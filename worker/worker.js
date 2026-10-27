/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv").config({ path: ".env.local" });

const mysql = require("mysql2/promise");
const { MongoClient } = require("mongodb");

async function main() {
  let sql;
  let mongo;

  try {
    sql = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });
    console.log("MySQL connection successful.");

    mongo = new MongoClient(process.env.MONGODB_URI);
    await mongo.connect();
    console.log("MongoDB connection successful.");
    const collection = mongo
      .db(process.env.MONGODB_DATABASE)
      .collection(process.env.MONGODB_COLLECTION);

    await collection.createIndex(
      { event_id: 1 },
      { unique: true }
    );

    // Recover events stuck in PROCESSING
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

    const [events] = await sql.execute(`
      SELECT event_id, event_type, aggregate_type,
             aggregate_id, payload, created_at
      FROM event_outbox
      WHERE delivery_status IN ('PENDING', 'FAILED')
        AND attempts < 5
      ORDER BY event_id ASC
    `);

    console.log(`Found ${events.length} events to deliver.`);

    for (const event of events) {
      const [claim] = await sql.execute(
        `UPDATE event_outbox
         SET delivery_status = 'PROCESSING',
             attempts = attempts + 1,
             processing_started_at = NOW(),
             last_error = NULL
         WHERE event_id = ?
           AND delivery_status IN ('PENDING', 'FAILED')
           AND attempts < 5`,
        [event.event_id]
      );

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
          `UPDATE event_outbox
           SET delivery_status = 'DELIVERED',
               delivered_at = NOW(),
               processing_started_at = NULL,
               last_error = NULL
           WHERE event_id = ?
             AND delivery_status = 'PROCESSING'`,
          [event.event_id]
        );

        console.log(`Delivered event ${event.event_id}`);
      } catch (error) {
        const message = String(error.message).slice(0, 4000);

        await sql.execute(
          `UPDATE event_outbox
           SET delivery_status = 'FAILED',
               processing_started_at = NULL,
               last_error = ?
           WHERE event_id = ?
             AND delivery_status = 'PROCESSING'`,
          [message, event.event_id]
        );

        console.error(
          `Event ${event.event_id} failed: ${message}`
        );
      }
    }

    console.log("Event delivery run finished.");
  } finally {
    if (sql) await sql.end();
    if (mongo) await mongo.close();
  }
}

main().catch((error) => {
  console.error("Worker failed:", error.message);
  process.exitCode = 1;
});
