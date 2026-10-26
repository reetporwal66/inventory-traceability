
"use client";

import { useCallback, useEffect, useState } from "react";

type Shipment = {
  shipment_id: number;
  shipment_code: string;
  recipient_id: number;
  source_warehouse_id: number;
  status: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  recipient_name: string;
  organization_name: string | null;
  delivery_address: string;
  city: string | null;
  source_warehouse_name: string;
  item_count: number;
  total_quantity: number | string;
};

type Recipient = {
  recipient_id: number;
  recipient_name: string;
  organization_name: string | null;
  delivery_address: string;
  city: string | null;
};

type Warehouse = {
  warehouse_id: number;
  warehouse_name: string;
  warehouse_code: string;
};

type Batch = {
  batch_id: number;
  warehouse_id: number;
  batch_code: string;
  sku: string;
  product_name: string;
  warehouse_name: string;
  available_quantity: number;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  data?: {
    shipments: Shipment[];
    recipients: Recipient[];
    warehouses: Warehouse[];
    batches: Batch[];
  };
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  const [recipientId, setRecipientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [batchKey, setBatchKey] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [shipmentCode, setShipmentCode] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingShipmentId, setUpdatingShipmentId] = useState<number | null>(null);
  const [pendingStatuses, setPendingStatuses] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/shipments", {
        cache: "no-store",
      });
      const result: ApiResponse = await response.json();

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Could not load shipments.");
      }

      setShipments(result.data.shipments);
      setRecipients(result.data.recipients);
      setWarehouses(result.data.warehouses);
      setBatches(result.data.batches);

      setRecipientId((current) =>
        current && result.data!.recipients.some(
          (item) => String(item.recipient_id) === current
        )
          ? current
          : String(result.data!.recipients[0]?.recipient_id ?? "")
      );

      setWarehouseId((current) =>
        current && result.data!.warehouses.some(
          (item) => String(item.warehouse_id) === current
        )
          ? current
          : String(result.data!.warehouses[0]?.warehouse_id ?? "")
      );

      setBatchKey((current) =>
        current && result.data!.batches.some(
          (item) => `${item.batch_id}-${item.warehouse_id}` === current
        )
          ? current
          : ""
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load shipments."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableBatches = batches.filter(
    (batch) => String(batch.warehouse_id) === warehouseId
  );

  const selectedBatch = availableBatches.find(
    (batch) => `${batch.batch_id}-${batch.warehouse_id}` === batchKey
  );

  function formatDate(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
  }

  function statusStyle(status: string) {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-100 text-emerald-800";
      case "DISPATCHED":
      case "IN_TRANSIT":
        return "bg-blue-100 text-blue-800";
      case "PREPARING":
        return "bg-amber-100 text-amber-800";
      case "DISCREPANCY":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  async function createShipment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const requestedQuantity = Number(quantity);

    if (!shipmentCode.trim()) {
      setError("Enter a shipment code.");
      return;
    }

    if (!recipientId || !warehouseId || !selectedBatch) {
      setError("Select a recipient, warehouse and eligible batch.");
      return;
    }

    if (
      !Number.isSafeInteger(requestedQuantity) ||
      requestedQuantity <= 0 ||
      requestedQuantity > selectedBatch.available_quantity
    ) {
      setError(
        `Enter a whole-number quantity between 1 and ${selectedBatch.available_quantity}.`
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentCode: shipmentCode.trim(),
          recipientId: Number(recipientId),
          warehouseId: Number(warehouseId),
          batchId: selectedBatch.batch_id,
          quantity: requestedQuantity,
          notes: notes.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not create shipment.");
      }

      setSuccess(
        `Shipment ${shipmentCode.trim()} created successfully.`
      );
      setShipmentCode("");
      setQuantity("1");
      setNotes("");
      setBatchKey("");

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create shipment."
      );
    } finally {
      setSaving(false);
    }
  }

  
