
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Search,
  RefreshCw,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";

type ProductBatch = {
  productId: number;
  sku: string;
  product: string;
  batchId: number;
  batch: string;
  expiryDate: string;
  status: string;
  warehouseId: number;
  warehouseCode: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
};

export default function ProductsPage() {
  const [items, setItems] = useState<ProductBatch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/inventory", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Unable to load product data.");
      }

      setItems(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial data fetch; keep the existing loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
  }, []);

  const products = useMemo(() => {
    const grouped = new Map<number, ProductBatch>();

    for (const item of items) {
      const existing = grouped.get(item.productId);

      if (!existing) {
        grouped.set(item.productId, { ...item });
      } else {
        existing.onHand += item.onHand;
        existing.reserved += item.reserved;
        existing.available += item.available;

        if (item.status === "RECALLED") {
          existing.status = "RECALLED";
        }
      }
    }

    return Array.from(grouped.values());
  }, [items]);

  const batches = useMemo(() => {
    const grouped = new Map<string, ProductBatch>();

    for (const item of items) {
      const key =
        String(item.batchId) + "-" + String(item.warehouseId);

      grouped.set(key, item);
    }

    return Array.from(grouped.values());
  }, [items]);

  const filteredProducts = products.filter((product) =>
    [
      product.product,
      product.sku,
      product.batch,
      product.status,
    ].some((value) =>
      value.toLowerCase().includes(search.trim().toLowerCase())
    )
  );

  const recalledCount = products.filter(
    (product) => product.status === "RECALLED"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"
            >
              <ArrowLeft size={16} />
              Back to Overview
            </Link>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Products &amp; Batches
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Review product information, batch traceability, expiry dates,
              and recall status.
            </p>
          </div>

          <button
            onClick={loadProducts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Products"
            value={products.length}
            description="Distinct products in inventory"
            icon={<Package size={20} />}
          />

          <StatCard
            title="Batch / warehouse records"
            value={batches.length}
            description="Inventory records grouped by batch and warehouse"
            icon={<CalendarDays size={20} />}
          />

          <StatCard
            title="Products with recalled stock"
            value={recalledCount}
            description="Products requiring recall attention"
            icon={<AlertTriangle size={20} />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Product catalogue
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Product totals are aggregated across the listed warehouses.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products..."
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm !text-black placeholder:!text-gray-500 opacity-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          {error && (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}

              <button
                onClick={loadProducts}
                className="ml-3 font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Product</th>
                  <th className="px-5 py-4 font-semibold">Batch</th>
                  <th className="px-5 py-4 text-right font-semibold">
                    On hand
                  </th>
                  <th className="px-5 py-4 text-right font-semibold">
                    Available
                  </th>
                  <th className="px-5 py-4 font-semibold">Expiry date</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      Loading products...
                    </td>
                  </tr>
                ) : !error && filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr
                      key={product.productId}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {product.product}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {product.sku}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {product.batch}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold">
                        {product.onHand}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                        {product.available}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {new Date(product.expiryDate).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            product.status === "RECALLED"
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            Showing {loading ? 0 : filteredProducts.length} of{" "}
            {products.length} products
          </footer>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Batch and warehouse breakdown
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            The same batch can appear in multiple warehouses. Each row below
            represents one batch and warehouse combination.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Warehouse</th>
                  <th className="px-4 py-3 text-right">On hand</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => (
                  <tr
                    key={String(batch.batchId) + "-" + String(batch.warehouseId)}
                  >
                    <td className="px-4 py-3 font-medium">
                      {batch.batch}
                    </td>

                    <td className="px-4 py-3">{batch.warehouse}</td>

                    <td className="px-4 py-3 text-right">
                      {batch.onHand}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {batch.available}
                    </td>

                    <td className="px-4 py-3">{batch.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{title}</p>

        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
      </div>

      <p className="mt-5 text-3xl font-bold text-slate-900">{value}</p>

      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}
