"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  Send,
} from "lucide-react";

type Batch = {
  batch_id: number;
  batch_code: string;
  batch_status: string;
  product_name: string;
  sku: string;
};

type Defect = {
  defect_id: number;
  defect_code: string;
  batch_code: string;
  product_name: string;
  defect_type: string;
  description: string;
  affected_quantity: number;
  severity: string;
  status: string;
  reporter_name: string | null;
  created_at: string;
  review_notes?: string | null;
  reviewer_name?: string | null;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function badgeClass(value: string) {
  if (value === "CRITICAL" || value === "HIGH") {
    return "bg-rose-50 text-rose-700";
  }
  if (value === "MEDIUM" || value === "UNDER_REVIEW") {
    return "bg-amber-50 text-amber-700";
  }
  if (value === "CONFIRMED" || value === "RECALL_INITIATED") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (value === "REJECTED") {
    return "bg-slate-100 text-slate-600";
  }
  return "bg-blue-50 text-blue-700";
}

export default function DefectsPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [batchId, setBatchId] = useState("4");
  const [defectType, setDefectType] = useState("DAMAGED_PACKAGING");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [severity, setSeverity] = useState("MEDIUM");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    userId: number;
    name: string;
    email: string;
    role: "ADMIN" | "INVENTORY_STAFF" | "QUALITY_STAFF";
  } | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          router.push("/login");
          return null;
        }
        const result = await response.json();
        return result.ok ? result.user : null;
      })
      .then((user) => {
        if (user) setCurrentUser(user);
        else router.push("/login");
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  async function reviewDefect(defectId: number, action: string) {
    setError("");
    setSuccess("");
    setReviewingId(defectId);

    try {
      const response = await fetch(`/api/defects/${defectId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          review_notes: reviewNotes[defectId] ?? "",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not review defect.");
      }

      setSuccess(`${defectId}: status changed to ${action.replace(/_/g, " ")}.`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not review defect."
      );
    } finally {
      setReviewingId(null);
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/defects", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not load defect reports.");
      }

      setBatches(result.data.batches);
      setDefects(result.data.defects);

      if (
        result.data.batches.length &&
        !result.data.batches.some(
          (batch: Batch) => String(batch.batch_id) === batchId
        )
      ) {
        const active = result.data.batches.find(
          (batch: Batch) => batch.batch_status === "ACTIVE"
        );
        if (active) setBatchId(String(active.batch_id));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load defect reports."
      );
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function submitDefect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/defects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: Number(batchId),
          defect_type: defectType,
          description,
          affected_quantity: Number(quantity),
          severity,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not submit defect report.");
      }

      setSuccess(
        `Report ${result.data.defect_code} submitted successfully for review.`
      );
      setDescription("");
      setQuantity("1");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit defect report."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const openCount = defects.filter(
    (defect) =>
      defect.status === "REPORTED" || defect.status === "UNDER_REVIEW"
  ).length;

  const highCount = defects.filter(
    (defect) =>
      defect.severity === "HIGH" || defect.severity === "CRITICAL"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
              <AlertTriangle size={18} /> STOCKSYNC QUALITY
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Defect Reports
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Report suspected batch defects and track their review status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Total reports</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {defects.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Awaiting review</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {openCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">High / critical severity</p>
            <p className="mt-2 text-3xl font-bold text-rose-600">
              {highCount}
            </p>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            {success}
          </div>
        )}

        <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form
            onSubmit={submitDefect}
            className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Report a defect
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                New reports are saved as REPORTED for review.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Product batch
              </label>
              <select
                required
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className={inputClass}
              >
                {batches.map((batch) => (
                  <option
                    key={batch.batch_id}
                    value={batch.batch_id}
                    disabled={batch.batch_status !== "ACTIVE"}
                  >
                    {batch.batch_code} — {batch.product_name} (
                    {batch.batch_status})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Only active batches can receive new reports.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Defect type
              </label>
              <select
                value={defectType}
                onChange={(e) => setDefectType(e.target.value)}
                className={inputClass}
              >
                <option value="CONTAMINATION">Contamination</option>
                <option value="DAMAGED_PACKAGING">Damaged packaging</option>
                <option value="QUALITY_FAILURE">Quality failure</option>
                <option value="EXPIRY_ISSUE">Expiry issue</option>
                <option value="LABELING_ERROR">Labeling error</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Affected quantity
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className={inputClass}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Defect description
              </label>
              <textarea
                required
                minLength={5}
                maxLength={5000}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what was found, where it was found, and any inspection evidence..."
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || batches.every(
                (batch) => batch.batch_status !== "ACTIVE"
              )}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {submitting ? "Submitting..." : "Submit defect report"}
            </button>

            <p className="text-xs leading-5 text-slate-500">
              Reporting a defect does not automatically quarantine stock or
              initiate a recall.
            </p>
          </form>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 border-b border-slate-100 p-5">
              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                <ClipboardList size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  Report history
                </h2>
                <p className="text-sm text-slate-500">
                  Reports recorded in MySQL
                </p>
              </div>
            </div>

            {loading ? (
              <p className="p-6 text-sm text-slate-500">
                Loading defect reports...
              </p>
            ) : defects.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No defect reports have been submitted yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {defects.map((defect) => (
                  <article key={defect.defect_id} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {defect.defect_code}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {defect.batch_code} · {defect.product_name}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(defect.status)}`}
                      >
                        {defect.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                      {defect.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-lg bg-slate-100 px-2 py-1">
                        {defect.defect_type.replace(/_/g, " ")}
                      </span>
                      <span className={`rounded-lg px-2 py-1 font-semibold ${badgeClass(defect.severity)}`}>
                        {defect.severity}
                      </span>
                      <span>{defect.affected_quantity} units affected</span>
                    </div>

                    <p className="text-xs text-slate-400">
                      {defect.created_at
                        ? new Date(defect.created_at).toLocaleString("en-IN")
                        : "Date unavailable"}
                      {defect.reporter_name ? ` · Reported by ${defect.reporter_name}` : ""}
                    </p>

                    {defect.review_notes && (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                        <strong>Review notes:</strong> {defect.review_notes}
                        {defect.reviewer_name ? ` — ${defect.reviewer_name}` : ""}
                      </p>
                    )}

                    {currentUser &&
                      ["ADMIN", "QUALITY_STAFF"].includes(currentUser.role) &&
                      ["REPORTED", "UNDER_REVIEW"].includes(defect.status) && (
                        <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                          <label className="block text-xs font-semibold text-slate-700">
                            Review notes
                            <textarea
                              className={`${inputClass} mt-2`}
                              rows={2}
                              maxLength={500}
                              placeholder="Add findings or reason for rejection..."
                              value={reviewNotes[defect.defect_id] ?? ""}
                              onChange={(event) =>
                                setReviewNotes((previous) => ({
                                  ...previous,
                                  [defect.defect_id]: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            {defect.status === "REPORTED" && (
                              <button
                                type="button"
                                disabled={reviewingId === defect.defect_id}
                                onClick={() => reviewDefect(defect.defect_id, "UNDER_REVIEW")}
                                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
                              >
                                Mark under review
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={reviewingId === defect.defect_id}
                              onClick={() => reviewDefect(defect.defect_id, "CONFIRMED")}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              title={
                                defect.reporter_name === currentUser.name
                                  ? "A reviewer cannot confirm their own report"
                                  : "Confirm defect"
                              }
                            >
                              Confirm defect
                            </button>

                            <button
                              type="button"
                              disabled={
                                reviewingId === defect.defect_id ||
                                !(reviewNotes[defect.defect_id] ?? "").trim()
                              }
                              onClick={() => reviewDefect(defect.defect_id, "REJECTED")}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Reject defect
                            </button>
                          </div>
                        </div>
                      )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}




