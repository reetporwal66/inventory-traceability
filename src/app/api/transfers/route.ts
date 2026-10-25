
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";

interface TransferRow extends RowDataPacket {
  transfer_id: number;
  batch_id: number;
  source_warehouse_id: number;
  destination_warehouse_id: number;
  quantity: number;
  status: string;
  initiated_by: number;
  notes: string | null;
  created_at: Date;
  sku: string;
  product_name: string;
  batch_code: string;
  source_name: string;
  destination_name: string;
}

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Please sign in." },
        { status: 401 }
      );
    }

    const [transfers] = await pool.query<TransferRow[]>(`
      SELECT
        st.transfer_id,
        st.batch_id,
        st.source_warehouse_id,
        st.destination_warehouse_id,
        st.quantity,
        st.status,
        st.initiated_by,
        st.notes,
        st.created_at,
        p.sku,
        p.product_name,
        b.batch_code,
        sw.warehouse_name AS source_name,
        dw.warehouse_name AS destination_name
      FROM stock_transfers st
      JOIN batches b ON b.batch_id = st.batch_id
      JOIN products p ON p.product_id = b.product_id
      JOIN warehouses sw ON sw.warehouse_id = st.source_warehouse_id
      JOIN warehouses dw ON dw.warehouse_id = st.destination_warehouse_id
      ORDER BY st.transfer_id DESC
      LIMIT 100
    `);

    const [batches] = await pool.query<RowDataPacket[]>(`
      SELECT
        b.batch_id AS id,
        b.batch_code,
        p.sku,
        p.product_name,
        b.status,
        b.expiry_date
      FROM batches b
      JOIN products p ON p.product_id = b.product_id
      ORDER BY b.batch_id
    `);

    const [inventoryRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        i.batch_id,
        i.warehouse_id AS id,
        w.warehouse_name AS name,
        i.available_quantity AS available
      FROM inventory i
      JOIN warehouses w ON w.warehouse_id = i.warehouse_id
      WHERE w.status = 'ACTIVE'
      ORDER BY w.warehouse_name
    `);

    const [warehouses] = await pool.query<RowDataPacket[]>(`
      SELECT
        warehouse_id AS id,
        warehouse_code,
        warehouse_name
      FROM warehouses
      WHERE status = 'ACTIVE'
      ORDER BY warehouse_name
    `);

    const batchesWithLocations = batches.map((batch) => ({
      ...batch,
      locations: inventoryRows
        .filter(
          (row) => Number(row.batch_id) === Number(batch.id)
        )
        .map((row) => ({
          id: Number(row.id),
          name: String(row.name),
          available: Number(row.available),
        })),
    }));

    return NextResponse.json({
      ok: true,
      data: {
        transfers,
        batches: batchesWithLocations,
        warehouses,
      },
    });
  } catch (error) {
    console.error("GET /api/transfers:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load transfer data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let connection:
    | Awaited<ReturnType<typeof pool.getConnection>>
    | undefined;

  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Please sign in." },
        { status: 401 }
      );
    }

    if (user.role === "QUALITY_STAFF") {
      return NextResponse.json(
        { ok: false, error: "Your role cannot transfer stock." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const batchId = Number(body.batchId);
    const sourceWarehouseId = Number(body.sourceWarehouseId);
    const destinationWarehouseId = Number(body.destinationWarehouseId);
    const quantity = Number(body.quantity);
    const notes =
      typeof body.notes === "string" ? body.notes.trim() : "";

    if (
      !Number.isSafeInteger(batchId) ||
      batchId <= 0 ||
      !Number.isSafeInteger(sourceWarehouseId) ||
      sourceWarehouseId <= 0 ||
      !Number.isSafeInteger(destinationWarehouseId) ||
      destinationWarehouseId <= 0 ||
      sourceWarehouseId === destinationWarehouseId ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      notes.length > 500
    ) {
      return NextResponse.json(
        { ok: false, error: "Please provide valid transfer details." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();

    const [batchRows] = await connection.query<RowDataPacket[]>(
      "SELECT status FROM batches WHERE batch_id = ?",
      [batchId]
    );

    if (batchRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "The selected batch does not exist." },
        { status: 404 }
      );
    }

    if (batchRows[0].status !== "ACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          error: "Only ACTIVE batches can be transferred.",
        },
        { status: 400 }
      );
    }

    const [sourceRows] = await connection.query<RowDataPacket[]>(
      `SELECT warehouse_id FROM warehouses
       WHERE warehouse_id = ? AND status = 'ACTIVE'`,
      [sourceWarehouseId]
    );

    const [destinationRows] = await connection.query<RowDataPacket[]>(
      `SELECT warehouse_id FROM warehouses
       WHERE warehouse_id = ? AND status = 'ACTIVE'`,
      [destinationWarehouseId]
    );

    if (!sourceRows.length || !destinationRows.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Both warehouses must exist and be active.",
        },
        { status: 400 }
      );
    }

    await connection.query(
      "CALL sp_transfer_stock(?, ?, ?, ?, ?, ?)",
      [
        batchId,
        sourceWarehouseId,
        destinationWarehouseId,
        quantity,
        user.userId,
        notes || null,
      ]
    );

    return NextResponse.json({
      ok: true,
      message: "Stock transfer completed successfully.",
    });
  } catch (error) {
    console.error("POST /api/transfers:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete stock transfer.",
      },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
