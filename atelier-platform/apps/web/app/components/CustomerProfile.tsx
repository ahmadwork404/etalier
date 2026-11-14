"use client";
import { CustomSelect } from "./CustomSelect";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Pencil,
  X,
  Send,
  Copy,
} from "lucide-react";
import { goToUrl, useUrlParam, validDate } from "./UrlState";
import { CustomerAvatar, CustomerPhotoUpload } from "./CustomerPhoto";
import { CustomerInsights } from "./CustomerInsights";
import { DirectoryDetails } from "./DirectoryDetails";
import { toast } from "./Toasts";
import { useMoney } from "./Currency";
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok)
    throw Error(
      Object.values(payload.error?.issues?.fieldErrors || {})
        .flat()
        .join(" ") ||
        payload.error?.message ||
        "Request failed",
    );
  return payload.data;
}
export function CustomerProfile({
  customerId,
  tenantId,
  permissions,
  billingEnabled,
  features,
}: {
  customerId: string;
  tenantId: string;
  permissions: string[];
  billingEnabled: boolean;
  features: any[];
}) {
  const [tab, setTab] = useUrlParam("tab", "upcoming", (value) =>
    ["upcoming", "past", "invoices"].includes(value),
  );
  const [rawPage, setPage] = useUrlParam("page", "1", (value) =>
    /^[1-9]\d{0,5}$/.test(value),
  );
  const page = Number(rawPage);
  const [edit, setEdit] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [composer, setComposer] = useState<"email" | "sms" | null>(null);
  const profile = useQuery({
    queryKey: ["customer-profile", tenantId, customerId],
    queryFn: () => request(`customers/${customerId}`),
  });
  const finance = permissions.includes("finance.read") && billingEnabled;
  const history = useQuery({
    queryKey: ["customer-profile-history", tenantId, customerId, tab, page],
    queryFn: () =>
      request(
        `customers/${customerId}/${tab === "invoices" ? "invoices" : "appointments"}?page=${page}` +
          (tab !== "invoices" ? "&section=" + tab : ""),
      ),
    enabled: tab !== "invoices" || finance,
  });
  const money = useMoney();
  const customer = profile.data?.customer;
  const canEdit = permissions.includes("customers.write");
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label + " copied");
    } catch {
      toast.error("Unable to copy " + label.toLowerCase());
    }
  }
  if (profile.isPending)
    return (
      <div className="loading" role="status">
        Loading customer…
      </div>
    );
  if (profile.error)
    return (
      <section className="panel empty">
        <h2>Unable to open customer</h2>
        <p>{profile.error.message}</p>
        <a className="secondary" href="/customers">
          Back to customers
        </a>
      </section>
    );
  return (
    <div className="customer-profile">
      <a
        className="customer-back"
        href="/customers"
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          goToUrl("/customers");
        }}
      >
        <ArrowLeft size={17} />
        All customers
      </a>
      <section className="panel customer-profile-header">
        <CustomerAvatar customer={customer} />
        <div className="customer-profile-title">
          <span className="eyebrow">CUSTOMER PROFILE</span>
          <h1>{customer.name}</h1>
          <p>
            Customer since {new Date(customer.created_at).toLocaleDateString()}
          </p>
        </div>
        {canEdit && (
          <button className="secondary" onClick={() => setEdit(true)}>
            <Pencil size={16} />
            Edit customer
          </button>
        )}
      </section>
      <CustomerInsights customerId={customerId} tenantId={tenantId} />
      <div className="customer-profile-grid">
        <section
          className={
            "panel customer-contact-panel " +
            (contactExpanded ? "details-expanded" : "")
          }
        >
          <h2>Contact details</h2>
          <dl>
            <dt>Email</dt>
            <dd>
              {customer.email ? (
                <button
                  className="contact-copy"
                  onClick={() => copy(customer.email, "Email")}
                >
                  {customer.email}
                  <Copy size={14} />
                </button>
              ) : (
                "-"
              )}
            </dd>
            <dt>Cellphone</dt>
            <dd>
              {customer.phone ? (
                <button
                  className="contact-copy"
                  onClick={() => copy(customer.phone, "Cellphone")}
                >
                  {customer.phone}
                  <Copy size={14} />
                </button>
              ) : (
                "-"
              )}
            </dd>
            <dt className="extra-customer-detail">Notes</dt>
            <dd className="customer-notes extra-customer-detail">
              {customer.notes || "No notes"}
            </dd>
            {!!customer.tags?.length && (
              <>
                <dt className="extra-customer-detail">Tags</dt>
                <dd className="extra-customer-detail">
                  {customer.tags.join(", ")}
                </dd>
              </>
            )}
          </dl>
          <button
            className="text-button mobile-more-details"
            aria-expanded={contactExpanded}
            onClick={() => setContactExpanded((value) => !value)}
          >
            {contactExpanded ? "Less customer detail" : "More customer details"}
          </button>
          <h2>Quick actions</h2>
          <button
            className="secondary full"
            disabled={!canEdit || !customer.email}
            onClick={() => setComposer("email")}
          >
            <Mail size={17} />
            Quick email
          </button>
          <button
            className="secondary full"
            disabled={!canEdit || !customer.phone}
            onClick={() => setComposer("sms")}
          >
            <MessageSquare size={17} />
            Quick message
          </button>
          {!profile.data.delivery.email && (
            <small>Email delivery is not configured.</small>
          )}
          {!profile.data.delivery.sms && (
            <small>SMS delivery is not configured.</small>
          )}
        </section>
        <section className="panel customer-timeline">
          <div
            className="customer-profile-tabs"
            role="tablist"
            aria-label="Customer records"
          >
            {[
              ["upcoming", "Upcoming appointments"],
              ["past", "Past appointments"],
              ["invoices", "Invoices"],
            ].map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                onClick={() => {
                  setTab(value);
                  setPage("1");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "invoices" && !finance ? (
            <div className="empty">
              <h2>Invoices unavailable</h2>
              <p>
                {billingEnabled
                  ? "You need finance access to view invoices."
                  : "The sales module is disabled for this shop."}
              </p>
            </div>
          ) : history.isPending ? (
            <div className="loading">Loading records…</div>
          ) : history.error ? (
            <div className="empty" role="alert">
              <p>{history.error.message}</p>
              <button className="secondary" onClick={() => history.refetch()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="customer-history-cards">
                {history.data.items.map((item: any) =>
                  tab === "invoices" ? (
                    <article className="history-mobile-card" key={item.id}>
                      <div className="history-mobile-top">
                        <strong>Order {item.id.slice(0, 8)}</strong>
                        <span className="badge">
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <strong className="mobile-invoice-total">
                        {money(item.total_minor)}
                      </strong>
                      <small>
                        {new Date(item.created_at).toLocaleDateString()} ·{" "}
                        {item.branch_name}
                      </small>
                      <details>
                        <summary>Payment & line details</summary>
                        <p>
                          Paid {money(item.paid_minor)} · Refunded{" "}
                          {money(item.refunded_minor)}
                        </p>
                        {item.items.map((line: any) => (
                          <p key={line.id}>
                            {line.name || line.description || "Item"} ×{" "}
                            {line.quantity} ·{" "}
                            {money(
                              line.unit_price_minor || line.price_minor || 0,
                            )}
                          </p>
                        ))}
                        <p>
                          Tax {money(item.tax_minor)} · Discount{" "}
                          {money(item.discount_minor)}
                        </p>
                      </details>
                    </article>
                  ) : (
                    <article className="history-mobile-card" key={item.id}>
                      <div className="history-mobile-top">
                        <strong>
                          {new Date(item.starts_at).toLocaleDateString()}
                        </strong>
                        <span className="badge">
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <h3>{item.services || "Appointment"}</h3>
                      <p>
                        {new Date(item.starts_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {item.employee_name}
                      </p>
                      <small>{item.branch_name}</small>
                    </article>
                  ),
                )}
              </div>
              {history.data.items.length > 0 && (
                <div className="customer-table-scroll">
                  <table className="customer-table">
                    <thead>
                      <tr>
                        {(tab === "invoices"
                          ? [
                              "Reference / date",
                              "Location",
                              "Total",
                              "Paid / refunded",
                              "Status",
                            ]
                          : [
                              "When",
                              "Service",
                              "Team member",
                              "Location",
                              "Status",
                            ]
                        ).map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.data.items.map((item: any) =>
                        tab === "invoices" ? (
                          <tr key={item.id}>
                            <td>
                              <details>
                                <summary>Order {item.id.slice(0, 8)}</summary>
                                <dl>
                                  {item.items.map((line: any) => (
                                    <div key={line.id}>
                                      <dt>
                                        {line.name ||
                                          line.description ||
                                          "Line item"}{" "}
                                        × {line.quantity}
                                      </dt>
                                      <dd>
                                        {money(
                                          line.unit_price_minor ||
                                            line.price_minor ||
                                            0,
                                        )}
                                      </dd>
                                    </div>
                                  ))}
                                  <dt>Subtotal</dt>
                                  <dd>{money(item.subtotal_minor)}</dd>
                                  <dt>Tax</dt>
                                  <dd>{money(item.tax_minor)}</dd>
                                  <dt>Discount</dt>
                                  <dd>{money(item.discount_minor)}</dd>
                                </dl>
                              </details>
                              <small>
                                {new Date(item.created_at).toLocaleDateString()}
                              </small>
                            </td>
                            <td>{item.branch_name}</td>
                            <td>{money(item.total_minor)}</td>
                            <td>
                              {money(item.paid_minor)}
                              <small>
                                Refunded {money(item.refunded_minor)}
                              </small>
                            </td>
                            <td>
                              <span className="badge">
                                {item.status.replaceAll("_", " ")}
                              </span>
                            </td>
                          </tr>
                        ) : (
                          <tr key={item.id}>
                            <td>
                              {new Date(item.starts_at).toLocaleDateString()}
                              <small>
                                {new Date(item.starts_at).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </small>
                            </td>
                            <td>{item.services || "Service"}</td>
                            <td>{item.employee_name}</td>
                            <td>{item.branch_name}</td>
                            <td>
                              <span
                                className={
                                  "badge " +
                                  (item.status === "completed" ? "on" : "")
                                }
                              >
                                {item.status.replaceAll("_", " ")}
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {!history.data.items.length && (
                <div className="empty">
                  <h2>
                    {tab === "invoices"
                      ? "No invoices yet"
                      : tab === "upcoming"
                        ? "No upcoming appointments"
                        : "No past appointments"}
                  </h2>
                </div>
              )}
              <div className="pagination">
                <span>
                  {history.data.total}{" "}
                  {history.data.total === 1 ? "record" : "records"}
                </span>
                <div className="row-actions">
                  <button
                    className="secondary"
                    disabled={page === 1}
                    onClick={() => setPage(String(page - 1))}
                  >
                    Previous
                  </button>
                  <span className="page-number">Page {page}</span>
                  <button
                    className="secondary"
                    disabled={!history.data.hasMore}
                    onClick={() => setPage(String(page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      {edit && (
        <DirectoryDetails
          kind="customers"
          row={customer}
          onClose={() => setEdit(false)}
        />
      )}
      {composer && (
        <MessageComposer
          channel={composer}
          customer={customer}
          configured={profile.data.delivery[composer]}
          moduleEnabled={features.some(
            (feature) =>
              feature.key === composer &&
              feature.enabled &&
              feature.tenant_enabled &&
              feature.admin_enabled !== false,
          )}
          marketingAllowed={permissions.includes("marketing.write")}
          onClose={() => setComposer(null)}
        />
      )}
    </div>
  );
}
function MessageComposer({
  channel,
  customer,
  configured,
  moduleEnabled,
  marketingAllowed,
  onClose,
}: {
  channel: "email" | "sms";
  customer: any;
  configured: boolean;
  moduleEnabled: boolean;
  marketingAllowed: boolean;
  onClose: () => void;
}) {
  const key = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState("service");
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-title"
      >
        <div className="modal-heading">
          <h2 id="message-title">
            {channel === "email" ? "Quick email" : "Quick SMS message"}
          </h2>
          <button aria-label="Close message" onClick={onClose}>
            <X />
          </button>
        </div>
        <p>
          To {customer.name}:{" "}
          {channel === "email" ? customer.email : customer.phone}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            const data = Object.fromEntries(new FormData(event.currentTarget));
            try {
              await request(`customers/${customer.id}/messages`, "POST", {
                ...data,
                channel,
                purpose,
                idempotency_key: key.current,
              });
              toast.success("Message queued for delivery.");
              onClose();
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Message purpose
            <CustomSelect
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
            >
              <option value="service">Service / appointment update</option>
              <option
                value="marketing"
                disabled={!marketingAllowed || !customer.marketing_consent}
              >
                Marketing (requires opt-in)
              </option>
            </CustomSelect>
          </label>
          {channel === "email" && (
            <label>
              Subject
              <input autoFocus required name="subject" maxLength={200} />
            </label>
          )}
          <label>
            Message
            <textarea
              autoFocus={channel === "sms"}
              name="body"
              required
              maxLength={5000}
              rows={6}
            />
          </label>
          {!configured && (
            <p className="section-note">
              {channel === "email" ? "Email" : "SMS"} delivery needs to be
              configured before you can send.
            </p>
          )}
          {!moduleEnabled && (
            <p className="section-note">
              The {channel} module must be enabled by your shop and platform
              administrator.
            </p>
          )}
          <div className="form-actions">
            <button className="secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || !configured || !moduleEnabled}
            >
              <Send size={16} />
              {busy
                ? "Queuing…"
                : "Send " + (channel === "email" ? "email" : "message")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
