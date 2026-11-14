"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { DateTimePicker } from "./DateTimePicker";
import { EmployeePicker } from "./EmployeePicker";
import { EmployeeAvatar } from "./EmployeePhoto";
import { InvoiceView } from "./InvoiceView";
import { useMoney } from "./Currency";
import { paymentLabels } from "./payment-methods";
import { useUrlParam, goToUrl } from "./UrlState";
import { toast } from "./Toasts";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/v1/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    b = await r.json();
  if (!r.ok) throw Error(b.error?.message || "Unable to load bookings");
  return b.data;
}
const statuses = [
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];
export function BookingForm({
  onClose,
  onSaved,
  date,
}: {
  onClose: () => void;
  onSaved: () => void;
  date?: string;
}) {
  const money = useMoney();
  const options = useQuery({
    queryKey: ["booking-options"],
    queryFn: () => api("bookings/options"),
  });
  const [branch, setBranch] = useState(""),
    [employee, setEmployee] = useState(""),
    [customer, setCustomer] = useState(""),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [notes, setNotes] = useState(""),
    [paid, setPaid] = useState(false),
    [method, setMethod] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key] = useState(() => crypto.randomUUID());
  const [starts, setStarts] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    return date ? date + local.slice(10) : local;
  });
  useEffect(() => {
    if (options.data && !branch) setBranch(options.data.branches[0]?.id || "");
    if (options.data && !method)
      setMethod(
        options.data.payment_methods.filter((m: string) => m !== "stripe")[0] ||
          "",
      );
  }, [options.data, branch, method]);
  useEffect(() => {
    const t = setTimeout(() => setTerm(search), 180);
    return () => clearTimeout(t);
  }, [search]);
  const customers = useQuery({
    queryKey: ["booking-customers", term],
    queryFn: () => api("customers?q=" + encodeURIComponent(term)),
  });
  const services = options.data?.services || [],
    subtotal = services
      .filter((s: any) => ids.includes(s.id))
      .reduce((sum: number, s: any) => sum + Number(s.price_minor), 0),
    tax = Math.round(
      (subtotal * Number(options.data?.tax_basis_points || 0)) / 10000,
    ),
    total = subtotal + tax;
  return (
    <div className="modal-backdrop">
      <section
        className="modal booking-create-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New booking"
      >
        <div className="modal-heading">
          <h2>New booking</h2>
          <button aria-label="Close booking" onClick={onClose}>
            <X />
          </button>
        </div>
        {options.isPending ? (
          <p>Loading booking options…</p>
        ) : options.isError ? (
          <p className="error-box">{options.error.message}</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ids.length) {
                setError("Select at least one service.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                await api("appointments", "POST", {
                  branch_id: branch,
                  employee_id: employee,
                  customer_id: customer,
                  service_ids: ids,
                  starts_at: new Date(starts).toISOString(),
                  notes,
                  paid_in_advance: paid,
                  ...(paid ? { payment_method: method } : {}),
                  request_key: key,
                });
                toast.success(
                  paid
                    ? "Booking and advance payment saved."
                    : "Booking saved.",
                );
                onSaved();
                onClose();
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="booking-form-grid">
              <label>
                Location
                <CustomSelect
                  required
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    setEmployee("");
                  }}
                >
                  <option value="">Choose location…</option>
                  {options.data.branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label>
                Employee
                <EmployeePicker
                  value={employee}
                  onChange={setEmployee}
                  branchId={branch}
                />
              </label>
              <label>
                Find customer
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone or email…"
                />
              </label>
              <label>
                Customer
                <CustomSelect
                  required
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                >
                  <option value="">Choose customer…</option>
                  {(customers.data?.items || []).map((c: any) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                      {c.phone ? " · " + c.phone : ""}
                    </option>
                  ))}
                </CustomSelect>
                {customers.isError && (
                  <small className="error-box">{customers.error.message}</small>
                )}
              </label>
              <label>
                Booking starts
                <DateTimePicker
                  required
                  type="datetime-local"
                  value={starts}
                  onChange={(e) => setStarts(e.target.value)}
                />
              </label>
              <label>
                Notes
                <input
                  maxLength={5000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
            <fieldset className="booking-service-options">
              <legend>Services</legend>
              {services.map((service: any) => (
                <label key={service.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(service.id)}
                    onChange={(e) =>
                      setIds((previous) =>
                        e.target.checked
                          ? [...previous, service.id]
                          : previous.filter((id) => id !== service.id),
                      )
                    }
                  />
                  <span>
                    {service.name}
                    <small>
                      {service.duration_minutes} min ·{" "}
                      {money(service.price_minor)}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="booking-advance">
              <div className="booking-amount">
                <span>Booking total {tax > 0 ? "(including tax)" : ""}</span>
                <strong>{money(total)}</strong>
              </div>
              <label className="payroll-checkbox">
                <input
                  type="checkbox"
                  checked={paid}
                  disabled={!options.data.can_record_payment}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                Service is paid in advance
              </label>
              {paid && (
                <>
                  <p>
                    Record the full {money(total)} already received. This does
                    not charge a payment provider.
                  </p>
                  <label>
                    Payment received by
                    <CustomSelect
                      required
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      {options.data.payment_methods
                        .filter((m: string) => m !== "stripe")
                        .map((m: string) => (
                          <option key={m} value={m}>
                            {paymentLabels[m] || m}
                          </option>
                        ))}
                    </CustomSelect>
                  </label>
                </>
              )}
              {!options.data.can_record_payment && (
                <small>
                  Recording advance payments requires finance access.
                </small>
              )}
            </div>
            <p className="section-note">
              Times use your device timezone. Salon timezone:{" "}
              {options.data.timezone}.
            </p>
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button className="secondary" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save booking"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
export function BookingDetails({
  visit,
  onClose,
}: {
  visit: any;
  onClose: () => void;
}) {
  const cache = useQueryClient(),
    [invoice, setInvoice] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => api("access"),
  });
  const writable = access.data?.permissions.includes("appointments.write"),
    finance = access.data?.permissions.includes("finance.read");
  async function update(body: any) {
    setBusy(true);
    setError("");
    try {
      await api("appointments/" + visit.id, "PATCH", body);
      await cache.invalidateQueries();
      toast.success("Booking updated.");
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className={
          "modal booking-details-dialog " + (invoice ? "invoice-dialog" : "")
        }
        role="dialog"
        aria-modal="true"
        aria-label="Booking details"
      >
        <div className="modal-heading">
          <h2>{invoice ? "Invoice" : visit.customer_name}</h2>
          <button aria-label="Close details" onClick={onClose}>
            <X />
          </button>
        </div>
        {invoice ? (
          <InvoiceView id={visit.order_id} />
        ) : (
          <>
            <span
              className={"badge " + (visit.status === "completed" ? "on" : "")}
            >
              {visit.kind === "walkin"
                ? "Completed quick visit"
                : visit.status.replaceAll("_", " ")}
            </span>
            <p>{visit.services?.map((s: any) => s.name).join(", ")}</p>
            <p>
              {visit.employee_name} · {visit.branch_name}
            </p>
            <p>
              {visit.starts_local || new Date(visit.starts_at).toLocaleString()}
            </p>
            {visit.kind !== "walkin" && (
              <p>
                {visit.paid_in_advance
                  ? "Full payment recorded in advance"
                  : "No advance payment recorded"}
              </p>
            )}
            {visit.notes && <p>{visit.notes}</p>}
            {finance && visit.order_id && (
              <button className="secondary" onClick={() => setInvoice(true)}>
                View invoice
              </button>
            )}
            {visit.kind !== "walkin" && writable && (
              <>
                <div className="status-actions">
                  {statuses.map((status) => (
                    <button
                      type="button"
                      className="secondary"
                      disabled={
                        busy ||
                        status === visit.status ||
                        ["completed", "cancelled", "no_show"].includes(
                          visit.status,
                        )
                      }
                      key={status}
                      onClick={() => update({ status })}
                    >
                      {status.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
                {!["completed", "cancelled", "no_show"].includes(
                  visit.status,
                ) && (
                  <label>
                    Reschedule
                    <DateTimePicker
                      type="datetime-local"
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.value)
                          update({
                            starts_at: new Date(e.target.value).toISOString(),
                          });
                      }}
                    />
                  </label>
                )}
              </>
            )}
            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
export function BookingsWorkspace() {
  const cache = useQueryClient(),
    [from] = useUrlParam("from"),
    [to] = useUrlParam("to"),
    [range] = useUrlParam("range", "date"),
    [page] = useUrlParam("page", "1"),
    [kind] = useUrlParam("kind", "all"),
    [status] = useUrlParam("status", "all"),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<any>(null);
  useEffect(() => {
    const t = setTimeout(() => setTerm(search), 180);
    return () => clearTimeout(t);
  }, [search]);
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => api("access"),
  });
  const query = useQuery({
    queryKey: ["bookings", from, to, range, page, kind, status, term],
    queryFn: () =>
      api(
        "bookings?" +
          new URLSearchParams({
            range,
            page,
            kind,
            status,
            q: term,
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          }),
      ),
    refetchInterval: 30000,
  });
  function filter(values: Record<string, string>) {
    const url = new URL(window.location.href);
    url.searchParams.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    goToUrl(url.pathname + url.search);
  }
  return (
    <div className="bookings-workspace">
      <div className="operation-heading">
        <p>Scheduled bookings and completed Quick Work visits in one place.</p>
        {access.data?.permissions.includes("appointments.write") && (
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus size={17} />
            New booking
          </button>
        )}
      </div>
      <div className="module-filter-bar booking-filters">
        <label>
          From
          <DateTimePicker
            type="date"
            value={from || query.data?.from || ""}
            onChange={(e) =>
              filter({
                from: e.target.value,
                to: e.target.value,
                range: "date",
              })
            }
          />
        </label>
        <label>
          Until
          <DateTimePicker
            type="date"
            value={to || query.data?.to || ""}
            onChange={(e) => filter({ to: e.target.value, range: "date" })}
          />
        </label>
        <button
          className="secondary"
          onClick={() => filter({ from: "", to: "", range: "date" })}
        >
          Today
        </button>
        <button
          className={"secondary " + (range === "all" ? "active" : "")}
          onClick={() => filter({ range: "all" })}
        >
          All dates
        </button>
        <label>
          Type
          <CustomSelect
            value={kind}
            onChange={(e) => filter({ kind: e.target.value })}
          >
            <option value="all">All bookings & visits</option>
            <option value="booking">Scheduled bookings</option>
            <option value="walkin">Quick visits / walk-ins</option>
          </CustomSelect>
        </label>
        <label>
          Status
          <CustomSelect
            value={status}
            onChange={(e) => filter({ status: e.target.value })}
          >
            <option value="all">All statuses</option>
            {["pending", ...statuses, "rescheduled"].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </CustomSelect>
        </label>
        <label>
          Search
          <input
            value={search}
            placeholder="Customer, employee or location…"
            onChange={(e) => {
              setSearch(e.target.value);
              if (page !== "1") filter({ page: "" });
            }}
          />
        </label>
      </div>
      {query.isPending ? (
        <div className="loading">Loading bookings…</div>
      ) : query.isError ? (
        <p className="error-box" role="alert">
          {query.error.message}
        </p>
      ) : (
        <>
          <div className="booking-summary">
            <span>
              <strong>{query.data.total}</strong> bookings & visits
            </span>
            <span>{query.data.scheduled} scheduled</span>
            <span>{query.data.walkins} quick visits</span>
            <span>{query.data.completed} completed</span>
            <small>
              {range === "all"
                ? "All dates"
                : query.data.from + " – " + query.data.to}{" "}
              · {query.data.timezone}
            </small>
          </div>
          <section className="panel">
            <div className="module-table-scroll">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Services</th>
                    <th>Employee</th>
                    <th>Location</th>
                    <th>Date & time</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((visit: any) => (
                    <tr key={visit.kind + visit.id}>
                      <td>
                        <strong>{visit.customer_name}</strong>
                        <small className="location-subtext">
                          {visit.kind === "walkin"
                            ? "Quick visit / walk-in"
                            : "Scheduled booking"}
                        </small>
                      </td>
                      <td>
                        {visit.services.map((s: any) => s.name).join(", ")}
                      </td>
                      <td>
                        <div className="location-employee">
                          <EmployeeAvatar
                            employee={{
                              id: visit.employee_id,
                              name: visit.employee_name,
                              image_version: visit.image_version,
                            }}
                          />
                          <span>{visit.employee_name}</span>
                        </div>
                      </td>
                      <td>{visit.branch_name}</td>
                      <td>{visit.starts_local}</td>
                      <td>
                        <span
                          className={
                            "badge " +
                            (visit.status === "completed"
                              ? "on"
                              : ["cancelled", "no_show"].includes(visit.status)
                                ? "warning"
                                : "")
                          }
                        >
                          {visit.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>
                        {visit.kind === "walkin"
                          ? "Recorded at checkout"
                          : visit.paid_in_advance
                            ? "Paid in advance"
                            : "No advance payment"}
                      </td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => setSelected(visit)}
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!query.data.items.length && (
              <div className="empty">
                No bookings or visits in this selection.
              </div>
            )}
            <div className="location-pagination">
              <button
                className="secondary"
                disabled={Number(page) <= 1}
                onClick={() => filter({ page: String(Number(page) - 1) })}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="secondary"
                disabled={Number(page) * 25 >= query.data.total}
                onClick={() => filter({ page: String(Number(page) + 1) })}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        </>
      )}
      {open && (
        <BookingForm
          date={from || query.data?.today}
          onClose={() => setOpen(false)}
          onSaved={() => {
            cache.invalidateQueries();
          }}
        />
      )}
      {selected && (
        <BookingDetails visit={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
