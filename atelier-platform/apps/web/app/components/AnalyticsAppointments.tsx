"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
async function load(path: string) {
  const r = await fetch("/api/v1/" + path),
    b = await r.json();
  if (!r.ok) throw Error(b.error?.message || "Unable to load appointments");
  return b.data;
}
export function AnalyticsAppointments({
  status,
  count,
  from,
  to,
}: {
  status: string;
  count: number;
  from: string;
  to: string;
}) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["analytics-appointments", status, from, to, page],
    queryFn: () =>
      load(
        "analytics/appointments?" +
          new URLSearchParams({ status, from, to, page: String(page) }),
      ),
    enabled: open,
  });
  const label = status.replaceAll("_", " ");
  return (
    <div className="analytics-appointment-group">
      <button
        className="analytics-status-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <strong>{label}</strong>
        <span>
          {count} {count === 1 ? "appointment" : "appointments"}
          <ChevronDown
            size={18}
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          />
        </span>
      </button>
      {open && (
        <div className="analytics-appointment-details">
          {query.isPending ? (
            <p>Loading appointments…</p>
          ) : query.isError ? (
            <p role="alert">{query.error.message}</p>
          ) : (
            <>
              <div className="module-table-scroll">
                <table className="module-table">
                  <caption className="sr-only">{label} appointments</caption>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Services</th>
                      <th>Employee</th>
                      <th>Location</th>
                      <th>Date & time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((a: any) => (
                      <tr key={a.id}>
                        <td>{a.customer_name}</td>
                        <td>{a.services}</td>
                        <td>{a.employee_name}</td>
                        <td>{a.branch_name}</td>
                        <td>
                          {a.starts_local}
                          <small className="location-subtext">
                            Until {a.ends_local}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!query.data.items.length && (
                <p className="empty">
                  No matching appointments in this date range.
                </p>
              )}
              <div className="location-pagination">
                <button
                  className="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} · {query.data.total} appointments
                </span>
                <button
                  className="secondary"
                  disabled={page * 25 >= query.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
