
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Warehouse,
  RefreshCw,
  Search,
  Package,
  Boxes,
  MapPin,
  AlertTriangle,
} from "lucide-react";

type InventoryItem = {
  productId: number;
  sku: string;
  product: string;
  batchId: number;
  batch: string;
  expiryDate: string | null;
  status: string;
  warehouseId: number;
  warehouseCode: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
};

type WarehouseSummary = {
  id: number;
  code: string;
  name: string;
  records: number;
  products: Set<number>;
  batches: Set<number>;
  onHand: number;
  reserved: number;
  available: number;
  recalledRecords: number;
};

export default function WarehousesPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/inventory", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ||
            result.error ||
            "Unable to load warehouse stock."
        );
      }

      setItems(result.data as InventoryItem[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load warehouse stock."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const warehouses = useMemo(() => {
    const map = new Map<number, WarehouseSummary>();

    for (const item of items) {
      let warehouse = map.get(item.warehouseId);

      if (!warehouse) {
        warehouse = {
          id: item.warehouseId,
          code: item.warehouseCode,
          name: item.warehouse,
          records: 0,
          products: new Set<number>(),
          batches: new Set<number>(),
          onHand: 0,
          reserved: 0,
          available: 0,
          recalledRecords: 0,
        };

        map.set(item.warehouseId, warehouse);
      }

      warehouse.records += 1;
      warehouse.products.add(item.productId);
      warehouse.batches.add(item.batchId);
      warehouse.onHand += Number(item.onHand);
      warehouse.reserved += Number(item.reserved);
      warehouse.available += Number(item.available);

      if (
        item.status === "RECALLED" ||
        item.status === "QUARANTINED"
      ) {
        warehouse.recalledRecords += 1;
      }
    }

    return Array.from(map.values());
  }, [items]);

  const filteredWarehouses = warehouses.filter((warehouse) =>
    `${warehouse.name} ${warehouse.code} ${warehouse.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const totalUnits = warehouses.reduce(
    (sum, item) => sum + item.onHand,
    0
  );

  const totalAvailable = warehouses.reduce(
    (sum, item) => sum + item.available,
    0
  );

  return (
    <main className="min-h-screen bg-[#f6f7fb] p-5 text-slate-900 sm:p-8">
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

            <p className="text-xs font-semibold uppercase tracking-[2px] text-emerald-700">
              Operations center
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Warehouses<span className="text-emerald-500">.</span>
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Review stock distribution across warehouse locations.
            </p>
          </div>

          <button
            onClick={() => void loadInventory()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Could not load warehouse stock: {error}
            <button
              onClick={() => void loadInventory()}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Warehouses found"
            value={loading ? "…" : warehouses.length}
            note="Locations represented in inventory"
            icon={<Warehouse size={20} />}
          />
          <StatCard
            label="Total units on hand"
            value={loading ? "…" : totalUnits.toLocaleString("en-IN")}
            note="Across listed locations"
            icon={<Boxes size={20} />}
          />
          <StatCard
            label="Available units"
            value={loading ? "…" : totalAvailable.toLocaleString("en-IN")}
            note="Based on the inventory API"
            icon={<Package size={20} />}
          />
          <StatCard
            label="Locations with recalled stock"
            value={
              loading
                ? "…"
                : warehouses.filter(
                    (warehouse) => warehouse.recalledRecords > 0
                  ).length
            }
            note="Locations needing attention"
            icon={<AlertTriangle size={20} />}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold">Warehouse locations</h2>
              <p className="mt-1 text-sm text-slate-500">
                Summarized from current inventory records.
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search warehouses..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            {!loading &&
              filteredWarehouses.map((warehouse) => (
                <article
                  key={warehouse.id}
                  className="rounded-2xl border border-slate-200 p-5 transition hover:border-emerald-300 hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                      <Warehouse size={24} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900">
                        {warehouse.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {warehouse.code}
                      </p>
                    </div>

                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      ID {warehouse.id}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Metric label="Units on hand" value={warehouse.onHand} />
                    <Metric label="Available units" value={warehouse.available} />
                    <Metric label="Products" value={warehouse.products.size} />
                    <Metric label="Batch records" value={warehouse.records} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <MapPin size={14} />
                      {warehouse.batches.size} distinct batches
                    </span>

                    {warehouse.recalledRecords > 0 ? (
                      <span className="rounded-full bg-rose-50 px-3 py-1 font-semibold text-rose-700">
                        Recall attention required
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                        No recalled records listed
                      </span>
                    )}
                  </div>
                </article>
              ))}

            {loading && (
              <p className="col-span-full py-12 text-center text-sm text-slate-500">
                Loading warehouse data from MySQL...
              </p>
            )}

            {!loading &&
              !error &&
              filteredWarehouses.length === 0 && (
                <p className="col-span-full py-12 text-center text-sm text-slate-500">
                  No matching warehouse records found.
                </p>
              )}
          </div>

          <footer className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
            Showing {loading ? 0 : filteredWarehouses.length} of{" "}
            {warehouses.length} locations · Source: MySQL inventory API
          </footer>
        </section>

        <p className="text-xs leading-5 text-slate-500">
          Note: this page shows warehouses represented in the current inventory
          response. Warehouses with zero inventory are not included by this API.
          Full warehouse details and CRUD operations can be connected separately.
        </p>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
      </div>
      <p className="mt-5 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
