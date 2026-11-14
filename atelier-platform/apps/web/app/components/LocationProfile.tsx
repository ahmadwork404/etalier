"use client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { LocationVisual, LocationPhotoEditor } from "./LocationPhoto";
import { EmployeeAvatar } from "./EmployeePhoto";
import { useMoney } from "./Currency";
import { goToUrl, useUrlParam } from "./UrlState";

async function load(path: string) {
  const response = await fetch("/api/v1/" + path);
  const body = await response.json();
  if (!response.ok)
    throw Error(body.error?.message || "Unable to load location");
  return body.data;
}
export function LocationProfile({ id }: { id: string }) {
  const money = useMoney();
  const [month, setMonth] = useUrlParam("month", "", (value) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value),
  );
  const [page, setPage] = useUrlParam(
    "visits_page",
    "1",
    (value) => /^\d+$/.test(value) && Number(value) > 0,
  );
  const query = useQuery({
    queryKey: ["location-profile", id, month, page],
    queryFn: () =>
      load(
        `location-profiles/${id}?page=${page}${month ? "&month=" + month : ""}`,
      ),
  });
  if (query.isPending) return <div className="loading">Loading location…</div>;
  if (query.isError)
    return (
      <div className="empty error-box">
        <p>{query.error.message}</p>
        <button className="secondary" onClick={() => goToUrl("/branches")}>
          Back to locations
        </button>
      </div>
    );
  const data = query.data,
    current = data.month;
  const moveMonth = (offset: number) => {
    const [year, m] = current.split("-").map(Number);
    const date = new Date(Date.UTC(year, m - 1 + offset, 1));
    const url = new URL(window.location.href);
    url.searchParams.set("month", date.toISOString().slice(0, 7));
    url.searchParams.delete("visits_page");
    goToUrl(url.pathname + url.search);
  };
  const active = data.employees.filter((e: any) => e.active);
  const monthLabel = new Date(current + "-15T12:00:00Z").toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  const edit = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "edit");
    goToUrl(url.pathname + url.search);
  };
  return (
    <div className="location-profile">
      <button className="text-button" onClick={() => goToUrl("/branches")}>
        <ArrowLeft size={16} /> Back to locations
      </button>
      <section className="panel location-profile-header">
        <LocationVisual
          key={data.location.image_version || "placeholder"}
          location={data.location}
        />
        <div className="location-header-copy">
          <span className={"badge " + (data.location.active ? "on" : "")}>
            {data.location.active ? "Active location" : "Inactive location"}
          </span>
          <h2>{data.location.name}</h2>
          <p>
            <MapPin size={16} />
            {data.location.address || "No address added"}
          </p>
          <small>{data.location.timezone}</small>
        </div>
        <div className="location-header-actions">
          <button className="secondary" onClick={edit}>
            <Pencil size={16} />
            Edit location
          </button>
          {data.access.can_edit && (
            <LocationPhotoEditor location={data.location} />
          )}
        </div>
      </section>
      <div className="location-month-control">
        <button
          className="secondary"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <strong>{monthLabel}</strong>
        <button
          className="secondary"
          aria-label="Next month"
          onClick={() => moveMonth(1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          className="text-button"
          onClick={() => {
            setMonth("");
            setPage("1");
          }}
        >
          This month
        </button>
      </div>
      <div className="location-kpis">
        {data.access.team && (
          <article className="panel">
            <small>Active employees</small>
            <strong>{active.length}</strong>
          </article>
        )}
        {data.summary && (
          <>
            <article className="panel">
              <small>Completed visits</small>
              <strong>{data.summary.completed}</strong>
              <small>{data.summary.visits} total bookings & quick visits</small>
            </article>
            <article className="panel">
              <small>Upcoming bookings</small>
              <strong>{data.summary.upcoming}</strong>
              <small>{data.summary.customers} customers this month</small>
            </article>
          </>
        )}
        {data.financial && (
          <>
            <article className="panel">
              <small>Net collected</small>
              <strong>{money(data.financial.net_minor)}</strong>
              <small>After refunds · includes tax and tips</small>
            </article>
            <article className="panel">
              <small>Refunds</small>
              <strong>{money(data.financial.refunded_minor)}</strong>
              <small>
                {money(data.financial.received_minor)} payments received
              </small>
            </article>
            <article className="panel">
              <small>Tips collected</small>
              <strong>{money(data.financial.tips_minor)}</strong>
              <small>Included in net collected</small>
            </article>
          </>
        )}
      </div>
      {data.financial && (
        <section className="panel">
          <h3>Daily collections</h3>
          <p>Payments minus refunds, recorded in this location’s timezone.</p>
          {data.trend.length ? (
            <div style={{ height: 240, width: "100%" }}>
              <ResponsiveContainer>
                <BarChart data={data.trend}>
                  <XAxis
                    dataKey="collection_day"
                    tickFormatter={(v) => String(v).slice(8)}
                  />
                  <YAxis tickFormatter={(v) => money(Number(v))} width={90} />
                  <Tooltip
                    formatter={(v) => [money(Number(v)), "Net collected"]}
                  />
                  <Bar
                    dataKey="net_minor"
                    fill="#234c40"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty">
              No payments or refunds recorded this month.
            </div>
          )}
        </section>
      )}
      {data.access.bookings && (
        <section className="panel">
          <h3>Visit outcomes</h3>
          <div className="location-outcomes">
            {[
              ["Completed", data.summary.completed],
              ["Cancelled", data.summary.cancelled],
              ["No-show", data.summary.no_show],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <div className="location-meter">
                  <i
                    style={{
                      width: data.summary.visits
                        ? `${(Number(value) / data.summary.visits) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.access.team && (
        <section className="panel">
          <h3>Employees at this location</h3>
          <p>
            Monthly activity for the team assigned here. Inactive employees
            remain visible for reference.
          </p>
          <div className="module-table-scroll">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  {data.access.bookings && (
                    <>
                      <th>Visits</th>
                      <th>Completed</th>
                    </>
                  )}
                  {data.access.finance && <th>Net collected</th>}
                </tr>
              </thead>
              <tbody>
                {data.employees.map((employee: any) => (
                  <tr key={employee.id}>
                    <td>
                      <a
                        className="location-employee"
                        href={`/employees?record=${employee.id}&mode=view`}
                      >
                        <EmployeeAvatar employee={employee} />
                        <span>
                          <strong>{employee.name}</strong>
                          <small>{employee.title || employee.email}</small>
                        </span>
                      </a>
                    </td>
                    <td>
                      <span
                        className={"badge " + (employee.active ? "on" : "")}
                      >
                        {employee.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {data.access.bookings && (
                      <>
                        <td>{employee.visits}</td>
                        <td>{employee.completed}</td>
                      </>
                    )}
                    {data.access.finance && (
                      <td>{money(employee.net_minor)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.employees.length && (
            <div className="empty">
              No employees are assigned to this location.
            </div>
          )}
        </section>
      )}
      {data.access.bookings && (
        <section className="panel">
          <h3>Bookings & quick visits</h3>
          <div className="module-table-scroll">
            <table className="module-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Services</th>
                  <th>Employee</th>
                  <th>Date & time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.appointments.map((visit: any) => (
                  <tr key={visit.kind + visit.id}>
                    <td>
                      {visit.customer_name}
                      <small className="location-subtext">
                        {visit.kind === "walkin" ? "Quick visit" : "Booking"}
                      </small>
                    </td>
                    <td>{visit.services}</td>
                    <td>{visit.employee_name}</td>
                    <td>{visit.occurred_local}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (visit.status === "completed"
                            ? "on"
                            : visit.status === "cancelled" ||
                                visit.status === "no_show"
                              ? "warning"
                              : "")
                        }
                      >
                        {visit.status.replaceAll("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.appointments.length && (
            <div className="empty">No bookings or quick visits this month.</div>
          )}
          <div className="location-pagination">
            <span>{data.total} visits</span>
            <button
              className="secondary"
              disabled={Number(page) <= 1}
              onClick={() => setPage(String(Number(page) - 1))}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="secondary"
              disabled={Number(page) * 25 >= data.total}
              onClick={() => setPage(String(Number(page) + 1))}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
