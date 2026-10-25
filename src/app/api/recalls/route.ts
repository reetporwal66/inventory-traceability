
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please log in." },
        { status: 401 }
      );
    }

    const [recallRows] = await pool.query(`
      SELECT
        r.recall_id, r.recall_code, r.title, r.reason,
        r.severity, r.status, r.started_at, r.completed_at,
        COUNT(DISTINCT rb.batch_id) AS batch_count,
        COALESCE(SUM(rb.affected_quantity), 0) AS affected_quantity,
        COALESCE(SUM(rb.quarantine_quantity), 0) AS quarantine_quantity,
        COALESCE(SUM(rb.recovered_quantity), 0) AS recovered_quantity
      FROM recalls r
      LEFT JOIN recall_batches rb ON rb.recall_id = r.recall_id
      GROUP BY
        r.recall_id, r.recall_code, r.title, r.reason,
        r.severity, r.status, r.started_at, r.completed_at
      ORDER BY r.started_at DESC
    `);

    const [batchRows] = await pool.query(`
      SELECT
        b.batch_id,
        b.batch_code,
        b.status AS batch_status,
        p.product_name,
        p.sku
      FROM batches b
      JOIN products p ON p.product_id = b.product_id
      ORDER BY b.batch_code
    `);

    const [recoveryRows] = await pool.query(`
      SELECT
        rr.recovery_id,
        rr.recall_id,
        rr.batch_id,
        rr.warehouse_id,
        rr.recipient_id,
        rr.quantity,
        rr.action_type,
        rr.notes,
        rr.created_at,
        b.batch_code,
        p.product_name,
        w.warehouse_name,
        rec.recipient_name
      FROM recall_recoveries rr
      JOIN batches b ON b.batch_id = rr.batch_id
      JOIN products p ON p.product_id = b.product_id
      LEFT JOIN warehouses w ON w.warehouse_id = rr.warehouse_id
      LEFT JOIN recipients rec ON rec.recipient_id = rr.recipient_id
      ORDER BY rr.created_at DESC
    `);

    return NextResponse.json({
      ok: true,
      data: {
        recalls: recallRows,
        batches: batchRows,
        recoveries: recoveryRows,
      },
    });
  } catch (error) {
    console.error("Recalls GET failed:", error);

    return NextResponse.json(
      { ok: false, message: "Could not load recalls." },
      { status: 500 }
    );
  }
}

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
      { ok: false, message: "You are not allowed to initiate recalls." },
      { status: 403 }
    );
  }

  let body: {
    defectId?: unknown;
    title?: unknown;
    reason?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 }
    );
  }

  const defectId = Number(body.defectId);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (
    !Number.isSafeInteger(defectId) ||
    defectId <= 0 ||
    !title ||
    title.length > 180 ||
    !reason ||
    reason.length > 5000
  ) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid defect, title and reason." },
      { status: 400 }
    );
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [defectRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
         defect_id, defect_code, batch_id, description,
         affected_quantity, severity, status
       FROM defect_reports
       WHERE defect_id = ?
       FOR UPDATE`,
      [defectId]
    );

    const defect = defectRows[0];

    if (!defect) {
      await connection.rollback();

      return NextResponse.json(
        { ok: false, message: "Defect not found." },
        { status: 404 }
      );
    }

    if (defect.status !== "CONFIRMED") {
      await connection.rollback();

      return NextResponse.json(
        {
          ok: false,
          message: "Only confirmed defects can initiate recalls.",
        },
        { status: 409 }
      );
    }

    const [batchRows] = await connection.execute<RowDataPacket[]>(
      `SELECT batch_id, batch_code, status
       FROM batches
       WHERE batch_id = ?
       FOR UPDATE`,
      [defect.batch_id]
    );

    const batch = batchRows[0];

    if (!batch || batch.status !== "ACTIVE") {
      await connection.rollback();

      return NextResponse.json(
        { ok: false, message: "The affected batch is not active." },
        { status: 409 }
      );
    }

    const recallCode = `REC-${randomUUID()}`;

    const [recallResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO recalls
         (recall_code, title, reason, severity, status, initiated_by)
       VALUES (?, ?, ?, ?, 'OPEN', ?)`,
      [
        recallCode,
        title,
        `${reason}\nDefect: ${defect.defect_code}`,
        defect.severity,
        user.userId,
      ]
    );

    const recallId = recallResult.insertId;

    await connection.execute(
      `INSERT INTO recall_batches
         (recall_id, batch_id, affected_quantity, quarantine_quantity, notes)
       VALUES (?, ?, ?, 0, ?)`,
      [
        recallId,
        defect.batch_id,
        defect.affected_quantity,
        `Initiated from defect ${defect.defect_code}`,
      ]
    );

    await connection.execute(
      `UPDATE defect_reports
       SET status = 'RECALL_INITIATED'
       WHERE defect_id = ? AND status = 'CONFIRMED'`,
      [defectId]
    );

    await connection.execute(
      `UPDATE batches
       SET status = 'RECALLED'
       WHERE batch_id = ?`,
      [defect.batch_id]
    );

    await connection.commit();

    return NextResponse.json(
      {
        ok: true,
        message: "Recall initiated successfully.",
        data: {
          recallId,
          recallCode,
          defectId,
          batchCode: batch.batch_code,
          affectedQuantity: defect.affected_quantity,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    console.error("Recall creation failed:", error);

    return NextResponse.json(
      { ok: false, message: "Could not initiate recall." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
