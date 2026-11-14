"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Wallet, CalendarCheck } from "lucide-react";
import { useMoney } from "./Currency";
export function CustomerInsights({
  customerId,
  tenantId,
}: {
  customerId: string;
  tenantId: string;
}) {
  const money = useMoney();
  const [expanded, setExpanded] = useState(false);
  const insight = useQuery({
    queryKey: ["customer-insights", tenantId, customerId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/customers/${customerId}/insights`);
      const payload = await response.json();
      if (!response.ok)
        throw Error(
          payload.error?.message || "Unable to load customer insights",
        );
      return payload.data;
    },
  });
  if (insight.isPending)
    return (
      <section className="panel customer-insights-loading" role="status">
        Loading customer insights…
      </section>
    );
  if (insight.error)
    return (
      <section className="panel customer-insights-loading">
        <p>{insight.error.message}</p>
        <button className="secondary" onClick={() => insight.refetch()}>
          Retry insights
        </button>
      </section>
    );
  const { attendance, financial } = insight.data;
  const decided = attendance.completed + attendance.no_show;
  const kept = decided
    ? Math.round((attendance.completed / decided) * 100)
    : null;
  const outcomes = [
    { label: "Completed", count: attendance.completed, tone: "primary" },
    { label: "No-show", count: attendance.no_show, tone: "accent" },
    { label: "Cancelled", count: attendance.cancelled, tone: "muted" },
  ];
  const outcomeTotal = outcomes.reduce((sum, item) => sum + item.count, 0);
  return (
    <section
      className={"customer-insights " + (expanded ? "insights-expanded" : "")}
      aria-labelledby="customer-value-title"
    >
      <div className="insights-heading">
        <div>
          <h2 id="customer-value-title">Customer at a glance</h2>
          <p>Value and visit patterns, based on recorded activity.</p>
        </div>
      </div>
      <div className="customer-value-metrics">
        {financial && (
          <>
            <article className="panel value-metric">
              <span>
                <Wallet size={17} />
                Net collected
              </span>
              <strong>{money(financial.net_collected_minor)}</strong>
              <small>After {money(financial.refunded_minor)} in refunds</small>
            </article>
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
                After {money(financial.known_cost_minor)} in known costs
              </small>
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
            {attendance.upcoming} upcoming ·{" "}
            {kept === null
              ? "No attendance history yet"
              : `${kept}% kept (completed vs no-shows)`}
          </small>
        </article>
      </div>
      <button
        className="secondary mobile-insights-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Less detail" : "View charts & contribution"}
      </button>
      <div className="customer-value-charts">
        {financial && (
          <section className="panel value-chart">
            <h3>Collected over time</h3>
            <p>Last six months · refunds deducted when recorded</p>
            <div
              className="customer-revenue-chart"
              role="img"
              aria-label={
                "Monthly net collected: " +
                financial.monthly
                  .map((item: any) => `${item.month}: ${money(item.net_minor)}`)
                  .join("; ")
              }
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={financial.monthly}
                  margin={{ top: 14, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                  />
                  <YAxis
                    width={58}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat(undefined, {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(Number(value) / 100)
                    }
                  />
                  <Tooltip
                    formatter={(value: any) => [
                      money(Number(value)),
                      "Net collected",
                    ]}
                  />
                  <Bar
                    dataKey="net_minor"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={38}
                  >
                    {financial.monthly.map((item: any) => (
                      <Cell
                        key={item.month}
                        fill={
                          item.net_minor < 0
                            ? "var(--color-accent)"
                            : "var(--color-primary)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
        <section className="panel value-chart">
          <h3>Appointment outcomes</h3>
          <p>Completed visits, no-shows and cancellations</p>
          <div className="attendance-chart">
            {outcomeTotal ? (
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
                        style={{ width: `${(item.count / outcomeTotal) * 100}%` }}
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
          Contribution is an estimate, not net profit. Known costs include
          products sold, treatment consumables, recorded commissions and tips, using
          current product costs. Tax, other labor and overhead are not deducted.
        </p>
      )}
    </section>
  );
}
