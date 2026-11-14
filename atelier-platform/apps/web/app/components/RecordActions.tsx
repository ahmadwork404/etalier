"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
  AlertTriangle,
  Check,
  Copy,
} from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { DateTimePicker } from "./DateTimePicker";
import { RecordVisual } from "./RecordVisual";
import { ServiceVisual, ServiceImageEditor } from "./ServiceVisual";
import { EmployeeAvatar } from "./EmployeePhoto";
import { useUrlParam, goToUrl } from "./UrlState";
import { useMoney, useCurrencySymbol } from "./Currency";
import { toast } from "./Toasts";

type Field = {
  key: string;
  label: string;
  type?: string;
  optional?: boolean;
  source?: string;
  min?: number;
  max?: number;
};
type Definition = { label: string; permission: string; fields: Field[] };
const name: Field = { key: "name", label: "Name" };
const contact: Field[] = [
  { key: "email", label: "Email", type: "email", optional: true },
  { key: "phone", label: "Cellphone", type: "tel", optional: true },
];
const active: Field = {
  key: "active",
  label: "Available for new bookings",
  type: "checkbox",
};
export const recordDefinitions: Record<string, Definition> = {
  orders: { label: "order", permission: "", fields: [] },
  "service-consumables": {
    label: "consumption rule",
    permission: "inventory.write",
    fields: [
      {
        key: "quantity",
        label: "Quantity used per service",
        type: "number",
        min: 0.001,
        max: 100000,
      },
    ],
  },
  forms: {
    label: "form",
    permission: "forms.write",
    fields: [
      name,
      { key: "active", label: "Accept new submissions", type: "checkbox" },
    ],
  },
  workflows: {
    label: "automation",
    permission: "marketing.write",
    fields: [
      name,
      { key: "subject", label: "Subject" },
      { key: "body", label: "Message", type: "textarea" },
      {
        key: "delay_minutes",
        label: "Delay (minutes)",
        type: "number",
        min: 0,
        max: 525600,
      },
    ],
  },
  campaigns: {
    label: "campaign draft",
    permission: "marketing.write",
    fields: [
      name,
      { key: "subject", label: "Subject" },
      { key: "body", label: "Message", type: "textarea" },
    ],
  },
  "membership-plans": {
    label: "membership plan",
    permission: "marketing.write",
    fields: [
      name,
      { key: "price_minor", label: "Price", type: "money", min: 0 },
      {
        key: "duration_days",
        label: "Duration (days)",
        type: "number",
        min: 1,
        max: 3660,
      },
      {
        key: "service_credits",
        label: "Service credits",
        type: "number",
        min: 0,
        max: 10000,
      },
    ],
  },
  branches: {
    label: "workspace",
    permission: "settings.manage",
    fields: [name, { key: "address", label: "Address", optional: true }],
  },
  customers: {
    label: "customer",
    permission: "customers.write",
    fields: [name, ...contact],
  },
  employees: {
    label: "employee",
    permission: "employees.write",
    fields: [
      name,
      { key: "title", label: "Role / title", optional: true },
      ...contact.map((field) => ({ ...field, optional: false })),
      {
        key: "base_salary_minor",
        label: "Monthly base salary",
        type: "money",
        min: 0,
        max: 10000000,
      },
      active,
    ],
  },
  services: {
    label: "service",
    permission: "services.write",
    fields: [
      name,
      {
        key: "duration_minutes",
        label: "Duration (minutes)",
        type: "number",
        min: 5,
        max: 600,
      },
      {
        key: "buffer_minutes",
        label: "Buffer (minutes)",
        type: "number",
        min: 0,
        max: 120,
      },
      { key: "price_minor", label: "Price", type: "money", min: 0 },
      {
        ...active,
        label:
          "Active service — available for new bookings (uncheck to make inactive)",
      },
    ],
  },
  products: {
    label: "product",
    permission: "inventory.write",
    fields: [
      name,
      { key: "sku", label: "SKU" },
      { key: "price_minor", label: "Selling price", type: "money", min: 0 },
      { key: "cost_minor", label: "Cost", type: "money", min: 0 },
      {
        key: "minimum_stock",
        label: "Low stock threshold",
        type: "number",
        min: 0,
      },
      {
        key: "supplier_id",
        label: "Supplier",
        source: "suppliers",
        optional: true,
      },
      { key: "expires_on", label: "Expiry date", type: "date", optional: true },
      { ...active, label: "Active product" },
    ],
  },
  suppliers: {
    label: "supplier",
    permission: "inventory.write",
    fields: [name, ...contact],
  },
  expenses: {
    label: "expense",
    permission: "finance.write",
    fields: [
      { ...name, label: "Description" },
      { key: "amount_minor", label: "Amount", type: "money", min: 0.01 },
      { key: "incurred_on", label: "Date", type: "date" },
    ],
  },
  "employee-schedules": {
    label: "working day",
    permission: "employees.write",
    fields: [
      { key: "weekday", label: "Day", type: "weekday" },
      { key: "opens_at", label: "Starts at", type: "time" },
      { key: "closes_at", label: "Ends at", type: "time" },
    ],
  },
  "employee-leaves": {
    label: "leave",
    permission: "employees.write",
    fields: [
      { key: "starts_at", label: "Starts at", type: "datetime-local" },
      { key: "ends_at", label: "Ends at", type: "datetime-local" },
      { key: "reason", label: "Reason", optional: true },
      { key: "paid", label: "Paid leave", type: "checkbox" },
    ],
  },
  payroll: {
    label: "payroll draft",
    permission: "payroll.write",
    fields: [
      { key: "period_start", label: "Period starts", type: "date" },
      { key: "period_end", label: "Period ends", type: "date" },
      { key: "base_minor", label: "Base salary", type: "money", min: 0 },
      { key: "bonus_minor", label: "Bonus", type: "money", min: 0 },
      { key: "deduction_minor", label: "Deduction", type: "money", min: 0 },
    ],
  },
};
export function recordId(row: any): string {
  return (
    row.id ||
    [
      row.customer_id,
      row.employee_id,
      row.branch_id,
      row.service_id,
      row.product_id,
    ]
      .filter(Boolean)
      .join(".")
  );
}
export function recordName(row: any, fallback = "Record") {
  return (
    row.name ||
    row.employee_name ||
    row.customer_name ||
    row.product_name ||
    row.service_name ||
    row.subject ||
    row.reason ||
    fallback
  );
}
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok)
    throw Error(
      Object.values(payload.error?.issues?.fieldErrors || {})
        .flat()
        .join(" ") ||
        payload.error?.message ||
        "Unable to complete this action",
    );
  return payload.data;
}
function locked(kind: string, row: any) {
  return (
    kind === "orders" ||
    (kind === "payroll" && row?.status !== "draft") ||
    (kind === "campaigns" && row?.status !== "draft") ||
    (kind === "workflows" && row?.enabled)
  );
}
function useAccess() {
  return useQuery({
    queryKey: ["record-access"],
    queryFn: () => request("access"),
  });
}
export function RecordActions({
  kind,
  row,
  viewOnly = false,
  deleteOnly = false,
}: {
  kind: string;
  row: any;
  viewOnly?: boolean;
  deleteOnly?: boolean;
}) {
  const access = useAccess();
  const definition = recordDefinitions[kind];
  const writable =
    !viewOnly &&
    !!definition &&
    access.data?.permissions.includes(definition.permission) &&
    !locked(kind, row);
  const open = (mode: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("record", recordId(row));
    url.searchParams.set("mode", mode);
    goToUrl(url.pathname + url.search);
  };
  const label = recordName(row, definition?.label || "record");
  return (
    <div className="record-actions" aria-label={`Actions for ${label}`}>
      {!deleteOnly && (
        <button
          className="table-icon-button"
          title="View details"
          aria-label={`View ${label}`}
          onClick={() => open("view")}
        >
          <Eye size={18} />
        </button>
      )}
      {writable && !deleteOnly && (
        <button
          className="table-icon-button"
          title="Edit record"
          aria-label={`Edit ${label}`}
          onClick={() => open("edit")}
        >
          <Pencil size={18} />
        </button>
      )}
      {writable && (
        <button
          className="table-icon-button destructive-icon"
          title="Delete record"
          aria-label={`Delete ${label}`}
          onClick={() => open("delete")}
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
}
function OptionField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = useQuery({
    queryKey: ["record-options", field.source],
    queryFn: () => request(field.source!),
  });
  return (
    <>
      <CustomSelect
        aria-label={field.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">None</option>
        {(options.data?.items || options.data || []).map((option: any) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </CustomSelect>
      {options.error && <small role="alert">{options.error.message}</small>}
    </>
  );
}
function initialValues(row: any, fields: Field[]) {
  return Object.fromEntries(
    fields.map((field) => {
      let value = row[field.key];
      if (field.type === "money") value = Number(value || 0) / 100;
      if (field.type === "date") value = value?.slice(0, 10) || "";
      if (field.type === "time") value = value?.slice(0, 5) || "";
      if (field.type === "datetime-local" && value) {
        const date = new Date(value);
        value = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }
      return [field.key, value ?? ""];
    }),
  );
}
function RecordEditor({
  row,
  definition,
  save,
  busy,
}: {
  row: any;
  definition: Definition;
  save: (body: any) => void;
  busy: boolean;
}) {
  const [values, setValues] = useState(() =>
    initialValues(row, definition.fields),
  );
  const symbol = useCurrencySymbol();
  return (
    <form
      className="record-editor"
      onSubmit={(event) => {
        event.preventDefault();
        const body = Object.fromEntries(
          definition.fields.map((field) => {
            let value = values[field.key];
            if (field.type === "money") value = Math.round(Number(value) * 100);
            else if (["number", "weekday"].includes(field.type || ""))
              value = Number(value);
            else if (field.type === "datetime-local")
              value = new Date(value).toISOString();
            else if (field.type === "checkbox") value = !!value;
            else if (
              !value &&
              (field.source || field.type === "date" || field.type === "email")
            )
              value = null;
            return [field.key, value];
          }),
        );
        save(body);
      }}
    >
      <div className="record-form-grid">
        {definition.fields.map((field) => (
          <label
            key={field.key}
            className={field.type === "checkbox" ? "checkbox" : ""}
          >
            {field.label}
            {field.type === "money" ? ` (${symbol})` : ""}
            {field.type === "textarea" ? (
              <textarea
                aria-label={field.label}
                required
                maxLength={5000}
                rows={5}
                value={values[field.key]}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
              />
            ) : field.source ? (
              <OptionField
                field={field}
                value={String(values[field.key])}
                onChange={(value) =>
                  setValues({ ...values, [field.key]: value })
                }
              />
            ) : ["date", "time", "datetime-local"].includes(
                field.type || "",
              ) ? (
              <DateTimePicker
                type={field.type}
                aria-label={field.label}
                required={!field.optional}
                value={values[field.key]}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
              />
            ) : field.type === "weekday" ? (
              <CustomSelect
                aria-label={field.label}
                value={String(values[field.key])}
                onChange={(event) =>
                  setValues({ ...values, [field.key]: event.target.value })
                }
              >
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </CustomSelect>
            ) : (
              <input
                aria-label={field.label}
                required={!field.optional && field.type !== "checkbox"}
                type={field.type === "money" ? "number" : field.type || "text"}
                min={field.min}
                max={field.max}
                maxLength={field.type === undefined ? 1000 : undefined}
                step={
                  field.type === "money"
                    ? "0.01"
                    : field.type === "number"
                      ? "any"
                      : undefined
                }
                checked={
                  field.type === "checkbox" ? !!values[field.key] : undefined
                }
                value={
                  field.type === "checkbox" ? undefined : values[field.key]
                }
                onChange={(event) =>
                  setValues({
                    ...values,
                    [field.key]:
                      field.type === "checkbox"
                        ? event.target.checked
                        : event.target.value,
                  })
                }
              />
            )}
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          <Check size={17} />
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
export function RecordDialog({ kind, rows }: { kind: string; rows: any[] }) {
  const [id] = useUrlParam("record");
  const [mode, setMode] = useUrlParam("mode", "view", (value) =>
    ["view", "edit", "delete"].includes(value),
  );
  const access = useAccess(),
    cache = useQueryClient(),
    money = useMoney();
  const definition = recordDefinitions[kind];
  const fallback = rows.find((row) => recordId(row) === id);
  const query = useQuery({
    queryKey: ["record-details", kind, id],
    queryFn: () => request(`records/${kind}/${id}`),
    enabled: !!id && !!definition,
  });
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("record");
    url.searchParams.delete("mode");
    goToUrl(url.pathname + url.search);
  };
  useEffect(() => {
    if (id && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [id]);
  if (!id) return null;
  const record = query.data ? { ...fallback, ...query.data } : fallback;
  const writable =
    !!definition &&
    access.data?.permissions.includes(definition.permission) &&
    !locked(kind, record);
  const label = record
    ? recordName(record, definition?.label || "Record")
    : "Record";
  async function mutate(method: string, body?: any) {
    setBusy(true);
    try {
      await request(`records/${kind}/${id}`, method, body);
      toast.success(
        method === "DELETE" ? `${label} deleted.` : "Changes saved.",
      );
      await cache.invalidateQueries();
      close();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const format = (key: string, value: any) =>
    key.endsWith("_minor")
      ? money(value)
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : key === "weekday"
          ? [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ][Number(value)]
          : key.endsWith("_at")
            ? new Date(value).toLocaleString()
            : Array.isArray(value)
              ? value
                  .map((item) =>
                    typeof item === "object"
                      ? item.name || JSON.stringify(item)
                      : item,
                  )
                  .join(", ")
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value).replaceAll("_", " ");
  const visible = record
    ? Object.entries(record).filter(
        ([key, value]) =>
          value !== null &&
          value !== "" &&
          ![
            "id",
            "tenant_id",
            "deleted_at",
            "photo_media_id",
            "token_hash",
            "code_hash",
            "idempotency_key",
            "items",
            "payments",
          ].includes(key) &&
          !key.endsWith("_id") &&
          !key.endsWith("_hash") &&
          !/secret|token/i.test(key),
      )
    : [];
  return (
    <dialog
      className={
        "record-dialog modal" +
        (kind === "customers" && mode === "edit" ? " customer-edit-dialog" : "")
      }
      ref={dialog}
      aria-label={
        mode === "delete"
          ? `Delete ${label}?`
          : mode === "edit"
            ? `Edit ${label}`
            : `${label} details`
      }
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <div className="modal-heading">
        <div className="record-dialog-title">
          {kind === "services" && record ? (
            <ServiceVisual service={record} />
          ) : kind === "employees" && record ? (
            <EmployeeAvatar employee={record} />
          ) : (
            <RecordVisual name={label} kind={kind} identity={id} />
          )}
          <div>
            <small>
              {mode === "delete"
                ? "CONFIRM DELETION"
                : mode === "edit"
                  ? "EDIT RECORD"
                  : "RECORD DETAILS"}
            </small>
            <h2>{label}</h2>
          </div>
        </div>
        <button aria-label="Close record" disabled={busy} onClick={close}>
          <X />
        </button>
      </div>
      {query.isPending && definition ? (
        <div className="empty">Loading details…</div>
      ) : query.error ? (
        <div className="empty" role="alert">
          <p>{query.error.message}</p>
          <button className="secondary" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : !record ? (
        <div className="empty">This record is unavailable.</div>
      ) : mode === "delete" && writable ? (
        <div className="delete-confirmation">
          <span className="delete-warning-icon">
            <AlertTriangle size={26} />
          </span>
          <h3>Delete {label}?</h3>
          <p>
            {kind === "customers"
              ? "This removes the customer from your directory. Existing invoices and appointment history are retained. Upcoming appointments must be cancelled first."
              : "This action cannot be undone. Records linked to appointments, stock or financial history cannot be deleted."}
          </p>
          <div className="form-actions">
            <button className="secondary" disabled={busy} onClick={close}>
              Keep {definition.label}
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => mutate("DELETE")}
            >
              <Trash2 size={17} />
              {busy ? "Deleting…" : "Delete " + definition.label}
            </button>
          </div>
        </div>
      ) : mode === "edit" && writable ? (
        <>
          {kind === "services" && <ServiceImageEditor service={record} />}
          <RecordEditor
            key={id}
            row={record}
            definition={
              kind === "employees"
                ? {
                    ...definition,
                    fields: definition.fields.filter(
                      (field) =>
                        field.key !== "base_salary_minor" ||
                        access.data?.permissions.includes("payroll.write"),
                    ),
                  }
                : definition
            }
            busy={busy}
            save={(body) => mutate("PATCH", body)}
          />
        </>
      ) : (
        <>
          <dl className="record-detail-grid">
            {visible.map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/_minor$/, " ").replaceAll("_", " ")}</dt>
                <dd>
                  {["email", "phone"].includes(key) ? (
                    <button
                      className="contact-copy"
                      title={`Copy ${key}`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(String(value));
                          toast.success(
                            `${key === "email" ? "Email" : "Cellphone"} copied.`,
                          );
                        } catch {
                          toast.error("Unable to copy. Try again.");
                        }
                      }}
                    >
                      {String(value)}
                      <Copy size={14} />
                    </button>
                  ) : (
                    format(key, value)
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {locked(kind, record) && kind !== "orders" && (
            <p className="record-history-note">
              {kind === "workflows"
                ? "Pause this automation to edit or delete it."
                : kind === "campaigns"
                  ? "This campaign has already been queued. Use Pause to stop delivery."
                  : "Paid payroll is retained for your financial history."}
            </p>
          )}
          {kind === "orders" && (
            <div className="record-invoice">
              <h3>Invoice items</h3>
              {record.items?.map((item: any, index: number) => (
                <div className="invoice-line" key={index}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.quantity} × {money(item.price_minor)}
                    </small>
                  </span>
                  <strong>
                    {money(Number(item.quantity) * Number(item.price_minor))}
                  </strong>
                </div>
              ))}
              <h3>Payments</h3>
              {record.payments?.length ? (
                record.payments.map((payment: any, index: number) => (
                  <div className="invoice-line" key={index}>
                    <span>
                      {payment.method}
                      <small>
                        {new Date(payment.created_at).toLocaleString()}
                      </small>
                    </span>
                    <strong>{money(payment.amount_minor)}</strong>
                  </div>
                ))
              ) : (
                <p>No payments recorded yet.</p>
              )}
            </div>
          )}
          {!definition && (
            <p className="record-history-note">
              This entry is part of your activity history. Use this module’s
              status, refund or adjustment actions to make a correction.
            </p>
          )}
          <div className="form-actions">
            <button className="secondary" onClick={close}>
              <ArrowLeft size={16} />
              Back to list
            </button>
            {writable && (
              <button className="primary" onClick={() => setMode("edit")}>
                <Pencil size={17} />
                Edit {definition.label}
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
