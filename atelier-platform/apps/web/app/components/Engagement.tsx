"use client";
import { ModuleRecords } from "./ModuleRecords";
import { IntakeForms } from "./IntakeForms";
import { useUrlParam } from "./UrlState";
import { CustomSelect } from "./CustomSelect";
import { useCurrencySymbol, useMoney } from "./Currency";
import { ToastNotice, toast } from "./Toasts";
import { RecordVisual } from "./RecordVisual";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Copy, ArrowRight } from "lucide-react";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error?.message || "Request failed");
  return d.data;
}
const routes: Record<string, string> = {
  "Intake forms": "forms",
  "Form submissions": "form-submissions",
  Reviews: "reviews",
  UGC: "ugc-submissions",
  Automations: "workflows",
  Campaigns: "campaigns",
  Notifications: "notifications",
  Loyalty: "loyalty",
  "Membership plans": "membership-plans",
  Memberships: "memberships",
  "Gift cards": "gift-cards",
  Members: "members",
  Integrations: "integrations",
};
export const engagementPages = Object.keys(routes);
export function Engagement({ page }: { page: string }) {
  if (page === "Intake forms" || page === "Form submissions")
    return <IntakeForms />;
  return <LegacyEngagement page={page} />;
}
function LegacyEngagement({ page }: { page: string }) {
  const money = useMoney();
  const currencySymbol = useCurrencySymbol();
  const cache = useQueryClient(),
    [modal, setModal] = useState(false),
    [member, setMember] = useState<any>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [fields, setFields] = useState<any[]>([
      { key: "question_1", label: "", type: "text", required: true },
    ]);
  const q = useQuery({
    queryKey: ["engagement", page],
    queryFn: () => api(routes[page]),
  });
  const customers = useQuery({
    queryKey: ["options", "customers"],
    queryFn: () => api("customers"),
  });
  const roles = useQuery({
    queryKey: ["roles-options"],
    queryFn: () => api("roles"),
    enabled: page === "Members",
  });
  const branches = useQuery({
    queryKey: ["options", "branches"],
    queryFn: () => api("branches"),
  });
  const plans = useQuery({
    queryKey: ["options", "membership-plans"],
    queryFn: () => api("membership-plans"),
    enabled: page === "Memberships",
  });
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api(path, method, body);
      setSuccess(
        result.url
          ? (result.email_status === "sent"
              ? "Invitation email sent. "
              : result.email_status === "failed"
                ? "Invitation created, but email delivery failed. Share this link instead. "
                : "") +
              "Secure link (expires in 7 days): " +
              result.url
          : result.code
            ? "Gift code — save it now: " + result.code
            : "Changes saved",
      );
      await cache.invalidateQueries();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const creatable = [
    "Intake forms",
    "Automations",
    "Campaigns",
    "Loyalty",
    "Membership plans",
    "Memberships",
    "Gift cards",
    "Members",
  ];
  const [search, setSearch] = useUrlParam("q");
  const [sort, setSort] = useUrlParam("sort", "newest", (value) =>
    ["newest", "name_asc", "name_desc"].includes(value),
  );
  const sourceRows = Array.isArray(q.data) ? q.data : [];
  const rows = [...sourceRows]
    .filter((row) =>
      Object.values(row).some(
        (value) =>
          typeof value === "string" &&
          value.toLowerCase().includes(search.toLowerCase()),
      ),
    )
    .sort((a, b) =>
      sort === "newest"
        ? 0
        : (sort === "name_desc" ? -1 : 1) *
          String(a.name || a.customer_name || "").localeCompare(
            String(b.name || b.customer_name || ""),
          ),
    );
  function input(label: string, name: string, type = "text", optional = false) {
    return (
      <label>
        {label}
        <input
          name={name}
          type={type}
          required={!optional}
          step={type === "number" ? "1" : undefined}
        />
      </label>
    );
  }
  function customer() {
    return (
      <label>
        Customer
        <CustomSelect name="customer_id" required>
          <option value="">Choose…</option>
          {customers.data?.items.map((c: any) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </CustomSelect>
      </label>
    );
  }
  return (
    <>
      <div className="operation-heading">
        <p>
          {page === "Integrations"
            ? "Credentials are stored in server environment variables."
            : "Your salon’s customer experience, thoughtfully connected."}
        </p>
        {creatable.includes(page) && (
          <button className="primary" onClick={() => setModal(true)}>
            <Plus size={17} />
            {page === "Members" ? "Invite employee" : "Create entry"}
          </button>
        )}
        {["Reviews", "UGC"].includes(page) && (
          <button className="secondary" onClick={() => setModal(true)}>
            Create customer link
          </button>
        )}
      </div>
      {error && <ToastNotice message={error} />}
      {success && !success.startsWith("Changes saved") && (
        <div role="status" className="success secure-result">
          <span>{success}</span>
          <button
            aria-label="Copy result"
            onClick={() => navigator.clipboard.writeText(success)}
          >
            <Copy size={18} />
          </button>
        </div>
      )}
      <ToastNotice
        message={success.startsWith("Changes saved") ? success : ""}
        kind="success"
        onDismiss={() => setSuccess("")}
      />
      {q.isPending ? (
        <div className="loading">Loading…</div>
      ) : q.error ? (
        <div className="error-box" role="alert">
          {q.error.message}
        </div>
      ) : page === "Integrations" ? (
        <div className="record-grid">
          {Object.entries(q.data).map(([name, configured]) => (
            <section className="panel module" key={name}>
              <h2>{name === "r2" ? "Cloudflare R2" : name}</h2>
              <span className={"badge " + (configured ? "on" : "warning")}>
                {configured ? "Configured" : "Not configured"}
              </span>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <div className="module-filter-bar">
            <label className="module-search">
              <input
                aria-label="Search loaded records"
                placeholder="Search loaded records…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <CustomSelect
              aria-label="Sort records"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Original order</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
            </CustomSelect>
          </div>
          <ModuleRecords
            kind={routes[page]}
            rows={rows}
            label={page}
            detail={(r) =>
              r.email ||
              r.subject ||
              r.role_name ||
              r.reason ||
              r.body ||
              r.testimonial ||
              (r.last_four
                ? "Card ending " + r.last_four
                : "View entry details")
            }
            value={(r) => (
              <>
                {r.status && (
                  <span className="badge">{r.status.replaceAll("_", " ")}</span>
                )}
                {r.enabled !== undefined && (
                  <span className={"badge " + (r.enabled ? "on" : "warning")}>
                    {r.enabled ? "Enabled" : "Paused"}
                  </span>
                )}
                {r.active !== undefined && (
                  <span className={"badge " + (r.active ? "on" : "warning")}>
                    {r.active ? "Active" : "Inactive"}
                  </span>
                )}
                {r.rating && <strong>{r.rating}/5</strong>}
                {r.points !== undefined && <strong>{r.points} points</strong>}
                {r.balance_minor !== undefined && (
                  <strong>{money(r.balance_minor)}</strong>
                )}
                {r.price_minor !== undefined && (
                  <strong>{money(r.price_minor)}</strong>
                )}
                {r.credits_remaining !== undefined && (
                  <strong>{r.credits_remaining} credits</strong>
                )}
              </>
            )}
            actions={(r) => (
              <>
                {" "}
                {page === "Automations" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      action("workflows/" + r.id, "PATCH", {
                        enabled: !r.enabled,
                      })
                    }
                  >
                    {r.enabled ? "Pause" : "Enable"}
                  </button>
                )}
                {page === "Campaigns" && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      action(
                        "campaigns/" +
                          r.id +
                          (r.status === "draft" ? "/queue" : ""),
                        r.status === "draft" ? "POST" : "PATCH",
                        r.status === "draft"
                          ? undefined
                          : {
                              status:
                                r.status === "paused" ? "queued" : "paused",
                            },
                      )
                    }
                  >
                    {r.status === "draft"
                      ? "Queue for opted-in customers"
                      : r.status === "paused"
                        ? "Resume"
                        : "Pause"}
                  </button>
                )}
                {page === "UGC" && (
                  <div className="row-actions">
                    {["approved", "rejected", "withdrawn"].map((status) => (
                      <button
                        className="secondary"
                        disabled={busy}
                        key={status}
                        onClick={() =>
                          action("ugc/" + r.id, "PATCH", { status })
                        }
                      >
                        {status}
                      </button>
                    ))}
                    {r.status === "approved" && r.media_id && (
                      <button
                        className="primary"
                        onClick={async () => {
                          try {
                            const d = await api("ugc/" + r.id + "/download");
                            window.open(d.url, "_blank", "noopener,noreferrer");
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Download media
                      </button>
                    )}
                  </div>
                )}
                {page === "Memberships" && (
                  <button
                    className="secondary"
                    disabled={busy || r.status !== "active"}
                    onClick={() => action("memberships/" + r.id, "PATCH")}
                  >
                    Cancel membership
                  </button>
                )}
                {page === "Members" && !r.is_owner && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setMember(r);
                      setModal(true);
                    }}
                  >
                    Manage access
                  </button>
                )}
              </>
            )}
          />
        </section>
      )}
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create entry"
          >
            <div className="modal-heading">
              <h2>
                {["Reviews", "UGC"].includes(page)
                  ? "Create secure customer link"
                  : page}
              </h2>
              <button aria-label="Close dialog" onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const d: any = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                for (const key of [
                  "delay_minutes",
                  "points",
                  "price_minor",
                  "duration_days",
                  "service_credits",
                  "initial_minor",
                ])
                  if (key in d)
                    d[key] = key.endsWith("_minor")
                      ? Math.round(Number(d[key]) * 100)
                      : Number(d[key]);
                let path = routes[page];
                if (page === "Intake forms") {
                  if (d.link === "yes") {
                    path = "customer-links";
                    d.purpose = "form";
                    delete d.link;
                  } else {
                    d.fields = fields.map((f) => ({
                      ...f,
                      options:
                        f.type === "select"
                          ? String(f.options || "")
                              .split(",")
                              .map((v: string) => v.trim())
                          : undefined,
                    }));
                    delete d.link;
                  }
                }
                if (page === "Reviews" || page === "UGC") {
                  path = "customer-links";
                  d.purpose = page === "Reviews" ? "review" : "ugc";
                }
                if (page === "Loyalty") d.idempotency_key = crypto.randomUUID();
                if (page === "Members") {
                  if (member) {
                    path = "members/" + member.id;
                    d.active = d.active === "true";
                    d.branch_id = d.branch_id || null;
                  } else {
                    path = "invitations";
                    if (!d.branch_id) delete d.branch_id;
                  }
                }
                if (
                  await action(
                    path,
                    page === "Members" && member ? "PATCH" : "POST",
                    d,
                  )
                ) {
                  setModal(false);
                  setMember(null);
                }
              }}
            >
              {page === "Intake forms" ? (
                <>
                  <label>
                    Create
                    <CustomSelect
                      name="link"
                      onChange={(e) => {
                        const form = e.currentTarget.form;
                        form
                          ?.querySelectorAll<HTMLElement>("[data-mode]")
                          .forEach(
                            (el) =>
                              (el.hidden = el.dataset.mode !== e.target.value),
                          );
                      }}
                    >
                      <option value="no">New form template</option>
                      <option value="yes">Secure customer form link</option>
                    </CustomSelect>
                  </label>
                  <div data-mode="no">
                    {input("Form name", "name", "text", true)}
                    <div className="form-builder">
                      {fields.map((f, i) => (
                        <fieldset key={i}>
                          <legend>Question {i + 1}</legend>
                          <label>
                            Question
                            <input
                              value={f.label}
                              onChange={(e) =>
                                setFields((items) =>
                                  items.map((v, j) =>
                                    i === j
                                      ? { ...v, label: e.target.value }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label>
                            Answer type
                            <CustomSelect
                              value={f.type}
                              onChange={(e) =>
                                setFields((items) =>
                                  items.map((v, j) =>
                                    i === j
                                      ? { ...v, type: e.target.value }
                                      : v,
                                  ),
                                )
                              }
                            >
                              {[
                                "text",
                                "textarea",
                                "select",
                                "checkbox",
                                "date",
                                "consent",
                              ].map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </CustomSelect>
                          </label>
                          {f.type === "select" && (
                            <label>
                              Choices (comma separated)
                              <input
                                value={f.options || ""}
                                onChange={(e) =>
                                  setFields((items) =>
                                    items.map((v, j) =>
                                      i === j
                                        ? { ...v, options: e.target.value }
                                        : v,
                                    ),
                                  )
                                }
                              />
                            </label>
                          )}
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={f.required}
                              onChange={(e) =>
                                setFields((items) =>
                                  items.map((v, j) =>
                                    i === j
                                      ? { ...v, required: e.target.checked }
                                      : v,
                                  ),
                                )
                              }
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              setFields((v) => v.filter((_, j) => j !== i))
                            }
                          >
                            Remove question
                          </button>
                        </fieldset>
                      ))}
                      <button
                        className="secondary"
                        type="button"
                        onClick={() =>
                          setFields((v) => [
                            ...v,
                            {
                              key:
                                "question_" +
                                crypto
                                  .randomUUID()
                                  .replaceAll("-", "")
                                  .slice(0, 10),
                              label: "",
                              type: "text",
                              required: false,
                            },
                          ])
                        }
                      >
                        <Plus size={16} />
                        Add question
                      </button>
                    </div>
                  </div>
                  <div data-mode="yes" hidden>
                    <label>
                      Customer
                      <CustomSelect name="customer_id">
                        <option value="">Choose…</option>
                        {customers.data?.items.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </CustomSelect>
                    </label>
                    <label>
                      Form
                      <CustomSelect name="resource_id">
                        <option value="">Choose…</option>
                        {rows.map((r: any) => (
                          <option value={r.id} key={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </CustomSelect>
                    </label>
                  </div>
                </>
              ) : ["Reviews", "UGC"].includes(page) ? (
                customer()
              ) : (
                <>
                  {["Automations", "Campaigns", "Membership plans"].includes(
                    page,
                  ) && input("Name", "name")}
                  {["Automations", "Campaigns"].includes(page) && (
                    <>
                      <label>
                        Channel
                        <CustomSelect name="channel">
                          <option>email</option>
                          <option>sms</option>
                          <option>whatsapp</option>
                        </CustomSelect>
                      </label>
                      {input("Subject", "subject")}
                      <label>
                        Message (use {"{{name}}"} to personalize)
                        <textarea required name="body" />
                      </label>
                    </>
                  )}
                  {page === "Automations" && (
                    <>
                      <label>
                        Trigger
                        <CustomSelect name="trigger">
                          <option>appointment.created</option>
                          <option>appointment.completed</option>
                        </CustomSelect>
                      </label>
                      {input("Delay in minutes", "delay_minutes", "number")}
                    </>
                  )}
                  {["Loyalty", "Memberships"].includes(page) && customer()}
                  {page === "Loyalty" && (
                    <>
                      {input("Points (+ earn / − redeem)", "points", "number")}
                      {input("Reason", "reason")}
                    </>
                  )}
                  {page === "Membership plans" && (
                    <>
                      {input(
                        `Price (${currencySymbol})`,
                        "price_minor",
                        "number",
                      )}
                      {input("Duration in days", "duration_days", "number")}
                      {input("Service credits", "service_credits", "number")}
                    </>
                  )}
                  {page === "Memberships" && (
                    <label>
                      Plan
                      <CustomSelect name="plan_id" required>
                        <option value="">Choose…</option>
                        {plans.data?.map((p: any) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </CustomSelect>
                    </label>
                  )}
                  {page === "Gift cards" && (
                    <>
                      {input(
                        `Initial value (${currencySymbol})`,
                        "initial_minor",
                        "number",
                      )}
                      {input("Expires on", "expires_on", "date")}
                    </>
                  )}
                  {page === "Members" && (
                    <>
                      {member ? (
                        <>
                          <p>
                            {member.name} · {member.email}
                          </p>
                          <label>
                            Status
                            <CustomSelect
                              name="active"
                              defaultValue={String(member.active)}
                            >
                              <option value="true">Active</option>
                              <option value="false">Revoke access</option>
                            </CustomSelect>
                          </label>
                        </>
                      ) : (
                        input("Employee email", "email", "email")
                      )}
                      <label>
                        Role
                        <CustomSelect name="role_id" required>
                          <option value="">Choose…</option>
                          {roles.data?.roles
                            .filter((r: any) => !r.is_owner)
                            .map((r: any) => (
                              <option value={r.id} key={r.id}>
                                {r.name}
                              </option>
                            ))}
                        </CustomSelect>
                      </label>
                      <label>
                        Branch restriction
                        <CustomSelect name="branch_id">
                          <option value="">All branches</option>
                          {branches.data?.map((b: any) => (
                            <option value={b.id} key={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </CustomSelect>
                      </label>
                    </>
                  )}
                </>
              )}

              <div className="form-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setModal(false)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
