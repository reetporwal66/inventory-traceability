
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

const ACTION_TYPES = [
  "QUARANTINED",
  "RETURNED",
  "DESTROYED",
  "RELEASED",
] as const;

type ActionType = (typeof ACTION_TYPES)[number];

export async function POST(request: Request) {
  const user = await getSession();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Please log in." },
      { status: 401 }
    );
  }

  if (!["ADMIN", "QUALITY_STAFF"].includes(user.role)) {
    return NextResponse.json(
      { ok: false, message: "You are not allowed to record recovery." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 }
    );
  }

  const recallId = Number(body.recallId);
  const batchId = Number(body.batchId);
  const quantity = Number(body.quantity);

  const warehouseId =
    body.warehouseId == null || body.warehouseId === ""
      ? null
      : Number(body.warehouseId);

  const recipientId =
    body.recipientId == null || body.recipientId === ""
      ? null
      : Number(body.recipientId);

  const actionType = body.actionType;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (
    !Number.isSafeInteger(recallId) ||
    recallId <= 0 ||
    !Number.isSafeInteger(batchId) ||
    batchId <= 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    (warehouseId !== null &&
      (!Number.isSafeInteger(warehouseId) || warehouseId <= 0)) ||
    (recipientId !== null &&
      (!Number.isSafeInteger(recipientId) || recipientId <= 0)) ||
    typeof actionType !== "string" ||
    !ACTION_TYPES.includes(actionType as ActionType) ||
    notes.length > 500
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Enter valid recovery details. Notes must not exceed 500 characters.",
      },
      { status: 400 }
    );
  }

  const selectedAction = actionType as ActionType;

  // Quarantine and release must identify the physical warehouse.
  if (
    (selectedAction === "QUARANTINED" ||
      selectedAction === "RELEASED") &&
    warehouseId === null
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Select an active warehouse for quarantine or release.",
      },
      { status: 400 }
    );
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT
         rb.recall_id,
         rb.batch_id,
         rb.affected_quantity,
         rb.quarantine_quantity,
         rb.recovered_quantity,
         r.status AS recall_status
       FROM recall_batches rb
       JOIN recalls r ON r.recall_id = rb.recall_id
       WHERE rb.recall_id = ? AND rb.batch_id = ?
       FOR UPDATE`,
      [recallId, batchId]
    );

    const item = rows[0];

    if (!item) {
      await connection.rollback();

      return NextResponse.json(
        { ok: false, message: "Recall and batch combination not found." },
        { status: 404 }
      );
    }

    if (
      ["COMPLETED", "CLOSED", "CANCELLED"].includes(
        String(item.recall_status).toUpperCase()
      )
    ) {
      await connection.rollback();

      return NextResponse.json(
        { ok: false, message: "This recall is no longer active." },
        { status: 409 }
      );
    }

    const affected = Number(item.affected_quantity);
    const quarantined = Number(item.quarantine_quantity);
    const recovered = Number(item.recovered_quantity);

    let quarantineDelta = 0;
    let recoveredDelta = 0;

    if (
      selectedAction === "QUARANTINED" ||
      selectedAction === "RELEASED"
    ) {
      // warehouseId is guaranteed non-null by the validation above.
      const [warehouseRows] = await connection.execute<RowDataPacket[]>(
        `SELECT warehouse_id
         FROM warehouses
         WHERE warehouse_id = ? AND status = 'ACTIVE'
         FOR UPDATE`,
        [warehouseId]
      );

      if (warehouseRows.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          { ok: false, message: "The selected warehouse is not active or does not exist." },
          { status: 409 }
        );
      }

      const [inventoryRows] = await connection.execute<RowDataPacket[]>(
        `SELECT
           inventory_id,
           quantity_on_hand,
           quantity_reserved,
           quantity_quarantined,
           available_quantity
         FROM inventory
         WHERE batch_id = ? AND warehouse_id = ?
         FOR UPDATE`,
        [batchId, warehouseId]
      );

      const inventory = inventoryRows[0];

      if (!inventory) {
        await connection.rollback();

        return NextResponse.json(
          {
            ok: false,
            message: "No inventory record exists for this batch at the selected warehouse.",
          },
          { status: 409 }
        );
      }

      const inventoryQuarantined = Number(inventory.quantity_quarantined);

      if (selectedAction === "QUARANTINED") {
        if (quantity > affected - quarantined - recovered) {
          await connection.rollback();

          return NextResponse.json(
            {
              ok: false,
              message: "Quantity exceeds the remaining affected units.",
            },
            { status: 409 }
          );
        }

        if (quantity > Number(inventory.available_quantity)) {
          await connection.rollback();

          return NextResponse.json(
            {
              ok: false,
              message: "Insufficient available stock at the selected warehouse.",
            },
            { status: 409 }
          );
        }

        await connection.execute<ResultSetHeader>(
          `UPDATE inventory
           SET quantity_quarantined = quantity_quarantined + ?
           WHERE inventory_id = ?`,
          [quantity, inventory.inventory_id]
        );

        quarantineDelta = quantity;
      } else {
        if (quantity > quarantined) {
          await connection.rollback();

          return NextResponse.json(
            {
              ok: false,
              message: "Cannot release more units than are quarantined for this recall.",
            },
            { status: 409 }
          );
        }

        if (quantity > inventoryQuarantined) {
          await connection.rollback();

          return NextResponse.json(
            {
              ok: false,
              message: "The selected warehouse does not have enough quarantined stock to release.",
            },
            { status: 409 }
          );
        }

        await connection.execute<ResultSetHeader>(
          `UPDATE inventory
           SET quantity_quarantined = quantity_quarantined - ?
           WHERE inventory_id = ?`,
          [quantity, inventory.inventory_id]
        );

        quarantineDelta = -quantity;
      }
    } else {
      if (quantity > affected - recovered) {
        await connection.rollback();

        return NextResponse.json(
          {
            ok: false,
            message: "Quantity exceeds the remaining affected units.",
          },
          { status: 409 }
        );
      }

      recoveredDelta = quantity;

      // RETURNED and DESTROYED retain their existing behavior:
      // record the outcome and update the recall's recovered total.
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO recall_recoveries
        (recall_id, batch_id, warehouse_id, recipient_id,
         quantity, action_type, recorded_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recallId,
        batchId,
        warehouseId,
        recipientId,
        quantity,
        selectedAction,
        user.userId,
        notes || null,
      ]
    );

    await connection.execute<ResultSetHeader>(
      `UPDATE recall_batches
       SET quarantine_quantity = quarantine_quantity + ?,
           recovered_quantity = recovered_quantity + ?
       WHERE recall_id = ? AND batch_id = ?`,
      [quarantineDelta, recoveredDelta, recallId, batchId]
    );

    await connection.commit();

    return NextResponse.json(
      { ok: true, message: "Recovery action recorded successfully." },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    console.error("Recall recovery failed:", error);

    return NextResponse.json(
      { ok: false, message: "Could not record recovery." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
