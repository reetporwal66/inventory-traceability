
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
    !Number.isSafeInteger(recallId) || recallId <= 0 ||
    !Number.isSafeInteger(batchId) || batchId <= 0 ||
    !Number.isSafeInteger(quantity) || quantity <= 0 ||
    (warehouseId !== null &&
      (!Number.isSafeInteger(warehouseId) || warehouseId <= 0)) ||
    (recipientId !== null &&
      (!Number.isSafeInteger(recipientId) || recipientId <= 0)) ||
    typeof actionType !== "string" ||
    !ACTION_TYPES.includes(actionType as (typeof ACTION_TYPES)[number]) ||
    notes.length > 2000
  ) {
    return NextResponse.json(
      { ok: false, message: "Enter valid recovery details." },
      { status: 400 }
    );
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT
         rb.recall_id, rb.batch_id,
         rb.affected_quantity, rb.quarantine_quantity,
         rb.recovered_quantity, r.status AS recall_status
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

    if (["COMPLETED", "CLOSED", "CANCELLED"].includes(
      String(item.recall_status).toUpperCase()
    )) {
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

    if (actionType === "QUARANTINED") {
      if (quantity > affected - quarantined - recovered) {
        await connection.rollback();
        return NextResponse.json(
          { ok: false, message: "Quantity exceeds the remaining affected units." },
          { status: 409 }
        );
      }
      quarantineDelta = quantity;
    } else if (actionType === "RELEASED") {
      if (quantity > quarantined) {
        await connection.rollback();
        return NextResponse.json(
          { ok: false, message: "Cannot release more units than are quarantined." },
          { status: 409 }
        );
      }
      quarantineDelta = -quantity;
    } else {
      if (quantity > affected - recovered) {
        await connection.rollback();
        return NextResponse.json(
          { ok: false, message: "Quantity exceeds the remaining affected units." },
          { status: 409 }
        );
      }
      recoveredDelta = quantity;

      if (actionType === "RETURNED" || actionType === "DESTROYED") {
        // Returned/destroyed units are counted as recovered.
      }
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO recall_recoveries
        (recall_id, batch_id, warehouse_id, recipient_id,
         quantity, action_type, recorded_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recallId, batchId, warehouseId, recipientId,
        quantity, actionType, user.userId, notes || null,
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
