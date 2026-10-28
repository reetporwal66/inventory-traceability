
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

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
        r.recipient_id,
        r.recipient_name,
        r.organization_name,
        r.email,
        r.phone,
        r.delivery_address,
        r.city,
        r.created_at,
        COUNT(s.shipment_id) AS shipment_count
      FROM recipients r
      LEFT JOIN shipments s ON s.recipient_id = r.recipient_id
      GROUP BY
        r.recipient_id,
        r.recipient_name,
        r.organization_name,
        r.email,
        r.phone,
        r.delivery_address,
        r.city,
        r.created_at
      ORDER BY r.created_at DESC
    `);

    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    console.error("Recipients GET failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not load recipients." },
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

    if (!["ADMIN", "INVENTORY_STAFF"].includes(user.role)) {
      return NextResponse.json(
        { ok: false, message: "Your role cannot create recipients." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const recipientName =
      typeof body.recipientName === "string"
        ? body.recipientName.trim()
        : "";
    const organizationName =
      typeof body.organizationName === "string"
        ? body.organizationName.trim()
        : "";
    const email =
      typeof body.email === "string" ? body.email.trim() : "";
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";
    const deliveryAddress =
      typeof body.deliveryAddress === "string"
        ? body.deliveryAddress.trim()
        : "";
    const city =
      typeof body.city === "string" ? body.city.trim() : "";

    if (
      !recipientName ||
      recipientName.length > 150 ||
      !deliveryAddress ||
      deliveryAddress.length > 500 ||
      organizationName.length > 180 ||
      email.length > 255 ||
      phone.length > 30 ||
      city.length > 100
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Enter a recipient name and delivery address. Check the maximum lengths of all fields.",
        },
        { status: 400 }
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO recipients
        (recipient_name, organization_name, email, phone, delivery_address, city)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        recipientName,
        organizationName || null,
        email || null,
        phone || null,
        deliveryAddress,
        city || null,
      ]
    );

    const recipientId = result.insertId;

    await connection.execute(
      `INSERT INTO event_outbox
        (event_type, aggregate_type, aggregate_id, payload)
       VALUES (?, ?, ?, ?)`,
      [
        "RECIPIENT_CREATED",
        "RECIPIENT",
        recipientId,
        JSON.stringify({
          recipient_id: recipientId,
          recipient_name: recipientName,
          organization_name: organizationName || null,
          delivery_address: deliveryAddress,
          city: city || null,
        }),
      ]
    );

    await connection.commit();

    return NextResponse.json(
      {
        ok: true,
        message: "Recipient created successfully.",
        data: { recipientId },
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Recipient rollback failed:", rollbackError);
      });
    }

    console.error("Recipients POST failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not create recipient." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
