
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";

type Warehouse = {
  id: number;
  warehouse_code: string;
  warehouse_name: string;
};

type BatchLocation = {
  id: number;
  name: string;
  available: number;
};

type Batch = {
  id: number;
  batch_code: string;
  sku: string;
  product_name: string;
  status: string;
  expiry_date: string | null;
  locations: BatchLocation[];
};

type Transfer = {
  transfer_id: number;
  batch_id: number;
  quantity: number;
  status: string;
  notes: string | null;
  created_at: string;
  sku: string;
  product_name: string;
  batch_code: string;
  source_name: string;
  destination_name: string;
};

type ApiData = {
  transfers: Transfer[];
  batches: Batch[];
  warehouses: Warehouse[];
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN").format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function getLocations(batch?: Batch): BatchLocation[] {
  return Array.isArray(batch?.locations) ? batch.locations : [];
}

export default function TransfersPage() {
  const [data, setData] = useState<ApiData>({
    transfers: [],
    batches: [],
    warehouses: [],
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [batchId, setBatchId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setError("");

    try {
      const response = await fetch("/api/transfers", {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Could not load transfers.");
      }

      setData({
        transfers: json.data.transfers ?? [],
        batches: json.data.batches ?? [],
        warehouses: json.data.warehouses ?? [],
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load transfers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch; keep the existing loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // Keep selected IDs as strings because HTML select values are strings.
  const selectedBatch = data.batches.find(
    (batch) => String(batch.id) === String(batchId)
  );

  const batchLocations = getLocations(selectedBatch);

  const sourceLocation = batchLocations.find(
    (location) => String(location.id) === String(sourceId)
  );

  const destinationWarehouses = data.warehouses.filter(
    (warehouse) => String(warehouse.id) !== String(sourceId)
  );

  const filteredTransfers = data.transfers.filter((item) =>
    [
      item.batch_code,
      item.product_name,
      item.sku,
      item.source_name,
      item.destination_name,
      item.status,
      String(item.transfer_id),
    ].some((value) => value.toLowerCase().includes(search.toLowerCase()))
  );

  function handleBatchChange(nextBatchId: string) {
    setBatchId(nextBatchId);
    setSourceId("");
    setDestinationId("");
    setError("");
    setSuccess("");
  }

  function handleSourceChange(nextSourceId: string) {
    setSourceId(nextSourceId);
    setDestinationId("");
    setError("");
  }

  async function submitTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amount = Number(quantity);

    if (!batchId || !sourceId || !destinationId) {
      setError("Select a batch, source warehouse, and destination warehouse.");
      return;
    }

    if (sourceId === destinationId) {
      setError("Source and destination warehouses must be different.");
      return;
    }

    if (!selectedBatch || selectedBatch.status !== "ACTIVE") {
      setError("Only ACTIVE batches can be transferred.");
      return;
    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    if (!sourceLocation) {
      setError("The selected batch has no inventory at this source warehouse.");
      return;
    }

    if (amount > sourceLocation.available) {
      setError(
        `Only ${formatNumber(sourceLocation.available)} units are available at the source.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: Number(batchId),
          sourceWarehouseId: Number(sourceId),
          destinationWarehouseId: Number(destinationId),
          quantity: amount,
          notes,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Transfer failed.");
      }

      setSuccess(
        `Transfer #${json.data?.transfer_id ?? ""} completed successfully.`
      );

      setQuantity("1");
      setNotes("");
      setBatchId("");
      setSourceId("");
      setDestinationId("");

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium !text-slate-900 opacity-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:!text-slate-500";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-blue-600 hover:underline">
              ← Back to dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold">Stock Transfers</h1>

            <p className="mt-2 text-sm text-slate-500">
              Move inventory between warehouses and track transfer history.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadData();
            }}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
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
            className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total transfers" value={data.transfers.length} />
          <Stat
            label="Units transferred"
            value={data.transfers.reduce((sum, item) => sum + item.quantity, 0)}
          />
          <Stat
            label="Completed"
            value={
              data.transfers.filter((item) => item.status === "COMPLETED")
                .length
            }
          />
          <Stat label="Warehouses" value={data.warehouses.length} />
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <Truck size={23} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Create transfer</h2>
                <p className="text-sm text-slate-500">
                  Choose a batch and transfer quantity.
                </p>
              </div>
            </div>

            <form onSubmit={submitTransfer} className="space-y-5">
              <Field label="Product batch">
                <select
                  required
                  value={batchId}
                  onChange={(event) => handleBatchChange(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Select a batch</option>
                  {data.batches.map((batch) => (
                    <option key={batch.id} value={String(batch.id)}>
                      {batch.product_name} — {batch.batch_code} ({batch.status})
                    </option>
                  ))}
                </select>
              </Field>

              {selectedBatch && selectedBatch.status !== "ACTIVE" && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  This batch is {selectedBatch.status}. Only ACTIVE batches can
                  be transferred.
                </p>
              )}

              <Field label="Source warehouse">
                <select
                  required
                  value={sourceId}
                  disabled={!batchId || loading || batchLocations.length === 0}
                  onChange={(event) => handleSourceChange(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Select source warehouse</option>
                  {batchLocations.map((location) => (
                    <option key={location.id} value={String(location.id)}>
                      {location.name} — {formatNumber(location.available)}{" "}
                      available
                    </option>
                  ))}
                </select>

                {selectedBatch && batchLocations.length === 0 && (
                  <p className="mt-2 text-xs font-normal text-amber-700">
                    No inventory locations were returned for this batch.
                  </p>
                )}
              </Field>

              <Field label="Destination warehouse">
                <select
                  required
                  value={destinationId}
                  disabled={!sourceId || loading}
                  onChange={(event) => setDestinationId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Select destination warehouse</option>
                  {destinationWarehouses.map((warehouse) => (
                    <option
                      key={warehouse.id}
                      value={String(warehouse.id)}
                    >
                      {warehouse.warehouse_name} ({warehouse.warehouse_code})
                    </option>
                  ))}
                </select>
              </Field>

              {sourceLocation && (
                <div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
                  <span className="text-slate-600">Available at source</span>
                  <strong>
                    {formatNumber(sourceLocation.available)} units
                  </strong>
                </div>
              )}

              <Field label="Quantity">
                <input
                  required
                  type="number"
                  min="1"
                  max={sourceLocation?.available}
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm !text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </Field>

              <Field label="Notes (optional)">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Reason for transfer..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm !text-slate-900 placeholder:!text-gray-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </Field>

              <button
                type="submit"
                disabled={
                  loading ||
                  submitting ||
                  !selectedBatch ||
                  selectedBatch.status !== "ACTIVE"
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <ArrowRight size={18} />
                )}
                {submitting ? "Processing..." : "Complete transfer"}
              </button>

              <p className="text-xs leading-5 text-slate-500">
                Transfers update your MySQL inventory and create an event
                through the existing stored procedure.
              </p>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">Transfer history</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recorded transfers from your database.
            </p>

            <div className="relative my-5">
              <Search
                size={17}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transfers..."
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm !text-black placeholder:!text-gray-500 opacity-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Loading transfers...
              </p>
            ) : filteredTransfers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No matching transfers found.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredTransfers.map((item) => (
                  <article
                    key={item.transfer_id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold">
                          Transfer #{item.transfer_id}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.product_name} · {item.batch_code}
                        </p>
                      </div>
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        {item.status}
                      </span>
                    </div>

                    <div className="my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">From</p>
                        <p className="break-words text-sm font-semibold">
                          {item.source_name}
                        </p>
                      </div>

                      <ArrowRight size={18} className="text-blue-600" />

                      <div className="min-w-0 text-right">
                        <p className="text-xs text-slate-500">To</p>
                        <p className="break-words text-sm font-semibold">
                          {item.destination_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <strong>{formatNumber(item.quantity)} units</strong>
                      <span className="text-xs text-slate-500">
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    {item.notes && (
                      <p className="mt-3 border-t pt-3 text-sm text-slate-500">
                        {item.notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="border-t pt-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <ArrowLeftRight size={14} />
            StockSync · Inventory Traceability System
          </span>
        </footer>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold">{formatNumber(value)}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}
