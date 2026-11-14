"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { EmployeePicker } from "./EmployeePicker";
import { EmployeeAvatar } from "./EmployeePhoto";
import { DateTimePicker } from "./DateTimePicker";
import { CustomSelect } from "./CustomSelect";
import { useMoney } from "./Currency";
import { goToUrl, useUrlParam } from "./UrlState";
import { toast } from "./Toasts";
async function request(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/v1/" + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    b = await r.json();
  if (!r.ok) throw Error(b.error?.message || "Unable to update payroll");
  return b.data;
}
const total = (r: any) =>
  Math.max(
    0,
    Number(r.base_minor) +
      Number(r.commission_minor || 0) +
      Number(r.bonus_minor) -
      Number(r.unpaid_leave_minor || 0) -
      Number(r.deduction_minor),
  );
const date = (v: string) =>
  new Date(String(v).slice(0, 10) + "T12:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function PayrollSchedule({
  employeeId,
  canEdit,
}: {
  employeeId: string;
  canEdit: boolean;
}) {
  const q = useQuery({
    queryKey: ["payroll-schedule", employeeId],
    queryFn: () => request(`employees/${employeeId}/payroll-schedule`),
  });
  return (
    <section className="panel payroll-schedule">
      <h3>Automatic payroll</h3>
      <p>
        Your base salary is a monthly rate. Drafts combine prorated base pay and
        commission, less unpaid leave. Review and adjust them before marking
        paid.
      </p>
      {q.isPending ? (
        <p>Loading schedule…</p>
      ) : q.isError ? (
        <p className="error-box">{q.error.message}</p>
      ) : (
        <ScheduleForm
          key={JSON.stringify(q.data)}
          data={q.data}
          canEdit={canEdit}
        />
      )}
    </section>
  );
}
function ScheduleForm({ data, canEdit }: { data: any; canEdit: boolean }) {
  const cache = useQueryClient(),
    [frequency, setFrequency] = useState(data.payroll_frequency),
    [start, setStart] = useState(data.payroll_start_on),
    [enabled, setEnabled] = useState(data.payroll_enabled),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="payroll-schedule-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await request(`employees/${data.id}/payroll-schedule`, "PATCH", {
            payroll_frequency: frequency,
            payroll_start_on: start,
            payroll_enabled: enabled,
          });
          await cache.invalidateQueries();
          toast.success("Payroll schedule saved. Drafts are ready.");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Pay frequency
        <CustomSelect
          disabled={!canEdit}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly · 7 days</option>
          <option value="biweekly">Biweekly · 15 days</option>
          <option value="monthly">Monthly</option>
        </CustomSelect>
      </label>
      <label>
        Schedule starts
        <DateTimePicker
          type="date"
          required
          disabled={!canEdit}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label className="payroll-checkbox">
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Create drafts automatically
      </label>
      <small>
        Monthly periods end on the last day of the month. Weekly and 15-day
        periods follow the start date. Existing payrolls are retained;
        overlapping dates are skipped.
      </small>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {canEdit && (
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save payroll schedule"}
        </button>
      )}
    </form>
  );
}
export function PayrollWorkspace() {
  const [id] = useUrlParam("record");
  const money = useMoney(),
    cache = useQueryClient(),
    [create, setCreate] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => request("access"),
  });
  const q = useQuery({
    queryKey: ["payroll-list"],
    queryFn: () => request("payroll"),
    enabled: !id,
  });
  if (id)
    return (
      <PayrollDetail
        id={id}
        canEdit={!!access.data?.permissions.includes("payroll.write")}
      />
    );
  const rows = (q.data || []).filter(
    (r: any) =>
      (status === "all" || r.status === status) &&
      r.employee_name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="payroll-workspace">
      <div className="operation-heading">
        <p>
          Automatic drafts use each employee’s pay schedule. Drafts refresh when
          opened; paid records keep their saved calculation.
        </p>
        {access.data?.permissions.includes("payroll.write") && (
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Create payroll draft
          </button>
        )}
      </div>
      <div className="module-filter-bar">
        <input
          value={search}
          placeholder="Search employee…"
          aria-label="Search payroll employees"
          onChange={(e) => setSearch(e.target.value)}
        />
        <CustomSelect
          value={status}
          aria-label="Payroll status"
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="paid">Paid</option>
        </CustomSelect>
        <button className="secondary" onClick={() => q.refetch()}>
          <RefreshCw size={16} />
          Refresh drafts
        </button>
      </div>
      {q.isPending ? (
        <div className="loading">Preparing payroll drafts…</div>
      ) : q.isError ? (
        <p className="error-box" role="alert">
          {q.error.message}
        </p>
      ) : (
        <section className="panel">
          <div className="module-table-scroll">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Base</th>
                  <th>Commission</th>
                  <th>Deductions</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <div className="location-employee">
                        <EmployeeAvatar
                          employee={{
                            id: r.employee_id,
                            name: r.employee_name,
                            image_version: r.image_version,
                          }}
                        />
                        <strong>{r.employee_name}</strong>
                      </div>
                    </td>
                    <td>
                      {date(r.period_start)} – {date(r.period_end)}
                      <small className="location-subtext">
                        {r.automatic
                          ? "Calculated payroll"
                          : "Existing manual record"}
                      </small>
                    </td>
                    <td>{money(r.base_minor)}</td>
                    <td>{money(r.commission_minor || 0)}</td>
                    <td>
                      {money(
                        Number(r.deduction_minor) +
                          Number(r.unpaid_leave_minor || 0),
                      )}
                    </td>
                    <td>
                      <strong>{money(total(r))}</strong>
                    </td>
                    <td>
                      <span
                        className={
                          "badge " + (r.status === "paid" ? "on" : "warning")
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <a className="secondary" href={"/payroll?record=" + r.id}>
                        View payroll
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="empty">
              No payrolls match. Configure a pay schedule in an employee profile
              or create a draft.
            </div>
          )}
        </section>
      )}
      {create && (
        <CreatePayroll
          onClose={() => setCreate(false)}
          onCreated={async (record: any) => {
            await cache.invalidateQueries();
            goToUrl("/payroll?record=" + record.id);
          }}
        />
      )}
    </div>
  );
}
function CreatePayroll({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: any) => void;
}) {
  const [employee, setEmployee] = useState(""),
    [start, setStart] = useState(new Date().toLocaleDateString("en-CA")),
    [end, setEnd] = useState(new Date().toLocaleDateString("en-CA")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create payroll draft"
      >
        <div className="modal-heading">
          <h2>Create payroll draft</h2>
          <button aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p>
          Base pay, commission and unpaid leave are calculated automatically for
          these dates.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              onCreated(
                await request("payroll", "POST", {
                  employee_id: employee,
                  period_start: start,
                  period_end: end,
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Employee
            <EmployeePicker value={employee} onChange={setEmployee} />
          </label>
          <label>
            Period starts
            <DateTimePicker
              type="date"
              value={start}
              required
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Period ends
            <DateTimePicker
              type="date"
              value={end}
              required
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Calculating…" : "Create draft"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function PayrollDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const money = useMoney(),
    cache = useQueryClient();
  const q = useQuery({
    queryKey: ["payroll-detail", id],
    queryFn: () => request("payroll/" + id),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reviewed, setReviewed] = useState(false);
  if (q.isPending) return <div className="loading">Calculating payroll…</div>;
  if (q.isError)
    return (
      <p className="error-box" role="alert">
        {q.error.message}
      </p>
    );
  const { record: r, employee: e } = q.data,
    c = r.calculation || {},
    lines = [
      ["Prorated base", r.base_minor],
      ["Commission", r.commission_minor],
      ["Bonus", r.bonus_minor],
      ["Unpaid leave", -Number(r.unpaid_leave_minor)],
      ["Manual deduction", -Number(r.deduction_minor)],
    ];
  return (
    <div className="payroll-detail">
      <button className="text-button" onClick={() => goToUrl("/payroll")}>
        <ArrowLeft size={16} />
        Back to payroll
      </button>
      <section className="panel payroll-detail-header">
        <EmployeeAvatar employee={e} />
        <div>
          <span className={"badge " + (r.status === "paid" ? "on" : "warning")}>
            {r.status === "paid" ? "Paid payroll" : "Payroll draft"}
          </span>
          <h1>{e.name}</h1>
          <p>
            {date(r.period_start)} – {date(r.period_end)} · {e.branch_name}
          </p>
          <small>
            {e.email} · {e.phone}
          </small>
        </div>
        <strong>{money(total(r))}</strong>
      </section>
      <section className="panel">
        <div className="operation-heading">
          <h2>Pay calculation</h2>
          {r.status === "draft" && (
            <button
              className="secondary"
              onClick={async () => {
                setReviewed(false);
                await q.refetch();
              }}
            >
              <RefreshCw size={16} />
              Refresh calculation
            </button>
          )}
        </div>
        <div className="payroll-calculation">
          {lines.map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>{money(value)}</strong>
            </div>
          ))}
          <div className="payroll-total">
            <span>Total payable</span>
            <strong>{money(total(r))}</strong>
          </div>
        </div>
        {r.deduction_reason && (
          <p>
            <strong>Deduction reason:</strong> {r.deduction_reason}
          </p>
        )}
        {r.bonus_reason && (
          <p>
            <strong>Bonus note:</strong> {r.bonus_reason}
          </p>
        )}
        <p>
          {c.formula ||
            "This is an existing manual payroll record. Its stored base, bonus and deductions are retained."}
        </p>
        {c.monthly_base_minor !== undefined && (
          <p>
            Monthly salary used: <strong>{money(c.monthly_base_minor)}</strong>{" "}
            · Timezone: {c.timezone}
          </p>
        )}
        <small>
          {r.calculated_at
            ? "Calculated " + new Date(r.calculated_at).toLocaleString()
            : ""}
          {r.status === "paid"
            ? " · Saved when marked paid"
            : " · Draft figures refresh from current salary, commission and leave."}
        </small>
        {c.warnings?.map((warning: string) => (
          <p className="error-box" key={warning}>
            {warning}
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>Commission included</h2>
        {c.commissions?.length ? (
          <div className="module-table-scroll">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Earned on</th>
                  <th>Source</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                {c.commissions.map((row: any) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      {row.quick_visit_id ? "Quick visit" : "Appointment"}
                    </td>
                    <td>{money(row.amount_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No commission included in this record.</p>
        )}
      </section>
      <section className="panel">
        <h2>Leave included</h2>
        {c.leaves?.length ? (
          <div className="module-table-scroll">
            <table className="module-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Until</th>
                  <th>Leave</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {c.leaves.map((leave: any) => (
                  <tr key={leave.id}>
                    <td>{leave.starts_local}</td>
                    <td>{leave.ends_local}</td>
                    <td>
                      <span
                        className={"badge " + (leave.paid ? "on" : "warning")}
                      >
                        {leave.paid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td>{leave.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No leave in this pay period.</p>
        )}
        {c.unpaid_days?.length > 0 && (
          <>
            <h3>Unpaid leave breakdown</h3>
            <div className="module-table-scroll">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Missed hours</th>
                    <th>Working day fraction</th>
                    <th>Deduction</th>
                  </tr>
                </thead>
                <tbody>
                  {c.unpaid_days.map((day: any) => (
                    <tr key={day.date}>
                      <td>{date(day.date)}</td>
                      <td>{Number(day.hours).toFixed(2)}</td>
                      <td>{(Number(day.fraction) * 100).toFixed(1)}%</td>
                      <td>{money(day.amount_minor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {canEdit && r.status === "draft" && (
        <section className="panel">
          <h2>Bonus & deductions</h2>
          <Adjustments
            key={
              r.id +
              ":" +
              r.bonus_minor +
              ":" +
              r.deduction_minor +
              ":" +
              r.deduction_reason
            }
            record={r}
          />
          <hr />
          <h3>Record payment</h3>
          <p>
            This records a payment already made. It does not transfer money.
          </p>
          <label className="payroll-checkbox">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            I have reviewed the calculation and paid this amount.
          </label>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={!reviewed || busy || !!c.warnings?.length}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await request("payroll/" + id, "PATCH", {
                  status: "paid",
                  expected_total_minor: total(r),
                });
                await cache.invalidateQueries();
                toast.success("Payroll recorded as paid.");
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Record as paid"}
          </button>
        </section>
      )}
      {r.status === "paid" && (
        <p className="section-note">
          Paid {r.paid_at ? new Date(r.paid_at).toLocaleString() : ""}. This
          payroll and its calculation are retained as recorded.
        </p>
      )}
    </div>
  );
}
function Adjustments({ record }: { record: any }) {
  const [bonus, setBonus] = useState(String(Number(record.bonus_minor) / 100)),
    [deduction, setDeduction] = useState(
      String(Number(record.deduction_minor) / 100),
    ),
    [reason, setReason] = useState(record.deduction_reason || ""),
    [note, setNote] = useState(record.bonus_reason || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cache = useQueryClient();
  return (
    <form
      className="payroll-adjustments"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await request("payroll/" + record.id, "PATCH", {
            bonus_minor: Math.round(Number(bonus) * 100),
            deduction_minor: Math.round(Number(deduction) * 100),
            deduction_reason: reason,
            bonus_reason: note,
          });
          await cache.invalidateQueries();
          toast.success("Payroll adjustments saved.");
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Bonus
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
        />
      </label>
      <label>
        Bonus note
        <input
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label>
        Deduction
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={deduction}
          onChange={(e) => setDeduction(e.target.value)}
        />
      </label>
      <label>
        Deduction reason{Number(deduction) > 0 ? " (required)" : ""}
        <input
          required={Number(deduction) > 0}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Save adjustments"}
      </button>
    </form>
  );
}
