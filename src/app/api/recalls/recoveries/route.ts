
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
        message:
          "Enter valid recovery details. Notes must not exceed 500 characters.",
      },
      { status: 400 }
    );
  }

  const selectedAction = actionType as ActionType;

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
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();

    // QUARANTINED is handled entirely by the stored procedure.
    // The procedure manages its own transaction.
    if (selectedAction === "QUARANTINED") {
      await connection.execute(
        `CALL sp_record_quarantine(?, ?, ?, ?, ?, ?, ?)`,
        [
          recallId,
          batchId,
          warehouseId,
          recipientId,
          quantity,
          user.userId,
          notes || null,
        ]
      );

      return NextResponse.json(
        { ok: true, message: "Recovery action recorded successfully." },
        { status: 201 }
      );
    }

    // Other recovery actions retain their existing API transaction.
    await connection.beginTransaction();
    transactionStarted = true;

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
      transactionStarted = false;

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
      transactionStarted = false;

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

    if (selectedAction === "RELEASED") {
      const [warehouseRows] = await connection.execute<RowDataPacket[]>(
        `SELECT warehouse_id
         FROM warehouses
         WHERE warehouse_id = ? AND status = 'ACTIVE'
         FOR UPDATE`,
        [warehouseId]
      );

      if (warehouseRows.length === 0) {
        await connection.rollback();
        transactionStarted = false;

        return NextResponse.json(
          {
            ok: false,
            message: "The selected warehouse is not active or does not exist.",
          },
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
        transactionStarted = false;

        return NextResponse.json(
          {
            ok: false,
            message:
              "No inventory record exists for this batch at the selected warehouse.",
          },
          { status: 409 }
        );
      }

      const inventoryQuarantined = Number(inventory.quantity_quarantined);

      if (quantity > quarantined) {
        await connection.rollback();
        transactionStarted = false;

        return NextResponse.json(
          {
            ok: false,
            message:
              "Cannot release more units than are quarantined for this recall.",
          },
          { status: 409 }
        );
      }

      if (quantity > inventoryQuarantined) {
        await connection.rollback();
        transactionStarted = false;

        return NextResponse.json(
          {
            ok: false,
            message:
              "The selected warehouse does not have enough quarantined stock to release.",
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
    } else {
      // RETURNED and DESTROYED retain their existing behavior.
      if (quantity > affected - recovered) {
        await connection.rollback();
        transactionStarted = false;

        return NextResponse.json(
          {
            ok: false,
            message: "Quantity exceeds the remaining affected units.",
          },
          { status: 409 }
        );
      }

      recoveredDelta = quantity;
    }

    const [recoveryResult] = await connection.execute<ResultSetHeader>(
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

    await connection.execute<ResultSetHeader>(
      `INSERT INTO event_outbox
         (event_type, aggregate_type, aggregate_id, payload)
       VALUES (?, ?, ?, ?)`,
      [
        "RECALL_RECOVERY_RECORDED",
        "RECALL",
        recallId,
        JSON.stringify({
          recall_id: recallId,
          recovery_id: recoveryResult.insertId,
          batch_id: batchId,
          warehouse_id: warehouseId,
          recipient_id: recipientId,
          quantity,
          action_type: selectedAction,
          actor_id: user.userId,
          notes: notes || null,
        }),
      ]
    );

    await connection.commit();
    transactionStarted = false;

    return NextResponse.json(
      { ok: true, message: "Recovery action recorded successfully." },
      { status: 201 }
    );
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback().catch(() => undefined);
    }

    console.error("Recall recovery failed:", error);

    const dbError = error as {
      code?: string;
      errno?: number;
      sqlMessage?: string;
    };

    if (
      dbError.code === "ER_SIGNAL_EXCEPTION" ||
      dbError.errno === 1644
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: dbError.sqlMessage || "The recovery action could not be completed.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, message: "Could not record recovery." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
