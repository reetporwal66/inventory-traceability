
"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Recall = {
  recall_id: number;
  recall_code: string;
  title: string;
  reason: string | null;
  status: string;
  started_at: string | null;
  completed_at?: string | null;
};

type Batch = {
  batch_id: number;
  batch_code: string;
  product_name: string;
  sku: string | null;
  category: string | null;
  batch_status: string | null;
  supplier_name: string | null;
  contact_name: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_address: string | null;
  manufacture_date: string | null;
  expiry_date: string | null;
  unit_cost: number | string | null;
  affected_quantity: number | string | null;
  quarantine_quantity: number | string | null;
  recovered_quantity: number | string | null;
};

type InventoryItem = {
  batch_id: number;
  batch_code: string;
  warehouse_id: number | null;
  warehouse_name: string | null;
  warehouse_code: string | null;
  city: string | null;
  quantity_on_hand: number | string | null;
  quantity_reserved: number | string | null;
  quantity_quarantined: number | string | null;
  available_quantity: number | string | null;
};

type Shipment = {
  shipment_item_id: number;
  shipment_code: string;
  shipment_status: string | null;
  batch_code: string;
  source_warehouse: string | null;
  recipient_name: string | null;
  organization_name: string | null;
  delivery_address: string | null;
  city: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  quantity_dispatched: number | string | null;
  quantity_received: number | string | null;
  shipment_created_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  discrepancy_notes: string | null;
  shipment_notes: string | null;
};

type Recovery = {
  recovery_id: number;
  recall_id: number;
  batch_id: number;
  batch_code: string;
  quantity: number | string;
  action_type: string;
  created_at: string | null;
  warehouse_name: string | null;
  recipient_name: string | null;
  recorded_by_name: string | null;
  notes: string | null;
};

type TraceabilityData = {
  recall: Recall;
  batches: Batch[];
  inventory: InventoryItem[];
  shipments: Shipment[];
  recoveries: Recovery[];
};

type RecallsApiResponse = {
  ok: boolean;
  message?: string;
  data?: {
    recalls?: Recall[];
  };
};

type TraceabilityApiResponse = {
  ok: boolean;
  message?: string;
  data?: TraceabilityData;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}

function date(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString();
}

function display(value: unknown): string {
  return value === null || value === undefined || value === ""
    ? "Not recorded"
    : String(value);
}

function Value({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <p className="break-words text-sm">
      <span className="text-slate-500">{label}: </span>
      <strong>{display(value)}</strong>
    </p>
  );
}

