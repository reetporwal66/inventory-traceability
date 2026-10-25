
"use client";

import { useCallback, useEffect, useState } from "react";

type Reservation = {
  reservation_id: number;
  batch_id: number;
  warehouse_id: number;
  quantity: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  batch_code: string;
  sku: string;
  product_name: string;
  warehouse_name: string;
};

type EligibleBatch = {
  batch_id: number;
  warehouse_id: number;
  batch_code: string;
  batch_status: string;
  sku: string;
  product_name: string;
  warehouse_name: string;
  available_quantity: number;
};

type ReservationsResponse = {
  ok: boolean;
  message?: string;
  data?: {
    reservations: Reservation[];
    inventory: EligibleBatch[];
  };
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inventory, setInventory] = useState<EligibleBatch[]>([]);
  const [batchKey, setBatchKey] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [minimumExpiry, setMinimumExpiry] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/reservations", {
        cache: "no-store",
      });

      const result: ReservationsResponse = await response.json();

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Could not load reservations.");
      }

      setReservations(result.data.reservations);
      setInventory(result.data.inventory);

      setBatchKey((current) => {
        if (
          current &&
          result.data!.inventory.some(
            (item) => `${item.batch_id}-${item.warehouse_id}` === current
          )
        ) {
          return current;
        }

        const first = result.data!.inventory[0];

        return first ? `${first.batch_id}-${first.warehouse_id}` : "";
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load reservations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setMinimumExpiry(
      new Date(Date.now() + 60000).toISOString().slice(0, 16)
    );
  }, []);

  const selectedBatch = inventory.find(
    (item) => `${item.batch_id}-${item.warehouse_id}` === batchKey
  );

  async function createReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedBatch) {
      setError("No eligible stock batch is available.");
      return;
    }

    const requestedQuantity = Number(quantity);

    if (
      !Number.isSafeInteger(requestedQuantity) ||
      requestedQuantity <= 0
    ) {
      setError("Enter a positive whole-number quantity.");
      return;
    }

    if (requestedQuantity > selectedBatch.available_quantity) {
      setError(
        `Only ${selectedBatch.available_quantity} units are currently available.`
      );
      return;
    }

    if (expiresAt && minimumExpiry && expiresAt < minimumExpiry) {
      setError("Reservation expiry must be a future date and time.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: selectedBatch.batch_id,
          warehouseId: selectedBatch.warehouse_id,
          quantity: requestedQuantity,
          expiresAt: expiresAt || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Reservation failed.");
      }

      setSuccess("Stock reserved successfully!");
      setQuantity("1");
      setExpiresAt("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Reservation failed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelReservation(reservationId: number) {
    const confirmed = window.confirm(
      `Cancel reservation #${reservationId}? Its reserved stock will be released.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setCancellingId(reservationId);

    try {
      const response = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not cancel reservation.");
      }

      setSuccess(result.message || "Reservation cancelled successfully.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel reservation."
      );
    } finally {
      setCancellingId(null);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "No expiry";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString("en-IN");
  }

  function statusStyle(status: string) {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-100 text-emerald-800";
      case "FULFILLED":
        return "bg-blue-100 text-blue-800";
      case "CANCELLED":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-amber-100 text-amber-800";
    }
  }

  const activeCount = reservations.filter(
    (item) => item.status === "ACTIVE"
  ).length;

  const totalReserved = reservations
    .filter((item) => item.status === "ACTIVE")
    .reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Inventory management
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Stock Reservations
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Reserve available stock and keep track of reservation history.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading || saving || cancellingId !== null}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-100 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
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
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total reservations</p>
            <p className="mt-2 text-3xl font-bold">{reservations.length}</p>
            <p className="mt-1 text-xs text-slate-400">
              Includes cancelled and fulfilled reservations
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Active reservations</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {activeCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Reservations currently active
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Units reserved</p>
            <p className="mt-2 text-3xl font-bold text-indigo-700">
              {totalReserved}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Across active reservations
            </p>
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Create reservation</h2>
            <p className="mt-1 text-sm text-slate-500">
              Only active batches with available stock are listed.
            </p>

            <form onSubmit={createReservation} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="batch"
                  className="mb-2 block text-sm font-semibold"
                >
                  Product, batch and warehouse
                </label>

                <select
                  id="batch"
                  value={batchKey}
                  onChange={(event) => setBatchKey(event.target.value)}
                  required
                  disabled={loading || inventory.length === 0 || saving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                >
                  {inventory.length === 0 && (
                    <option value="">No eligible stock available</option>
                  )}

                  {inventory.map((item) => (
                    <option
                      key={`${item.batch_id}-${item.warehouse_id}`}
                      value={`${item.batch_id}-${item.warehouse_id}`}
                    >
                      {item.product_name} · {item.batch_code} ·{" "}
                      {item.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBatch && (
                <div className="rounded-xl bg-indigo-50 p-4">
                  <p className="text-sm text-indigo-900">Available stock</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-700">
                    {selectedBatch.available_quantity} units
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">
                    SKU: {selectedBatch.sku}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="quantity"
                  className="mb-2 block text-sm font-semibold"
                >
                  Quantity to reserve
                </label>

                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedBatch?.available_quantity ?? undefined}
                  step="1"
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={!selectedBatch || saving}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="expiry"
                  className="mb-2 block text-sm font-semibold"
                >
                  Reservation expiry (optional)
                </label>

                <input
                  id="expiry"
                  type="datetime-local"
                  min={minimumExpiry}
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Leave blank if no expiry is required.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving || loading || !selectedBatch}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating reservation..." : "Reserve stock"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Reservation history</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review all previous and current reservations.
            </p>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Loading reservations...
              </p>
            ) : reservations.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No reservations yet.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {reservations.map((item) => (
                  <article
                    key={item.reservation_id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">
                          {item.product_name}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Reservation #{item.reservation_id} ·{" "}
                          {item.batch_code}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-400">Quantity</p>
                        <p className="mt-1 font-semibold">
                          {item.quantity} units
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Warehouse</p>
                        <p className="mt-1 font-medium">
                          {item.warehouse_name}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Created</p>
                        <p className="mt-1">{formatDate(item.created_at)}</p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Expires</p>
                        <p className="mt-1">{formatDate(item.expires_at)}</p>
                      </div>
                    </div>

                    {item.status === "ACTIVE" && (
                      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            void cancelReservation(item.reservation_id)
                          }
                          disabled={
                            saving ||
                            loading ||
                            cancellingId !== null
                          }
                          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {cancellingId === item.reservation_id
                            ? "Cancelling..."
                            : "Cancel reservation"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
