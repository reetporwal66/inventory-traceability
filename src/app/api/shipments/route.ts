
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

type ShipmentBody = {
  shipmentCode?: string;
  recipientId?: number | string;
  warehouseId?: number | string;
  batchId?: number | string;
  quantity?: number | string;
  notes?: string;
};

type InventoryRow = RowDataPacket & {
  available_quantity: number;
};

function validId(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const [shipmentRows] = await pool.query(`
      SELECT
        s.shipment_id,
        s.shipment_code,
        s.recipient_id,
        s.source_warehouse_id,
        s.status,
        s.dispatched_at,
        s.delivered_at,
        s.notes,
        s.created_at,
        r.recipient_name,
        r.organization_name,
        r.delivery_address,
        r.city,
        w.warehouse_name AS source_warehouse_name,
        COUNT(si.shipment_item_id) AS item_count,
        COALESCE(SUM(si.quantity_dispatched), 0) AS total_quantity
      FROM shipments s
      JOIN recipients r ON r.recipient_id = s.recipient_id
      JOIN warehouses w ON w.warehouse_id = s.source_warehouse_id
      LEFT JOIN shipment_items si ON si.shipment_id = s.shipment_id
      GROUP BY
        s.shipment_id,
        s.shipment_code,
        s.recipient_id,
        s.source_warehouse_id,
        s.status,
        s.dispatched_at,
        s.delivered_at,
        s.notes,
        s.created_at,
        r.recipient_name,
        r.organization_name,
        r.delivery_address,
        r.city,
        w.warehouse_name
      ORDER BY s.created_at DESC
    `);

    const [recipientRows] = await pool.query(`
      SELECT
        recipient_id,
        recipient_name,
        organization_name,
        delivery_address,
        city
      FROM recipients
      ORDER BY recipient_name
    `);

    const [warehouseRows] = await pool.query(`
      SELECT warehouse_id, warehouse_name, warehouse_code
      FROM warehouses
      WHERE status = 'ACTIVE'
      ORDER BY warehouse_name
    `);

    const [batchRows] = await pool.query(`
      SELECT
        i.batch_id,
        i.warehouse_id,
        b.batch_code,
        p.sku,
        p.product_name,
        w.warehouse_name,
        i.available_quantity
      FROM inventory i
      JOIN batches b ON b.batch_id = i.batch_id
      JOIN products p ON p.product_id = b.product_id
      JOIN warehouses w ON w.warehouse_id = i.warehouse_id
      WHERE b.status = 'ACTIVE'
        AND w.status = 'ACTIVE'
        AND i.available_quantity > 0
      ORDER BY p.product_name, w.warehouse_name
    `);

    return NextResponse.json({
      ok: true,
      data: {
        shipments: shipmentRows,
        recipients: recipientRows,
        warehouses: warehouseRows,
        batches: batchRows,
      },
    });
  } catch (error) {
    console.error("Shipments GET failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not load shipments from MySQL." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;

  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    if (user.role === "QUALITY_STAFF") {
      return NextResponse.json(
        { ok: false, message: "Your role cannot create shipments." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ShipmentBody;

    const shipmentCode =
      typeof body.shipmentCode === "string"
        ? body.shipmentCode.trim()
        : "";

    const recipientId = validId(body.recipientId);
    const warehouseId = validId(body.warehouseId);
    const batchId = validId(body.batchId);
    const quantity = validId(body.quantity);
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (
      !shipmentCode ||
      shipmentCode.length > 80 ||
      !recipientId ||
      !warehouseId ||
      !batchId ||
      !quantity ||
      notes.length > 500
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Provide a shipment code (up to 80 characters), valid recipient, warehouse, batch, positive quantity and notes up to 500 characters.",
        },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [recipients] = await connection.query<RowDataPacket[]>(
      "SELECT recipient_id FROM recipients WHERE recipient_id = ? FOR UPDATE",
      [recipientId]
    );

    if (recipients.length === 0) {
      throw Object.assign(new Error("Recipient not found."), {
        statusCode: 400,
      });
    }

    const [warehouses] = await connection.query<RowDataPacket[]>(
      `SELECT warehouse_id FROM warehouses
       WHERE warehouse_id = ? AND status = 'ACTIVE'
       FOR UPDATE`,
      [warehouseId]
    );

    if (warehouses.length === 0) {
      throw Object.assign(new Error("Choose an active source warehouse."), {
        statusCode: 400,
      });
    }

    const [batches] = await connection.query<RowDataPacket[]>(
      `SELECT batch_id FROM batches
       WHERE batch_id = ? AND status = 'ACTIVE'
       FOR UPDATE`,
      [batchId]
    );

    if (batches.length === 0) {
      throw Object.assign(new Error("The batch is not active."), {
        statusCode: 409,
      });
    }

    const [inventoryRows] = await connection.query<InventoryRow[]>(
      `SELECT available_quantity FROM inventory
       WHERE batch_id = ? AND warehouse_id = ?
       FOR UPDATE`,
      [batchId, warehouseId]
    );

    if (inventoryRows.length === 0) {
      throw Object.assign(
        new Error(
          "No inventory record exists for this batch at the selected warehouse."
        ),
        { statusCode: 409 }
      );
    }

    if (Number(inventoryRows[0].available_quantity) < quantity) {
      throw Object.assign(new Error("Insufficient available stock."), {
        statusCode: 409,
      });
    }

    const [shipmentResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO shipments
        (shipment_code, recipient_id, source_warehouse_id, status, notes, created_by)
       VALUES (?, ?, ?, 'PREPARING', ?, ?)`,
      [shipmentCode, recipientId, warehouseId, notes || null, user.userId]
    );

    await connection.execute(
      `INSERT INTO shipment_items
        (shipment_id, batch_id, quantity_dispatched)
       VALUES (?, ?, ?)`,
      [shipmentResult.insertId, batchId, quantity]
    );

    const [inventoryUpdate] = await connection.execute<ResultSetHeader>(
      `UPDATE inventory
       SET quantity_on_hand = quantity_on_hand - ?
       WHERE batch_id = ?
         AND warehouse_id = ?
         AND available_quantity >= ?`,
      [quantity, batchId, warehouseId, quantity]
    );

    if (inventoryUpdate.affectedRows !== 1) {
      throw Object.assign(
        new Error("Stock changed while creating the shipment. Please retry."),
        { statusCode: 409 }
      );
    }

    await connection.commit();

    return NextResponse.json(
      {
        ok: true,
        message: "Shipment created and stock updated successfully.",
        data: { shipmentId: shipmentResult.insertId },
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Shipment rollback failed:", rollbackError);
      });
    }

    const err = error as Error & {
      statusCode?: number;
      code?: string;
    };

    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        {
          ok: false,
          message: "That shipment code already exists. Use a unique code.",
        },
        { status: 409 }
      );
    }

    if (err.statusCode) {
      return NextResponse.json(
        { ok: false, message: err.message },
        { status: err.statusCode }
      );
    }

    console.error("Shipment POST failed:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Could not create shipment. The transaction was rolled back.",
      },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
