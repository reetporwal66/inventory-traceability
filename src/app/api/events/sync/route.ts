
import { NextResponse } from "next/server";
import clientPromise from "@/lib/db/mongodb";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";

type OutboxEvent = {
  event_id: number;
  event_type: string;
  aggregate_type: string;
  aggregate_id: number;
  payload: Record<string, unknown> | string;
  created_at: Date;
};

export async function POST() {
  const user = await getSession();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Please sign in." },
      { status: 401 }
    );
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, message: "Only admins can synchronize events." },
      { status: 403 }
    );
  }

  let connection;

  try {
    connection = await pool.getConnection();

    // Recover jobs abandoned by a crashed worker.
    await connection.query(`
      UPDATE event_outbox
      SET delivery_status = 'PENDING',
          processing_started_at = NULL
      WHERE delivery_status = 'PROCESSING'
        AND processing_started_at < NOW() - INTERVAL 5 MINUTE
    `);

    // Claim a batch safely, even if two requests arrive together.
    await connection.beginTransaction();

    const [rows] = await connection.query(`
      SELECT
        event_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        created_at
      FROM event_outbox
      WHERE delivery_status = 'PENDING'
      ORDER BY event_id ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    `);

    const events = rows as OutboxEvent[];

    if (events.length > 0) {
      const ids = events.map((event) => event.event_id);
      const placeholders = ids.map(() => "?").join(", ");

      await connection.query(
        `UPDATE event_outbox
         SET delivery_status = 'PROCESSING',
             processing_started_at = NOW(),
             attempts = attempts + 1
         WHERE event_id IN (${placeholders})`,
        ids
      );
    }

    await connection.commit();

    // Copy to MongoDB using event_id as the idempotency key.
    const databaseName = process.env.MONGODB_DATABASE;
    const collectionName = process.env.MONGODB_COLLECTION;

    if (!databaseName || !collectionName) {
      throw new Error(
        "MongoDB database or collection is not configured."
      );
    }

    const client = await clientPromise;
    const collection = client
      .db(databaseName)
      .collection(collectionName);

    let delivered = 0;
    let failed = 0;

    const results: { event_id: number; status: string }[] = [];

    for (const event of events) {
      try {
        const payload =
          typeof event.payload === "string"
            ? JSON.parse(event.payload)
            : event.payload;

        await collection.updateOne(
          { event_id: event.event_id },
          {
            $setOnInsert: {
              event_id: event.event_id,
              event_type: event.event_type,
              aggregate_type: event.aggregate_type,
              aggregate_id: event.aggregate_id,
              payload,
              source_created_at: new Date(event.created_at),
              copied_at: new Date(),
            },
          },
          { upsert: true }
        );

        await pool.query(
          `UPDATE event_outbox
           SET delivery_status = 'DELIVERED',
               delivered_at = NOW(),
               processing_started_at = NULL,
               last_error = NULL
           WHERE event_id = ?
             AND delivery_status = 'PROCESSING'`,
          [event.event_id]
        );

        delivered++;
        results.push({
          event_id: event.event_id,
          status: "DELIVERED",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        await pool.query(
          `UPDATE event_outbox
           SET delivery_status = 'PENDING',
               processing_started_at = NULL,
               last_error = ?
           WHERE event_id = ?
             AND delivery_status = 'PROCESSING'`,
          [message.slice(0, 60000), event.event_id]
        );

        failed++;
        results.push({
          event_id: event.event_id,
          status: "PENDING_RETRY",
        });
      }
    }

    return NextResponse.json({
      ok: failed === 0,
      processed: events.length,
      delivered,
      failed,
      results,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => undefined);
    }

    console.error("Event synchronization failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Event synchronization failed.",
      },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
