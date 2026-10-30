
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const [reservationRows] = await pool.query(`
      SELECT
        sr.reservation_id,
        sr.batch_id,
        sr.warehouse_id,
        sr.quantity,
        sr.status,
        sr.expires_at,
        sr.created_at,
        b.batch_code,
        p.sku,
        p.product_name,
        w.warehouse_name
      FROM stock_reservations sr
      JOIN batches b ON b.batch_id = sr.batch_id
      JOIN products p ON p.product_id = b.product_id
      JOIN warehouses w ON w.warehouse_id = sr.warehouse_id
      ORDER BY sr.created_at DESC
    `);

    const [inventoryRows] = await pool.query(`
      SELECT
        i.batch_id,
        i.warehouse_id,
        b.batch_code,
        b.status AS batch_status,
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
        reservations: reservationRows,
        inventory: inventoryRows,
      },
    });
  } catch (error) {
    console.error("Reservations GET failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Could not load reservations from MySQL.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
        { ok: false, message: "Your role cannot create reservations." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const batchId = Number(body.batchId);
    const warehouseId = Number(body.warehouseId);
    const quantity = Number(body.quantity);

    if (
      !Number.isSafeInteger(batchId) ||
      batchId <= 0 ||
      !Number.isSafeInteger(warehouseId) ||
      warehouseId <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Choose a valid batch, warehouse, and positive quantity.",
        },
        { status: 400 }
      );
    }

    let expiresAt: string | null = null;

    if (body.expiresAt) {
      const expiry = new Date(body.expiresAt);

      if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
        return NextResponse.json(
          {
            ok: false,
            message: "Expiry must be a valid future date and time.",
          },
          { status: 400 }
        );
      }

      expiresAt = expiry.toISOString().slice(0, 19).replace("T", " ");
    }

    await pool.query("CALL sp_reserve_stock(?, ?, ?, ?, ?)", [
      batchId,
      warehouseId,
      quantity,
      user.userId,
      expiresAt,
    ]);

    return NextResponse.json({
      ok: true,
      message: "Stock reserved successfully.",
    });
  } catch (error) {
    console.error("Reservations POST failed:", error);

    const message =
      error instanceof Error ? error.message : "Reservation failed.";

    const conflict =
      message.includes("Insufficient available stock") ||
      message.includes("Batch is not active") ||
      message.includes("Inventory row does not exist");

    return NextResponse.json(
      {
        ok: false,
        message: conflict
          ? message
          : "Could not create reservation. Check the server terminal for details.",
      },
      { status: conflict ? 409 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
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
        { ok: false, message: "Your role cannot cancel reservations." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const reservationId = Number(body.reservationId);

    if (!Number.isSafeInteger(reservationId) || reservationId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Choose a valid reservation.",
        },
        { status: 400 }
      );
    }

    await pool.query("CALL sp_cancel_reservation(?, ?, ?)", [
      reservationId,
      user.userId,
      "Cancelled through StockSync UI",
    ]);

    return NextResponse.json({
      ok: true,
      message: `Reservation #${reservationId} cancelled successfully.`,
    });
  } catch (error) {
    console.error("Reservations PATCH failed:", error);

    const message =
      error instanceof Error ? error.message : "Cancellation failed.";

    const notFound = message.includes("Reservation does not exist");

    const conflict =
      notFound ||
      message.includes("Reservation is not active") ||
      message.includes("Reserved quantity is inconsistent") ||
      message.includes("Inventory row does not exist");

    return NextResponse.json(
      {
        ok: false,
        message: conflict
          ? message
          : "Could not cancel reservation. Check the server terminal for details.",
      },
      { status: notFound ? 404 : conflict ? 409 : 500 }
    );
  }
}

export async function DELETE(request: Request) {
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
        { ok: false, message: "Your role cannot delete reservations." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const reservationId = Number(body.reservationId);

    if (!Number.isSafeInteger(reservationId) || reservationId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Choose a valid reservation.",
        },
        { status: 400 }
      );
    }

    await pool.query("CALL sp_delete_reservation(?, ?, ?)", [
      reservationId,
      user.userId,
      "Deleted through StockSync UI",
    ]);

    return NextResponse.json({
      ok: true,
      message: `Reservation #${reservationId} deleted successfully.`,
    });
  } catch (error) {
    console.error("Reservations DELETE failed:", error);

    const message =
      error instanceof Error ? error.message : "Deletion failed.";

    const notFound = message.includes("Reservation does not exist");

    const conflict =
      notFound ||
      message.includes("Reserved quantity is inconsistent") ||
      message.includes("Inventory row does not exist");

    return NextResponse.json(
      {
        ok: false,
        message: conflict
          ? message
          : "Could not delete reservation. Check the server terminal for details.",
      },
      { status: notFound ? 404 : conflict ? 409 : 500 }
    );
  }
}
