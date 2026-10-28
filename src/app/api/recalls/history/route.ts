
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import pool from "@/lib/db/mysql";
import { MongoClient } from "mongodb";

type TimelineEvent = {
  event_id: string;
  event_type: string;
  payload: Record<string, any>;
  created_at: string | Date | null;
};

function asDate(value: any): number {
  if (!value) return 0;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : date;
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

    const [recallRows]: any = await pool.execute(
      `SELECT
         recall_id, recall_code, title, reason, severity, status,
         started_at, completed_at, initiated_by
       FROM recalls
       WHERE recall_id = ?`,
      [recallId]
    );

    if (!recallRows.length) {
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
      payload: Record<string, any>,
      created_at: string | Date | null
    ) => {
      timeline.push({ event_id, event_type, payload, created_at });
    };

    // MySQL is the source of truth for recall and batch details.
    const [batchRows]: any = await pool.execute(
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

    // Only show defects currently marked as initiating a recall.
    // Joining by batch_id alone would incorrectly include rejected
    // or unrelated defect reports from the same batch.
    const [defectRows]: any = await pool.execute(
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

    // Include every non-cancelled shipment associated with an affected
    // batch. This is batch traceability, not proof the recall caused dispatch.
    const [shipmentRows]: any = await pool.execute(
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

    // Recovery actions from MySQL remain visible even if the corresponding
    // event was never delivered to MongoDB.
    const [recoveryRows]: any = await pool.execute(
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

    // MongoDB contains the event history. MySQL still supplies the
    // authoritative business records when MongoDB is unavailable.
    let mongoEvents: any[] = [];
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
          .collection(process.env.MONGODB_COLLECTION)
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

    // Display a MySQL-backed recall milestone for older recalls that
    // have no original initiation event in MongoDB.
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
      let payload: Record<string, any> = {};

      if (
        event.payload &&
        typeof event.payload === "object" &&
        !Array.isArray(event.payload)
      ) {
        payload = event.payload;
      } else if (typeof event.payload === "string") {
        try {
          const parsed = JSON.parse(event.payload);
          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
          ) {
            payload = parsed;
          }
        } catch {
          payload = { raw_payload: event.payload };
        }
      }

      addEvent(
        `mongo-${event.event_id}`,
        event.event_type,
        payload,
        event.source_created_at || event.created_at || null
      );
    }

    const mongoRecoveryIds = new Set(
      mongoEvents
        .filter(
          (event) => event.event_type === "RECALL_RECOVERY_RECORDED"
        )
        .map((event) => {
          let payload = event.payload;

          if (typeof payload === "string") {
            try {
              payload = JSON.parse(payload);
            } catch {
              payload = {};
            }
          }

          return Number(payload?.recovery_id);
        })
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    );

    // Add MySQL recovery actions only when the same recovery ID
    // is not already represented by a MongoDB event.
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

    // Do not invent a shipment when no shipment item exists for the
    // recalled batch.
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
