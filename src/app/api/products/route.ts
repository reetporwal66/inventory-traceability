
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
        p.product_id AS productId,
        p.sku,
        p.product_name AS productName,
        p.category,
        p.description,
        p.unit_of_measure AS unitOfMeasure,
        p.reorder_level AS reorderLevel,
        p.is_active AS isActive,
        p.created_at AS createdAt,
        COUNT(DISTINCT b.batch_id) AS batchCount
      FROM products p
      LEFT JOIN batches b ON b.product_id = p.product_id
      GROUP BY
        p.product_id, p.sku, p.product_name, p.category,
        p.description, p.unit_of_measure, p.reorder_level,
        p.is_active, p.created_at
      ORDER BY p.created_at DESC
    `);

    return NextResponse.json({ ok: true, data: rows });
  } catch (error) {
    console.error("Products GET failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not load products." },
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
        { ok: false, message: "Your role cannot create products." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    const productName =
      typeof body.productName === "string" ? body.productName.trim() : "";
    const category =
      typeof body.category === "string" ? body.category.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const unitOfMeasure =
      typeof body.unitOfMeasure === "string"
        ? body.unitOfMeasure.trim()
        : "unit";
    const reorderLevel = Number(body.reorderLevel ?? 0);

    if (
      !sku ||
      sku.length > 60 ||
      !productName ||
      productName.length > 180 ||
      !category ||
      category.length > 100 ||
      !unitOfMeasure ||
      unitOfMeasure.length > 30 ||
      description.length > 20000 ||
      !Number.isInteger(reorderLevel) ||
      reorderLevel < 0 ||
      reorderLevel > 4294967295
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Enter a valid SKU, product name, category, unit, and non-negative whole-number reorder level.",
        },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO products
        (sku, product_name, category, description, unit_of_measure, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sku,
        productName,
        category,
        description || null,
        unitOfMeasure,
        reorderLevel,
      ]
    );

    const productId = result.insertId;

    await connection.execute(
      `INSERT INTO event_outbox
        (event_type, aggregate_type, aggregate_id, payload)
       VALUES (?, ?, ?, ?)`,
      [
        "PRODUCT_CREATED",
        "PRODUCT",
        productId,
        JSON.stringify({
          product_id: productId,
          sku,
          product_name: productName,
          category,
          unit_of_measure: unitOfMeasure,
          reorder_level: reorderLevel,
        }),
      ]
    );

    await connection.commit();

    return NextResponse.json(
      {
        ok: true,
        message: "Product created successfully.",
        data: { productId },
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError) => {
        console.error("Product rollback failed:", rollbackError);
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { ok: false, message: "That SKU already exists. Use a unique SKU." },
        { status: 409 }
      );
    }

    console.error("Products POST failed:", error);
    return NextResponse.json(
      { ok: false, message: "Could not create product." },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}
