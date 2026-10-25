
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const [lowStockRows] = await pool.query(`
      SELECT COUNT(*) AS count FROM vw_low_stock
    `);

    const [recallRows] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM recalls
      WHERE status IN ('OPEN', 'IN_PROGRESS')
    `);

    return NextResponse.json({
      ok: true,
      data: {
        lowStockCount: Number(
          (lowStockRows as { count: number }[])[0]?.count ?? 0
        ),
        openRecallCount: Number(
          (recallRows as { count: number }[])[0]?.count ?? 0
        ),
      },
    });
  } catch (error) {
    console.error("Dashboard summary API failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not load dashboard summary from MySQL." },
      { status: 500 }
    );
  }
}
