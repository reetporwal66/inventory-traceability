
/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv").config({ path: ".env.local" });

const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");

const POLL_INTERVAL_MS = 5000;
const RECONNECT_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 5;

let shutdownRequested = false;
let sql = null;
let mongo = null;
let collection = null;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function requestShutdown(signal) {
  if (shutdownRequested) return;

  shutdownRequested = true;
  console.log(`\n${signal} received. Shutting down gracefully...`);
}

process.on("SIGINT", () => requestShutdown("SIGINT"));
process.on("SIGTERM", () => requestShutdown("SIGTERM"));

async function closeConnections() {
  const oldSql = sql;
  const oldMongo = mongo;

  sql = null;
  mongo = null;
  collection = null;

  if (oldSql) {
    try {
      await oldSql.end();
      console.log("MySQL connection closed.");
    } catch (error) {
      console.error("Error closing MySQL:", error.message);
    }
  }

  if (oldMongo) {
    try {
      await oldMongo.close();
      console.log("MongoDB connection closed.");
    } catch (error) {
      console.error("Error closing MongoDB:", error.message);
    }
  }
}

async function connectConnections() {
  const newSql = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectTimeout: 10000,
  });

  let newMongo;

  try {
    console.log("MySQL connection successful.");

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured.");
    }

    newMongo = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    await newMongo.connect();
    console.log("MongoDB connection successful.");

    const newCollection = newMongo
      .db(process.env.MONGODB_DATABASE)
      .collection(process.env.MONGODB_COLLECTION);

    await newCollection.createIndex(
      { event_id: 1 },
      { unique: true }
    );

    sql = newSql;
    mongo = newMongo;
    collection = newCollection;
  } catch (error) {
    await newSql.end().catch(() => {});
    if (newMongo) {
      await newMongo.close().catch(() => {});
    }
    throw error;
  }
}

async function processEvents() {
  // Recover events left in PROCESSING after a crash or timeout.
  const [recovered] = await sql.execute(`
    UPDATE event_outbox
    SET delivery_status = 'PENDING',
        processing_started_at = NULL,
        last_error = 'Recovered stale PROCESSING event'
    WHERE delivery_status = 'PROCESSING'
      AND (
        processing_started_at IS NULL
        OR processing_started_at <
           DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      )
  `);

  if (recovered.affectedRows > 0) {
    console.log(
      `Recovered ${recovered.affectedRows} stale events.`
    );
  }

  const [events] = await sql.execute(
    `
      SELECT event_id, event_type, aggregate_type,
             aggregate_id, payload, created_at
      FROM event_outbox
      WHERE delivery_status IN ('PENDING', 'FAILED')
        AND attempts < ?
      ORDER BY event_id ASC
    `,
    [MAX_ATTEMPTS]
  );

  console.log(`Found ${events.length} events to deliver.`);

  for (const event of events) {
    if (shutdownRequested) break;

    const [claim] = await sql.execute(
      `
        UPDATE event_outbox
        SET delivery_status = 'PROCESSING',
            attempts = attempts + 1,
            processing_started_at = NOW(),
            last_error = NULL
        WHERE event_id = ?
          AND delivery_status IN ('PENDING', 'FAILED')
          AND attempts < ?
      `,
      [event.event_id, MAX_ATTEMPTS]
    );

    // Another worker may already have claimed this event.
    if (claim.affectedRows !== 1) continue;

    try {
      await collection.updateOne(
        { event_id: event.event_id },
        {
          $setOnInsert: {
            event_id: event.event_id,
            event_type: event.event_type,
            aggregate_type: event.aggregate_type,
            aggregate_id: event.aggregate_id,
            payload: event.payload,
            source_created_at: event.created_at,
            copied_at: new Date(),
          },
        },
        { upsert: true }
      );

      await sql.execute(
        `
          UPDATE event_outbox
          SET delivery_status = 'DELIVERED',
              delivered_at = NOW(),
              processing_started_at = NULL,
              last_error = NULL
          WHERE event_id = ?
            AND delivery_status = 'PROCESSING'
        `,
        [event.event_id]
      );

      console.log(`Delivered event ${event.event_id}`);
    } catch (error) {
      const message = String(
        error?.message || error
      ).slice(0, 4000);

      // If MySQL itself is unavailable, this update may fail.
      // The outer loop will close broken connections and reconnect.
      await sql.execute(
        `
          UPDATE event_outbox
          SET delivery_status = 'FAILED',
              processing_started_at = NULL,
              last_error = ?
          WHERE event_id = ?
            AND delivery_status = 'PROCESSING'
        `,
        [message, event.event_id]
      );

      console.error(
        `Event ${event.event_id} failed: ${message}`
      );
    }
  }

  console.log("Event delivery run finished.");
}

async function main() {
  console.log("Starting continuous outbox worker...");

  try {
    while (!shutdownRequested) {
      try {
        // Reconnect if a previous cycle failed.
        if (!sql || !mongo || !collection) {
          await connectConnections();
        }

        if (!shutdownRequested) {
          await processEvents();
        }
      } catch (error) {
        console.error(
          "Worker cycle failed:",
          error?.message || error
        );

        // Discard connections that may be broken.
        await closeConnections();

        if (!shutdownRequested) {
          console.log(
            `Retrying connections in ${
              RECONNECT_INTERVAL_MS / 1000
            } seconds...`
          );
        }
      }

      if (!shutdownRequested) {
        await sleep(
          sql && mongo
            ? POLL_INTERVAL_MS
            : RECONNECT_INTERVAL_MS
        );
      }
    }
  } finally {
    await closeConnections();
    console.log("Worker stopped.");
  }
}

main().catch((error) => {
  console.error("Worker failed:", error?.message || error);
  process.exitCode = 1;
});
