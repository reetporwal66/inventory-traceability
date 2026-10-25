
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Package,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

type InventoryItem = {
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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadInventory() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/inventory", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Unable to load inventory.");
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
    void loadInventory();
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return items;

    return items.filter((item) =>
      [
        item.product,
        item.sku,
        item.batch,
        item.warehouse,
        item.warehouseCode,
        item.status,
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [items, search]);

  const totalOnHand = items.reduce(
    (sum, item) => sum + item.onHand,
    0
  );

  const totalAvailable = items.reduce(
    (sum, item) => sum + item.available,
    0
  );

  const totalReserved = items.reduce(
    (sum, item) => sum + item.reserved,
    0
  );

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
              Inventory
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Monitor stock levels across your warehouses.
              Data is loaded from MySQL.
            </p>
          </div>

          <button
            onClick={loadInventory}
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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Inventory records"
            value={items.length}
            description="Product and warehouse combinations"
            icon={<Package size={20} />}
          />

          <StatCard
            title="Total units on hand"
            value={totalOnHand}
            description="Across all listed inventory records"
            icon={<Package size={20} />}
          />

          <StatCard
            title="Available units"
            value={totalAvailable}
            description="Excludes reserved and quarantined stock"
            icon={<CheckCircle2 size={20} />}
          />

          <StatCard
            title="Reserved units"
            value={totalReserved}
            description="Units currently reserved"
            icon={<AlertTriangle size={20} />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Stock records
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search by product, SKU, batch, warehouse, or status.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search inventory..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          {error && (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
              <button
                onClick={loadInventory}
                className="ml-3 font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Product / Batch</th>
                  <th className="px-5 py-4 font-semibold">Warehouse</th>
                  <th className="px-5 py-4 text-right font-semibold">On hand</th>
                  <th className="px-5 py-4 text-right font-semibold">Reserved</th>
                  <th className="px-5 py-4 text-right font-semibold">Available</th>
                  <th className="px-5 py-4 font-semibold">Expiry date</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      Loading inventory...
                    </td>
                  </tr>
                ) : !error && filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      No inventory records found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => (
                    <tr
                      key={`${item.batchId}-${item.warehouseId}-${index}`}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {item.product}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.sku} · {item.batch}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-700">
                          {item.warehouse}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.warehouseCode}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-slate-800">
                        {item.onHand}
                      </td>

                      <td className="px-5 py-4 text-right text-slate-600">
                        {item.reserved}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                        {item.available}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {new Date(item.expiryDate).toLocaleDateString(
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
                            item.status === "RECALLED"
                              ? "bg-red-50 text-red-700"
                              : item.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            <span>
              Showing {loading ? 0 : filteredItems.length} of {items.length} records
            </span>
            <span>Source: MySQL inventory view</span>
          </footer>
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
