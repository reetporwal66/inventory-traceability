
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import pool from "@/lib/db/mysql";
import { MongoClient, type Document } from "mongodb";
import type { RowDataPacket } from "mysql2";

type EventPayload = Record<string, unknown>;

type TimelineEvent = {
  event_id: string;
  event_type: string;
  payload: EventPayload;
  created_at: string | Date | null;
};

interface RecallRow extends RowDataPacket {
  recall_id: number;
  recall_code: string;
  title: string;
  reason: string;
  severity: string;
  status: string;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  initiated_by: number;
}

interface BatchRow extends RowDataPacket {
  batch_id: number;
  affected_quantity: number;
  quarantine_quantity: number;
  recovered_quantity: number;
  batch_code: string;
  batch_status: string;
  product_name: string;
  sku: string;
  supplier_name: string | null;
  contact_name: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_address: string | null;
}

interface DefectRow extends RowDataPacket {
  defect_id: number;
  defect_code: string;
  defect_type: string;
  description: string;
  affected_quantity: number;
  severity: string;
  status: string;
  created_at: string | Date | null;
  batch_id: number;
  batch_code: string;
  product_name: string;
}

interface ShipmentRow extends RowDataPacket {
  shipment_item_id: number;
  quantity_dispatched: number;
  quantity_received: number | null;
  discrepancy_notes: string | null;
  shipment_id: number;
  shipment_code: string;
  shipment_status: string;
  created_at: string | Date | null;
  dispatched_at: string | Date | null;
  delivered_at: string | Date | null;
  shipment_notes: string | null;
  batch_code: string;
  product_name: string;
  source_warehouse: string | null;
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
  quantity: number;
  action_type: string;
  notes: string | null;
  created_at: string | Date | null;
  batch_code: string;
  product_name: string;
  warehouse_name: string | null;
  recipient_name: string | null;
  recorded_by_name: string | null;
}

interface MongoTimelineDocument extends Document {
  event_id?: string | number;
  event_type?: string;
  aggregate_type?: string;
  aggregate_id?: number;
  payload?: unknown;
  source_created_at?: string | Date | null;
  created_at?: string | Date | null;
}

function asDate(value: unknown): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const date = new Date(
    value instanceof Date || typeof value === "string" ||
      typeof value === "number"
      ? value
      : String(value)
  ).getTime();

  return Number.isNaN(date) ? 0 : date;
}

function toPayload(value: unknown): EventPayload {
  if (typeof value === "string") {
    try {
      return toPayload(JSON.parse(value) as unknown);
    } catch {
      return { raw_payload: value };
    }
  }

  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as EventPayload;
  }

  return {};
}

