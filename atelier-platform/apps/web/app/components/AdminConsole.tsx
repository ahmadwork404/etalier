"use client";
import { BrandStar } from "./BrandStar";
import { AdminLeads } from "./AdminLeads";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Users,
  Blocks,
  ScrollText,
  ServerCog,
  LogOut,
  ShieldCheck,
  Search,
  Mail,
} from "lucide-react";
import {
  useWorkspacePage,
  useUrlParam,
  useUrlPage,
  replaceLocation,
  goToUrl,
} from "./UrlState";
import { workspaceRoutes } from "./workspaceRoutes";
import { SalonPicker } from "./SalonPicker";
import { toast } from "./Toasts";
import { paymentLabels } from "./payment-methods";
function PaymentMethodsForm({
  shop,
  busy,
  onSave,
}: {
  shop: any;
  busy: boolean;
  onSave: (methods: string[]) => unknown;
}) {
  const [selected, setSelected] = useState<string[]>(
    shop.payment_methods || [
      "cash",
      "card",
      "zelle",
      "venmo",
      "cash_app",
      "other",
    ],
  );
  return (
    <form
      className="admin-payment-methods"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(selected);
      }}
    >
      <fieldset>
        <legend>Payment methods for this salon</legend>
        <p>
          Choose which methods staff can record. Online Stripe also needs its
          integration and module enabled.
        </p>
        <div>
          {Object.entries(paymentLabels).map(([value, label]) => (
            <label className="checkbox" key={value}>
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? [...previous, value]
                      : previous.filter((method) => method !== value),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="secondary" disabled={busy || !selected.length}>
        Save payment methods
      </button>
    </form>
  );
}
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok)
    throw Error(payload.error?.message || "Unable to complete request");
  return payload.data;
}
const sections = [
  { page: "Platform leads", label: "Leads", Icon: Mail },
  { page: "Platform tenants", label: "Shops", Icon: Building2 },
  { page: "Platform members", label: "Members", Icon: Users },
  { page: "Platform features", label: "Modules", Icon: Blocks },
  { page: "Platform logs", label: "Activity log", Icon: ScrollText },
  { page: "Job monitor", label: "Jobs", Icon: ServerCog },
];
export function AdminConsole({
  name,
  onSignOut,
}: {
  name: string;
  onSignOut: () => void;
}) {
  const [page, setPage] = useWorkspacePage();
  const cache = useQueryClient();
  const [shop, setShop] = useUrlParam("shop");
  const [user, setUser] = useUrlParam("user");
  const [search, setSearch] = useUrlParam("q");
  const [number, setNumber] = useUrlPage();
  const [scope, setScope] = useUrlParam("scope", "global", (value) =>
    ["global", "shop"].includes(value),
  );
  const [busy, setBusy] = useState(false);
  const [expandedShops, setExpandedShops] = useState<Record<string, boolean>>(
    {},
  );
  useEffect(() => {
    if (!sections.some((section) => section.page === page))
      replaceLocation("/admin/shops");
  }, [page]);
  const shops = useQuery({
    queryKey: ["admin-shops"],
    queryFn: () => request("admin/tenants"),
  });
  const selectedShop = shop || shops.data?.[0]?.id || "";
  const members = useQuery({
    queryKey: ["admin-members", selectedShop],
    queryFn: () => request(`admin/tenants/${selectedShop}/members`),
    enabled: page === "Platform members" && !!selectedShop,
  });
  const modules = useQuery({
    queryKey: ["admin-modules", scope, selectedShop],
    queryFn: () =>
      request(
        scope === "global"
          ? "admin/features"
          : `admin/tenants/${selectedShop}/features`,
      ),
    enabled:
      page === "Platform features" && (scope === "global" || !!selectedShop),
  });
  const filters = new URLSearchParams({
    q: search,
    page: String(number),
    ...(shop ? { shop } : {}),
    ...(user ? { user } : {}),
  });
  const logs = useQuery({
    queryKey: ["admin-audit", shop, user, search, number],
    queryFn: () => request("admin/audit?" + filters),
    enabled: page === "Platform logs",
  });
  const jobs = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: () => request("admin/jobs"),
    enabled: page === "Job monitor",
  });
  async function change(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await request(path, method, body);
      toast.success("Changes saved.");
      await cache.invalidateQueries({
        predicate: (query) => String(query.queryKey[0]).startsWith("admin-"),
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const section =
    sections.find((section) => section.page === page) || sections[0];
  const selectShop = (
    <SalonPicker
      label="SHOP FILTER"
      salons={shops.data || []}
      selectedId={selectedShop}
      onSelect={(id) => {
        setShop(id);
        setNumber(1);
      }}
      busy={busy}
    />
  );
  return (
    <div className="workspace admin-workspace">
      <aside className="admin-sidebar">
        <a className="brand" href="/admin/shops">
          etalier
          <span>
            <BrandStar />
          </span>
        </a>
        <p className="admin-label">
          <ShieldCheck size={16} />
          Platform administration
        </p>
        <nav aria-label="Platform navigation">
          {sections.map(({ page: destination, label, Icon }) => (
            <a
              key={destination}
              href={workspaceRoutes[destination]}
              aria-current={page === destination ? "page" : undefined}
              className={page === destination ? "active" : ""}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey) return;
                event.preventDefault();
                setPage(destination);
              }}
            >
              <Icon size={19} />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-end">
          <strong>{name}</strong>
          <small>Platform administrator</small>
          <button onClick={onSignOut}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <main>
        <header>
          <ShieldCheck size={18} />
          <strong>Platform / {section.label}</strong>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">PLATFORM CONTROL</span>
              <h1>{section.label}</h1>
              <p>
                {page === "Platform leads"
                  ? "Website enquiries, conversations, and next steps."
                  : "Manage access and availability across shops."}
              </p>
            </div>
          </div>
          {page === "Platform leads" && <AdminLeads />}
          {shops.error && page !== "Platform leads" && (
            <div className="error-box" role="alert">
              {shops.error.message}
            </div>
          )}
          {page === "Platform tenants" && (
            <>
              <div className="list-toolbar">
                <label className="customer-search">
                  <Search size={17} />
                  <input
                    aria-label="Search shops"
                    placeholder="Search shops…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className="record-grid">
                {shops.data
                  ?.filter((item: any) =>
                    (item.name + item.slug)
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((item: any) => (
                    <section
                      className={
                        "panel module " +
                        (expandedShops[item.id] ? "controls-open" : "")
                      }
                      key={item.id}
                    >
                      <span
                        className={
                          "badge " +
                          (item.status === "active" ? "on" : "warning")
                        }
                      >
                        {item.status}
                      </span>
                      <h2>{item.name}</h2>
                      <p>
                        {item.location_count} / {item.max_locations} workspaces
                        · {item.member_count} active members
                      </p>
                      <button
                        className="secondary mobile-shop-controls-toggle"
                        aria-expanded={!!expandedShops[item.id]}
                        aria-controls={"shop-controls-" + item.id}
                        onClick={() =>
                          setExpandedShops((previous) => ({
                            ...previous,
                            [item.id]: !previous[item.id],
                          }))
                        }
                      >
                        {expandedShops[item.id]
                          ? "Hide controls"
                          : "Manage shop"}
                      </button>
                      <div
                        id={"shop-controls-" + item.id}
                        className="admin-shop-controls"
                      >
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void change(`admin/tenants/${item.id}`, "PATCH", {
                              max_locations: Number(
                                new FormData(event.currentTarget).get(
                                  "max_locations",
                                ),
                              ),
                            });
                          }}
                        >
                          <label>
                            Workspace limit
                            <input
                              key={item.max_locations}
                              type="number"
                              name="max_locations"
                              min={1}
                              max="1000"
                              required
                              defaultValue={item.max_locations}
                            />
                          </label>
                          <button className="secondary" disabled={busy}>
                            Save workspace limit
                          </button>
                        </form>
                        <div className="row-actions">
                          <PaymentMethodsForm
                            key={item.id + JSON.stringify(item.payment_methods)}
                            shop={item}
                            busy={busy}
                            onSave={(methods) =>
                              change(`admin/tenants/${item.id}`, "PATCH", {
                                payment_methods: methods,
                              })
                            }
                          />
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              change(`admin/tenants/${item.id}`, "PATCH", {
                                status:
                                  item.status === "active"
                                    ? "suspended"
                                    : "active",
                              })
                            }
                          >
                            {item.status === "active"
                              ? "Suspend shop"
                              : "Activate shop"}
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              goToUrl(`/admin/members?shop=${item.id}`)
                            }
                          >
                            Members
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              goToUrl(
                                `/admin/modules?scope=shop&shop=${item.id}`,
                              )
                            }
                          >
                            Modules
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              goToUrl(`/admin/logs?shop=${item.id}`)
                            }
                          >
                            Logs
                          </button>
                        </div>
                      </div>
                    </section>
                  ))}
              </div>
            </>
          )}
          {page === "Platform members" && (
            <>
              <div className="admin-filter">{selectShop}</div>
              <section className="panel">
                {members.isPending ? (
                  <div className="loading">Loading members…</div>
                ) : members.error ? (
                  <div className="error-box">{members.error.message}</div>
                ) : members.data?.length ? (
                  members.data.map((member: any) => (
                    <article className="record-row" key={member.id}>
                      <div>
                        <strong>{member.name}</strong>
                        <small>
                          {member.email} · {member.role_name}
                        </small>
                      </div>
                      <span
                        className={
                          "badge " + (member.active ? "on" : "warning")
                        }
                      >
                        {member.active ? "Active" : "Disabled"}
                      </span>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          change(
                            `admin/tenants/${selectedShop}/members/${member.id}`,
                            "PATCH",
                            { active: !member.active },
                          )
                        }
                      >
                        {member.active ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `Remove ${member.name} from this shop? They will lose access.`,
                            )
                          )
                            void change(
                              `admin/tenants/${selectedShop}/members/${member.id}`,
                              "DELETE",
                            );
                        }}
                      >
                        Remove
                      </button>
                      <button
                        className="secondary"
                        onClick={() =>
                          goToUrl(`/admin/logs?user=${member.user_id}`)
                        }
                      >
                        View activity
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty">No members.</div>
                )}
              </section>
            </>
          )}
          {page === "Platform features" && (
            <>
              <div className="calendar-toolbar">
                <button
                  className={scope === "global" ? "primary" : "secondary"}
                  onClick={() => setScope("global")}
                >
                  Global modules
                </button>
                <button
                  className={scope === "shop" ? "primary" : "secondary"}
                  onClick={() => setScope("shop")}
                >
                  Shop modules
                </button>
              </div>
              {scope === "shop" && (
                <div className="admin-filter">{selectShop}</div>
              )}
              <p className="section-note">
                Global restrictions apply to every shop. Shop restrictions
                cannot be overridden by shop owners.
              </p>
              <section className="panel">
                {modules.error ? (
                  <div className="error-box">{modules.error.message}</div>
                ) : (
                  modules.data?.map((module: any) => {
                    const allowed =
                      scope === "global"
                        ? module.enabled
                        : module.admin_enabled;
                    return (
                      <div className="feature-row" key={module.key}>
                        <div>
                          <strong>{module.name}</strong>
                          <small>
                            {scope === "global"
                              ? "Global availability"
                              : `${module.enabled ? "Globally available" : "Globally blocked"} · Owner switch ${module.tenant_enabled ? "on" : "off"}`}
                          </small>
                        </div>
                        <span
                          className={"badge " + (allowed ? "on" : "warning")}
                        >
                          {allowed ? "Allowed" : "Blocked"}
                        </span>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            change("admin/features/" + module.key, "PATCH", {
                              enabled: !allowed,
                              ...(scope === "shop"
                                ? { tenant_id: selectedShop }
                                : {}),
                            })
                          }
                        >
                          {allowed ? "Block" : "Allow"}
                        </button>
                      </div>
                    );
                  })
                )}
              </section>
            </>
          )}
          {page === "Platform logs" && (
            <>
              <div className="list-toolbar">
                <input
                  aria-label="Search activity"
                  placeholder="Search person, email, shop or action…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {(shop || user) && (
                  <button
                    className="secondary"
                    onClick={() => replaceLocation("/admin/logs")}
                  >
                    Clear person/shop filter
                  </button>
                )}
              </div>
              <section className="panel">
                <div className="admin-audit-cards">
                  {logs.data?.items.map((entry: any) => (
                    <article className="history-mobile-card" key={entry.id}>
                      <div className="history-mobile-top">
                        {entry.actor_id ? (
                          <button
                            className="contact-copy"
                            onClick={() => {
                              setUser(entry.actor_id);
                              setNumber(1);
                            }}
                          >
                            {entry.actor_name || "Unknown user"}
                          </button>
                        ) : (
                          <strong>System</strong>
                        )}
                        <small>
                          {new Date(entry.created_at).toLocaleDateString()}
                        </small>
                      </div>
                      <p>
                        {entry.action
                          .replaceAll("_", " ")
                          .replaceAll(".", " · ")}
                      </p>
                      <small>
                        {entry.shop_name || "Platform"} ·{" "}
                        {new Date(entry.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                      <details>
                        <summary>Event details</summary>
                        <small>{entry.actor_email || "System event"}</small>
                        <small>{entry.target_id || "No target"}</small>
                      </details>
                    </article>
                  ))}
                </div>
                <div className="customer-table-scroll">
                  <table className="customer-table">
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Action</th>
                        <th>Shop</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.data?.items.map((entry: any) => (
                        <tr key={entry.id}>
                          <td>
                            {entry.actor_id ? (
                              <button
                                className="contact-copy"
                                onClick={() => {
                                  setUser(entry.actor_id);
                                  setNumber(1);
                                }}
                              >
                                {entry.actor_name || "Unknown user"}
                              </button>
                            ) : (
                              "System"
                            )}
                            <small>{entry.actor_email}</small>
                          </td>
                          <td>
                            {entry.action}
                            <small>{entry.target_id}</small>
                          </td>
                          <td>{entry.shop_name || "Platform"}</td>
                          <td>{new Date(entry.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {logs.error && (
                  <div className="error-box">{logs.error.message}</div>
                )}
                {logs.data?.items.length === 0 && (
                  <div className="empty">No matching activity.</div>
                )}
                <div className="pagination">
                  <button
                    className="secondary"
                    disabled={number === 1}
                    onClick={() => setNumber((value) => value - 1)}
                  >
                    Previous
                  </button>
                  Page {number}
                  <button
                    className="secondary"
                    disabled={!logs.data?.hasMore}
                    onClick={() => setNumber((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              </section>
            </>
          )}
          {page === "Job monitor" && (
            <section className="panel">
              {jobs.data?.map((job: any) => (
                <div className="record-row" key={job.status}>
                  <strong>{job.status}</strong>
                  <span>{job.count}</span>
                </div>
              ))}
              {jobs.error && (
                <div className="error-box">{jobs.error.message}</div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
