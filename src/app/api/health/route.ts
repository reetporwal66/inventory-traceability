
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";

export async function GET() {
  try {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query(
        "SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion"
      );

      return NextResponse.json({
        ok: true,
        message: "MySQL connection successful",
        data: rows,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("MySQL health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Could not connect to MySQL. Check server configuration.",
      },
      { status: 503 }
    );
  }
}
