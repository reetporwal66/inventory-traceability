
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Package,
  Truck,
  Warehouse,
  ArrowLeftRight,
  ClipboardList,
  ShieldAlert,
  Users,
  Search,
  Bell,
  ChevronDown,
  TrendingUp,
  AlertTriangle,
  Activity,
  Menu,
  X,
  CircleCheck,
  Clock3,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

type StockItem = {
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
  quarantined?: number;
  available: number;
};

type ActivityEvent = {
  event_id: number;
  event_type: string;
  aggregate_type: string;
  aggregate_id: number;
  source_created_at: string;
  copied_at?: string;
  payload?: Record<string, unknown>;
};

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Products & Batches", href: "/products", icon: Package },
  { label: "Warehouses", href: "/warehouses", icon: Warehouse },
  { label: "Stock Transfers", href: "/transfers", icon: ArrowLeftRight },
  { label: "Reservations", href: "/reservations", icon: ClipboardList },
  { label: "Shipments", href: "/shipments", icon: Truck },
  { label: "Recipients", href: "/recipients", icon: Users },
  { label: "Recalls & Quality", href: "/recalls", icon: ShieldAlert },
  { label: "Defect Reports", href: "/defects", icon: AlertTriangle },
];

function eventName(type: string) {
  const names: Record<string, string> = {
    INVENTORY_CREATED: "Inventory Created",
    INVENTORY_UPDATED: "Inventory Updated",
    STOCK_RESERVED: "Stock Reserved",
    RESERVATION_CANCELLED: "Reservation Cancelled",
    STOCK_TRANSFERRED: "Stock Transferred",
    RECALL_QUARANTINED: "Recall Quarantined",
  };

  return (
    names[type] ??
    type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function eventDetails(event: ActivityEvent) {
  const p = event.payload ?? {};

  if (event.event_type === "RECALL_QUARANTINED") {
    return `Batch ${p.batch_id ?? event.aggregate_id} Â· ${p.quantity ?? "â€”"} units quarantined`;
  }

  if (event.event_type === "STOCK_RESERVED") {
    return `Batch ${p.batch_id ?? "â€”"} Â· ${p.quantity ?? "â€”"} units reserved`;
  }

  if (event.event_type === "RESERVATION_CANCELLED") {
    return `Reservation ${p.reservation_id ?? event.aggregate_id} cancelled`;
  }

  if (event.event_type === "INVENTORY_UPDATED") {
    return `Batch ${p.batch_id ?? "â€”"} Â· ${p.available_quantity ?? "â€”"} units available`;
  }

  if (event.event_type === "INVENTORY_CREATED") {
    return `Inventory created for batch ${p.batch_id ?? event.aggregate_id}`;
  }

  return `${event.aggregate_type.replace(/_/g, " ")} Â· Record ${event.aggregate_id}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Time unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function eventColor(type: string) {
  if (type.includes("RECALL") || type.includes("QUARANTINE")) {
    return "bg-rose-50 text-rose-700";
  }

  if (type.includes("RESERV")) return "bg-amber-50 text-amber-700";
  if (type.includes("TRANSFER")) return "bg-violet-50 text-violet-700";

  return "bg-emerald-50 text-emerald-700";
}

export default function Dashboard() {
  const pathname = usePathname();

  const activePage =
    navigation.find((item) => item.href === pathname)?.label ?? "Overview";

  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [stock, setStock] = useState<StockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [inventoryError, setInventoryError] = useState("");

  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [openRecallCount, setOpenRecallCount] = useState<number | null>(null);

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");

  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: "ADMIN" | "INVENTORY_STAFF" | "QUALITY_STAFF";
  } | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const result = await response.json();

        if (!result.ok || !result.user) {
          router.replace("/login");
          return;
        }

        if (!cancelled) setCurrentUser(result.user);
      } catch {
        router.replace("/login");
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      try {
        const response = await fetch("/api/inventory");
        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Inventory request failed");
        }

        if (!cancelled) {
          setStock(result.data as StockItem[]);
          setInventoryError("");
        }
      } catch (error) {
        console.error("Inventory loading failed:", error);

        if (!cancelled) {
          setInventoryError("Could not load inventory from MySQL.");
        }
      } finally {
        if (!cancelled) setLoadingStock(false);
      }
    }

    async function loadSummary() {
      try {
        const response = await fetch("/api/dashboard/summary");
        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Summary request failed");
        }

        if (!cancelled) {
          setLowStockCount(Number(result.data.lowStockCount));
          setOpenRecallCount(Number(result.data.openRecallCount));
        }
      } catch (error) {
        console.error("Summary loading failed:", error);
      }
    }

    async function loadEvents() {
      try {
        const response = await fetch("/api/events");
        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Events request failed");
        }

        if (!cancelled) {
          setEvents(result.data as ActivityEvent[]);
          setEventsError("");
        }
      } catch (error) {
        console.error("Event loading failed:", error);

        if (!cancelled) {
          setEventsError("Could not load event history from MongoDB.");
        }
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    }

    loadInventory();
    loadSummary();
    loadEvents();

    const eventsInterval = window.setInterval(() => {
      loadEvents();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(eventsInterval);
    };
  }, []);

  const filteredStock = stock.filter((item) =>
    `${item.sku} ${item.product} ${item.batch} ${item.warehouse}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalUnits = stock.reduce(
    (sum, item) => sum + Number(item.onHand),
    0
  );

  const availableUnits = stock.reduce(
    (sum, item) => sum + Number(item.available),
    0
  );

  const stats = [
    {
      label: "Total units on hand",
      value: loadingStock ? "â€¦" : totalUnits.toLocaleString("en-IN"),
      note: "Across all listed warehouses",
      icon: Boxes,
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Available units",
      value: loadingStock ? "â€¦" : availableUnits.toLocaleString("en-IN"),
      note: "Excludes reserved and quarantined stock",
      icon: CircleCheck,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Low stock items",
      value: lowStockCount === null ? "â€”" : String(lowStockCount),
      note: "From MySQL low-stock view",
      icon: TrendingUp,
      color: "bg-amber-50 text-amber-700",
    },
    {
      label: "Open recalls",
      value: openRecallCount === null ? "â€”" : String(openRecallCount),
      note: "Open and in-progress cases",
      icon: AlertTriangle,
      color: "bg-rose-50 text-rose-700",
    },
  ];

  if (authChecking || !currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] text-sm text-slate-500">
        Checking your session...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      {mobileMenu && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col bg-[#111827] text-white transition-transform lg:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[82px] items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <Boxes size={23} />
          </div>

          <div>
            <p className="text-[15px] font-bold">StockSync</p>
            <p className="mt-1 text-[10px] tracking-[2px] text-slate-400">
              INVENTORY INTELLIGENCE
            </p>
          </div>

          <button
            className="ml-auto lg:hidden"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-7">
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[2px] text-slate-500">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileMenu(false)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[13px] transition ${
                  activePage === label
                    ? "bg-emerald-400 font-semibold text-slate-950"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}

                {label === "Recalls & Quality" && (
                  <span className="ml-auto rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                    !
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
              <Activity size={15} className="text-emerald-400" />
              System overview
            </div>

            <p className="text-xs leading-5 text-slate-400">
              Inventory is connected to MySQL, with event history from MongoDB.
            </p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-emerald-400" />
            </div>

            <p className="mt-2 text-[10px] text-slate-500">
              Local development
            </p>
          </div>
        </div>
      </aside>

      <section className="min-h-screen lg:pl-[255px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              onClick={() => setMobileMenu(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="text-[11px] text-slate-500">
                Workspace / {activePage}
              </p>
              <h1 className="mt-1 text-lg font-bold">{activePage}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              aria-label="Notifications"
              className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            <div className="hidden items-center gap-3 border-l border-slate-200 pl-4 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                {currentUser?.name
                  ?.split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div>
                <p className="text-xs font-semibold">{currentUser?.name}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {currentUser?.role?.replace(/_/g, " ")}
                </p>
              </div>

                            <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } finally {
                    router.replace("/login");
                    router.refresh();
                  }
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-7 p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[2px] text-emerald-700">
                Operations center
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Inventory overview<span className="text-emerald-500">.</span>
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Track stock, monitor quality and follow every batch.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  inventoryError
                    ? "bg-rose-500"
                    : loadingStock
                      ? "bg-amber-400"
                      : "bg-emerald-500"
                }`}
              />

              {inventoryError
                ? "Database connection issue"
                : loadingStock
                  ? "Loading live inventory..."
                  : "Connected Â· MySQL inventory"}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40"
              >
                <div className="flex items-start justify-between">
                  <p className="text-[12px] font-medium text-slate-500">
                    {card.label}
                  </p>

                  <div className={`rounded-xl p-2.5 ${card.color}`}>
                    <card.icon size={19} />
                  </div>
                </div>

                <p className="mt-4 text-3xl font-bold tracking-tight">
                  {card.value}
                </p>

                <p className="mt-2 text-[11px] text-slate-500">
                  {card.note}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-bold">Inventory snapshot</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Live records from MySQL
                  </p>
                </div>

                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search stock..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-56"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Product / batch</th>
                      <th className="px-4 py-3 font-semibold">Warehouse</th>
                      <th className="px-4 py-3 font-semibold">On hand</th>
                      <th className="px-4 py-3 font-semibold">Available</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredStock.map((item) => (
                      <tr
                        key={`${item.batchId}-${item.warehouseId}`}
                        className="transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-4">
                          <p className="text-xs font-semibold">{item.product}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {item.sku} Â· {item.batch}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-600">
                          {item.warehouse}
                        </td>

                        <td className="px-4 py-4 text-xs font-semibold">
                          {item.onHand}
                        </td>

                        <td className="px-4 py-4 text-xs font-semibold">
                          {item.available}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                              item.status === "RECALLED"
                                ? "bg-rose-50 text-rose-700"
                                : item.status === "QUARANTINED"
                                  ? "bg-amber-50 text-amber-800"
                                  : item.status === "EXPIRED"
                                    ? "bg-slate-100 text-slate-700"
                                    : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {loadingStock && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-sm text-slate-500"
                        >
                          Loading inventory from MySQL...
                        </td>
                      </tr>
                    )}

                    {!loadingStock && filteredStock.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-12 text-center text-sm text-slate-500"
                        >
                          {inventoryError
                            ? inventoryError
                            : search
                              ? "No matching inventory found."
                              : "No inventory records found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-[11px] text-slate-500">
                <span>
                  {loadingStock
                    ? "Loading inventory..."
                    : inventoryError
                      ? "Inventory unavailable"
                      : `${filteredStock.length} inventory records`}
                </span>

                <Link
                  href="/inventory"
                  className="flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  View inventory <ArrowUpRight size={14} />
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Operational activity</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Recent events from MongoDB
                  </p>
                </div>

                <Activity size={18} className="text-slate-400" />
              </div>

              <div className="mt-5 space-y-3">
                {loadingEvents && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                    <RefreshCw
                      size={22}
                      className="mx-auto animate-spin text-slate-400"
                    />
                    <p className="mt-3 text-sm text-slate-500">
                      Loading event history...
                    </p>
                  </div>
                )}

                {!loadingEvents && eventsError && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-700">
                      Event history unavailable
                    </p>
                    <p className="mt-1 text-xs leading-5 text-rose-600">
                      {eventsError}
                    </p>
                  </div>
                )}

                {!loadingEvents && !eventsError && events.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                    <Clock3 size={25} className="mx-auto text-slate-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      No events found
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Delivered event history will appear here when available.
                    </p>
                  </div>
                )}

                {!loadingEvents &&
                  !eventsError &&
                  events.map((event) => (
                    <div
                      key={event.event_id}
                      className="rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 rounded-lg p-2 ${eventColor(event.event_type)}`}
                        >
                          <Activity size={16} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-800">
                              {eventName(event.event_type)}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              #{event.event_id}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] leading-5 text-slate-500">
                            {eventDetails(event)}
                          </p>

                          <p className="mt-2 text-[10px] text-slate-400">
                            {formatDate(event.source_created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="mt-5 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                <div className="flex items-center gap-2 font-semibold">
                  <Activity size={15} />
                  Connected data sources
                </div>
                <p className="mt-1 text-[11px]">
                  Inventory and summary from MySQL. Event history from MongoDB.
                </p>
              </div>
            </section>
          </div>

          <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-[10px] text-slate-400 sm:flex-row">
            <p>
              StockSync Â· Product Batch Traceability &amp; Inventory Management
            </p>
            <p>
              Local development Â· Authentication and role checks still to come
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}


