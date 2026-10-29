
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Plus, Boxes } from "lucide-react";

type Product = {
  productId: number;
  sku: string;
  productName: string;
  category: string;
  description: string | null;
  unitOfMeasure: string;
  reorderLevel: number;
  isActive: number | boolean;
  createdAt: string;
  batchCount: number | string;
};

type ApiResult = {
  ok: boolean;
  message?: string;
  data?: Product[];
};

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("unit");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const result: ApiResult = await response.json();

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Could not load products.");
      }

      setProducts(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();
  }, [loadProducts]);

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          productName,
          category,
          description,
          unitOfMeasure: unit,
          reorderLevel: Number(reorderLevel),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not create product.");
      }

      setSuccess("Product added successfully.");
      setSku("");
      setProductName("");
      setCategory("");
      setDescription("");
      setUnit("unit");
      setReorderLevel("0");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create product.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = products.filter((p) =>
    `${p.sku} ${p.productName} ${p.category}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const activeCount = products.filter((p) => Boolean(p.isActive)).length;

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"
            >
              <ArrowLeft size={16} /> Back to Overview
            </Link>
            <h1 className="text-3xl font-bold">Products</h1>
            <p className="mt-2 text-sm text-slate-500">
              Create products and manage your product catalogue.
            </p>
          </div>
          <Link
            href="/batches"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Boxes size={17} /> Manage batches
          </Link>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {success}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <Stat title="Total products" value={products.length} />
          <Stat title="Active products" value={activeCount} />
          <Stat
            title="Batches linked"
            value={products.reduce((sum, p) => sum + Number(p.batchCount), 0)}
          />
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Add product</h2>
            <p className="mt-1 text-sm text-slate-500">
              SKU, name and category are required.
            </p>

            <form onSubmit={createProduct} className="mt-5 space-y-4">
              <Field label="SKU *">
                <input className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} maxLength={60} required disabled={saving} placeholder="e.g. RICE-001" />
              </Field>
              <Field label="Product name *">
                <input className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} maxLength={180} required disabled={saving} placeholder="e.g. Organic Rice" />
              </Field>
              <Field label="Category *">
                <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} required disabled={saving} placeholder="e.g. Grains" />
              </Field>
              <Field label="Unit of measure *">
                <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30} required disabled={saving} placeholder="e.g. kg, bag, unit" />
              </Field>
              <Field label="Reorder level">
                <input className={inputClass} type="number" min="0" step="1" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} required disabled={saving} />
              </Field>
              <Field label="Description">
                <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={20000} rows={3} disabled={saving} placeholder="Optional product details" />
              </Field>
              <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Plus size={17} /> {saving ? "Saving..." : "Add product"}
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="text-xl font-bold">Product catalogue</h2>
                <p className="mt-1 text-sm text-slate-500">Saved products from MySQL.</p>
              </div>
              <button onClick={() => void loadProducts()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            <div className="border-b p-4">
              <input className={inputClass + " mt-0"} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by SKU, name or category..." />
            </div>

            {loading ? (
              <p className="p-10 text-center text-sm text-slate-500">Loading products...</p>
            ) : filtered.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">No matching products found.</p>
            ) : (
              <div className="divide-y">
                {filtered.map((p) => (
                  <article key={p.productId} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{p.productName}</h3>
                        <p className="mt-1 text-xs text-slate-500">{p.sku} · {p.category}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {p.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div><p className="text-xs text-slate-500">Unit</p><p className="mt-1 font-medium">{p.unitOfMeasure}</p></div>
                      <div><p className="text-xs text-slate-500">Reorder level</p><p className="mt-1 font-medium">{p.reorderLevel}</p></div>
                      <div><p className="text-xs text-slate-500">Batches</p><p className="mt-1 font-medium">{p.batchCount}</p></div>
                    </div>
                    {p.description && <p className="mt-3 text-sm text-slate-600">{p.description}</p>}
                  </article>
                ))}
              </div>
            )}
            <footer className="border-t px-5 py-4 text-xs text-slate-500">
              Showing {loading ? 0 : filtered.length} of {products.length} products
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
