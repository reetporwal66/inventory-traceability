
import { NextResponse } from "next/server";
import pool from "@/lib/db/mysql";
import { getSession } from "@/lib/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
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

    const [batches] = await pool.query(`
      SELECT
        b.batch_id AS batchId,
        b.batch_code AS batchCode,
        b.product_id AS productId,
        p.product_name AS productName,
        p.sku,
        b.supplier_id AS supplierId,
        s.supplier_name AS supplierName,
        b.manufacture_date AS manufactureDate,
        b.expiry_date AS expiryDate,
        b.unit_cost AS unitCost,
        b.status,
        b.created_at AS createdAt
      FROM batches b
      INNER JOIN products p ON p.product_id = b.product_id
      INNER JOIN suppliers s ON s.supplier_id = b.supplier_id
      ORDER BY b.created_at DESC
    `);

    const [products] = await pool.query<RowDataPacket[]>(`
      SELECT product_id AS productId, sku, product_name AS productName
      FROM products
      WHERE is_active = 1
      ORDER BY product_name
    `);

    const [suppliers] = await pool.query<RowDataPacket[]>(`
      SELECT supplier_id AS supplierId, supplier_name AS supplierName
      FROM suppliers
      WHERE status = 'ACTIVE'
      ORDER BY supplier_name
    `);

    return NextResponse.json({
      ok: true,
      data: batches,
      products,
      suppliers,
    });
  } catch (error) {
    console.error("Batches GET failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not load batches." },
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
        { ok: false, message: "Your role cannot create batches." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const batchCode =
      typeof body.batchCode === "string" ? body.batchCode.trim() : "";
    const productId = Number(body.productId);
    const supplierId = Number(body.supplierId);
    const manufactureDate = body.manufactureDate || null;
    const expiryDate = body.expiryDate || null;
    const unitCost = Number(body.unitCost ?? 0);

    if (
      !batchCode ||
      batchCode.length > 80 ||
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      !Number.isSafeInteger(supplierId) ||
      supplierId <= 0 ||
      (manufactureDate !== null && !validDate(manufactureDate)) ||
      (expiryDate !== null && !validDate(expiryDate)) ||
      (manufactureDate && expiryDate && expiryDate < manufactureDate) ||
      !Number.isFinite(unitCost) ||
      unitCost < 0 ||
      Math.round(unitCost * 100) !== unitCost * 100
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Enter a valid batch code, product, supplier, dates and non-negative unit cost. Expiry cannot be before manufacture.",
        },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [productRows] = await connection.execute<RowDataPacket[]>(
      "SELECT product_id FROM products WHERE product_id = ? AND is_active = 1",
      [productId]
    );

    if (productRows.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { ok: false, message: "Select an active product." },
        { status: 400 }
      );
    }

    const [supplierRows] = await connection.execute<RowDataPacket[]>(
      "SELECT supplier_id FROM suppliers WHERE supplier_id = ? AND status = 'ACTIVE'",
      [supplierId]
    );

    if (supplierRows.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { ok: false, message: "Select an active supplier." },
        { status: 400 }
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO batches
        (batch_code, product_id, supplier_id, manufacture_date, expiry_date, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        batchCode,
        productId,
        supplierId,
        manufactureDate,
        expiryDate,
        unitCost,
      ]
    );

    const batchId = result.insertId;

    await connection.execute(
      `INSERT INTO event_outbox
        (event_type, aggregate_type, aggregate_id, payload)
       VALUES (?, ?, ?, ?)`,
      [
        "BATCH_CREATED",
        "BATCH",
        batchId,
        JSON.stringify({
          batch_id: batchId,
          batch_code: batchCode,
          product_id: productId,
          supplier_id: supplierId,
          manufacture_date: manufactureDate,
          expiry_date: expiryDate,
          unit_cost: unitCost,
          status: "ACTIVE",
        }),
      ]
    );

    await connection.commit();

    return NextResponse.json(
      {
        ok: true,
        message: "Batch created successfully.",
        data: { batchId },
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Batch rollback failed:", rollbackError);
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { ok: false, message: "That batch code already exists." },
        { status: 409 }
      );
    }

    console.error("Batches POST failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not create batch." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
