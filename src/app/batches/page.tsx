"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, RefreshCw, Plus } from "lucide-react";

type ProductOption = {
  productId: number;
  sku: string;
  productName: string;
};

type SupplierOption = {
  supplierId: number;
  supplierName: string;
};

type WarehouseOption = {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
};

type Batch = {
  batchId: number;
  batchCode: string;
  productId: number;
  productName: string;
  sku: string;
  supplierId: number;
  supplierName: string;
  manufactureDate: string | null;
  expiryDate: string | null;
  unitCost: number | string;
  status: string;
  createdAt: string;
};

type ApiResult = {
  ok: boolean;
  message?: string;
  data?: Batch[];
  products?: ProductOption[];
  suppliers?: SupplierOption[];
  warehouses?: WarehouseOption[];
};

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  const [batchCode, setBatchCode] = useState("");
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("100");
  const [manufactureDate, setManufactureDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/batches", {
        cache: "no-store",
      });

      const result: ApiResult = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not load batches.");
      }

      setBatches(result.data ?? []);
      setProducts(result.products ?? []);
      setSuppliers(result.suppliers ?? []);
      setWarehouses(result.warehouses ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load batches."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  async function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchCode,
          productId: Number(productId),
          supplierId: Number(supplierId),
          warehouseId: Number(warehouseId),
          initialQuantity: Number(initialQuantity),
          manufactureDate: manufactureDate || null,
          expiryDate: expiryDate || null,
          unitCost: Number(unitCost),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not create batch.");
      }

      setSuccess(
        `Batch created successfully. Batch ID: ${result.data.batchId}. ` +
          `${initialQuantity} units registered at the selected warehouse.`
      );

      setBatchCode("");
      setProductId("");
      setSupplierId("");
      setWarehouseId("");
      setInitialQuantity("100");
      setManufactureDate("");
      setExpiryDate("");
      setUnitCost("0");

      await loadBatches();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create batch."
      );
    } finally {
      setSaving(false);
    }
  }

  const filtered = batches.filter((batch) =>
    `${batch.batchCode} ${batch.productName} ${batch.sku} ${batch.supplierName} ${batch.status}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const canCreate =
    !saving &&
    products.length > 0 &&
    suppliers.length > 0 &&
    warehouses.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
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

            <h1 className="text-3xl font-bold">Batches</h1>

            <p className="mt-2 text-sm text-slate-500">
              Create batches, register initial stock and trace products.
            </p>
          </div>

          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            <Boxes size={17} />
            Products
          </Link>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat title="Total batches" value={batches.length} />
          <Stat
            title="Active batches"
            value={batches.filter((b) => b.status === "ACTIVE").length}
          />
          <Stat
            title="Recalled batches"
            value={batches.filter((b) => b.status === "RECALLED").length}
          />
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Create batch</h2>

            <p className="mt-1 text-sm text-slate-500">
              Create a batch and register its initial warehouse stock.
            </p>

            <form onSubmit={createBatch} className="mt-5 space-y-4">
              <Field label="Batch code *">
                <input
                  className={inputClass}
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  maxLength={80}
                  required
                  disabled={saving}
                  placeholder="e.g. RICE-BATCH-001"
                />
              </Field>

              <Field label="Product *">
                <select
                  className={inputClass}
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                  disabled={saving || products.length === 0}
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName} ({p.sku})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Supplier *">
                <select
                  className={inputClass}
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  disabled={saving || suppliers.length === 0}
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>
                      {s.supplierName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Initial warehouse *">
                <select
                  className={inputClass}
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                  disabled={saving || warehouses.length === 0}
                >
                  <option value="">Select a warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.warehouseId} value={w.warehouseId}>
                      {w.warehouseCode} — {w.warehouseName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Initial quantity *">
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  max="4294967295"
                  step="1"
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(e.target.value)}
                  required
                  disabled={saving}
                />
                <p className="mt-1 text-xs font-normal text-slate-500">
                  Whole units received into the selected warehouse.
                </p>
              </Field>

              {products.length === 0 && (
                <p className="text-xs text-amber-700">
                  Add an active product first on the Products page.
                </p>
              )}

              {suppliers.length === 0 && (
                <p className="text-xs text-amber-700">
                  An active supplier is required before creating a batch.
                </p>
              )}

              {warehouses.length === 0 && (
                <p className="text-xs text-amber-700">
                  No warehouses were found. Create a warehouse before
                  registering initial stock.
                </p>
              )}

              <Field label="Manufacture date">
                <input
                  className={inputClass}
                  type="date"
                  value={manufactureDate}
                  onChange={(e) => setManufactureDate(e.target.value)}
                  max={expiryDate || undefined}
                  disabled={saving}
                />
              </Field>

              <Field label="Expiry date">
                <input
                  className={inputClass}
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={manufactureDate || undefined}
                  disabled={saving}
                />
              </Field>

              <Field label="Unit cost">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  required
                  disabled={saving}
                />
              </Field>

              <button
                type="submit"
                disabled={!canCreate}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus size={17} />
                {saving ? "Creating batch and stock..." : "Create batch & add stock"}
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="text-xl font-bold">Batch directory</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Batch, product and supplier records from MySQL.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadBatches()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>

            <div className="border-b p-4">
              <input
                className={inputClass + " mt-0"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search batch, product or supplier..."
              />
            </div>

            {loading ? (
              <p className="p-10 text-center text-sm text-slate-500">
                Loading batches...
              </p>
            ) : filtered.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">
                No matching batches found.
              </p>
            ) : (
              <div className="divide-y">
                {filtered.map((batch) => (
                  <article key={batch.batchId} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{batch.batchCode}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {batch.productName} · {batch.sku}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          batch.status === "RECALLED"
                            ? "bg-red-50 text-red-700"
                            : batch.status === "QUARANTINED"
                              ? "bg-amber-50 text-amber-700"
                              : batch.status === "EXPIRED"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">Supplier</p>
                        <p className="mt-1 font-medium">
                          {batch.supplierName}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Manufactured</p>
                        <p className="mt-1 font-medium">
                          {formatDate(batch.manufactureDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Expires</p>
                        <p className="mt-1 font-medium">
                          {formatDate(batch.expiryDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-500">Unit cost</p>
                        <p className="mt-1 font-medium">
                          {Number(batch.unitCost).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <footer className="border-t px-5 py-4 text-xs text-slate-500">
              Showing {loading ? 0 : filtered.length} of {batches.length} batches
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}