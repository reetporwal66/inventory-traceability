
"use client";

import { useCallback, useEffect, useState } from "react";

type Recipient = {
  recipient_id: number;
  recipient_name: string;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  delivery_address: string;
  city: string | null;
  created_at: string;
  shipment_count: number | string;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  data?: Recipient[];
};

export default function RecipientsPage() {
  const [items, setItems] = useState<Recipient[]>([]);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/recipients", {
        cache: "no-store",
      });
      const result: ApiResponse = await response.json();

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Could not load recipients.");
      }

      setItems(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load recipients."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  async function createRecipient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: name,
          organizationName: organization,
          email,
          phone,
          deliveryAddress: address,
          city,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not create recipient.");
      }

      setSuccess("Recipient added successfully.");
      setName("");
      setOrganization("");
      setEmail("");
      setPhone("");
      setAddress("");
      setCity("");
      await loadRecipients();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create recipient."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Inventory management
          </p>
          <h1 className="mt-2 text-3xl font-bold">Recipients</h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage delivery destinations and review their shipment history.
          </p>
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
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total recipients</p>
            <p className="mt-2 text-3xl font-bold">{items.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Organizations</p>
            <p className="mt-2 text-3xl font-bold">
              {new Set(items.map((item) => item.organization_name).filter(Boolean)).size}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Linked shipments</p>
            <p className="mt-2 text-3xl font-bold">
              {items.reduce((sum, item) => sum + Number(item.shipment_count), 0)}
            </p>
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Add recipient</h2>
            <p className="mt-1 text-sm text-slate-500">
              Name and delivery address are required.
            </p>

            <form onSubmit={createRecipient} className="mt-5 space-y-4">
              <div>
                <label htmlFor="recipientName" className="mb-1 block text-sm font-semibold">Recipient name *</label>
                <input id="recipientName" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required disabled={saving} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </div>
              <div>
                <label htmlFor="organization" className="mb-1 block text-sm font-semibold">Organization</label>
                <input id="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={180} disabled={saving} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-semibold">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} disabled={saving} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-semibold">Phone</label>
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} disabled={saving} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </div>
              <div>
                <label htmlFor="address" className="mb-1 block text-sm font-semibold">Delivery address *</label>
                <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} required disabled={saving} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </div>
              <div>
                <label htmlFor="city" className="mb-1 block text-sm font-semibold">City</label>
                <input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} disabled={saving} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" />
              </div>
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Saving..." : "Add recipient"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Recipient directory</h2>
                <p className="mt-1 text-sm text-slate-500">Saved delivery destinations.</p>
              </div>
              <button type="button" onClick={() => void loadRecipients()} disabled={loading} className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500">Loading recipients...</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No recipients found.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {items.map((item) => (
                  <article key={item.recipient_id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{item.recipient_name}</h3>
                        {item.organization_name && <p className="text-sm text-slate-500">{item.organization_name}</p>}
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {Number(item.shipment_count)} shipments
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p><span className="font-semibold text-slate-800">Address:</span> {item.delivery_address}{item.city ? `, ${item.city}` : ""}</p>
                      {item.email && <p><span className="font-semibold text-slate-800">Email:</span> {item.email}</p>}
                      {item.phone && <p><span className="font-semibold text-slate-800">Phone:</span> {item.phone}</p>}
                    </div>
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
