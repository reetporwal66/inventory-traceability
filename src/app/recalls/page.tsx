
"use client";

import { useCallback, useEffect, useState } from "react";

type Recall = {
  recall_id: number;
  recall_code: string;
  title: string;
  reason: string;
  severity: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  batch_count: number | string;
  affected_quantity: number | string;
  quarantine_quantity: number | string;
  recovered_quantity: number | string;
};

type Batch = {
  batch_id: number;
  batch_code: string;
  batch_status: string;
  product_name: string;
  sku: string;
};

type Recovery = {
  recovery_id: number;
  recall_id: number;
  batch_id: number;
  warehouse_id: number | null;
  recipient_id: number | null;
  quantity: number;
  action_type: string;
  notes: string | null;
  created_at: string;
  batch_code: string;
  product_name: string;
  warehouse_name: string | null;
  recipient_name: string | null;
};

type Defect = {
  defect_id: number;
  defect_code: string;
  batch_code: string;
  product_name: string;
  description: string;
  affected_quantity: number;
  severity: string;
  status: string;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  data?: {
    recalls: Recall[];
    batches: Batch[];
    recoveries: Recovery[];
  };
};

export default function RecallsPage() {
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [defectId, setDefectId] = useState("");
  const [recallTitle, setRecallTitle] = useState("");
  const [recallReason, setRecallReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/recalls", {
        cache: "no-store",
      });
      const result: ApiResponse = await response.json();

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Could not load recalls.");
      }

      setRecalls(result.data.recalls);
      setBatches(result.data.batches);
      setRecoveries(result.data.recoveries);

      const defectResponse = await fetch("/api/defects", {
        cache: "no-store",
      });
      const defectResult = await defectResponse.json();

      if (defectResponse.ok && defectResult.ok) {
        setDefects(
          (defectResult.data.defects as Defect[]).filter(
            (defect) => defect.status === "CONFIRMED"
          )
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load recalls."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createRecall() {
    setError("");
    setNotice("");

    if (!defectId || !recallTitle.trim() || !recallReason.trim()) {
      setError("Select a confirmed defect and enter the title and reason.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/recalls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defectId: Number(defectId),
          title: recallTitle.trim(),
          reason: recallReason.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not initiate recall.");
      }

      setNotice(
        `Recall ${result.data.recallCode} created successfully!`
      );
      setDefectId("");
      setRecallTitle("");
      setRecallReason("");

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Recall creation failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
  }

  function severityStyle(severity: string) {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 text-red-800";
      case "HIGH":
        return "bg-orange-100 text-orange-800";
      case "MEDIUM":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function statusStyle(status: string) {
    switch (status) {
      case "OPEN":
        return "bg-red-50 text-red-700";
      case "IN_PROGRESS":
        return "bg-amber-50 text-amber-800";
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  const openCount = recalls.filter(
    (recall) =>
      recall.status === "OPEN" || recall.status === "IN_PROGRESS"
  ).length;

  const totalAffected = recalls.reduce(
    (sum, recall) => sum + Number(recall.affected_quantity || 0),
    0
  );

  const totalRecovered = recalls.reduce(
    (sum, recall) => sum + Number(recall.recovered_quantity || 0),
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
              Product Recalls
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Track affected batches, quarantine quantities and recovery actions.
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

        {notice && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {notice}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Initiate a recall</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a confirmed defect to create a recall for its affected batch.
          </p>

          <div className="mt-5 grid gap-4">
            <label className="text-sm font-medium">
              Confirmed defect
              <select
                value={defectId}
                onChange={(e) => {
                  setDefectId(e.target.value);
                  const selected = defects.find(
                    (d) => d.defect_id === Number(e.target.value)
                  );
                  if (selected && !recallTitle) {
                    setRecallTitle(
                      `Recall for ${selected.batch_code}`
                    );
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"
              >
                <option value="">Select a confirmed defect</option>
                {defects.map((defect) => (
                  <option
                    key={defect.defect_id}
                    value={defect.defect_id}
                  >
                    {defect.defect_code} — {defect.product_name} /{" "}
                    {defect.batch_code} ({defect.severity})
                  </option>
                ))}
              </select>
            </label>

            {defects.length === 0 && (
              <p className="text-sm text-amber-700">
                No confirmed defects available. Refresh the page after a defect is confirmed.
              </p>
            )}

            <label className="text-sm font-medium">
              Recall title
              <input
                value={recallTitle}
                onChange={(e) => setRecallTitle(e.target.value)}
                maxLength={180}
                placeholder="e.g. Damaged packaging recall"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <label className="text-sm font-medium">
              Recall reason
              <textarea
                value={recallReason}
                onChange={(e) => setRecallReason(e.target.value)}
                maxLength={5000}
                rows={3}
                placeholder="Explain why this batch needs to be recalled"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3"
              />
            </label>

            <button
              type="button"
              onClick={() => void createRecall()}
              disabled={submitting || loading || defects.length === 0}
              className="w-fit rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Creating recall..." : "Initiate recall"}
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total recalls</p>
            <p className="mt-2 text-3xl font-bold">{recalls.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Open / in progress</p>
            <p className="mt-2 text-3xl font-bold text-red-700">{openCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Affected units</p>
            <p className="mt-2 text-3xl font-bold">{totalAffected}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Recovered units</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {totalRecovered}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Recall register</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recall status and quantity summaries from MySQL.
          </p>

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading recalls...
            </p>
          ) : recalls.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No recalls found.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {recalls.map((recall) => {
                const affected = Number(recall.affected_quantity || 0);
                const recovered = Number(recall.recovered_quantity || 0);
                const progress =
                  affected > 0
                    ? Math.min(100, (recovered / affected) * 100)
                    : 0;

                return (
                  <article
                    key={recall.recall_id}
                    className="rounded-xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          {recall.recall_code}
                        </p>
                        <h3 className="mt-1 text-lg font-bold">
                          {recall.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${severityStyle(recall.severity)}`}
                        >
                          {recall.severity}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(recall.status)}`}
                        >
                          {recall.status.replaceAll("_", " ")}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {recall.reason}
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-400">Affected batches</p>
                        <p className="mt-1 font-semibold">
                          {Number(recall.batch_count)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Affected units</p>
                        <p className="mt-1 font-semibold">{affected}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Quarantined units</p>
                        <p className="mt-1 font-semibold">
                          {Number(recall.quarantine_quantity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Recovered units</p>
                        <p className="mt-1 font-semibold text-emerald-700">
                          {recovered}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Recovery progress</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                      <span>Started: {formatDate(recall.started_at)}</span>
                      <span>Completed: {formatDate(recall.completed_at)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Batch register</h2>
          <p className="mt-1 text-sm text-slate-500">
            Batch status helps identify stock affected by recalls.
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">Batch</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.batch_id} className="border-b border-slate-100">
                    <td className="px-3 py-4 font-semibold">{batch.batch_code}</td>
                    <td className="px-3 py-4">{batch.product_name}</td>
                    <td className="px-3 py-4">{batch.sku}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          batch.batch_status === "RECALLED"
                            ? "bg-red-100 text-red-800"
                            : batch.batch_status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {batch.batch_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Recovery history</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recorded quarantine, return, destruction and release actions.
          </p>

          {recoveries.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">
              No recovery actions recorded.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {recoveries.map((item) => (
                <article
                  key={item.recovery_id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{item.action_type}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.product_name} · {item.batch_code}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                      {item.quantity} units
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                    <span>Recall #{item.recall_id}</span>
                    {item.warehouse_name && (
                      <span>Warehouse: {item.warehouse_name}</span>
                    )}
                    {item.recipient_name && (
                      <span>Recipient: {item.recipient_name}</span>
                    )}
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                  {item.notes && (
                    <p className="mt-3 text-sm text-slate-600">{item.notes}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
