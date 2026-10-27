import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 },
      );
    }

    const [rows] = await pool.query(`
      SELECT
        d.defect_id, d.defect_code, d.batch_id, b.batch_code,
        p.product_name, d.defect_type, d.description,
        d.affected_quantity, d.severity, d.status, d.reported_by,
        reporter.full_name AS reporter_name,
        reviewer.full_name AS reviewer_name,
        d.review_notes, d.created_at, d.reviewed_at
      FROM defect_reports d
      JOIN batches b ON b.batch_id = d.batch_id
      JOIN products p ON p.product_id = b.product_id
      LEFT JOIN app_users reporter ON reporter.user_id = d.reported_by
      LEFT JOIN app_users reviewer ON reviewer.user_id = d.reviewed_by
      ORDER BY d.created_at DESC
    `);

    const [batches] = await pool.query(`
      SELECT b.batch_id, b.batch_code, b.status AS batch_status,
             p.product_name, p.sku
      FROM batches b
      JOIN products p ON p.product_id = b.product_id
      ORDER BY b.batch_code
    `);

    return NextResponse.json({
      ok: true,
      data: { defects: rows, batches },
    });
  } catch (error) {
    console.error("Defects GET failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not load defect reports." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;

  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 },
      );
    }

    if (!["ADMIN", "INVENTORY_STAFF"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, message: "Your role cannot submit defect reports." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const batchId = Number(body.batch_id);
    const affectedQuantity = Number(body.affected_quantity);
    const reportedBy = user.userId;

    const allowedTypes = [
      "CONTAMINATION",
      "DAMAGED_PACKAGING",
      "QUALITY_FAILURE",
      "EXPIRY_ISSUE",
      "LABELING_ERROR",
      "OTHER",
    ];

    const allowedSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const defectType = String(body.defect_type ?? "");
    const severity = String(body.severity ?? "MEDIUM");
    const description = String(body.description ?? "").trim();

    if (!Number.isSafeInteger(batchId) || batchId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Select a valid batch." },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(affectedQuantity) || affectedQuantity <= 0) {
      return NextResponse.json(
        { ok: false, message: "Affected quantity must be a positive whole number." },
        { status: 400 },
      );
    }

    if (!allowedTypes.includes(defectType)) {
      return NextResponse.json(
        { ok: false, message: "Select a valid defect type." },
        { status: 400 },
      );
    }

    if (!allowedSeverities.includes(severity)) {
      return NextResponse.json(
        { ok: false, message: "Select a valid severity." },
        { status: 400 },
      );
    }

    if (description.length < 5 || description.length > 5000) {
      return NextResponse.json(
        { ok: false, message: "Description must contain 5-5000 characters." },
        { status: 400 },
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [batchRows] = await connection.query<RowDataPacket[]>(
      `SELECT batch_id, batch_code, status
       FROM batches WHERE batch_id = ? FOR UPDATE`,
      [batchId],
    );

    if (!batchRows.length) {
      await connection.rollback();
      return NextResponse.json(
        { ok: false, message: "Batch not found." },
        { status: 404 },
      );
    }

    if (batchRows[0].status !== "ACTIVE") {
      await connection.rollback();
      return NextResponse.json(
        {
          ok: false,
          message: `Only ACTIVE batches can receive new defect reports. This batch is ${batchRows[0].status}.`,
        },
        { status: 409 },
      );
    }

    const [userRows] = await connection.query<RowDataPacket[]>(
      `SELECT user_id FROM app_users
       WHERE user_id = ? AND is_active = 1`,
      [reportedBy],
    );

    if (!userRows.length) {
      await connection.rollback();
      return NextResponse.json(
        { ok: false, message: "Your account is no longer active." },
        { status: 401 },
      );
    }

    const defectCode =
      `DEF-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO defect_reports
       (defect_code, batch_id, defect_type, description,
        affected_quantity, severity, status, reported_by)
       VALUES (?, ?, ?, ?, ?, ?, 'REPORTED', ?)`,
      [
        defectCode,
        batchId,
        defectType,
        description,
        affectedQuantity,
        severity,
        reportedBy,
      ],
    );

    await connection.commit();

    return NextResponse.json(
      {
        ok: true,
        message: "Defect report submitted for review.",
        data: {
          defect_id: result.insertId,
          defect_code: defectCode,
          batch_code: batchRows[0].batch_code,
          status: "REPORTED",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("Defects POST failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not submit the defect report." },
      { status: 500 },
    );
  } finally {
    connection?.release();
  }
}
