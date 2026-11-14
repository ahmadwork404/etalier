"use client";
import {
  BookingsWorkspace,
  BookingForm,
  BookingDetails,
} from "./BookingsWorkspace";
import { SalonSettings } from "./SalonSettings";
import { EmployeePicker } from "./EmployeePicker";
import { PayrollWorkspace } from "./PayrollWorkspace";
import { AnalyticsAppointments } from "./AnalyticsAppointments";
import { DateTimePicker } from "./DateTimePicker";
import { LocationProfile } from "./LocationProfile";
import { ModuleRecords } from "./ModuleRecords";
import { CustomSelect } from "./CustomSelect";
import { paymentLabels } from "./payment-methods";
import { ToastNotice, toast } from "./Toasts";
import { RecordVisual } from "./RecordVisual";
import { useMoney, useCurrencySymbol, getCurrencySymbol } from "./Currency";

import { useEffect, useState } from "react";
import {
  AppointmentCard,
  AppointmentStack,
  CalendarDayDialog,
} from "./CalendarCards";
import { PasswordInput } from "./PasswordInput";
import { useUrlPage, useUrlParam, validDate } from "./UrlState";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  X,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error?.message || "Request failed");
  if (method !== "GET") toast.success("Changes saved.");
  return d.data;
}
type Field = {
  key: string;
  label: string;
  type?: string;
  source?: string;
  options?: string[];
  optional?: boolean;
  value?: any;
};
const configs: Record<
  string,
  { path: string; fields: Field[]; label: string }