function Status({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const styles = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export default function TraceabilityPage() {
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [recallId, setRecallId] = useState("");
  const [data, setData] = useState<TraceabilityData | null>(null);
  const [loadingRecalls, setLoadingRecalls] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRecalls() {
      try {
        const response = await fetch("/api/recalls", {
          cache: "no-store",
        });

        const json: RecallsApiResponse = await response.json();

        if (!response.ok || !json.ok) {
          throw new Error(json.message || "Could not load recalls.");
        }

        const rows = json.data?.recalls ?? [];

        if (!cancelled) {
          setRecalls(rows);

          if (rows.length > 0) {
            setRecallId(String(rows[0].recall_id));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load recalls."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingRecalls(false);
        }
      }
    }

    void loadRecalls();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recallId) {
      return;
    }

    let cancelled = false;

    async function loadTrace() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await fetch(
          `/api/recalls/trace?recallId=${encodeURIComponent(recallId)}`,
          { cache: "no-store" }
        );

        const json: TraceabilityApiResponse = await response.json();

        if (!response.ok || !json.ok || !json.data) {
          throw new Error(json.message || "Could not load traceability.");
        }

        if (!cancelled) {
          setData(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load traceability."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTrace();

    return () => {
      cancelled = true;
    };
  }, [recallId]);

  const inventoryTotal = data
    ? data.inventory.reduce(
        (sum, item) => sum + Number(item.quantity_on_hand ?? 0),
        0
      )
    : 0;

  const recoveredTotal = data
    ? data.recoveries.reduce(
        (sum, item) => sum + Number(item.quantity ?? 0),
        0
      )
    : 0;

  const quarantinedTotal = data
    ? data.inventory.reduce(
        (sum, item) => sum + Number(item.quantity_quarantined ?? 0),
        0
      )
    : 0;

  const hasRecoveryInventoryWarning =
    !!data &&
    recoveredTotal > 0 &&
    data.inventory.length > 0 &&
    quarantinedTotal === 0;

  return (
    <main className="min-h-screen space-y-6 bg-slate-50 p-4 text-slate-900 sm:p-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
          StockSync · End-to-end trace
        </p>
        <h1 className="mt-2 text-3xl font-bold">Product Traceability</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Trace a recalled batch from its supplier through warehouse inventory,
          recorded shipments, recipients and recovery actions.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="recall" className="mb-2 block font-semibold">
          Select recall
        </label>

        <select
          id="recall"
          value={recallId}
          onChange={(event) => setRecallId(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white p-3"
          disabled={loadingRecalls || recalls.length === 0}
        >
          <option value="">
            {loadingRecalls ? "Loading recalls..." : "Choose a recall"}
          </option>

          {recalls.map((recall) => (
            <option key={recall.recall_id} value={recall.recall_id}>
              {recall.recall_code} — {recall.title}
            </option>
          ))}
        </select>

        {!loadingRecalls && recalls.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">
            No recalls were returned by the API.
          </p>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {loading && (
        <p className="text-slate-600">Loading traceability records...</p>
      )}

      {data && !loading && (
        <>
          <Section title="Traceability summary">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Recall status</p>
                <p className="mt-1 text-lg font-bold">
                  {display(data.recall.status)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Linked batches</p>
                <p className="mt-1 text-lg font-bold">
                  {data.batches.length}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Recorded shipments</p>
                <p className="mt-1 text-lg font-bold">
                  {data.shipments.length}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Recovery records</p>
                <p className="mt-1 text-lg font-bold">
                  {data.recoveries.length}
                </p>
              </div>
            </div>
          </Section>

          <Section title="Recall overview">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold">
                {data.recall.recall_code} — {data.recall.title}
              </h3>
              <Status tone="warning">{display(data.recall.status)}</Status>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              {data.recall.reason || "No reason recorded"}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Started: {date(data.recall.started_at)}
            </p>
          </Section>

          <Section title="1 · Supplier → Product → Batch">
            {data.batches.length === 0 ? (
              <Empty text="No batches are linked to this recall." />
            ) : (
              <div className="space-y-4">
                {data.batches.map((batch) => (
                  <article
                    key={batch.batch_id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">{batch.batch_code}</h3>
                      <Status tone="success">Batch linked</Status>
                    </div>

                    <p className="mt-1 font-medium">
                      {batch.product_name} ({display(batch.sku)})
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Category: {display(batch.category)} · Batch status:{" "}
                      {display(batch.batch_status)}
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <h4 className="mb-2 font-semibold">Supplier</h4>
                        <p className="font-medium">
                          {batch.supplier_name || "No supplier linked"}
                        </p>
                        <p className="text-sm">
                          Contact: {display(batch.contact_name)}
                        </p>
                        <p className="break-words text-sm">
                          Email: {display(batch.supplier_email)}
                        </p>
                        <p className="text-sm">
                          Phone: {display(batch.supplier_phone)}
                        </p>
                        <p className="text-sm">
                          Address: {display(batch.supplier_address)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <h4 className="mb-2 font-semibold">Batch details</h4>
                        <Value
                          label="Manufactured"
                          value={date(batch.manufacture_date)}
                        />
                        <Value
                          label="Expires"
                          value={date(batch.expiry_date)}
                        />
                        <Value label="Unit cost" value={batch.unit_cost} />
                        <Value
                          label="Affected"
                          value={`${batch.affected_quantity ?? 0} units`}
                        />
                        <Value
                          label="Quarantined (recall record)"
                          value={`${batch.quarantine_quantity ?? 0} units`}
                        />
                        <Value
                          label="Recovered (recall record)"
                          value={`${batch.recovered_quantity ?? 0} units`}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section title="2 · Batch → Warehouse → Inventory">
            {data.inventory.length === 0 ? (
              <Empty text="No inventory records were found for these batches." />
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-600">
                  On-hand quantity across returned inventory rows:{" "}
                  <strong>{inventoryTotal} units</strong>
                </p>

                <div className="space-y-3">
                  {data.inventory.map((item, index) => (
                    <article
                      key={`${item.batch_id}-${item.warehouse_id ?? "none"}-${index}`}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">
                          {item.batch_code} →{" "}
                          {item.warehouse_name || "No warehouse linked"}
                        </p>

                        <Status
                          tone={item.warehouse_name ? "success" : "warning"}
                        >
                          {item.warehouse_name
                            ? "Inventory linked"
                            : "Warehouse missing"}
                        </Status>
                      </div>

                      <p className="text-sm text-slate-600">
                        {item.warehouse_code || "No warehouse code"}
                        {item.city ? ` · ${item.city}` : ""}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Value
                          label="On hand"
                          value={item.quantity_on_hand}
                        />
                        <Value
                          label="Reserved"
                          value={item.quantity_reserved}
                        />
                        <Value
                          label="Quarantined (inventory)"
                          value={item.quantity_quarantined}
                        />
                        <Value
                          label="Available"
                          value={item.available_quantity}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section title="3 · Dispatch → Shipment → Recipient">
            {data.shipments.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Status tone="warning">No linked dispatch found</Status>
                  <span className="font-semibold">
                    Shipment history unavailable
                  </span>
                </div>

                <p className="mt-2 text-sm text-amber-900">
                  No non-cancelled shipment items are linked to the recalled
                  batch in the current database. Therefore, this trace cannot
                  identify a downstream recipient from shipment records.
                </p>

                <p className="mt-2 text-sm text-amber-900">
                  This means the shipment link is missing from the available
                  records; it does not prove that the batch was never dispatched.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.shipments.map((shipment) => (
                  <article
                    key={shipment.shipment_item_id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">
                        {shipment.shipment_code}
                      </h3>

                      <Status
                        tone={
                          shipment.shipment_status === "DELIVERED"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {display(shipment.shipment_status)}
                      </Status>
                    </div>

                    <p className="mt-2">
                      Batch: <strong>{shipment.batch_code}</strong>
                    </p>

                    <p className="text-sm">
                      Source warehouse: {display(shipment.source_warehouse)}
                    </p>

                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <h4 className="font-semibold">Recipient</h4>

                      <p>
                        {shipment.recipient_name || "Recipient not recorded"}
                        {shipment.organization_name
                          ? ` · ${shipment.organization_name}`
                          : ""}
                      </p>

                      <p className="text-sm">
                        Address: {display(shipment.delivery_address)}
                        {shipment.city ? `, ${shipment.city}` : ""}
                      </p>

                      <p className="break-words text-sm">
                        Email: {display(shipment.recipient_email)}
                      </p>

                      <p className="text-sm">
                        Phone: {display(shipment.recipient_phone)}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Value
                        label="Dispatched quantity"
                        value={shipment.quantity_dispatched}
                      />
                      <Value
                        label="Received quantity"
                        value={shipment.quantity_received}
                      />
                      <Value
                        label="Created"
                        value={date(shipment.shipment_created_at)}
                      />
                      <Value
                        label="Dispatched"
                        value={date(shipment.dispatched_at)}
                      />
                      <Value
                        label="Delivered"
                        value={date(shipment.delivered_at)}
                      />
                    </div>

                    {shipment.discrepancy_notes && (
                      <p className="mt-2 text-sm text-amber-700">
                        Discrepancy: {shipment.discrepancy_notes}
                      </p>
                    )}

                    {shipment.shipment_notes && (
                      <p className="mt-2 text-sm text-slate-600">
                        Notes: {shipment.shipment_notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section title="4 · Recall → Recovery actions">
            {data.recoveries.length === 0 ? (
              <Empty text="No recovery actions have been recorded in MySQL for this recall." />
            ) : (
              <div className="space-y-3">
                {data.recoveries.map((recovery) => (
                  <article
                    key={recovery.recovery_id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">
                        {recovery.action_type} — {recovery.batch_code}
                      </h3>

                      <Status tone="success">
                        {recovery.quantity} units recorded
                      </Status>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {date(recovery.created_at)}
                    </p>

                    {recovery.warehouse_name && (
                      <p className="text-sm">
                        Warehouse: {recovery.warehouse_name}
                      </p>
                    )}

                    {recovery.recipient_name && (
                      <p className="text-sm">
                        Recipient: {recovery.recipient_name}
                      </p>
                    )}

                    {recovery.recorded_by_name && (
                      <p className="text-sm">
                        Recorded by: {recovery.recorded_by_name}
                      </p>
                    )}

                    <p className="mt-2 text-sm">
                      Destination:{" "}
                      {recovery.warehouse_name ||
                        recovery.recipient_name ||
                        "Not linked to a warehouse or recipient"}
                    </p>

                    {recovery.notes && (
                      <p className="mt-2 text-sm">{recovery.notes}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </Section>

          {hasRecoveryInventoryWarning && (
            <section
              role="status"
              className="rounded-2xl border border-amber-300 bg-amber-50 p-5"
            >
              <h2 className="font-bold text-amber-900">
                Review recovery and inventory quantities
              </h2>

              <p className="mt-2 text-sm text-amber-900">
                Recovery records total {recoveredTotal} units, while the
                inventory rows report {quarantinedTotal} quarantined units.
                Confirm whether recovered goods should affect stock or whether
                these quantities represent different stages of the process.
                This page does not change inventory quantities.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
