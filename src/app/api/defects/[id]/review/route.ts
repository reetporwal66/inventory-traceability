import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;

  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Please sign in." }, { status: 401 });
    }

    if (!["ADMIN", "QUALITY_STAFF"].includes(user.role)) {
      return NextResponse.json({ ok: false, message: "Only Quality Staff or Admin can review defects." }, { status: 403 });
    }

    const { id } = await context.params;
    const defectId = Number(id);

    if (!Number.isSafeInteger(defectId) || defectId <= 0) {
      return NextResponse.json({ ok: false, message: "Invalid defect ID." }, { status: 400 });
    }

    const body = await request.json();
    const action = String(body.action ?? "");
    const notes = String(body.review_notes ?? "").trim();

    if (!["UNDER_REVIEW", "CONFIRMED", "REJECTED"].includes(action)) {
      return NextResponse.json({ ok: false, message: "Choose a valid review action." }, { status: 400 });
    }

    if (notes.length > 500 || (action === "REJECTED" && !notes)) {
      return NextResponse.json({ ok: false, message: "Rejection requires a reason; notes must be 500 characters or fewer." }, { status: 400 });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT defect_id, status, reported_by FROM defect_reports WHERE defect_id = ? FOR UPDATE",
      [defectId],
    );

    if (!rows.length) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: "Defect report not found." }, { status: 404 });
    }

    const defect = rows[0];

    if (!["REPORTED", "UNDER_REVIEW"].includes(defect.status)) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: "This defect has already been reviewed or closed." }, { status: 409 });
    }

    if (action === "CONFIRMED" && Number(defect.reported_by) === user.userId) {
      await connection.rollback();
      return NextResponse.json({ ok: false, message: "A reviewer cannot confirm their own defect report." }, { status: 403 });
    }

    await connection.query(
      `UPDATE defect_reports
       SET status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = NOW()
       WHERE defect_id = ?`,
      [action, user.userId, notes || null, defectId],
    );

    await connection.commit();

    return NextResponse.json({
      ok: true,
      message: "Defect status updated.",
      data: { defect_id: defectId, status: action },
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("Defect review failed:", error);
    return NextResponse.json({ ok: false, message: "Could not review the defect report." }, { status: 500 });
  } finally {
    connection?.release();
  }
}
