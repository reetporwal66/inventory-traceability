
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

    const [rows] = await pool.query(`
      SELECT
        product_id AS productId,
        sku,
        product_name AS product,
        batch_id AS batchId,
        batch_code AS batch,
        expiry_date AS expiryDate,
        batch_status AS status,
        warehouse_id AS warehouseId,
        warehouse_code AS warehouseCode,
        warehouse_name AS warehouse,
        quantity_on_hand AS onHand,
        quantity_reserved AS reserved,
        available_quantity AS available
      FROM vw_inventory_overview
      ORDER BY product_name, batch_code, warehouse_name
    `);

    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    console.error("Inventory API failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not load inventory from MySQL." },
      { status: 500 }
    );
  }
}