> = {
  Payroll: {
    path: "payroll",
    label: "payroll record",
    fields: [
      { key: "employee_id", label: "Employee", source: "employees" },
      { key: "period_start", label: "Period starts", type: "date" },
      { key: "period_end", label: "Period ends", type: "date" },
      { key: "base_minor", label: "Base salary ({currency})", type: "number" },
      { key: "bonus_minor", label: "Bonus ({currency})", type: "number" },
      {
        key: "deduction_minor",
        label: "Deduction ({currency})",
        type: "number",
      },
    ],
  },
  "Privacy requests": {
    path: "privacy-requests",
    label: "request",
    fields: [],
  },
  Branches: {
    path: "branches",
    label: "location",
    fields: [
      { key: "name", label: "Location name" },
      { key: "address", label: "Address", optional: true },
    ],
  },
  Products: {
    path: "products",
    label: "product",
    fields: [
      { key: "name", label: "Product name" },
      { key: "sku", label: "SKU" },
      {
        key: "price_minor",
        label: "Selling price ({currency})",
        type: "number",
      },
      { key: "cost_minor", label: "Cost ({currency})", type: "number" },
      { key: "minimum_stock", label: "Low stock threshold", type: "number" },
      {
        key: "supplier_id",
        label: "Supplier",
        source: "suppliers",
        optional: true,
      },
      {
        key: "expires_on",
        label: "Expiration date",
        type: "date",
        optional: true,
      },
    ],
  },
  Suppliers: {
    path: "suppliers",
    label: "supplier",
    fields: [
      { key: "name", label: "Supplier name" },
      { key: "email", label: "Email", type: "email", optional: true },
      { key: "phone", label: "Phone", optional: true },
    ],
  },
  Inventory: {
    path: "inventory",
    label: "stock movement",
    fields: [
      { key: "branch_id", label: "Branch", source: "branches" },
      { key: "product_id", label: "Product", source: "products" },
      { key: "quantity", label: "Quantity (+ add / − deduct)", type: "number" },
      {
        key: "reason",
        label: "Reason",
        options: ["purchase", "adjustment", "damaged", "expired", "return"],
      },
      {
        key: "transfer_to",
        label: "Transfer to branch",
        source: "branches",
        optional: true,
      },
    ],
  },
  "Stock history": {
    path: "inventory/movements",
    label: "movement",
    fields: [],
  },
  "Product consumption": {
    path: "service-consumables",
    label: "consumption rule",
    fields: [
      { key: "service_id", label: "Service", source: "services" },
      { key: "product_id", label: "Product", source: "products" },
      { key: "quantity", label: "Quantity used per service", type: "number" },
    ],
  },
  "Working hours": {
    path: "employee-schedules",
    label: "working day",
    fields: [
      { key: "employee_id", label: "Employee", source: "employees" },
      {
        key: "weekday",
        label: "Weekday (0 Sunday to 6 Saturday)",
        type: "number",
      },
      { key: "opens_at", label: "Start time", type: "time" },
      { key: "closes_at", label: "End time", type: "time" },
    ],
  },
  Leave: {
    path: "employee-leaves",
    label: "leave",
    fields: [
      { key: "employee_id", label: "Employee", source: "employees" },
      { key: "starts_at", label: "From", type: "datetime-local" },
      { key: "ends_at", label: "Until", type: "datetime-local" },
      { key: "reason", label: "Reason" },
      { key: "paid", label: "Paid leave", type: "checkbox", value: true },
    ],
  },
  Expenses: {
    path: "expenses",
    label: "expense",
    fields: [
      { key: "name", label: "Description" },
      { key: "branch_id", label: "Branch", source: "branches" },
      { key: "amount_minor", label: "Amount ({currency})", type: "number" },
      { key: "incurred_on", label: "Date", type: "date" },
    ],
  },
  Payments: { path: "payments", label: "payment", fields: [] },
  Commissions: { path: "commissions", label: "commission", fields: [] },
};
export const operationPages = [
  "Bookings",
  "Payroll",
  "Privacy requests",
  "Calendar",
  "Appointments",
  "Branches",
  "Working hours",
  "Leave",
  "Products",
  "Suppliers",
  "Inventory",
  "Stock history",
  "Product consumption",
  "POS & Orders",
  "Payments",
  "Expenses",
  "Commissions",
  "Analytics",
  "Settings",
];
export function Operations({ page }: { page: string }) {
  if (page === "Bookings") return <BookingsWorkspace />;
  if (page === "Calendar" || page === "Appointments") return <Calendar />;
  if (page === "POS & Orders") return <Orders />;
  if (page === "Settings") return <Settings />;
  if (page === "Analytics") return <Analytics />;
  return <Directory key={page} page={page} />;
}
function SelectSource({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: any;
  onChange: (v: string) => void;
}) {
  const result = useQuery({
    queryKey: ["options", field.source],
    queryFn: () => api(field.source! + "?page=1"),
    enabled: field.source !== "employees",
  });
  if (field.source === "employees")
    return (
      <EmployeePicker
        value={value || ""}
        onChange={onChange}
        required={!field.optional}
      />
    );
  return (
    <>
      <CustomSelect
        required={!field.optional}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{field.optional ? "None" : "Choose…"}</option>
        {(result.data?.items || result.data || []).map((r: any) => (
          <option value={r.id} key={r.id}>
            {r.name || r.customer_name || r.id}
          </option>
        ))}
      </CustomSelect>
      {result.error && <span className="error">{result.error.message}</span>}
    </>
  );
}
function Form({
  title,
  fields,
  initial = {},
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  fields: Field[];
  initial?: any;
  children?: React.ReactNode;
  onClose: () => void;
  onSubmit: (d: any) => Promise<void>;
}) {
  const currencySymbol = useCurrencySymbol();
  const [data, setData] = useState<any>(
      Object.fromEntries(
        Object.entries({
          ...Object.fromEntries(
            fields
              .filter((f) => f.value !== undefined)
              .map((f) => [f.key, f.value]),
          ),
          ...initial,
        }).map(([k, v]) => [k, k.endsWith("_minor") ? Number(v) / 100 : v]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={onClose}>
            <X />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              const body: any = {};
              for (const f of fields) {
                const value = data[f.key];
                if (f.optional && (value === undefined || value === ""))
                  continue;
                body[f.key] =
                  f.type === "checkbox"
                    ? !!value
                    : f.type === "number"
                      ? f.key.endsWith("_minor")
                        ? Math.round(Number(value) * 100)
                        : Number(value)
                      : f.type === "datetime-local"
                        ? new Date(value).toISOString()
                        : (value ?? "");
              }
              if (
                data.currency !== initial?.currency &&
                fields.some((f) => f.key === "currency")
              )
                body.currency_change_confirmed =
                  data.currency_change_confirmed === true;
              await onSubmit(body);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {children}
          {fields.map((f) => (
            <label key={f.key}>
              {f.label.replaceAll("{currency}", currencySymbol)}
              {f.source ? (
                <SelectSource
                  field={f}
                  value={data[f.key]}
                  onChange={(v) => setData({ ...data, [f.key]: v })}
                />
              ) : f.options ? (
                <CustomSelect
                  required={!f.optional}
                  value={data[f.key] || ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                >
                  <option value="">Choose…</option>
                  {f.options.map((v) => (
                    <option key={v} value={v}>
                      {f.key === "method"
                        ? paymentLabels[v] || v
                        : f.key === "currency"
                          ? `${v} · ${getCurrencySymbol(v)}`
                          : v}
                    </option>
                  ))}
                </CustomSelect>
              ) : ["date", "time", "datetime-local"].includes(f.type || "") ? (
                <DateTimePicker
                  type={f.type}
                  aria-label={f.label}
                  required={!f.optional}
                  value={data[f.key] ?? ""}
                  onChange={(event) =>
                    setData({ ...data, [f.key]: event.target.value })
                  }
                />
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={!!data[f.key]}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.checked })
                  }
                />
              ) : f.type === "password" ? (
                <PasswordInput
                  required={!f.optional}
                  value={data[f.key] ?? ""}
                  onChange={(event) =>
                    setData({ ...data, [f.key]: event.target.value })
                  }
                />
              ) : (
                <input
                  required={!f.optional}
                  type={f.type || "text"}
                  step={f.type === "number" ? "any" : undefined}
                  value={data[f.key] ?? ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          {fields.some((f) => f.key === "currency") &&
            data.currency !== initial?.currency && (
              <div className="currency-change-warning" role="note">
                <strong>
                  Change currency from {initial?.currency} to {data.currency}?
                </strong>
                <p>
                  All existing amounts, including prices, salaries, invoices and
                  reports, will use {data.currency}. The numbers will stay the
                  same. No exchange rate will be applied.
                </p>
                <label>
                  <input
                    type="checkbox"
                    required
                    checked={!!data.currency_change_confirmed}
                    onChange={(e) =>
                      setData({
                        ...data,
                        currency_change_confirmed: e.target.checked,
                      })
                    }
                  />{" "}
                  I understand and want to change the currency.
                </label>
              </div>
            )}
          {error && <ToastNotice message={error} />}
          <div className="form-actions">
            <button className="secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function State({ query }: { query: any }) {
  return query.isPending ? (
    <div className="loading">Loading your workspace…</div>
  ) : query.error ? (
    <div className="empty error-box" role="alert">
      {query.error.message}
      <button className="secondary" onClick={() => query.refetch()}>
        Try again
      </button>
    </div>
  ) : null;
}
function Directory({ page }: { page: string }) {
  const money = useMoney();
  const config = configs[page];
  const [locationId] = useUrlParam("record");
  const [locationMode] = useUrlParam("mode", "view");
  const cache = useQueryClient();
  const [modal, setModal] = useState(false);
  const [number, setNumber] = useUrlPage();
  const workspaceAccess = useQuery({
    queryKey: ["access"],
    queryFn: () => api("access"),
    enabled: page === "Branches",
  });
  const [search, setSearch] = useUrlParam("q");
  const [status, setStatus] = useUrlParam("status", "all", (value) =>
    ["all", "active", "inactive"].includes(value),
  );
  const [sort, setSort] = useUrlParam("sort", "name_asc", (value) =>
    ["name_asc", "name_desc"].includes(value),
  );
  const serverSearch = ["Products", "Suppliers", "Expenses"].includes(page);
  const query = useQuery({
    enabled: page !== "Payroll",
    queryKey: [
      "operations",
      page,
      number,
      ...(serverSearch ? [search, status, sort] : []),
    ],
    queryFn: () =>
      api(
        (page === "Branches" ? "location-profiles" : config.path) +
          "?" +
          new URLSearchParams({
            page: String(number),
            ...(serverSearch ? { q: search, status, sort } : {}),
          }),
      ),
  });
  const sourceRows = query.data?.items || query.data || [];
  const rows = [...sourceRows]
    .filter(
      (row: any) =>
        (serverSearch ||
          status === "all" ||
          row.active === (status === "active")) &&
        Object.values(row).some(
          (value) =>
            typeof value === "string" &&
            (serverSearch ||
              value.toLowerCase().includes(search.toLowerCase())),
        ),
    )
    .sort(
      (a: any, b: any) =>
        (sort === "name_desc" ? -1 : 1) *
        String(a.name || a.employee_name || a.product_name || "").localeCompare(
          String(b.name || b.employee_name || b.product_name || ""),
        ),
    );
  if (page === "Payroll") return <PayrollWorkspace />;
  if (page === "Branches" && locationId && locationMode === "view")
    return <LocationProfile id={locationId} />;
  return (
    <>
      <div className="operation-heading">
        <p>Every change is saved to your salon workspace.</p>
        {config.fields.length > 0 && (
          <button
            className="primary"
            disabled={
              page === "Branches" &&
              (!workspaceAccess.data ||
                workspaceAccess.data.location_count >=
                  workspaceAccess.data.max_locations)
            }
            onClick={() => setModal(true)}
          >
            <Plus size={17} />
            Add {config.label}
          </button>
        )}
      </div>
      <div className="module-filter-bar">
        <label className="module-search">
          <input
            aria-label={
              serverSearch ? "Search records" : "Search loaded records"
            }
            placeholder={
              serverSearch ? "Search records…" : "Search loaded records…"
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="module-filter-options">
          {["Products", "Suppliers", "Branches"].includes(page) && (
            <CustomSelect
              aria-label="Sort records"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setNumber(1);
              }}
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
            </CustomSelect>
          )}
          {page === "Products" && (
            <CustomSelect
              aria-label="Filter status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setNumber(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </CustomSelect>
          )}
        </div>
      </div>
      <State query={query} />
      {query.data && (
        <section className="panel">
          <ModuleRecords
            kind={config.path}
            rows={rows}
            label={page === "Branches" ? "Location" : page}
            columns={
              page === "Branches"
                ? [
                    {
                      label: "Status",
                      render: (r) => (
                        <span className={"badge " + (r.active ? "on" : "")}>
                          {r.active ? "Active" : "Inactive"}
                        </span>
                      ),
                    },
                    ...(rows.some((r) => r.employee_count !== null)
                      ? [
                          {
                            label: "Active team",
                            render: (r: any) => r.employee_count,
                          },
                        ]
                      : []),
                    ...(rows.some((r) => r.visits_month !== null)
                      ? [
                          {
                            label: "Visits this month",
                            render: (r: any) => r.visits_month,
                          },
                        ]
                      : []),
                    ...(rows.some((r) => r.net_minor !== null)
                      ? [
                          {
                            label: "Net this month",
                            render: (r: any) => money(r.net_minor),
                          },
                        ]
                      : []),
                  ]
                : undefined
            }
            detail={(r) =>
              (page === "Branches" ? r.address || "No address added" : "") ||
              r.sku ||
              r.product_name ||
              r.branch_name ||
              r.title ||
              r.method ||
              r.status?.replaceAll("_", " ") ||
              (r.opens_at
                ? [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ][r.weekday] +
                  " · " +
                  r.opens_at.slice(0, 5) +
                  "–" +
                  r.closes_at.slice(0, 5)
                : r.starts_at
                  ? new Date(r.starts_at).toLocaleString()
                  : "View record details")
            }
            value={
              page === "Branches"
                ? undefined
                : (r) => (
                    <>
                      {r.quantity !== undefined && (
                        <span
                          className={
                            "badge " +
                            (Number(r.quantity) <= Number(r.minimum_stock)
                              ? "warning"
                              : "on")
                          }
                        >
                          {Number(r.quantity)} units
                        </span>
                      )}
                      {r.price_minor !== undefined && (
                        <strong>{money(r.price_minor)}</strong>
                      )}
                      {r.amount_minor !== undefined && (
                        <strong>{money(r.amount_minor)}</strong>
                      )}
                      {r.paid !== undefined && (
                        <span
                          className={"badge " + (r.paid ? "on" : "warning")}
                        >
                          {r.paid ? "Paid leave" : "Unpaid leave"}
                        </span>
                      )}
                      {r.status && (
                        <span className="badge">
                          {r.status.replaceAll("_", " ")}
                        </span>
                      )}
                    </>
                  )
            }
            actions={(r) => (
              <>
                {" "}
                {page === "Privacy requests" && r.status === "requested" && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Complete this " +
                            r.type +
                            " request? Deletion removes personal data and stored media.",
                        )
                      )
                        return;
                      try {
                        await api(
                          "privacy-requests/" + r.id + "/complete",
                          "POST",
                          {},
                        );
                        await cache.invalidateQueries();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Complete {r.type} request
                  </button>
                )}
                {page === "Payroll" && r.status === "draft" && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await api("payroll/" + r.id, "PATCH", {});
                        await cache.invalidateQueries();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Record as paid
                  </button>
                )}
                {page === "Payments" && (
                  <Refund
                    payment={r}
                    onDone={() => cache.invalidateQueries()}
                  />
                )}
              </>
            )}
          />
          {query.data.items && (
            <div className="pagination">
              <button
                className="secondary"
                disabled={number === 1}
                onClick={() => setNumber((n) => n - 1)}
              >
                Previous
              </button>
              Page {number}
              <button
                className="secondary"
                disabled={
                  query.data.hasMore === undefined
                    ? sourceRows.length < 25
                    : !query.data.hasMore
                }
                onClick={() => setNumber((n) => n + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}
      {modal && (
        <Form
          title={"Add " + config.label}
          fields={config.fields}
          onClose={() => setModal(false)}
          onSubmit={async (d) => {
            await api(
              page === "Inventory" ? "inventory/movements" : config.path,
              "POST",
              d,
            );
            await cache.invalidateQueries();
          }}
        />
      )}
    </>
  );
}
function Refund({ payment, onDone }: { payment: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary" onClick={() => setOpen(true)}>
        Record refund
      </button>
      {open && (
        <Form
          title="Record a refund already issued"
          fields={[
            {
              key: "amount_minor",
              label: "Amount ({currency})",
              type: "number",
            },
            { key: "reason", label: "Reason" },
          ]}
          onClose={() => setOpen(false)}
          onSubmit={async (d) => {
            await api("payments/" + payment.id + "/refunds", "POST", {
              ...d,
              idempotency_key: crypto.randomUUID(),
            });
            onDone();
          }}
        />
      )}
    </>
  );
}
function Calendar() {
  const cache = useQueryClient();
  const [date, setDate] = useUrlParam(
    "date",
    new Date().toLocaleDateString("en-CA"),
    validDate,
  );
  const [view, setView] = useUrlParam("view", "Week", (value) =>
    ["Day", "Week", "Month"].includes(value),
  );
  const [employee, setEmployee] = useUrlParam(
    "employee",
    "",
    (value) => !value || /^[\da-f-]{36}$/i.test(value),
  );
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [error, setError] = useState("");
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => setExpandedDay(null), [date, view, employee]);
  const start = new Date(date + "T00:00:00");
  if (view === "Week") start.setDate(start.getDate() - start.getDay());
  if (view === "Month") start.setDate(1);
  const end = new Date(start);
  end.setDate(
    end.getDate() + (view === "Week" ? 7 : view === "Month" ? 32 : 1),
  );
  if (view === "Month") end.setDate(1);
  const query = useQuery({
    queryKey: ["appointments", date, view, employee],
    queryFn: () =>
      api(
        "appointments?from=" +
          encodeURIComponent(start.toISOString()) +
          "&to=" +
          encodeURIComponent(end.toISOString()) +
          "&include_walkins=true" +
          (employee ? "&employee_id=" + employee : ""),
      ),
  });
  const employees = useQuery({
    queryKey: ["options", "employees"],
    queryFn: () => api("employees"),
  });
  async function update(id: string, d: any) {
    setError("");
    try {
      await api("appointments/" + id, "PATCH", d);
      await cache.invalidateQueries();
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="calendar-toolbar">
        <div className="tabs">
          {["Day", "Week", "Month"].map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="calendar-date-controls">
          <button
            className="secondary"
            aria-label="Previous calendar period"
            onClick={() => {
              const next = new Date(date + "T12:00:00");
              if (view === "Month") {
                next.setDate(1);
                next.setMonth(next.getMonth() - 1);
              } else next.setDate(next.getDate() - (view === "Week" ? 7 : 1));
              setDate(next.toLocaleDateString("en-CA"));
            }}
          >
            <ChevronLeft size={17} />
          </button>
          <DateTimePicker
            aria-label="Calendar date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            className="secondary"
            aria-label="Next calendar period"
            onClick={() => {
              const next = new Date(date + "T12:00:00");
              if (view === "Month") {
                next.setDate(1);
                next.setMonth(next.getMonth() + 1);
              } else next.setDate(next.getDate() + (view === "Week" ? 7 : 1));
              setDate(next.toLocaleDateString("en-CA"));
            }}
          >
            <ChevronRight size={17} />
          </button>
          <button
            className="secondary"
            onClick={() => setDate(new Date().toLocaleDateString("en-CA"))}
          >
            Today
          </button>
        </div>
        <CustomSelect
          aria-label="Filter employee"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
        >
          <option value="">All employees</option>
          {employees.data?.items.map((e: any) => (
            <option value={e.id} key={e.id}>
              {e.name}
            </option>
          ))}
        </CustomSelect>
        <button
          className="primary"
          onClick={() => {
            setOpen(true);
          }}
        >
          <Plus size={17} />
          Book appointment
        </button>
      </div>
      {error && <ToastNotice message={error} />}
      <State query={query} />
      {query.data && (
        <div className={"calendar-grid " + view.toLowerCase()}>
          {Array.from(
            {
              length: Math.round((end.getTime() - start.getTime()) / 86400000),
            },
            (_, i) => {
              const day = new Date(start);
              day.setDate(day.getDate() + i);
              const key = day.toLocaleDateString("en-CA");
              const items = query.data
                .filter(
                  (a: any) =>
                    new Date(a.starts_at).toLocaleDateString("en-CA") === key,
                )
                .sort(
                  (a: any, b: any) =>
                    Date.parse(a.starts_at) - Date.parse(b.starts_at),
                );
              return (
                <section
                  key={key}
                  className="panel calendar-day"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const value = e.dataTransfer.getData("text/plain");
                    if (!value) return;
                    try {
                      const a = JSON.parse(value);
                      if (a.kind === "walkin") return;
                      const next = new Date(day);
                      next.setHours(
                        new Date(a.starts_at).getHours(),
                        new Date(a.starts_at).getMinutes(),
                      );
                      update(a.id, { starts_at: next.toISOString() });
                    } catch {
                      setError("Could not move appointment");
                    }
                  }}
                >
                  <h2>
                    {day.toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </h2>
                  {!items.length && (
                    <p className="quiet-day">No appointments</p>
                  )}
                  {view === "Day" ? (
                    items.map((a: any) => (
                      <AppointmentCard
                        key={a.id}
                        appointment={a}
                        now={now}
                        onClick={() => setSelected(a)}
                      />
                    ))
                  ) : (
                    <AppointmentStack
                      items={items}
                      now={now}
                      onOpen={() => setExpandedDay(day)}
                    />
                  )}
                </section>
              );
            },
          )}
        </div>
      )}
      {expandedDay && (
        <CalendarDayDialog
          day={expandedDay}
          now={now}
          items={(query.data || []).filter(
            (a: any) =>
              new Date(a.starts_at).toLocaleDateString("en-CA") ===
              expandedDay.toLocaleDateString("en-CA"),
          )}
          onClose={() => setExpandedDay(null)}
          onSelect={(a) => {
            setExpandedDay(null);
            setSelected(a);
          }}
        />
      )}
      {open && (
        <BookingForm
          date={date}
          onClose={() => setOpen(false)}
          onSaved={() => {
            cache.invalidateQueries();
          }}
        />
      )}
      {selected && (
        <BookingDetails visit={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function Orders() {
  const money = useMoney();
  const cache = useQueryClient();
  const q = useQuery({ queryKey: ["orders"], queryFn: () => api("orders") });
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => api("access"),
  });
  const [open, setOpen] = useState(false),
    [payment, setPayment] = useState<any>(null),
    [gift, setGift] = useState<any>(null),
    [checkoutError, setCheckoutError] = useState("");
  const fields: Field[] = [
    { key: "branch_id", label: "Branch", source: "branches" },
    { key: "customer_id", label: "Customer", source: "customers" },
    {
      key: "product_id",
      label: "Retail product",
      source: "products",
      optional: true,
    },
    { key: "service_id", label: "Service", source: "services", optional: true },
    { key: "quantity", label: "Quantity", type: "number" },
    {
      key: "appointment_id",
      label: "Completed appointment ID",
      optional: true,
    },
    { key: "discount_minor", label: "Discount ({currency})", type: "number" },
  ];
  return (
    <>
      <div className="operation-heading">
        <p>Cash, card and bank entries record payments already received.</p>
        <button className="primary" onClick={() => setOpen(true)}>
          <Plus size={17} />
          Create order
        </button>
      </div>
      <State query={q} />
      <section className="panel">
        <ModuleRecords
          kind="orders"
          rows={q.data || []}
          label="Orders"
          readOnly
          detail={(o) =>
            `${o.id.slice(0, 8)} · ${o.status.replaceAll("_", " ")}`
          }
          value={(o) => (
            <>
              <strong>{money(o.total_minor)}</strong>
              <small>
                Paid {money(o.paid_minor)} · Refunded {money(o.refunded_minor)}
              </small>
            </>
          )}
          actions={(o) => (
            <>
              {" "}
              {o.status === "open" && (
                <div className="row-actions">
                  <button className="primary" onClick={() => setPayment(o)}>
                    Record payment
                  </button>
                  <button className="secondary" onClick={() => setGift(o)}>
                    Redeem gift card
                  </button>
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        const d = await api(
                          "orders/" + o.id + "/checkout",
                          "POST",
                          {},
                        );
                        location.href = d.url;
                      } catch (e) {
                        setCheckoutError((e as Error).message);
                      }
                    }}
                  >
                    Pay online with Stripe
                  </button>
                </div>
              )}
            </>
          )}
        />
      </section>
      {checkoutError && <ToastNotice message={checkoutError} />}
      {gift && (
        <Form
          title="Redeem gift card"
          fields={[
            { key: "code", label: "Gift card code" },
            {
              key: "amount_minor",
              label: "Amount ({currency})",
              type: "number",
            },
          ]}
          onClose={() => setGift(null)}
          onSubmit={async (d) => {
            await api("gift-cards/redeem", "POST", {
              ...d,
              order_id: gift.id,
              idempotency_key: crypto.randomUUID(),
            });
            await cache.invalidateQueries();
          }}
        />
      )}
      {open && (
        <Form
          title="New order"
          fields={fields}
          initial={{ quantity: 1, discount_minor: 0 }}
          onClose={() => setOpen(false)}
          onSubmit={async (d) => {
            const items = [];
            if (d.product_id)
              items.push({
                kind: "product",
                id: d.product_id,
                quantity: d.quantity,
              });
            if (d.service_id)
              items.push({
                kind: "service",
                id: d.service_id,
                quantity: d.quantity,
              });
            await api("orders", "POST", {
              branch_id: d.branch_id,
              customer_id: d.customer_id,
              appointment_id: d.appointment_id,
              items,
              discount_minor: d.discount_minor,
              idempotency_key: crypto.randomUUID(),
            });
            await cache.invalidateQueries();
          }}
        />
      )}
      {payment && (
        <Form
          title="Record payment received"
          initial={{
            amount_minor:
              Number(payment.total_minor) - Number(payment.paid_minor),
          }}
          fields={[
            {
              key: "amount_minor",
              label: "Amount ({currency})",
              type: "number",
            },
            {
              key: "method",
              label: "Payment method",
              options: (
                access.data?.payment_methods || ["cash", "card"]
              ).filter((method: string) => method !== "stripe"),
            },
          ]}
          onClose={() => setPayment(null)}
          onSubmit={async (d) => {
            await api("orders/" + payment.id + "/payments", "POST", {
              ...d,
              idempotency_key: crypto.randomUUID(),
            });
            await cache.invalidateQueries();
          }}
        />
      )}
    </>
  );
}
function Settings() {
  return <SalonSettings security={<Password />} />;
}

function Password() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary" onClick={() => setOpen(true)}>
        Change password
      </button>
      {open && (
        <Form
          title="Change password (signs out all sessions)"
          fields={[
            {
              key: "currentPassword",
              label: "Current password",
              type: "password",
            },
            {
              key: "password",
              label: "New password (12+ characters)",
              type: "password",
            },
          ]}
          onClose={() => setOpen(false)}
          onSubmit={async (d) => {
            await api("auth/password", "POST", d);
            location.reload();
          }}
        />
      )}
    </>
  );
}
function Analytics() {
  const money = useMoney();
  const [from, setFrom] = useUrlParam(
    "from",
    new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA"),
    validDate,
  );
  const [to, setTo] = useUrlParam(
    "to",
    new Date().toLocaleDateString("en-CA"),
    validDate,
  );
  const q = useQuery({
    queryKey: ["analytics", from, to],
    queryFn: () => api("analytics?from=" + from + "&to=" + to),
  });
  return (
    <>
      <div className="calendar-toolbar">
        <label>
          From
          <DateTimePicker
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Until
          <DateTimePicker
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <State query={q} />
      {q.data && (
        <>
          <div className="overview-grid">
            {[
              ["Collected", q.data.gross_minor],
              ["Refunded", q.data.refunds_minor],
              ["Net collected", q.data.net_minor],
            ].map(([label, value]) => (
              <div className="panel metric" key={label}>
                <p>{label}</p>
                <h2>{money(value)}</h2>
              </div>
            ))}
          </div>
          <section className="panel chart-panel">
            <h2>Collected revenue</h2>
            <div style={{ height: 280, width: "100%" }}>
              <ResponsiveContainer>
                <BarChart
                  data={q.data.series.map((r: any) => ({
                    ...r,
                    value: Number(r.revenue_minor) / 100,
                    day: new Date(r.day).toLocaleDateString(),
                  }))}
                >
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    fill="var(--color-primary)"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            {q.data.bookings.map((b: any) => (
              <AnalyticsAppointments
                key={`${b.status}:${from}:${to}`}
                status={b.status}
                count={b.count}
                from={from}
                to={to}
              />
            ))}
          </section>
        </>
      )}
    </>
  );
}