function getRecoveryId(payload: unknown): number {
  const normalized = toPayload(payload);
  const value = Number(normalized.recovery_id);

  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export async function GET(request: Request) {
  let mongo: MongoClient | undefined;

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
        { ok: false, message: "Not allowed to view recall history." },
        { status: 403 }
      );
    }

    const recallId = Number(
      new URL(request.url).searchParams.get("recallId")
    );

    if (!Number.isSafeInteger(recallId) || recallId <= 0) {
      return NextResponse.json(
        { ok: false, message: "A valid recallId is required." },
        { status: 400 }
      );
    }

    const [recallRows] = await pool.execute<RecallRow[]>(
      `SELECT
         recall_id, recall_code, title, reason, severity, status,
         started_at, completed_at, initiated_by
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

    const recall = recallRows[0];
    const timeline: TimelineEvent[] = [];

    const addEvent = (
      event_id: string,
      event_type: string,
      payload: EventPayload,
      created_at: string | Date | null
    ) => {
      timeline.push({ event_id, event_type, payload, created_at });
    };

    // MySQL is the source of truth for recall and batch details.
    const [batchRows] = await pool.execute<BatchRow[]>(
      `SELECT
         rb.batch_id,
         rb.affected_quantity,
         rb.quarantine_quantity,
         rb.recovered_quantity,
         b.batch_code,
         b.status AS batch_status,
         p.product_name,
         p.sku,
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

    for (const batch of batchRows) {
      addEvent(
        `supplier-${batch.batch_id}`,
        "SUPPLIER_BATCH",
        {
          title: "Supplier and affected batch",
          ...batch,
        },
        recall.started_at
      );
    }

    // Only include defects currently marked as initiating a recall.
    const [defectRows] = await pool.execute<DefectRow[]>(
      `SELECT
         d.defect_id,
         d.defect_code,
         d.defect_type,
         d.description,
         d.affected_quantity,
         d.severity,
         d.status,
         d.created_at,
         b.batch_id,
         b.batch_code,
         p.product_name
       FROM recall_batches rb
       JOIN batches b ON b.batch_id = rb.batch_id
       JOIN products p ON p.product_id = b.product_id
       JOIN defect_reports d ON d.batch_id = b.batch_id
       WHERE rb.recall_id = ?
         AND d.status = 'RECALL_INITIATED'
       ORDER BY d.created_at DESC`,
      [recallId]
    );

    for (const defect of defectRows) {
      addEvent(
        `defect-${defect.defect_id}`,
        "DEFECT_REPORTED",
        {
          title: "Recall-initiating defect report",
          ...defect,
        },
        defect.created_at
      );
    }

    // These shipments are associated with affected batches.
    // Their presence does not prove the recall caused dispatch.
    const [shipmentRows] = await pool.execute<ShipmentRow[]>(
      `SELECT
         si.shipment_item_id,
         si.quantity_dispatched,
         si.quantity_received,
         si.discrepancy_notes,
         sh.shipment_id,
         sh.shipment_code,
         sh.status AS shipment_status,
         sh.created_at,
         sh.dispatched_at,
         sh.delivered_at,
         sh.notes AS shipment_notes,
         b.batch_code,
         p.product_name,
         w.warehouse_name AS source_warehouse,
         r.recipient_name,
         r.organization_name,
         r.email AS recipient_email,
         r.phone AS recipient_phone,
         r.delivery_address,
         r.city
       FROM recall_batches rb
       JOIN batches b ON b.batch_id = rb.batch_id
       JOIN products p ON p.product_id = b.product_id
       JOIN shipment_items si ON si.batch_id = b.batch_id
       JOIN shipments sh ON sh.shipment_id = si.shipment_id
       LEFT JOIN warehouses w
         ON w.warehouse_id = sh.source_warehouse_id
       LEFT JOIN recipients r
         ON r.recipient_id = sh.recipient_id
       WHERE rb.recall_id = ?
         AND sh.status <> 'CANCELLED'
       ORDER BY sh.created_at DESC`,
      [recallId]
    );

    for (const shipment of shipmentRows) {
      addEvent(
        `shipment-${shipment.shipment_item_id}`,
        "DISPATCH_RECORDED",
        {
          title: "Shipment associated with affected batch",
          ...shipment,
        },
        shipment.dispatched_at || shipment.created_at
      );
    }

    // MySQL recovery records remain visible even if their MongoDB
    // events were never delivered.
    const [recoveryRows] = await pool.execute<RecoveryRow[]>(
      `SELECT
         rr.recovery_id,
         rr.batch_id,
         rr.quantity,
         rr.action_type,
         rr.notes,
         rr.created_at,
         b.batch_code,
         p.product_name,
         w.warehouse_name,
         r.recipient_name,
         u.full_name AS recorded_by_name
       FROM recall_recoveries rr
       JOIN batches b ON b.batch_id = rr.batch_id
       JOIN products p ON p.product_id = b.product_id
       LEFT JOIN warehouses w ON w.warehouse_id = rr.warehouse_id
       LEFT JOIN recipients r ON r.recipient_id = rr.recipient_id
       LEFT JOIN app_users u ON u.user_id = rr.recorded_by
       WHERE rr.recall_id = ?
       ORDER BY rr.created_at DESC`,
      [recallId]
    );

    let mongoEvents: MongoTimelineDocument[] = [];
    let mongoWarning: string | null = null;

    if (
      process.env.MONGODB_URI &&
      process.env.MONGODB_DATABASE &&
      process.env.MONGODB_COLLECTION
    ) {
      try {
        mongo = new MongoClient(process.env.MONGODB_URI);
        await mongo.connect();

        mongoEvents = await mongo
          .db(process.env.MONGODB_DATABASE)
          .collection<MongoTimelineDocument>(
            process.env.MONGODB_COLLECTION
          )
          .find({
            aggregate_type: "RECALL",
            aggregate_id: recallId,
            event_type: {
              $in: [
                "RECALL_INITIATED",
                "RECALL_RECOVERY_RECORDED",
              ],
            },
          })
          .sort({ event_id: 1 })
          .limit(200)
          .toArray();
      } catch (error) {
        console.error("MongoDB recall timeline read failed:", error);
        mongoWarning =
          "MongoDB event history is temporarily unavailable. Showing available MySQL records.";
      } finally {
        await mongo?.close().catch(() => undefined);
        mongo = undefined;
      }
    } else {
      mongoWarning =
        "MongoDB configuration is missing. Showing available MySQL records.";
    }

    const hasInitiationEvent = mongoEvents.some(
      (event) => event.event_type === "RECALL_INITIATED"
    );

    // Provide a MySQL-backed milestone for older recalls without
    // a corresponding MongoDB initiation event.
    if (!hasInitiationEvent) {
      addEvent(
        `recall-mysql-${recallId}`,
        "RECALL_RECORD",
        {
          title: recall.title,
          reason: recall.reason,
          recall_code: recall.recall_code,
          status: recall.status,
          severity: recall.severity,
          historical_event_missing: true,
          message:
            "Recall exists in MySQL, but its original MongoDB initiation event was not found.",
        },
        recall.started_at
      );
    }

    for (const event of mongoEvents) {
      addEvent(
        `mongo-${String(event.event_id ?? "unknown")}`,
        event.event_type ?? "UNKNOWN_EVENT",
        toPayload(event.payload),
        event.source_created_at ?? event.created_at ?? null
      );
    }

    const mongoRecoveryIds = new Set(
      mongoEvents
        .filter(
          (event) =>
            event.event_type === "RECALL_RECOVERY_RECORDED"
        )
        .map((event) => getRecoveryId(event.payload))
        .filter((id) => id > 0)
    );

    // Add MySQL recovery actions only if their ID is not already
    // represented in MongoDB.
    for (const recovery of recoveryRows) {
      if (mongoRecoveryIds.has(Number(recovery.recovery_id))) {
        continue;
      }

      addEvent(
        `recovery-mysql-${recovery.recovery_id}`,
        "RECALL_RECOVERY_RECORDED",
        {
          title: "Recovery action (MySQL record)",
          ...recovery,
          historical_event_missing: true,
        },
        recovery.created_at
      );
    }

    // Do not invent a shipment when no shipment item exists.
    if (shipmentRows.length === 0) {
      addEvent(
        `dispatch-missing-${recallId}`,
        "DISPATCH_STATUS",
        {
          title: "Dispatch traceability",
          message:
            "No shipment item linked to this recall's affected batch was found. This does not prove that no dispatch occurred.",
        },
        recall.started_at
      );
    }

    timeline.sort(
      (a, b) => asDate(a.created_at) - asDate(b.created_at)
    );

    return NextResponse.json({
      ok: true,
      data: timeline,
      meta: {
        recall,
        mongoWarning,
        source: "MySQL records + MongoDB event history",
      },
    });
  } catch (error) {
    console.error("Recall history failed:", error);

    return NextResponse.json(
      { ok: false, message: "Could not load recall history." },
      { status: 500 }
    );
  } finally {
    await mongo?.close().catch(() => undefined);
  }
}
