
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";

interface RecallRow extends RowDataPacket {
  recall_id: number;
  recall_code: string;
  title: string;
  reason: string;
  status: string;
  started_at: string | Date | null;
}

interface RecallBatchRow extends RowDataPacket {
  recall_id: number;
  affected_quantity: number;
  quarantine_quantity: number;
  recovered_quantity: number;
  batch_id: number;
  batch_code: string;
  batch_status: string;
  manufacture_date: string | Date | null;
  expiry_date: string | Date | null;
  unit_cost: number;
  product_name: string;
  sku: string;
  category: string;
  supplier_id: number | null;
  supplier_name: string | null;
  contact_name: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_address: string | null;
}

interface InventoryRow extends RowDataPacket {
  batch_id: number;
  batch_code: string;
  warehouse_id: number | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  city: string | null;
  quantity_on_hand: number | null;
  quantity_reserved: number | null;
  quantity_quarantined: number | null;
  available_quantity: number | null;
}

interface ShipmentRow extends RowDataPacket {
  batch_id: number;
  batch_code: string;
  shipment_item_id: number;
  quantity_dispatched: number;
  quantity_received: number | null;
  discrepancy_notes: string | null;
  shipment_id: number;
  shipment_code: string;
  shipment_status: string;
  shipment_created_at: string | Date | null;
  dispatched_at: string | Date | null;
  delivered_at: string | Date | null;
  shipment_notes: string | null;
  source_warehouse: string | null;
  recipient_id: number | null;
  recipient_name: string | null;
  organization_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  delivery_address: string | null;
  city: string | null;
}

interface RecoveryRow extends RowDataPacket {
  recovery_id: number;
  batch_id: number;
  batch_code: string;
  quantity: number;
  action_type: string;
  notes: string | null;
  created_at: string | Date | null;
  warehouse_name: string | null;
  recipient_name: string | null;
  recorded_by_name: string | null;
}

export async function GET(request: Request) {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please log in." },
        { status: 401 }
      );
    }

    if (!["ADMIN", "QUALITY_STAFF"].includes(user.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Not allowed to view recall traceability.",
        },
        { status: 403 }
      );
    }

    const rawRecallId = new URL(request.url).searchParams.get("recallId");
    const recallId = Number(rawRecallId);

    if (
      !rawRecallId ||
      !Number.isSafeInteger(recallId) ||
      recallId <= 0
    ) {
      return NextResponse.json(
        { ok: false, message: "A valid recallId is required." },
        { status: 400 }
      );
    }

    const [recallRows] = await pool.execute<RecallRow[]>(
      `SELECT
         recall_id, recall_code, title, reason, status, started_at
       FROM recalls
       WHERE recall_id = ?`,
      [recallId]
    );

    if (recallRows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Recall not found." },
        { status: 404 }
      );
    }

    const [batches] = await pool.execute<RecallBatchRow[]>(
      `SELECT
         rb.recall_id,
         rb.affected_quantity,
         rb.quarantine_quantity,
         rb.recovered_quantity,
         b.batch_id,
         b.batch_code,
         b.status AS batch_status,
         b.manufacture_date,
         b.expiry_date,
         b.unit_cost,
         p.product_name,
         p.sku,
         p.category,
         s.supplier_id,
         s.supplier_name,
         s.contact_name,
         s.email AS supplier_email,
         s.phone AS supplier_phone,
         s.address AS supplier_address
       FROM recall_batches rb
       JOIN batches b ON b.batch_id = rb.batch_id
       JOIN products p ON p.product_id = b.product_id
       LEFT JOIN suppliers s ON s.supplier_id = b.supplier_id
       WHERE rb.recall_id = ?
       ORDER BY b.batch_code`,
      [recallId]
    );

    const [inventory] = await pool.execute<InventoryRow[]>(
      `SELECT
         i.batch_id,
         b.batch_code,
         w.warehouse_id,
         w.warehouse_code,
         w.warehouse_name,
         w.city,
         i.quantity_on_hand,
         i.quantity_reserved,
         i.quantity_quarantined,
         i.available_quantity
       FROM recall_batches rb
       JOIN batches b ON b.batch_id = rb.batch_id
       LEFT JOIN inventory i ON i.batch_id = b.batch_id
       LEFT JOIN warehouses w ON w.warehouse_id = i.warehouse_id
       WHERE rb.recall_id = ?
       ORDER BY b.batch_code, w.warehouse_name`,
      [recallId]
    );

    const [shipments] = await pool.execute<ShipmentRow[]>(
      `SELECT
         b.batch_id,
         b.batch_code,
         si.shipment_item_id,
         si.quantity_dispatched,
         si.quantity_received,
         si.discrepancy_notes,
         sh.shipment_id,
         sh.shipment_code,
         sh.status AS shipment_status,
         sh.created_at AS shipment_created_at,
         sh.dispatched_at,
         sh.delivered_at,
         sh.notes AS shipment_notes,
         w.warehouse_name AS source_warehouse,
         r.recipient_id,
         r.recipient_name,
         r.organization_name,
         r.email AS recipient_email,
         r.phone AS recipient_phone,
         r.delivery_address,
         r.city
       FROM recall_batches rb
       JOIN batches b ON b.batch_id = rb.batch_id
       JOIN shipment_items si ON si.batch_id = b.batch_id
       JOIN shipments sh ON sh.shipment_id = si.shipment_id
       LEFT JOIN recipients r ON r.recipient_id = sh.recipient_id
       LEFT JOIN warehouses w ON w.warehouse_id = sh.source_warehouse_id
       WHERE rb.recall_id = ?
         AND sh.status <> 'CANCELLED'
       ORDER BY sh.created_at DESC`,
      [recallId]
    );

    const [recoveries] = await pool.execute<RecoveryRow[]>(
      `SELECT
         rr.recovery_id,
         rr.batch_id,
         b.batch_code,
         rr.quantity,
         rr.action_type,
         rr.notes,
         rr.created_at,
         w.warehouse_name,
         r.recipient_name,
         u.full_name AS recorded_by_name
       FROM recall_recoveries rr
       JOIN batches b ON b.batch_id = rr.batch_id
       LEFT JOIN warehouses w ON w.warehouse_id = rr.warehouse_id
       LEFT JOIN recipients r ON r.recipient_id = rr.recipient_id
       LEFT JOIN app_users u ON u.user_id = rr.recorded_by
       WHERE rr.recall_id = ?
       ORDER BY rr.created_at DESC`,
      [recallId]
    );

    return NextResponse.json({
      ok: true,
      data: {
        recall: recallRows[0],
        batches,
        inventory,
        shipments,
        recoveries,
      },
    });
  } catch (error) {
    console.error("Recall trace API failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Could not load traceability. Check the server terminal.",
      },
      { status: 500 }
    );
  }
}
