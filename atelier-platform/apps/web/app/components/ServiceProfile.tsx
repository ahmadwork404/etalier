"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Wallet, CalendarCheck, Users } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useMoney } from "./Currency";
import { goToUrl, useUrlParam } from "./UrlState";
import { RecordActions, RecordDialog } from "./RecordActions";
import { ServiceVisual } from "./ServiceVisual";

export function ServiceProfile({ id }: { id: string }) {
  const [mode] = useUrlParam("mode", "view");
  const money = useMoney();
  const query = useQuery({
    queryKey: ["service-insights", id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/services/${id}/insights`);
      const payload = await response.json();
      if (!response.ok)
        throw Error(
          payload.error?.message || "Unable to load service insights",
        );
      return payload.data;
    },
  });
  const back = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("record");
    url.searchParams.delete("mode");
    goToUrl(url.pathname + url.search);
  };
  if (query.isPending)
    return (
      <section className="panel empty" role="status">
        Loading service insights…
      </section>
    );
  if (query.error)
    return (
      <section className="panel empty" role="alert">
        <p>{query.error.message}</p>
        <button className="secondary" onClick={() => query.refetch()}>
          Try again
        </button>
        <button onClick={back}>Back to services</button>
      </section>
    );
  const { service, attendance, financial, monthly } = query.data;
  const outcomes = [
    { label: "Completed", count: attendance.completed, tone: "primary" },
    { label: "No-show", count: attendance.no_show, tone: "accent" },
    { label: "Cancelled", count: attendance.cancelled, tone: "muted" },
  ];
  const total = outcomes.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="service-profile">
      <button className="secondary" onClick={back}>
        <ArrowLeft size={17} />
        Back to services
      </button>
      <section className="panel service-profile-heading">
        <div className="module-identity">
          <ServiceVisual service={service} />
          <div>
            <h2>{service.name}</h2>
            <span className={`badge ${service.active ? "on" : "warning"}`}>
              {service.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className="service-profile-facts">
          <span>
            <Clock size={17} />
            {service.duration_minutes} min · {service.buffer_minutes} min buffer
          </span>
          <strong>{money(service.price_minor)}</strong>
        </div>
        <RecordActions kind="services" row={service} deleteOnly />
        <button
          className="primary"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("mode", "edit");
            goToUrl(url.pathname + url.search);
          }}
        >
          Edit service
        </button>
      </section>
      <div className="customer-value-metrics">
        {financial && (
          <>
            <article className="panel value-metric">
              <span>
                <Wallet size={17} />
                Net collected · allocated
              </span>
              <strong>{money(financial.net_collected_minor)}</strong>
              <small>Recorded payments less refunds</small>
            </article>
            <article className="panel value-metric">
              <span>Completed service value</span>
              <strong>{money(financial.completed_value_minor)}</strong>
              <small>Historical booking prices before discounts and tax</small>
            </article>
          </>
        )}
        <article className="panel value-metric">
          <span>
            <CalendarCheck size={17} />
            Completed visits
          </span>
          <strong>{attendance.completed}</strong>
          <small>
            {attendance.upcoming} upcoming · {attendance.bookings} total
            bookings
          </small>
        </article>
        <article className="panel value-metric">
          <span>
            <Users size={17} />
            Customers served
          </span>
          <strong>{attendance.customers}</strong>
          <small>Distinct customers with completed visits</small>
        </article>
      </div>
      <div className="customer-value-charts">
        <section className="panel value-chart">
          <h3>
            {financial
              ? "Service value over time"
              : "Completed visits over time"}
          </h3>
          <p>Last six months · by appointment date</p>
          <div
            role="img"
            aria-label={monthly
              .map(
                (row: any) =>
                  `${row.month}: ${financial ? money(row.completed_value_minor) : row.completed + " completed"}`,
              )
              .join("; ")}
          >
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={monthly}
                margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  width={70}
                  allowDecimals={false}
                  tickFormatter={(value) =>
                    financial ? money(Number(value)) : String(value)
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => [
                    financial ? money(Number(value)) : Number(value),
                    financial ? "Completed service value" : "Completed visits",
                  ]}
                />
                <Bar
                  dataKey={financial ? "completed_value_minor" : "completed"}
                  fill="var(--color-primary)"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel value-chart">
          <h3>Appointment outcomes</h3>
          <p>Completed visits, no-shows and cancellations</p>
          <div className="attendance-chart">
            {total ? (
              outcomes.map((item) => (
                <div className="attendance-row" key={item.label}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.count}</span>
                  </div>
                  <div className="attendance-track">
                    {item.count > 0 && (
                      <span
                        className={"attendance-bar " + item.tone}
                        style={{ width: `${(item.count / total) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="insight-no-history">No visits to summarize yet.</p>
            )}
          </div>
        </section>
      </div>
      {financial && (
        <p className="contribution-note">
          Net collected is allocated by this service’s share of each invoice’s
          line value, including proportional discounts, tax and refunds.
          Completed service value uses the price saved on each booking; it is
          not profit or cash received.
        </p>
      )}
      {mode !== "view" && <RecordDialog kind="services" rows={[service]} />}
    </div>
  );
}
