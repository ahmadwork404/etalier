"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Mail,
  UserPlus,
  UserRound,
  CheckCircle2,
} from "lucide-react";
import { BrandStar } from "./BrandStar";
import { useMoney } from "./Currency";
import { paymentLabels } from "./payment-methods";
import { toast } from "./Toasts";
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok)
    throw Error(payload.error?.message || "Unable to complete request");
  return payload.data;
}
export function InvoiceView({ id }: { id: string }) {
  const money = useMoney(),
    cache = useQueryClient();
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["invoice-view", id],
    queryFn: () => request("quick-work/invoices/" + id),
  });
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => request("access"),
  });
  if (query.isPending)
    return (
      <div className="empty" role="status">
        Preparing invoice…
      </div>
    );
  if (query.error)
    return (
      <div className="empty" role="alert">
        <p>{query.error.message}</p>
        <button className="secondary" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );
  const { order, items, payments, refunds, summary, number, email_ready } =
    query.data;
  const canSave =
    access.data?.permissions.includes("customers.write") &&
    access.data?.permissions.includes("finance.write");
  const canSend =
    access.data?.permissions.includes("finance.write") &&
    email_ready &&
    order.customer_email;
  const date = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: order.timezone,
    });
  return (
    <div className="invoice-view">
      <div className="invoice-document">
        <div className="invoice-document-header">
          <div>
            <div className="invoice-brand">
              <BrandStar />
              <strong>etalier</strong>
            </div>
            <h3>{order.salon_name}</h3>
            <p>
              {order.branch_name}
              {(order.branch_address || order.salon_address) && (
                <>
                  <br />
                  {order.branch_address || order.salon_address}
                </>
              )}
              {order.salon_email && (
                <>
                  <br />
                  {order.salon_email}
                </>
              )}
              {order.salon_phone && (
                <>
                  <br />
                  {order.salon_phone}
                </>
              )}
            </p>
          </div>
          <div className="invoice-heading">
            <span className="eyebrow">INVOICE</span>
            <strong>{number}</strong>
            <span
              className={`badge ${summary.status === "paid" ? "on" : summary.refunded_minor > 0 ? "warning" : ""}`}
            >
              {summary.label}
            </span>
          </div>
        </div>
        <div className="invoice-parties">
          <section>
            <span className="eyebrow">BILL TO</span>
            <h4>{order.customer_name}</h4>
            {order.customer_email && <p>{order.customer_email}</p>}
            {order.customer_phone && <p>{order.customer_phone}</p>}
            <small>
              {order.is_walk_in ? "Walk-in visitor" : "Saved customer"}
            </small>
          </section>
          <dl>
            <div>
              <dt>Invoice date</dt>
              <dd>{date(order.created_at)}</dd>
            </div>
            <div>
              <dt>Team member</dt>
              <dd>{order.employee_name || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{order.branch_name}</dd>
            </div>
          </dl>
        </div>
        <div className="invoice-line-table">
          <table>
            <thead>
              <tr>
                <th>Service / item</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, index: number) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price_minor)}</td>
                  <td>{money(Number(item.price_minor) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="invoice-totals">
          {[
            ["Subtotal", Number(order.subtotal_minor)],
            ["Discount", -Number(order.discount_minor)],
            ["Tax", Number(order.tax_minor)],
            ["Tip", Number(order.tip_minor || 0)],
            ["Invoice total", Number(order.total_minor)],
            ["Payments received", summary.paid_minor],
            ["Refunded", -summary.refunded_minor],
            ["Net paid", summary.net_paid_minor],
            ["Amount due", summary.balance_minor],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className={
                ["Invoice total", "Net paid", "Amount due"].includes(
                  String(label),
                )
                  ? "invoice-total-strong"
                  : ""
              }
            >
              <dt>{label}</dt>
              <dd>{money(Number(value))}</dd>
            </div>
          ))}
        </dl>
        {refunds.length > 0 && (
          <section className="invoice-refund-notice">
            <strong>{summary.label}</strong>
            <p>
              {money(summary.refunded_minor)} has been refunded. Net paid is{" "}
              {money(summary.net_paid_minor)}. This preserves the original
              invoice and payment history.
            </p>
          </section>
        )}
        <section className="invoice-payment-history">
          <h4>Payment history</h4>
          {payments.length ? (
            payments.map((payment: any, index: number) => (
              <div key={index}>
                <span>
                  {paymentLabels[payment.method] || payment.method}
                  <small>{date(payment.created_at)}</small>
                </span>
                <strong>{money(payment.amount_minor)}</strong>
              </div>
            ))
          ) : (
            <p>
              No payment recorded
              {Number(order.total_minor) === 0 ? " — nothing is due." : "."}
            </p>
          )}
          {refunds.map((refund: any) => (
            <div key={refund.id} className="invoice-refund-line">
              <span>
                Refund · {refund.reason}
                <small>{date(refund.created_at)}</small>
              </span>
              <strong>−{money(refund.amount_minor)}</strong>
            </div>
          ))}
        </section>
        <footer>
          <CheckCircle2 size={17} />
          <span>
            Thank you for visiting {order.salon_name}.
            <small>Reference: {order.id}</small>
          </span>
        </footer>
      </div>
      <div className="invoice-actions">
        <a
          className="primary"
          href={`/api/v1/quick-work/invoices/${id}/pdf`}
          download
        >
          <Download size={16} />
          Download invoice
        </a>
        <button
          type="button"
          className="secondary"
          disabled={!canSend || busy}
          title={
            !email_ready
              ? "Receipt email setup is pending"
              : !order.customer_email
                ? "Add a customer email address first"
                : "Send receipt to " + order.customer_email
          }
          onClick={async () => {
            if (!canSend || busy) return;
            setBusy(true);
            setError("");
            try {
              await request(`quick-work/invoices/${id}/email`, "POST", {});
              toast.success("Receipt sent.");
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Mail size={16} />
          {busy ? "Please wait…" : "Send receipt"}
        </button>
        {order.is_walk_in ? (
          canSave && (
            <button
              type="button"
              className="secondary"
              onClick={() => setAdding(!adding)}
            >
              <UserPlus size={16} />
              {adding ? "Cancel customer details" : "Add as customer"}
            </button>
          )
        ) : (
          <a className="secondary" href={"/customers/" + order.customer_id}>
            <UserRound size={16} />
            View customer
          </a>
        )}
      </div>
      {!email_ready && (
        <p className="invoice-email-note">
          Receipt email setup is pending. You can download the invoice now.
        </p>
      )}
      {adding && (
        <form
          className="invoice-add-customer panel"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            const fields = new FormData(event.currentTarget);
            try {
              await request(`quick-work/invoices/${id}/customer`, "POST", {
                name: fields.get("name"),
                email: fields.get("email") || undefined,
                phone: fields.get("phone") || undefined,
              });
              await cache.invalidateQueries();
              setAdding(false);
              toast.success("Customer saved to your directory.");
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Add visitor to customers</h3>
          <p>
            The visit and invoice stay linked to this customer. No duplicate
            customer record is created.
          </p>
          <label>
            Name
            <input
              autoFocus
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={
                order.customer_name === "Walk-in customer"
                  ? ""
                  : order.customer_name
              }
            />
          </label>
          <div className="form-row">
            <label>
              Email
              <input
                name="email"
                type="email"
                maxLength={254}
                defaultValue={order.customer_email || ""}
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                type="tel"
                maxLength={40}
                defaultValue={order.customer_phone || ""}
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save customer"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