async function updateShipmentStatus(shipment: Shipment) {
  const nextStatus = pendingStatuses[shipment.shipment_id];

  if (!nextStatus || nextStatus === shipment.status) {
    setError("Choose a different status first.");
    return;
  }

  setError("");
  setSuccess("");
  setUpdatingShipmentId(shipment.shipment_id);

  try {
    const response = await fetch(
      `/api/shipments/${shipment.shipment_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Could not update shipment status.");
    }

    setSuccess(
      `Shipment ${shipment.shipment_code} updated to ${nextStatus.replaceAll("_", " ")}.`
    );

    setPendingStatuses((current) => ({
      ...current,
      [shipment.shipment_id]: nextStatus,
    }));

    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not update shipment status."
    );
  } finally {
    setUpdatingShipmentId(null);
  }
}


  const deliveredCount = shipments.filter(
    (shipment) => shipment.status === "DELIVERED"
  ).length;

  const totalQuantity = shipments.reduce(
    (sum, shipment) => sum + Number(shipment.total_quantity || 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Inventory management
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Shipments
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Track outgoing stock, delivery recipients and shipment status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
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
            <p className="text-sm text-slate-500">Total shipments</p>
            <p className="mt-2 text-3xl font-bold">{shipments.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Delivered shipments</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {deliveredCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Units dispatched</p>
            <p className="mt-2 text-3xl font-bold text-indigo-700">
              {totalQuantity}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Shipment overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Existing shipments retrieved from MySQL.
          </p>

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading shipments...
            </p>
          ) : shipments.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No shipments found.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {shipments.map((shipment) => (
                <article
                  key={shipment.shipment_id}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">
                        {shipment.shipment_code}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Shipment #{shipment.shipment_id}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(shipment.status)}`}
                    >
                      {shipment.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Recipient
                      </p>
                      <p className="mt-1 font-semibold">
                        {shipment.recipient_name}
                      </p>
                      {shipment.organization_name && (
                        <p className="text-sm text-slate-500">
                          {shipment.organization_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Source warehouse
                      </p>
                      <p className="mt-1 font-medium">
                        {shipment.source_warehouse_name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Shipment quantity
                      </p>
                      <p className="mt-1 font-semibold">
                        {Number(shipment.total_quantity)} units
                      </p>
                      <p className="text-sm text-slate-500">
                        {Number(shipment.item_count)} item types
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Delivery address
                      </p>
                      <p className="mt-1 text-sm">
                        {shipment.delivery_address}
                        {shipment.city ? `, ${shipment.city}` : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Dispatched
                      </p>
                      <p className="mt-1 text-sm">
                        {formatDate(shipment.dispatched_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Delivered
                      </p>
                      <p className="mt-1 text-sm">
                        {formatDate(shipment.delivered_at)}
                      </p>
                    </div>
                  </div>

                  
              {shipment.notes && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-400">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {shipment.notes}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                <div className="min-w-48 flex-1">
                  <label
                    htmlFor={`status-${shipment.shipment_id}`}
                    className="mb-2 block text-sm font-semibold"
                  >
                    Update shipment status
                  </label>

                  <select
                    id={`status-${shipment.shipment_id}`}
                    value={
                      pendingStatuses[shipment.shipment_id] ??
                      shipment.status
                    }
                    onChange={(event) =>
                      setPendingStatuses((current) => ({
                        ...current,
                        [shipment.shipment_id]: event.target.value,
                      }))
                    }
                    disabled={
                      updatingShipmentId === shipment.shipment_id
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
                  >
                    {(
                      {
                        PREPARING: [
                          "PREPARING",
                          "DISPATCHED",
                          "CANCELLED",
                        ],
                        DISPATCHED: [
                          "DISPATCHED",
                          "IN_TRANSIT",
                          "DISCREPANCY",
                        ],
                        IN_TRANSIT: [
                          "IN_TRANSIT",
                          "DELIVERED",
                          "DISCREPANCY",
                        ],
                        DELIVERED: ["DELIVERED"],
                        CANCELLED: ["CANCELLED"],
                        DISCREPANCY: [
                          "DISCREPANCY",
                          "IN_TRANSIT",
                          "DELIVERED",
                        ],
                      } as Record<string, string[]>
                    )[shipment.status]?.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => void updateShipmentStatus(shipment)}
                  disabled={
                    updatingShipmentId === shipment.shipment_id ||
                    (pendingStatuses[shipment.shipment_id] ??
                      shipment.status) === shipment.status
                  }
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingShipmentId === shipment.shipment_id
                    ? "Updating..."
                    : "Update Status"}
                </button>
              </div>
            </article>

              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Create shipment</h2>
          <p className="mt-1 text-sm text-slate-500">
            Shipment creation validates available stock and updates MySQL
            within a transaction.
          </p>

          <form onSubmit={createShipment} className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="shipmentCode" className="mb-2 block text-sm font-semibold">
                Shipment code
              </label>
              <input
                id="shipmentCode"
                value={shipmentCode}
                onChange={(event) => setShipmentCode(event.target.value)}
                maxLength={80}
                required
                placeholder="e.g. SHIP-2026-002"
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="recipient" className="mb-2 block text-sm font-semibold">
                Recipient
              </label>
              <select
                id="recipient"
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                required
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              >
                <option value="">Select recipient</option>
                {recipients.map((recipient) => (
                  <option key={recipient.recipient_id} value={recipient.recipient_id}>
                    {recipient.recipient_name}
                    {recipient.organization_name ? ` — ${recipient.organization_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="warehouse" className="mb-2 block text-sm font-semibold">
                Source warehouse
              </label>
              <select
                id="warehouse"
                value={warehouseId}
                onChange={(event) => {
                  setWarehouseId(event.target.value);
                  setBatchKey("");
                }}
                required
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                    {warehouse.warehouse_name} ({warehouse.warehouse_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="batch" className="mb-2 block text-sm font-semibold">
                Batch
              </label>
              <select
                id="batch"
                value={batchKey}
                onChange={(event) => setBatchKey(event.target.value)}
                required
                disabled={saving || !warehouseId || availableBatches.length === 0}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm disabled:bg-slate-100"
              >
                <option value="">Select eligible batch</option>
                {availableBatches.map((batch) => (
                  <option
                    key={`${batch.batch_id}-${batch.warehouse_id}`}
                    value={`${batch.batch_id}-${batch.warehouse_id}`}
                  >
                    {batch.product_name} · {batch.batch_code} · {batch.available_quantity} available
                  </option>
                ))}
              </select>
              {warehouseId && availableBatches.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No eligible stock is available at this warehouse.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="quantity" className="mb-2 block text-sm font-semibold">
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                max={selectedBatch?.available_quantity ?? undefined}
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
                disabled={saving || !selectedBatch}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
              {selectedBatch && (
                <p className="mt-1 text-xs text-slate-500">
                  Available: {selectedBatch.available_quantity} units
                </p>
              )}
            </div>

            <div>
              <label htmlFor="notes" className="mb-2 block text-sm font-semibold">
                Notes (optional)
              </label>
              <input
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                disabled={saving}
                placeholder="Delivery instructions"
                className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving || loading || !selectedBatch || !recipientId}
                className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating shipment..." : "Create shipment"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
