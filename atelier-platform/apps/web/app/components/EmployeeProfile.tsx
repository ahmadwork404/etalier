"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CalendarDays,
  CalendarOff,
  Wallet,
  TrendingUp,
  Users,
  CheckCircle2,
  X,
  Copy,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PayrollSchedule } from "./PayrollWorkspace";
import { EmployeeAvatar, EmployeePhotoEditor } from "./EmployeePhoto";
import { EmployeeStatus } from "./EmployeeStatus";
import { useMoney } from "./Currency";
import { goToUrl, useUrlParam } from "./UrlState";
import { RecordDialog } from "./RecordActions";
import { DateTimePicker } from "./DateTimePicker";
import { CustomSelect } from "./CustomSelect";
import { toast } from "./Toasts";
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
        "Unable to complete request",
    );
  return payload.data;
}
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog modal employee-modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EmployeeProfile({ id }: { id: string }) {
  const cache = useQueryClient(),
    money = useMoney();
  const [mode] = useUrlParam("mode", "view");
  const [month, setMonth] = useUrlParam(
    "month",
    new Date().toLocaleDateString("en-CA").slice(0, 7),
    (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value),
  );
  const [tab, setTab] = useUrlParam("employeeTab", "overview", (value) =>
    ["overview", "hours", "schedule", "leaves", "payroll"].includes(value),
  );
  const [leaveOpen, setLeaveOpen] = useState(false),
    [dayOpen, setDayOpen] = useState("");
  const [leaveDay, setLeaveDay] = useState("");
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => request("access"),
  });
  const canEdit = !!access.data?.permissions?.includes("employees.write");
  const query = useQuery({
    queryKey: ["employee-profile", id, month],
    queryFn: () => request(`employee-profiles/${id}?month=${month}`),
  });
  const back = () => {
    const url = new URL(window.location.href);
    for (const key of ["record", "mode", "month", "employeeTab"])
      url.searchParams.delete(key);
    goToUrl(url.pathname + url.search);
  };
  function shiftMonth(delta: number) {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + delta);
    setMonth(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
    setDayOpen("");
  }
  if (query.isPending)
    return (
      <section className="panel empty" role="status">
        Loading employee profile…
      </section>
    );
  if (query.error)
    return (
      <section className="panel empty" role="alert">
        <p>{query.error.message}</p>
        <button className="secondary" onClick={() => query.refetch()}>
          Try again
        </button>
        <button onClick={back}>Back to employees</button>
      </section>
    );
  const {
    employee,
    hours,
    leaves,
    appointments,
    attendance,
    financial,
    payroll,
  } = query.data;
  const monthName = new Date(month + "-01T12:00:00").toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
  const edit = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "edit");
    goToUrl(url.pathname + url.search);
  };
  return (
    <div className="employee-profile">
      <button className="secondary employee-back" onClick={back}>
        <ArrowLeft size={16} />
        All employees
      </button>
      <section className="panel employee-profile-header">
        <div className="module-identity">
          <EmployeeAvatar employee={employee} />
          <div>
            <EmployeeStatus employee={employee} canEdit={canEdit} />
            <h2>{employee.name}</h2>
            <p>
              {employee.title} · {employee.branch_name}
            </p>
            <div className="employee-contacts">
              <a href={"mailto:" + employee.email}>
                {employee.email || "Email missing — update employee"}
              </a>
              <a href={"tel:" + employee.phone}>
                {employee.phone || "Phone missing — update employee"}
              </a>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="employee-header-actions">
            <button className="secondary" onClick={edit}>
              Edit employee
            </button>
            <button
              className="primary"
              onClick={() => {
                setLeaveDay(query.data.today);
                setLeaveOpen(true);
              }}
            >
              <CalendarOff size={16} />
              Add leave
            </button>
          </div>
        )}
      </section>
      {canEdit && (
        <section className="panel employee-photo-panel">
          <EmployeePhotoEditor employee={employee} />
        </section>
      )}
      <div className="employee-toolbar">
        <div
          className="tabs intake-tabs"
          role="tablist"
          aria-label="Employee sections"
        >
          {[
            ["overview", "Performance"],
            ["schedule", "Monthly schedule"],
            ["hours", "Working hours"],
            ["leaves", "Leave"],
            ...(payroll ? [["payroll", "Payroll"]] : []),
          ].map(([value, label]) => (
            <button
              role="tab"
              aria-selected={tab === value}
              className={tab === value ? "active" : ""}
              key={value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="employee-month-controls">
          <button
            className="secondary"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <strong>{monthName}</strong>
          <button
            className="secondary"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={17} />
          </button>
          <button
            className="secondary"
            onClick={() => setMonth(query.data.today.slice(0, 7))}
          >
            This month
          </button>
        </div>
      </div>
      {tab === "overview" && (
        <>
          <div className="customer-value-metrics employee-metrics">
            <article className="panel value-metric">
              <span>
                <CheckCircle2 size={17} />
                Completed visits
              </span>
              <strong>{attendance.completed}</strong>
              <small>
                {attendance.bookings} total bookings · {attendance.no_show}{" "}
                no-shows
              </small>
            </article>
            <article className="panel value-metric">
              <span>
                <Users size={17} />
                Customers served
              </span>
              <strong>{attendance.customers}</strong>
              <small>{attendance.cancelled} cancellations this month</small>
            </article>
            {financial && (
              <>
                <article className="panel value-metric">
                  <span>
                    <Wallet size={17} />
                    Net service collections
                  </span>
                  <strong>{money(financial.net_collected_minor)}</strong>
                  <small>Allocated payments less refunds</small>
                </article>
                <article className="panel value-metric">
                  <span>Completed service value</span>
                  <strong>{money(financial.completed_value_minor)}</strong>
                  <small>Booking prices before discounts and tax</small>
                </article>
              </>
            )}
            {payroll && (
              <>
                <article className="panel value-metric">
                  <span>Monthly base salary</span>
                  <strong>{money(payroll.base_salary_minor)}</strong>
                  <small>
                    Monthly rate · unpaid leave is deducted in payroll drafts
                  </small>
                </article>
                <article className="panel value-metric">
                  <span>Commission accrued</span>
                  <strong>{money(payroll.commission_minor)}</strong>
                  <small>
                    {employee.commission_basis_points / 100}% configured rate
                  </small>
                </article>
                <article className="panel value-metric">
                  <span>Payroll recorded · selected month</span>
                  <strong>{money(payroll.recorded_minor)}</strong>
                  <small>{money(payroll.paid_minor)} recorded as paid</small>
                </article>
              </>
            )}
            {financial && payroll && (
              <article className="panel value-metric">
                <span>
                  <TrendingUp size={17} />
                  Contribution estimate
                </span>
                <strong
                  className={
                    financial.contribution_minor < 0 ? "negative-value" : ""
                  }
                >
                  {money(financial.contribution_minor)}
                </strong>
                <small>
                  After base salary, commission and known consumables
                </small>
              </article>
            )}
          </div>
          {financial && (
            <section className="panel employee-section">
              <h3>Service value through {monthName}</h3>
              <p>Completed booking value by appointment date</p>
              {financial.daily.length ? (
                <div
                  role="img"
                  aria-label={financial.daily
                    .map(
                      (row: any) => `Day ${row.day}: ${money(row.value_minor)}`,
                    )
                    .join("; ")}
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={financial.daily}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--color-border)"
                      />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} />
                      <YAxis
                        width={85}
                        tickFormatter={(value) => money(Number(value))}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: any) => [
                          money(Number(value)),
                          "Completed service value",
                        ]}
                      />
                      <Bar
                        dataKey="value_minor"
                        fill="var(--color-primary)"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={35}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty">
                  No completed service value recorded this month.
                </div>
              )}
            </section>
          )}
          {financial && payroll && (
            <p className="contribution-note">
              Contribution is an estimate, not net profit: allocated service
              payments received in the selected month, less the current monthly
              base salary, commissions on that month’s completed visits and
              consumables valued at current costs. Collections include
              proportional tax and discounts. Payroll bonuses, deductions, other
              overhead and historical salary changes are not included in this
              estimate. Payroll totals are separate, prorated to the selected
              month when a pay period overlaps months.
            </p>
          )}
          <div className="employee-profile-shortcuts">
            <button className="panel" onClick={() => setTab("hours")}>
              <Clock3 size={24} />
              <strong>Configure working hours</strong>
              <small>{hours.length} working days per week</small>
            </button>
            <button className="panel" onClick={() => setTab("schedule")}>
              <CalendarDays size={24} />
              <strong>View monthly schedule</strong>
              <small>
                {appointments.length} appointments · {leaves.length} leave
                periods
              </small>
            </button>
          </div>
        </>
      )}
      {tab === "payroll" && (
        <>
          {" "}
          {payroll && (
            <PayrollSchedule
              employeeId={id}
              canEdit={!!access.data?.permissions.includes("payroll.write")}
            />
          )}
          {payroll && (
            <section className="panel employee-section">
              <h3>Payroll records</h3>
              {payroll.records.length ? (
                <div className="employee-payroll-list">
                  {payroll.records.map((record: any) => (
                    <article key={record.id}>
                      <div>
                        <strong>
                          {new Date(
                            record.period_start + "T12:00",
                          ).toLocaleDateString()}{" "}
                          –{" "}
                          {new Date(
                            record.period_end + "T12:00",
                          ).toLocaleDateString()}
                        </strong>
                        <small>
                          Base {money(record.base_minor)} · bonus{" "}
                          {money(record.bonus_minor)} · deductions{" "}
                          {money(
                            Number(record.deduction_minor) +
                              Number(record.unpaid_leave_minor || 0),
                          )}{" "}
                          · commission {money(record.commission_minor || 0)}
                        </small>
                      </div>
                      <strong>
                        {money(
                          Number(record.base_minor) +
                            Number(record.commission_minor || 0) +
                            Number(record.bonus_minor) -
                            Number(record.deduction_minor) -
                            Number(record.unpaid_leave_minor || 0),
                        )}
                      </strong>
                      <a
                        className="secondary"
                        href={`/payroll?record=${record.id}`}
                      >
                        View payroll
                      </a>
                      <span
                        className={`badge ${record.status === "paid" ? "on" : "warning"}`}
                      >
                        {record.status}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p>
                  No payroll recorded for this month. The base salary above is
                  the agreed rate, not a payment record.
                </p>
              )}
              <a className="secondary" href="/payroll">
                Open payroll
              </a>
            </section>
          )}
        </>
      )}
      {tab === "hours" && (
        <WorkingHours
          key={id + JSON.stringify(hours)}
          employee={employee}
          hours={hours}
          canEdit={canEdit}
        />
      )}
      {tab === "schedule" && (
        <EmployeeMonth month={month} data={query.data} onDay={setDayOpen} />
      )}
      {tab === "leaves" && (
        <section className="panel employee-section">
          <div className="operation-heading">
            <div>
              <h3>Leave · {monthName}</h3>
              <p>
                Leave also appears in the main Leave tab and blocks appointment
                booking.
              </p>
            </div>
            {canEdit && (
              <button
                className="primary"
                onClick={() => {
                  setLeaveDay(query.data.today);
                  setLeaveOpen(true);
                }}
              >
                Add leave
              </button>
            )}
          </div>
          {leaves.length ? (
            <div className="employee-leave-list">
              {leaves.map((leave: any) => (
                <article key={leave.id}>
                  <div>
                    <strong>{leave.reason || "Leave"}</strong>
                    <span
                      className={"badge " + (leave.paid ? "on" : "warning")}
                    >
                      {leave.paid ? "Paid leave" : "Unpaid leave"}
                    </span>
                    <small>
                      {leave.starts_local} → {leave.ends_local} ·{" "}
                      {employee.timezone}
                    </small>
                  </div>
                  {canEdit && (
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          await request(
                            `records/employee-leaves/${leave.id}`,
                            "DELETE",
                          );
                          await cache.invalidateQueries();
                          toast.success("Leave removed.");
                        } catch (error) {
                          toast.error((error as Error).message);
                        }
                      }}
                    >
                      Remove leave
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">No leave recorded in this month.</div>
          )}
        </section>
      )}
      {leaveOpen && (
        <LeaveDialog
          employee={employee}
          initialDay={leaveDay || query.data.today}
          hours={hours}
          onClose={() => setLeaveOpen(false)}
        />
      )}
      {dayOpen && (
        <DaySchedule
          day={dayOpen}
          data={query.data}
          onClose={() => setDayOpen("")}
          onLeave={() => {
            setLeaveDay(dayOpen);
            setDayOpen("");
            setLeaveOpen(true);
          }}
          canEdit={canEdit}
        />
      )}
      {mode !== "view" && (
        <RecordDialog
          kind="employees"
          rows={[
            {
              ...employee,
              ...(payroll
                ? { base_salary_minor: payroll.base_salary_minor }
                : {}),
            },
          ]}
        />
      )}
    </div>
  );
}
function WorkingHours({
  employee,
  hours,
  canEdit,
}: {
  employee: any;
  hours: any[];
  canEdit: boolean;
}) {
  const cache = useQueryClient();
  const [days, setDays] = useState(() =>
    weekdays.map((_, weekday) => {
      const row = hours.find((day) => day.weekday === weekday);
      return {
        weekday,
        enabled: !!row,
        opens_at: row?.opens_at || "09:00",
        closes_at: row?.closes_at || "17:00",
      };
    }),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = (index: number, change: any) =>
    setDays((previous) =>
      previous.map((day, i) => (i === index ? { ...day, ...change } : day)),
    );
  return (
    <form
      className="panel employee-section"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await request(`employee-profiles/${employee.id}/hours`, "PUT", {
            days: days
              .filter((day) => day.enabled)
              .map(({ weekday, opens_at, closes_at }) => ({
                weekday,
                opens_at,
                closes_at,
              })),
          });
          await cache.invalidateQueries();
          toast.success("Weekly working hours saved.");
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="operation-heading">
        <div>
          <h3>Weekly working hours</h3>
          <p>
            Set regular shifts in {employee.timezone}. Switch a day off to stop
            new bookings.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const template = days.find((day) => day.enabled) || {
                opens_at: "09:00",
                closes_at: "17:00",
              };
              setDays((previous) =>
                previous.map((day) => ({
                  ...day,
                  enabled: day.weekday >= 1 && day.weekday <= 5,
                  opens_at: template.opens_at,
                  closes_at: template.closes_at,
                })),
              );
            }}
          >
            <Copy size={15} />
            Use Monday–Friday
          </button>
        )}
      </div>
      <div className="employee-hours-list">
        {days.map((day, index) => (
          <div className="employee-hours-row" key={day.weekday}>
            <label className="checkbox">
              <input
                type="checkbox"
                disabled={!canEdit || busy}
                checked={day.enabled}
                onChange={(event) =>
                  update(index, { enabled: event.target.checked })
                }
              />
              <strong>{weekdays[index]}</strong>
            </label>
            {day.enabled ? (
              <>
                <DateTimePicker
                  type="time"
                  aria-label={weekdays[index] + " opening time"}
                  value={day.opens_at}
                  disabled={!canEdit || busy}
                  onChange={(event) =>
                    update(index, { opens_at: event.target.value })
                  }
                />
                <span>to</span>
                <DateTimePicker
                  type="time"
                  aria-label={weekdays[index] + " closing time"}
                  value={day.closes_at}
                  disabled={!canEdit || busy}
                  onChange={(event) =>
                    update(index, { closes_at: event.target.value })
                  }
                />
              </>
            ) : (
              <span className="employee-day-off">Day off</span>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {canEdit && (
        <div className="form-actions">
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save working hours"}
          </button>
        </div>
      )}
    </form>
  );
}
function LeaveDialog({
  employee,
  initialDay,
  hours,
  onClose,
}: {
  employee: any;
  initialDay: string;
  hours: any[];
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const shift = hours.find(
    (day) => day.weekday === new Date(initialDay + "T12:00").getDay(),
  );
  const [start, setStart] = useState(
      initialDay + "T" + (shift?.opens_at || "09:00"),
    ),
    [end, setEnd] = useState(initialDay + "T" + (shift?.closes_at || "17:00")),
    [reason, setReason] = useState(""),
    [paid, setPaid] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={"Add leave · " + employee.name} onClose={onClose}>
      <p>
        Times use your device timezone (
        {Intl.DateTimeFormat().resolvedOptions().timeZone}). The schedule
        displays {employee.timezone}.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await request("employee-leaves", "POST", {
              employee_id: employee.id,
              starts_at: new Date(start).toISOString(),
              ends_at: new Date(end).toISOString(),
              reason,
              paid,
            });
            await cache.invalidateQueries();
            toast.success("Leave added to the employee and Leave tab.");
            onClose();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Leave starts
          <DateTimePicker
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Leave ends
          <DateTimePicker
            required
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label>
          Reason
          <textarea
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className="payroll-checkbox">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />
          Paid leave
        </label>
        <p className="section-note">
          Uncheck for unpaid leave. The missed fraction of scheduled working
          hours is deducted from payroll.
        </p>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <p className="section-note">
          Appointments must be rescheduled before adding leave that overlaps
          them. Leave is recorded immediately.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Add leave"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function EmployeeMonth({
  month,
  data,
  onDay,
}: {
  month: string;
  data: any;
  onDay: (day: string) => void;
}) {
  const first = new Date(month + "-01T12:00:00");
  const count = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  return (
    <section className="panel employee-section">
      <h3>Monthly schedule</h3>
      <p>Regular shifts, appointments and leave · {data.employee.timezone}</p>
      <div className="employee-month-scroll">
        <div className="employee-month-grid">
          {weekdays.map((day) => (
            <div className="employee-weekday" key={day}>
              {day.slice(0, 3)}
            </div>
          ))}
          {Array.from({ length: first.getDay() }, (_, i) => (
            <div className="employee-calendar-blank" key={"blank" + i} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const day = month + "-" + String(i + 1).padStart(2, "0"),
              weekday = new Date(day + "T12:00").getDay(),
              hours = data.hours.find((row: any) => row.weekday === weekday),
              appointments = data.appointments.filter((row: any) =>
                row.starts_local.startsWith(day),
              ),
              leaves = data.leaves.filter(
                (row: any) =>
                  row.starts_local < day + " 23:59" &&
                  row.ends_local > day + " 00:00",
              );
            return (
              <button
                type="button"
                className={
                  "employee-calendar-day" +
                  (day === data.today ? " is-today" : "")
                }
                key={day}
                onClick={() => onDay(day)}
                aria-label={`${new Date(day + "T12:00").toLocaleDateString(undefined, { dateStyle: "full" })}: ${appointments.length} appointments, ${leaves.length} leave periods`}
              >
                <strong>{i + 1}</strong>
                <small>
                  {hours ? hours.opens_at + "–" + hours.closes_at : "Day off"}
                </small>
                {leaves.length > 0 && (
                  <span className="employee-calendar-leave">On leave</span>
                )}
                {appointments.slice(0, 2).map((appointment: any) => (
                  <span
                    key={appointment.id}
                    className={
                      "employee-calendar-event " +
                      (["cancelled", "no_show"].includes(appointment.status)
                        ? "event-failed"
                        : appointment.status === "completed"
                          ? "event-completed"
                          : "")
                    }
                  >
                    {appointment.starts_local.slice(11)} ·{" "}
                    {appointment.customer_name}
                  </span>
                ))}
                {appointments.length > 2 && (
                  <span className="employee-calendar-more">
                    +{appointments.length - 2} more
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
function DaySchedule({
  day,
  data,
  onClose,
  onLeave,
  canEdit,
}: {
  day: string;
  data: any;
  onClose: () => void;
  onLeave: () => void;
  canEdit: boolean;
}) {
  const hours = data.hours.find(
      (row: any) => row.weekday === new Date(day + "T12:00").getDay(),
    ),
    appointments = data.appointments.filter((row: any) =>
      row.starts_local.startsWith(day),
    ),
    leaves = data.leaves.filter(
      (row: any) =>
        row.starts_local < day + " 23:59" && row.ends_local > day + " 00:00",
    );
  return (
    <Modal
      title={new Date(day + "T12:00").toLocaleDateString(undefined, {
        dateStyle: "full",
      })}
      onClose={onClose}
    >
      <p>
        {hours
          ? "Shift " + hours.opens_at + "–" + hours.closes_at
          : "Regular day off"}{" "}
        · {data.employee.timezone}
      </p>
      {leaves.map((leave: any) => (
        <div className="warning employee-day-leave" key={leave.id}>
          <strong>{leave.reason || "Leave"}</strong>
          <p>
            {leave.starts_local} → {leave.ends_local}
          </p>
        </div>
      ))}
      {appointments.length ? (
        appointments.map((appointment: any) => (
          <article className="employee-day-appointment" key={appointment.id}>
            <strong>
              {appointment.starts_local.slice(11)}–
              {appointment.ends_local.slice(11)} · {appointment.customer_name}
            </strong>
            <p>{appointment.services}</p>
            <span
              className={`badge ${appointment.status === "completed" ? "on" : ["cancelled", "no_show"].includes(appointment.status) ? "warning" : ""}`}
            >
              {appointment.status.replaceAll("_", " ")}
            </span>
          </article>
        ))
      ) : (
        <div className="empty">No appointments this day.</div>
      )}
      <div className="form-actions">
        {canEdit && (
          <button className="secondary" onClick={onLeave}>
            Add leave
          </button>
        )}
        <a
          className="primary"
          href={`/calendar?view=Day&date=${day}&employee=${data.employee.id}`}
        >
          Open in calendar
        </a>
      </div>
    </Modal>
  );
}
