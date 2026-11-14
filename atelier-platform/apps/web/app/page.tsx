"use client";
import { CustomSelect } from "./components/CustomSelect";
import { AdminConsole } from "./components/AdminConsole";
import { CustomerDirectory } from "./components/CustomerDirectory";
import { CustomerProfile } from "./components/CustomerProfile";
import { Auth } from "./components/Auth";
import { SidebarNavigation } from "./components/SidebarNavigation";
import { RecordVisual } from "./components/RecordVisual";
import { ToastNotice } from "./components/Toasts";
import { getCurrencySymbol, CurrencyContext } from "./components/Currency";
import { CatalogDirectory } from "./components/CatalogDirectory";
import { QuickWork } from "./components/QuickWork";
import { BrandStar } from "./components/BrandStar";
import { DirectoryDetails } from "./components/DirectoryDetails";

import { useEffect, useRef, useState } from "react";
import {
  useWorkspacePage,
  useUrlParam,
  useUrlPage,
  useUrlLocation,
  replaceLocation,
  returnDestination,
  goToUrl,
} from "./components/UrlState";
import { SalonList, SalonPicker } from "./components/SalonPicker";
import { Engagement, engagementPages } from "./components/Engagement";
import { Operations, operationPages } from "./components/Operations";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Scissors,
  Menu,
  X,
  ArrowRight,
  Plus,
  ShieldCheck,
  Users,
  Flower2,
  LogOut,
  Building2,
  Settings2,
  LockKeyhole,
  Check,
  Activity,
  ChevronLeft,
} from "lucide-react";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
class ApiError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await r.json();
  if (!r.ok)
    throw new ApiError(
      Object.values(payload.error?.issues?.fieldErrors || {})
        .flat()
        .join(" ") ||
        payload.error?.message ||
        "Request failed",
      payload.error?.issues?.fieldErrors,
    );
  return payload.data;
}
export default function Home() {
  return (
    <QueryClientProvider client={client}>
      <Workspace />
    </QueryClientProvider>
  );
}
function Workspace() {
  const [page, setPage] = useWorkspacePage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      setSidebarCollapsed(
        localStorage.getItem("etalier-sidebar-collapsed") === "true",
      );
    } catch {}
  }, []);
  const toggleSidebar = () =>
    setSidebarCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem("etalier-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  const routeLocation = useUrlLocation();
  const customerId = /^\/customers\/([\da-f-]{36})$/i.exec(
    routeLocation.split("?")[0],
  )?.[1];
  const [search, setSearch] = useUrlParam("q");
  const [recordPage, setRecordPage] = useUrlPage();
  const cache = useQueryClient(),
    [details, setDetails] = useState<any>(null),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: () => api("auth/me") });
  const tenants = useQuery({
    queryKey: ["tenants"],
    queryFn: () => api("tenants"),
    enabled: !!me.data && !me.data.platform_role,
  });
  const features = useQuery({
    queryKey: ["features", me.data?.tenant_id],
    queryFn: () => api("features"),
    enabled: !!me.data?.tenant_id,
  });
  const branches = useQuery({
    queryKey: ["branches", me.data?.tenant_id],
    queryFn: () => api("branches"),
    enabled: !!me.data?.tenant_id,
  });
  const access = useQuery({
    queryKey: ["access", me.data?.tenant_id],
    queryFn: () => api("access"),
    enabled: !!me.data?.tenant_id,
  });
  const paths: Record<string, string> = {
    Customers: "customers",
    Employees: "employees",
    Services: "services",
    Roles: "roles",
    "Audit log": "audit",
    "Platform tenants": "admin/tenants",
    "Platform features": "admin/features",
    "Job monitor": "admin/jobs",
  };
  const path = paths[page];
  const records = useQuery({
    queryKey: ["records", page, search, recordPage, me.data?.tenant_id],
    queryFn: () =>
      api(
        path +
          (path &&
          !path.includes("admin") &&
          ["customers", "employees", "services"].includes(path)
            ? "?q=" + encodeURIComponent(search) + "&page=" + recordPage
            : ""),
      ),
    enabled:
      !!me.data &&
      !me.data.platform_role &&
      !!path &&
      !["Customers", "Employees", "Services"].includes(page),
  });
  async function mutate(
    endpoint: string,
    method: string,
    body?: unknown,
    photo?: File,
  ) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const saved = await api(endpoint, method, body);
      if (endpoint === "employees" && photo?.size) {
        try {
          const response = await fetch(
            `/api/v1/employee-profiles/${saved.id}/photo`,
            {
              method: "PUT",
              headers: { "Content-Type": photo.type },
              body: photo,
            },
          );
          if (!response.ok)
            setError(
              "Employee saved, but the photo could not be uploaded. Add it from the employee profile.",
            );
        } catch {
          setError(
            "Employee saved, but the photo could not be uploaded. Add it from the employee profile.",
          );
        }
      }
      setModal(null);
      setSuccess("Changes saved.");
      await cache.invalidateQueries();
      if (endpoint === "employees" && method === "POST")
        goToUrl("/employees?record=" + saved.id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const [selectingSalon, setSelectingSalon] = useState(false);
  const autoSelectionAttempt = useRef("");
  const activeSalons = (tenants.data || []).filter(
    (salon: any) => salon.status === "active",
  );
  async function selectSalon(id: string) {
    if (selectingSalon || id === me.data?.tenant_id) return;
    setSelectingSalon(true);
    setError("");
    setSuccess("");
    try {
      await api("tenants/select", "POST", { id });
      await cache.cancelQueries();
      cache.removeQueries({
        predicate: (query) =>
          !["me", "tenants"].includes(String(query.queryKey[0])),
      });
      await cache.invalidateQueries({ queryKey: ["me"] });
      if (me.data?.tenant_id) setPage(page);
      setDetails(null);
      setMenu(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSelectingSalon(false);
    }
  }
  useEffect(() => {
    if (me.data && !me.data.tenant_id && activeSalons.length === 1) {
      const key = me.data.user_id + ":" + activeSalons[0].id;
      if (autoSelectionAttempt.current !== key) {
        autoSelectionAttempt.current = key;
        void selectSalon(activeSalons[0].id);
      }
    }
  }, [me.data?.tenant_id, tenants.data]);
  useEffect(() => {
    if (me.isPending) return;
    const pathname = routeLocation.split("?")[0];
    if (!me.data) {
      if (pathname !== "/login")
        replaceLocation(
          "/login" +
            (routeLocation !== "/"
              ? "?returnTo=" + encodeURIComponent(routeLocation)
              : ""),
        );
      return;
    }
    if (me.data.platform_role) {
      if (!pathname.startsWith("/admin")) replaceLocation("/admin/shops");
      return;
    }
    if (pathname.startsWith("/admin")) {
      replaceLocation("/");
      return;
    }
    if (tenants.isPending) return;
    if (
      !me.data.tenant_id &&
      activeSalons.length !== 1 &&
      pathname !== "/salons"
    ) {
      const destination =
        pathname === "/login"
          ? returnDestination(routeLocation)
          : routeLocation;
      replaceLocation(
        "/salons" +
          (destination !== "/"
            ? "?returnTo=" + encodeURIComponent(destination)
            : ""),
      );
    } else if (me.data.tenant_id && ["/login", "/salons"].includes(pathname))
      replaceLocation(returnDestination(routeLocation));
  }, [me.isPending, me.data, tenants.isPending, tenants.data, routeLocation]);
  if (me.isPending)
    return <div className="loading">Preparing your Etalier…</div>;
  if (!me.data)
    return (
      <Auth
        onDone={() => {
          cache.invalidateQueries();
          setSuccess("");
        }}
      />
    );
  if (me.data.platform_role)
    return me.data.platform_role === "super_admin" ? (
      <AdminConsole
        name={me.data.name}
        onSignOut={async () => {
          await api("auth/logout", "POST");
          cache.clear();
          window.location.assign("/login");
        }}
      />
    ) : (
      <main className="salon-selection">
        <h1>Platform access</h1>
        <p>This platform role has no shop access.</p>
      </main>
    );
  if (tenants.isPending || selectingSalon)
    return (
      <div className="loading" role="status">
        Opening your salon…
      </div>
    );
  if (tenants.isError)
    return (
      <main className="salon-selection">
        <h1>Unable to load your salons</h1>
        <p>{tenants.error.message}</p>
        <button className="primary" onClick={() => tenants.refetch()}>
          Try again
        </button>
      </main>
    );
  if (
    !me.data.tenant_id &&
    (activeSalons.length > 0 || me.data.platform_role !== "super_admin")
  )
    return (
      <>
        <SalonList
          salons={activeSalons}
          onSelect={selectSalon}
          busy={selectingSalon}
          onSignOut={async () => {
            await api("auth/logout", "POST");
            cache.clear();
            window.location.assign("/login");
          }}
        />
        <ToastNotice message={error} />
      </>
    );
  const tenant = tenants.data?.find((t: any) => t.id === me.data.tenant_id);
  const enabled = (key: string) =>
    features.data?.find(
      (f: any) =>
        f.key === key &&
        f.enabled &&
        f.tenant_enabled &&
        f.admin_enabled !== false,
    );
  const links = [
    ["Quick Work", Activity],
    ["Overview", Flower2],
    ...(enabled("appointments") ? [["Bookings", Activity]] : []),
    ...(enabled("customers") ? [["Customers", Users]] : []),
    ...(enabled("employees") ? [["Employees", Users]] : []),
    ...(enabled("services") ? [["Services", Scissors]] : []),
    ...(enabled("appointments") ? [["Calendar", Activity]] : []),
    ["Branches", Building2],
    ["Leave", Activity],
    ...(enabled("inventory")
      ? [
          ["Products", Scissors],
          ["Suppliers", Building2],
          ["Inventory", Activity],
          ["Stock history", Activity],
          ["Product consumption", Scissors],
        ]
      : []),
    ...(enabled("sales_management")
      ? [
          ["POS & Orders", Activity],
          ["Payments", Activity],
          ["Expenses", Activity],
        ]
      : []),
    ["Commissions", Activity],
    ["Payroll", Activity],
    ["Privacy requests", ShieldCheck],
    ...(enabled("analytics") ? [["Analytics", Activity]] : []),
    ["Intake forms", Activity],
    ...(enabled("reviews") ? [["Reviews", Activity]] : []),
    ...(enabled("ugc") ? [["UGC", Activity]] : []),
    ...(enabled("automations") ? [["Automations", Activity]] : []),
    ...(enabled("marketing")
      ? [
          ["Campaigns", Activity],
          ["Notifications", Activity],
        ]
      : []),
    ...(enabled("loyalty") ? [["Loyalty", Activity]] : []),
    ...(enabled("memberships")
      ? [
          ["Membership plans", Activity],
          ["Memberships", Activity],
        ]
      : []),
    ...(enabled("gift_cards") ? [["Gift cards", Activity]] : []),
    ["Members", Users],
    ["Integrations", Settings2],
    ["Settings", Settings2],
    ["Modules", Settings2],
    ["Roles", LockKeyhole],
    ["Audit log", Activity],
    ...(me.data.platform_role === "super_admin"
      ? [
          ["Platform tenants", Building2],
          ["Platform features", ShieldCheck],
          ["Job monitor", Activity],
        ]
      : []),
  ] as any[];
  return (
    <CurrencyContext.Provider value={me.data.currency || "USD"}>
      <div
        className={"workspace" + (sidebarCollapsed ? " sidebar-collapsed" : "")}
      >
        <div
          className={"scrim " + (menu ? "show" : "")}
          onClick={() => setMenu(false)}
        />
        <aside className={menu ? "open" : ""}>
          <div className="sidebar-brand">
            <a
              className="brand"
              href="/"
              aria-label={
                sidebarCollapsed ? "Expand navigation" : "Etalier home"
              }
              onClick={(event) => {
                if (
                  sidebarCollapsed &&
                  window.matchMedia("(min-width:1024px)").matches
                ) {
                  event.preventDefault();
                  toggleSidebar();
                }
              }}
            >
              <span className="brand-name">etalier</span>
              <span className="brand-mark">
                <BrandStar />
              </span>
            </a>
            <button
              type="button"
              className="sidebar-collapse-toggle"
              aria-label="Collapse navigation"
              title="Collapse navigation"
              onClick={toggleSidebar}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="mobile-only"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            >
              <X />
            </button>
          </div>
          <SalonPicker
            salons={activeSalons}
            selectedId={me.data.tenant_id || ""}
            onSelect={selectSalon}
            busy={selectingSalon}
          />
          <SidebarNavigation
            compact={sidebarCollapsed}
            activePage={page}
            onNavigate={(name) => {
              setPage(name);
              setMenu(false);
              setError("");
            }}
            items={links.filter(([name]) => {
              if (name.startsWith("Platform") || name === "Job monitor")
                return me.data.platform_role === "super_admin";
              if (!access.data)
                return name === "Quick Work" || name === "Overview";
              const permissions: Record<string, string> = {
                "Quick Work": "finance.read",
                Customers: "customers.read",
                Employees: "employees.read",
                Services: "services.read",
                Calendar: "appointments.read",
                Bookings: "appointments.read",
                Branches: "settings.manage",
                "Working hours": "employees.read",
                Leave: "employees.read",
                Products: "inventory.read",
                Suppliers: "inventory.read",
                Inventory: "inventory.read",
                "Stock history": "inventory.read",
                "Product consumption": "inventory.read",
                "POS & Orders": "finance.read",
                Payments: "finance.read",
                Expenses: "finance.read",
                Commissions: "payroll.read",
                Payroll: "payroll.read",
                "Privacy requests": "settings.manage",
                Analytics: "finance.read",
                "Intake forms": "forms.read",
                "Form submissions": "forms.read",
                Reviews: "reviews.read",
                UGC: "ugc.read",
                Automations: "marketing.read",
                Campaigns: "marketing.read",
                Notifications: "marketing.read",
                Loyalty: "marketing.read",
                "Membership plans": "marketing.read",
                Memberships: "marketing.read",
                "Gift cards": "finance.read",
                Members: "roles.manage",
                Integrations: "settings.manage",
                Settings: "settings.manage",
                Roles: "roles.manage",
                "Audit log": "audit.read",
              };
              return (
                !permissions[name] ||
                access.data.permissions.includes(permissions[name])
              );
            })}
          />
          <div className="sidebar-end">
            <div className="privacy">
              <ShieldCheck size={21} />
              <strong>A space of your own.</strong>
              <p>Your team’s access follows your workspace permissions.</p>
            </div>
            <div className="account">
              <span className="avatar">
                {me.data.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{me.data.name}</strong>
                <small>{me.data.email}</small>
              </div>
              <button
                aria-label="Sign out"
                onClick={async () => {
                  await api("auth/logout", "POST");
                  cache.clear();
                  window.location.assign("/login");
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>
        <main>
          <header>
            <button
              className="mobile-only"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>
              Workspace <span className="slash">/</span>{" "}
              <strong>
                {(
                  {
                    Branches: "Locations",
                    Employees: "Team members",
                    Leave: "Leaves",
                    "Intake forms": "Forms & responses",
                  } as Record<string, string>
                )[page] || page}
              </strong>
            </span>
            <span className="private-label">
              <LockKeyhole size={14} />
              Private workspace
            </span>
          </header>
          <div className="content">
            {!customerId &&
              page !== "Quick Work" &&
              !(
                ["Branches", "Payroll"].includes(page) &&
                new URLSearchParams(routeLocation.split("?")[1] || "").has(
                  "record",
                )
              ) && (
                <div className="page-heading">
                  <div>
                    <h1>
                      {page === "Overview"
                        ? "Room to do beautiful things."
                        : page === "Intake forms"
                          ? "Forms & responses"
                          : (
                              {
                                Branches: "Locations",
                                Employees: "Team members",
                                Leave: "Leaves",
                              } as Record<string, string>
                            )[page] || page}
                    </h1>
                    <p>
                      {page === "Overview"
                        ? `Welcome, ${me.data.name.split(" ")[0]}. Let’s take care of your business.`
                        : (
                            {
                              Customers:
                                "Your clients, their details and every visit.",
                              Employees: "The people who make your salon.",
                              Services:
                                "Your signature treatments, clearly organized.",
                              Products:
                                "Retail essentials and the details that matter.",
                              Suppliers:
                                "Your trusted partners, all in one place.",
                              Calendar: "Make room for a well-planned day.",
                              Bookings:
                                "Scheduled appointments and completed quick visits, together.",
                              "Quick Work":
                                "Walk-ins, completed services and payments in one place.",
                              "Intake forms":
                                "Reusable forms, secure customer links and all their answers.",
                              Branches: "Manage your salon’s workspaces.",
                              "Working hours":
                                "A clear schedule for every team member.",
                              Leave: "Plan time away with confidence.",
                              "POS & Orders": "From appointment to checkout.",
                              Payments: "Track collections and refunds.",
                              Expenses: "Know where your money goes.",
                            } as Record<string, string>
                          )[page] ||
                          "View your records and manage the details."}
                    </p>
                  </div>
                  {!customerId &&
                    ["Customers", "Employees", "Services", "Roles"].includes(
                      page,
                    ) && (
                      <button
                        className="primary"
                        onClick={() => setModal(path)}
                      >
                        <Plus size={18} />
                        Add{" "}
                        {page === "Employees"
                          ? "employee"
                          : page.toLowerCase().slice(0, -1)}
                      </button>
                    )}
                </div>
              )}
            <ToastNotice message={error} onDismiss={() => setError("")} />
            <ToastNotice
              message={success}
              kind="success"
              onDismiss={() => setSuccess("")}
            />
            {page === "Quick Work" ? (
              <QuickWork />
            ) : page === "Customers" ? (
              customerId ? (
                access.isPending || features.isPending ? (
                  <div className="loading">Loading customer access…</div>
                ) : (
                  <CustomerProfile
                    key={me.data.tenant_id + customerId}
                    customerId={customerId}
                    tenantId={me.data.tenant_id}
                    permissions={access.data?.permissions || []}
                    billingEnabled={!!enabled("pos")}
                    features={features.data || []}
                  />
                )
              ) : (
                <CustomerDirectory
                  tenantId={me.data.tenant_id}
                  canEdit={
                    !!access.data?.permissions?.includes("customers.write")
                  }
                />
              )
            ) : page === "Employees" || page === "Services" ? (
              <CatalogDirectory
                key={page + me.data.tenant_id}
                kind={page === "Employees" ? "employees" : "services"}
              />
            ) : engagementPages.includes(page) ? (
              <Engagement key={page + me.data.tenant_id} page={page} />
            ) : operationPages.includes(page) ? (
              <Operations key={page + me.data.tenant_id} page={page} />
            ) : page === "Overview" ? (
              <>
                <section className="hero panel">
                  <div>
                    <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
                    <h2>{tenant?.name || "Your salon"}</h2>
                    <p>
                      Less administration.
                      <br />
                      More time for your craft.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setPage("Modules")}
                    >
                      Explore your modules <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="hero-flower">✳</div>
                </section>
                <div className="overview-grid">
                  {[
                    [
                      "01",
                      "Your people",
                      "Customers",
                      "Manage customer contact details and communication consent.",
                    ],
                    [
                      "02",
                      "Your team",
                      "Employees",
                      "Keep your team and branch assignments organized.",
                    ],
                    [
                      "03",
                      "Your expertise",
                      "Services",
                      "Define service durations, buffers, and prices.",
                    ],
                  ].map(([n, title, dest, desc]) => (
                    <button
                      className="panel overview-card"
                      key={n}
                      onClick={() => setPage(dest)}
                    >
                      <span className="step">{n}</span>
                      <h2>{title}</h2>
                      <p>{desc}</p>
                      <span className="card-link">
                        Open {dest.toLowerCase()} <ArrowRight size={17} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="foundation-note">
                  <ShieldCheck size={21} />
                  <div>
                    <strong>Your salon operations</strong>
                    <p>
                      Manage your schedule, team, stock and checkout in one
                      workspace. Enable additional modules under Modules.
                    </p>
                  </div>
                </div>
              </>
            ) : page === "Modules" ? (
              <>
                <p className="section-note">
                  Global availability, plan restrictions, tenant switches, and
                  permissions are enforced by the API. Modules marked “Not
                  released” have no operational interface yet.
                </p>
                <div className="record-grid">
                  {features.isError ? (
                    <div className="error-box">{features.error.message}</div>
                  ) : (
                    features.data?.map((f: any) => (
                      <article className="panel module" key={f.key}>
                        <span
                          className={
                            "badge " +
                            (f.enabled &&
                            f.tenant_enabled &&
                            f.admin_enabled !== false
                              ? "on"
                              : "")
                          }
                        >
                          {f.admin_enabled === false
                            ? "Blocked by platform"
                            : f.enabled && f.tenant_enabled
                              ? "Enabled"
                              : "Disabled"}
                        </span>
                        <h2>{f.name}</h2>
                        <p>
                          {[
                            "customers",
                            "employees",
                            "services",
                            "appointments",
                            "inventory",
                            "pos",
                            "analytics",
                          ].includes(f.key)
                            ? "Manage records in your workspace."
                            : "Configure availability for this module."}
                        </p>
                        {f.dependency && <small>Requires {f.dependency}</small>}
                        <button
                          className="secondary"
                          disabled={
                            busy || !f.enabled || f.admin_enabled === false
                          }
                          onClick={() =>
                            mutate("features/" + f.key, "PATCH", {
                              enabled: !f.tenant_enabled,
                            })
                          }
                        >
                          {f.tenant_enabled
                            ? "Disable for salon"
                            : "Enable for salon"}
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : path ? (
              <section className="panel records-panel">
                {records.isPending ? (
                  <div className="loading">Loading records…</div>
                ) : records.isError ? (
                  <div role="alert" className="empty">
                    <LockKeyhole />
                    <h2>Unable to open this section</h2>
                    <p>{records.error.message}</p>
                    <button
                      className="secondary"
                      onClick={() => records.refetch()}
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    {["Customers", "Employees", "Services"].includes(page) && (
                      <div className="list-toolbar">
                        <input
                          aria-label="Search records"
                          placeholder="Search by name…"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                          }}
                        />
                        <span>25 per page</span>
                      </div>
                    )}
                    {page === "Platform features" ? (
                      <div className="feature-list">
                        {records.data.map((f: any) => (
                          <div className="feature-row" key={f.key}>
                            <div>
                              <strong>{f.name}</strong>
                              <small>Global availability · {f.key}</small>
                            </div>
                            <button
                              className={f.enabled ? "secondary" : "primary"}
                              disabled={busy}
                              onClick={() =>
                                mutate("admin/features/" + f.key, "PATCH", {
                                  enabled: !f.enabled,
                                })
                              }
                            >
                              {f.enabled ? "Disable" : "Enable"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : page === "Roles" ? (
                      <div className="record-grid padded">
                        {records.data.roles.map((r: any) => (
                          <article className="record-card" key={r.id}>
                            <LockKeyhole size={22} />
                            <h2>{r.name}</h2>
                            <p>
                              {r.is_owner
                                ? "All workspace permissions"
                                : r.permissions.join(", ") ||
                                  "No permissions assigned"}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="record-list">
                        {(records.data.items || records.data).length === 0 ? (
                          <div className="empty">
                            <Flower2 />
                            <h2>A little room to grow.</h2>
                            <p>
                              No records yet. Add your first entry to get
                              started.
                            </p>
                          </div>
                        ) : (
                          (records.data.items || records.data).map(
                            (r: any, i: number) => (
                              <article
                                key={r.id || r.status || i}
                                className="record-row"
                              >
                                <RecordVisual
                                  name={
                                    r.name || r.action || r.status || "Record"
                                  }
                                  kind={page}
                                  identity={r.id}
                                />
                                <div>
                                  <strong>
                                    {r.name || r.action || r.status}
                                  </strong>
                                  <small>
                                    {r.email ||
                                      r.title ||
                                      r.slug ||
                                      r.target_id ||
                                      (r.duration_minutes
                                        ? r.duration_minutes +
                                          " minutes + " +
                                          r.buffer_minutes +
                                          " minute buffer"
                                        : r.count + " jobs")}
                                  </small>
                                </div>
                                {[
                                  "Customers",
                                  "Employees",
                                  "Services",
                                ].includes(page) && (
                                  <button
                                    className="secondary"
                                    onClick={() => setDetails(r)}
                                  >
                                    Edit & details
                                  </button>
                                )}
                                {r.price_minor !== undefined && (
                                  <strong>
                                    {new Intl.NumberFormat("en-PK", {
                                      style: "currency",
                                      currencyDisplay: "narrowSymbol",
                                      currency: me.data.currency || "USD",
                                    }).format(Number(r.price_minor) / 100)}
                                  </strong>
                                )}
                                {r.status && r.name && (
                                  <span className="badge">{r.status}</span>
                                )}
                                {page === "Platform tenants" && (
                                  <button
                                    className="secondary"
                                    disabled={busy}
                                    onClick={() =>
                                      mutate("admin/tenants/" + r.id, "PATCH", {
                                        status:
                                          r.status === "active"
                                            ? "suspended"
                                            : "active",
                                      })
                                    }
                                  >
                                    {r.status === "active"
                                      ? "Suspend"
                                      : "Activate"}
                                  </button>
                                )}
                              </article>
                            ),
                          )
                        )}
                      </div>
                    )}
                    {records.data.items && (
                      <div className="pagination">
                        <button
                          className="secondary"
                          disabled={recordPage === 1}
                          onClick={() => setRecordPage((n) => n - 1)}
                        >
                          Previous
                        </button>
                        <span>Page {recordPage}</span>
                        <button
                          className="secondary"
                          disabled={records.data.items.length < 25}
                          onClick={() => setRecordPage((n) => n + 1)}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : null}
            <footer>
              <Flower2 size={17} /> Made for the art of taking care.
            </footer>
          </div>
        </main>
        {details && (
          <DirectoryDetails
            kind={path}
            row={details}
            onClose={() => setDetails(null)}
          />
        )}
        {modal && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <div className="modal-heading">
                <h2 id="modal-title">{"Add " + modal}</h2>
                <button
                  aria-label="Close dialog"
                  onClick={() => setModal(null)}
                >
                  <X />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d: any = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  const photo =
                    d.employee_photo instanceof File
                      ? d.employee_photo
                      : undefined;
                  delete d.employee_photo;
                  if (modal === "services") {
                    d.price_minor = Math.round(Number(d.price) * 100);
                    delete d.price;
                    d.duration_minutes = Number(d.duration_minutes);
                    d.buffer_minutes = Number(d.buffer_minutes);
                  }
                  if (modal === "customers") {
                    d.marketing_consent = d.marketing_consent === "on";
                    if (!d.email) delete d.email;
                  }
                  if (modal === "employees") {
                    d.email = d.email || null;
                    d.active = d.active === "on";
                    if ("base_salary" in d) {
                      d.base_salary_minor = Math.round(
                        Number(d.base_salary) * 100,
                      );
                      delete d.base_salary;
                    }
                    if ("commission_percent" in d) {
                      d.commission_basis_points = Math.round(
                        Number(d.commission_percent) * 100,
                      );
                      delete d.commission_percent;
                    }
                  }
                  if (modal === "roles")
                    d.permissions = new FormData(e.currentTarget).getAll(
                      "permissions",
                    );
                  mutate(modal, "POST", d, photo);
                }}
              >
                <label>
                  Name
                  <input
                    autoFocus
                    required
                    name="name"
                    minLength={2}
                    maxLength={100}
                  />
                </label>
                {modal === "customers" && (
                  <>
                    <label>
                      Email
                      <input type="email" name="email" />
                    </label>
                    <label>
                      Phone
                      <input type="tel" name="phone" />
                    </label>
                    <label>
                      Notes
                      <textarea name="notes" />
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" name="marketing_consent" />
                      Customer explicitly consented to marketing
                    </label>
                  </>
                )}
                {modal === "employees" && (
                  <>
                    <div className="form-row">
                      <label>
                        Email
                        <input
                          type="email"
                          name="email"
                          required
                          maxLength={254}
                          autoComplete="email"
                          placeholder="employee@example.com"
                        />
                      </label>
                      <label>
                        Phone
                        <input
                          type="tel"
                          name="phone"
                          required
                          minLength={5}
                          maxLength={40}
                          autoComplete="tel"
                          placeholder="Phone number"
                        />
                      </label>
                    </div>
                    <label>
                      Job title
                      <input name="title" defaultValue="Stylist" required />
                    </label>
                    <label>
                      Branch
                      <CustomSelect name="branch_id" required>
                        {branches.data?.map((b: any) => (
                          <option value={b.id} key={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </CustomSelect>
                    </label>
                    {access.data?.is_owner && (
                      <label>
                        Commission (%)
                        <input
                          type="number"
                          name="commission_percent"
                          defaultValue="0"
                          min="0"
                          max="100"
                          step="0.01"
                          required
                        />
                        <small>Percentage of completed service value.</small>
                      </label>
                    )}
                    <label className="checkbox">
                      <input type="checkbox" name="active" defaultChecked />
                      Active · available for new bookings
                    </label>
                    {access.data?.permissions?.includes("payroll.write") && (
                      <label>
                        Monthly base salary (
                        {getCurrencySymbol(me.data.currency || "USD")})
                        <input
                          type="number"
                          name="base_salary"
                          min="0"
                          max="10000000"
                          step="0.01"
                          defaultValue="0"
                          required
                        />
                      </label>
                    )}
                    <label>
                      Employee photo{" "}
                      <small>Optional · JPG, PNG or WebP · up to 2 MB</small>
                      <input
                        type="file"
                        name="employee_photo"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.setCustomValidity(
                            file &&
                              (![
                                "image/jpeg",
                                "image/png",
                                "image/webp",
                              ].includes(file.type) ||
                                file.size > 2 * 1024 * 1024)
                              ? "Choose a JPG, PNG or WebP image up to 2 MB."
                              : "",
                          );
                        }}
                      />
                    </label>
                  </>
                )}
                {modal === "services" && (
                  <>
                    <label>
                      Price ({getCurrencySymbol(me.data.currency || "USD")})
                      <input
                        type="number"
                        name="price"
                        min="0"
                        step="0.01"
                        required
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Duration (minutes)
                        <input
                          type="number"
                          name="duration_minutes"
                          defaultValue="45"
                          min="5"
                          max="600"
                          required
                        />
                      </label>
                      <label>
                        Buffer (minutes)
                        <input
                          type="number"
                          name="buffer_minutes"
                          defaultValue="0"
                          min="0"
                          max="120"
                          required
                        />
                      </label>
                    </div>
                  </>
                )}
                {modal === "roles" && (
                  <fieldset>
                    <legend>Permissions</legend>
                    {records.data?.permissions?.map((p: string) => (
                      <label className="checkbox" key={p}>
                        <input type="checkbox" value={p} name="permissions" />
                        {p}
                      </label>
                    ))}
                  </fieldset>
                )}

                <div className="form-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setModal(null)}
                  >
                    Cancel
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy ? "Saving…" : "Create record"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </CurrencyContext.Provider>
  );
}
