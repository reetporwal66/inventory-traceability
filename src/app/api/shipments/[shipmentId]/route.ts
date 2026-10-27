
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

type ShipmentStatus =
  | "PREPARING"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | "DISCREPANCY";

type ShipmentRow = RowDataPacket & {
  shipment_id: number;
  status: ShipmentStatus;
};

const transitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PREPARING: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["IN_TRANSIT", "DISCREPANCY"],
  IN_TRANSIT: ["DELIVERED", "DISCREPANCY"],
  DELIVERED: [],
  CANCELLED: [],
  DISCREPANCY: ["IN_TRANSIT", "DELIVERED"],
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ shipmentId: string }> }
) {
  let connection: PoolConnection | undefined;

  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    if (
      user.role !== "ADMIN" &&
      user.role !== "INVENTORY_STAFF"
    ) {
      return NextResponse.json(
        { ok: false, message: "Your role cannot update shipment status." },
        { status: 403 }
      );
    }

    const { shipmentId: rawId } = await context.params;
    const shipmentId = Number(rawId);

    if (!Number.isSafeInteger(shipmentId) || shipmentId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid shipment ID." },
        { status: 400 }
      );
    }

    let body: { status?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const allowedStatuses: ShipmentStatus[] = [
      "PREPARING",
      "DISPATCHED",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
      "DISCREPANCY",
    ];

    if (
      typeof body.status !== "string" ||
      !allowedStatuses.includes(body.status as ShipmentStatus)
    ) {
      return NextResponse.json(
        { ok: false, message: "Invalid shipment status." },
        { status: 400 }
      );
    }

    const nextStatus = body.status as ShipmentStatus;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<ShipmentRow[]>(
      `SELECT shipment_id, status
       FROM shipments
       WHERE shipment_id = ?
       FOR UPDATE`,
      [shipmentId]
    );

    if (rows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { ok: false, message: "Shipment not found." },
        { status: 404 }
      );
    }

    const currentStatus = rows[0].status;

    if (!transitions[currentStatus].includes(nextStatus)) {
      await connection.rollback();

      return NextResponse.json(
        {
          ok: false,
          message: `Cannot change shipment from ${currentStatus} to ${nextStatus}.`,
        },
        { status: 409 }
      );
    }

    await connection.execute(
      `UPDATE shipments
       SET status = ?,
           dispatched_at = CASE
             WHEN ? = 'DISPATCHED'
             THEN COALESCE(dispatched_at, CURRENT_TIMESTAMP)
             ELSE dispatched_at
           END,
           delivered_at = CASE
             WHEN ? = 'DELIVERED'
             THEN COALESCE(delivered_at, CURRENT_TIMESTAMP)
             ELSE delivered_at
           END
       WHERE shipment_id = ?`,
      [nextStatus, nextStatus, nextStatus, shipmentId]
    );

    await connection.commit();

    return NextResponse.json({
      ok: true,
      message: `Shipment status updated to ${nextStatus}.`,
      data: {
        shipmentId,
        previousStatus: currentStatus,
        status: nextStatus,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Shipment status rollback failed:", rollbackError);
      });
    }

    console.error("Shipment PATCH failed:", error);

    return NextResponse.json(
      { ok: false, message: "Could not update shipment status." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
