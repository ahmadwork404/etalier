"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  UserPlus,
  Users,
  Search,
  Check,
  Plus,
  X,
  Wallet,
  Mail,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { CustomerAvatar } from "./CustomerPhoto";
import { EmployeeAvatar } from "./EmployeePhoto";
import { ServiceVisual } from "./ServiceVisual";
import { CustomSelect } from "./CustomSelect";
import { useMoney } from "./Currency";
import { toast } from "./Toasts";
import { paymentLabels, manualPaymentMethods } from "./payment-methods";
import { InvoiceView } from "./InvoiceView";
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
const minor = (value: string) => Math.round(Number(value || 0) * 100);
function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"record-dialog modal quick-work-dialog " + className}
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
export function QuickWork() {
  const cache = useQueryClient(),
    money = useMoney();
  const options = useQuery({
    queryKey: ["quick-work-options"],
    queryFn: () => request("quick-work/options"),
  });
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => request("access"),
  });
  const canWrite = !!access.data?.permissions?.includes("finance.write");
  const visitors = useQuery({
    queryKey: ["quick-work-today"],
    queryFn: () => request("quick-work/today"),
    enabled: !!options.data,
    refetchInterval: 30000,
  });
  const [type, setType] = useState<"walkin" | "returning">("walkin"),
    [customer, setCustomer] = useState<any>(null),
    [customerOpen, setCustomerOpen] = useState(false),
    [contactOpen, setContactOpen] = useState(false),
    [customerName, setCustomerName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [branch, setBranch] = useState(""),
    [employee, setEmployee] = useState(""),
    [services, setServices] = useState<string[]>([]),
    [serviceSearch, setServiceSearch] = useState(""),
    [other, setOther] = useState(false),
    [otherName, setOtherName] = useState("Other service"),
    [otherPrice, setOtherPrice] = useState(""),
    [paid, setPaid] = useState(""),
    [manualPaid, setManualPaid] = useState(false),
    [hasTip, setHasTip] = useState(false),
    [tip, setTip] = useState(""),
    [method, setMethod] = useState("cash"),
    [sendInvoice, setSendInvoice] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID()),
    [lastVisit, setLastVisit] = useState<any>(null),
    [invoice, setInvoice] = useState("");
  if (options.isPending)
    return (
      <section className="panel empty" role="status">
        Opening Quick Work…
      </section>
    );
  if (options.error)
    return (
      <section className="panel empty" role="alert">
        <Zap size={32} />
        <h2>Quick Work</h2>
        <p>{options.error.message}</p>
        <p>Quick Work needs the Sales & checkout module and finance access.</p>
        <a className="secondary" href="/modules">
          Open modules
        </a>
        <button className="secondary" onClick={() => options.refetch()}>
          Try again
        </button>
      </section>
    );
  const data = options.data,
    branchId = branch || data.branches[0]?.id || "",
    team = data.employees.filter(
      (person: any) => person.branch_id === branchId,
    ),
    employeeId = team.some((person: any) => person.id === employee)
      ? employee
      : team.length === 1
        ? team[0].id
        : "",
    allowed = data.settings.payment_methods.filter((value: string) =>
      manualPaymentMethods.includes(value),
    ),
    paymentMethod = allowed.includes(method) ? method : allowed[0] || "";
  const subtotal =
      data.services
        .filter((service: any) => services.includes(service.id))
        .reduce(
          (sum: number, service: any) => sum + Number(service.price_minor),
          0,
        ) + (other ? minor(otherPrice) : 0),
    servicePaid = manualPaid ? minor(paid) : subtotal,
    discount = Math.max(0, subtotal - servicePaid),
    tax = Math.round((servicePaid * data.settings.tax_basis_points) / 10000),
    tipMinor = hasTip ? minor(tip) : 0,
    total = servicePaid + tax + tipMinor,
    recipientEmail = type === "returning" ? customer?.email : email;
  const selectedCount = services.length + (other ? 1 : 0),
    valid =
      canWrite &&
      selectedCount > 0 &&
      employeeId &&
      branchId &&
      paymentMethod &&
      (type === "walkin" || customer) &&
      servicePaid >= 0 &&
      servicePaid <= subtotal;
  return (
    <div className="quick-work">
      <div className="quick-intro">
        <span className="eyebrow">
          <Zap size={15} />
          QUICK WORK
        </span>
        <h2>A visit, recorded in a few taps.</h2>
        <p>Log completed services and the payment already received.</p>
      </div>
      {lastVisit && (
        <section className="quick-saved panel" role="status">
          <CheckCircle2 size={24} />
          <div>
            <strong>Visit and invoice saved</strong>
            <small>
              {lastVisit.receipt_status === "sent"
                ? "Invoice email sent."
                : lastVisit.receipt_status === "failed"
                  ? "Invoice email failed. The visit and payment are safely recorded."
                  : "Ready for the next customer."}
            </small>
          </div>
          <button
            className="secondary"
            onClick={() => setInvoice(lastVisit.order_id)}
          >
            <Receipt size={16} />
            View invoice
          </button>
        </section>
      )}
      <form
        className="quick-work-layout"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid || busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await request("quick-work", "POST", {
              request_key: requestKey,
              customer_type: type,
              ...(type === "returning"
                ? { customer_id: customer.id }
                : {
                    customer_name: customerName || undefined,
                    email: email || undefined,
                    phone: phone || undefined,
                  }),
              branch_id: branchId,
              employee_id: employeeId,
              service_ids: services,
              ...(other
                ? { other: { name: otherName, price_minor: minor(otherPrice) } }
                : {}),
              service_paid_minor: servicePaid,
              tip_minor: tipMinor,
              payment_method: paymentMethod,
              send_invoice: sendInvoice && !!recipientEmail,
            });
            setLastVisit(result);
            setRequestKey(crypto.randomUUID());
            setServices([]);
            setServiceSearch("");
            setOther(false);
            setOtherPrice("");
            setOtherName("Other service");
            setPaid("");
            setManualPaid(false);
            setTip("");
            setHasTip(false);
            setType("walkin");
            setCustomer(null);
            setCustomerName("");
            setEmail("");
            setPhone("");
            setSendInvoice(false);
            setContactOpen(false);
            await cache.invalidateQueries();
            toast.success("Completed visit recorded.");
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="quick-work-main">
          <section className="panel quick-section">
            <div className="quick-section-heading">
              <span className="quick-step">1</span>
              <h3>Who’s here?</h3>
              {data.branches.length > 1 && (
                <CustomSelect
                  aria-label="Visit location"
                  value={branchId}
                  onChange={(event) => {
                    setBranch(event.target.value);
                    setEmployee("");
                  }}
                >
                  {data.branches.map((row: any) => (
                    <option value={row.id} key={row.id}>
                      {row.name}
                    </option>
                  ))}
                </CustomSelect>
              )}
            </div>
            <div className="quick-customer-types">
              <button
                type="button"
                aria-pressed={type === "walkin"}
                onClick={() => {
                  setType("walkin");
                  setCustomer(null);
                  setSendInvoice(false);
                }}
              >
                <UserPlus size={23} />
                <strong>Walk-in customer</strong>
                <small>No account needed</small>
              </button>
              <button
                type="button"
                aria-pressed={type === "returning"}
                onClick={() => {
                  setType("returning");
                  setCustomerOpen(true);
                  setSendInvoice(false);
                }}
              >
                <Users size={23} />
                <strong>Returning customer</strong>
                <small>Search name, phone or email</small>
              </button>
            </div>
            {type === "returning" ? (
              customer ? (
                <div className="quick-selected-customer">
                  <CustomerAvatar customer={customer} />
                  <div>
                    <strong>{customer.name}</strong>
                    <small>
                      {customer.email || customer.phone || "Customer selected"}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setCustomerOpen(true)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="secondary quick-wide"
                  onClick={() => setCustomerOpen(true)}
                >
                  <Search size={16} />
                  Select customer
                </button>
              )
            ) : (
              <>
                <button
                  type="button"
                  className="quick-contact-toggle"
                  aria-expanded={contactOpen}
                  onClick={() => setContactOpen(!contactOpen)}
                >
                  {contactOpen
                    ? "Hide optional contact details"
                    : "+ Add name or contact details (optional)"}
                </button>
                {contactOpen && (
                  <div className="quick-contact-fields">
                    <label>
                      Name
                      <input
                        maxLength={120}
                        value={customerName}
                        onChange={(event) =>
                          setCustomerName(event.target.value)
                        }
                        placeholder="Walk-in customer"
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        maxLength={254}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="For an invoice email"
                        autoComplete="email"
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        type="tel"
                        maxLength={40}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        autoComplete="tel"
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </section>
          <section className="panel quick-section">
            <div className="quick-section-heading">
              <span className="quick-step">2</span>
              <h3>What did we do?</h3>
              <span className="badge on">{selectedCount} selected</span>
            </div>
            <label className="module-search quick-service-search">
              <Search size={16} />
              <input
                aria-label="Find a service"
                placeholder="Find a service…"
                value={serviceSearch}
                onChange={(event) => setServiceSearch(event.target.value)}
              />
            </label>
            <div className="quick-service-grid">
              {data.services
                .filter((service: any) =>
                  service.name
                    .toLowerCase()
                    .includes(serviceSearch.toLowerCase()),
                )
                .map((service: any) => (
                  <button
                    type="button"
                    key={service.id}
                    aria-pressed={services.includes(service.id)}
                    className="quick-service"
                    onClick={() => {
                      setServices((previous) =>
                        previous.includes(service.id)
                          ? previous.filter((id) => id !== service.id)
                          : [...previous, service.id],
                      );
                      setManualPaid(false);
                    }}
                  >
                    <ServiceVisual service={service} />
                    <span>
                      <strong>{service.name}</strong>
                      <small>
                        {money(service.price_minor)} ·{" "}
                        {service.duration_minutes} min
                      </small>
                    </span>
                    {services.includes(service.id) && <Check size={18} />}
                  </button>
                ))}
              <button
                type="button"
                className="quick-service quick-other"
                aria-pressed={other}
                onClick={() => {
                  setOther(!other);
                  setManualPaid(false);
                }}
              >
                <Plus size={25} />
                <span>
                  <strong>Other service</strong>
                  <small>Enter the description and price</small>
                </span>
                {other && <Check size={18} />}
              </button>
            </div>
            {other && (
              <div className="quick-other-fields">
                <label>
                  Other service name
                  <input
                    required
                    maxLength={120}
                    value={otherName}
                    onChange={(event) => setOtherName(event.target.value)}
                  />
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1000000"
                    step="0.01"
                    required
                    value={otherPrice}
                    onChange={(event) => {
                      setOtherPrice(event.target.value);
                      setManualPaid(false);
                    }}
                  />
                </label>
              </div>
            )}
          </section>
          <section className="panel quick-section">
            <div className="quick-section-heading">
              <span className="quick-step">3</span>
              <h3>Who did it?</h3>
            </div>
            <div className="quick-team-grid">
              {team.map((person: any) => (
                <button
                  type="button"
                  key={person.id}
                  aria-pressed={employeeId === person.id}
                  onClick={() => setEmployee(person.id)}
                >
                  <EmployeeAvatar employee={person} />
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.title}</small>
                  </span>
                  {employeeId === person.id && <Check size={17} />}
                </button>
              ))}
            </div>
            {!team.length && (
              <p>
                No active team members at this location. Activate or add an
                employee first.
              </p>
            )}
          </section>
        </div>
        <section className="panel quick-checkout" aria-label="Visit payment">
          <div className="quick-section-heading">
            <span className="quick-step">4</span>
            <h3>Payment</h3>
          </div>
          <div className="quick-price-line">
            <span>Selected services</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <label className="quick-paid-label">
            Customer pays for services
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max={(subtotal / 100).toFixed(2)}
              step="0.01"
              required
              value={manualPaid ? paid : (subtotal / 100).toFixed(2)}
              onChange={(event) => {
                setPaid(event.target.value);
                setManualPaid(true);
              }}
            />
            <small>
              Before tax and tip. A lower amount automatically adds a discount.
            </small>
          </label>
          {discount > 0 && (
            <div className="quick-price-line quick-discount">
              <span>Discount applied</span>
              <strong>−{money(discount)}</strong>
            </div>
          )}
          <div className="quick-tip-toggle">
            <span>Add a tip?</span>
            <button
              type="button"
              aria-pressed={!hasTip}
              onClick={() => setHasTip(false)}
            >
              No
            </button>
            <button
              type="button"
              aria-pressed={hasTip}
              onClick={() => setHasTip(true)}
            >
              Yes
            </button>
          </div>
          {hasTip && (
            <label>
              Tip amount
              <input
                type="number"
                inputMode="decimal"
                required
                min="0.01"
                max="100000"
                step="0.01"
                value={tip}
                onChange={(event) => setTip(event.target.value)}
              />
            </label>
          )}
          <h4>Payment received by</h4>
          <div className="quick-payment-grid">
            {allowed.map((value: string) => (
              <button
                type="button"
                key={value}
                aria-pressed={paymentMethod === value}
                onClick={() => setMethod(value)}
              >
                <Wallet size={17} />
                {paymentLabels[value]}
              </button>
            ))}
          </div>
          {!allowed.length && (
            <p className="warning">
              The platform administrator must enable a manual payment method for
              this salon.
            </p>
          )}
          <div className="quick-total-breakdown">
            <div>
              <span>Services after discount</span>
              <span>{money(servicePaid)}</span>
            </div>
            {data.settings.tax_basis_points > 0 && (
              <div>
                <span>Tax ({data.settings.tax_basis_points / 100}%)</span>
                <span>{money(tax)}</span>
              </div>
            )}
            {hasTip && (
              <div>
                <span>Tip</span>
                <span>{money(tipMinor)}</span>
              </div>
            )}
            <div className="quick-grand-total">
              <strong>Total received</strong>
              <strong>{money(total)}</strong>
            </div>
          </div>
          <label className="checkbox quick-email-option">
            <input
              type="checkbox"
              checked={sendInvoice}
              disabled={!recipientEmail || !data.email_ready}
              onChange={(event) => setSendInvoice(event.target.checked)}
            />
            <span>
              <Mail size={16} />
              Email invoice to customer
              <small>
                {recipientEmail
                  ? data.email_ready
                    ? recipientEmail
                    : "Email delivery is not configured or enabled."
                  : "Select a customer with email, or add walk-in contact details."}
              </small>
            </span>
          </label>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary quick-record-button"
            disabled={busy || !valid}
          >
            {busy ? "Saving visit…" : `Record visit · ${money(total)}`}
            <CheckCircle2 size={18} />
          </button>
          {!canWrite && (
            <small>You need finance write access to record a visit.</small>
          )}
          <p className="quick-payment-note">
            This records completed work and a payment already received. Tips are
            tracked separately from service earnings.
          </p>
        </section>
      </form>
      <section className="panel quick-section quick-visitors">
        <div className="quick-section-heading">
          <h3>Today’s visitors</h3>
          <span className="badge">
            {visitors.data?.length || 0} completed visits
          </span>
          <small>
            {data.settings.today} · {data.settings.timezone}
          </small>
        </div>
        {visitors.isPending ? (
          <p role="status">Loading today’s visits…</p>
        ) : visitors.error ? (
          <p role="alert">{visitors.error.message}</p>
        ) : visitors.data?.length ? (
          <div className="quick-visitors-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Services</th>
                  <th>Team member</th>
                  <th>Payment</th>
                  <th>Received</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {visitors.data.map((visit: any) => (
                  <tr key={visit.source + visit.id}>
                    <td>{visit.time_label}</td>
                    <td>
                      <div className="module-identity">
                        <CustomerAvatar
                          customer={{
                            id: visit.customer_id,
                            name: visit.customer_name,
                            photo_media_id: visit.photo_media_id,
                          }}
                        />
                        <div>
                          <strong>{visit.customer_name}</strong>
                          <small>
                            {visit.source === "appointment"
                              ? "Scheduled visit"
                              : visit.customer_type === "walkin"
                                ? "Walk-in"
                                : "Returning customer"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{visit.services}</td>
                    <td>{visit.employee_name}</td>
                    <td>
                      {paymentLabels[visit.payment_method] || "See invoice"}
                    </td>
                    <td>
                      <strong>{money(visit.total_minor)}</strong>
                      {Number(visit.tip_minor) > 0 && (
                        <small>Includes {money(visit.tip_minor)} tip</small>
                      )}
                    </td>
                    <td>
                      {visit.order_id ? (
                        <button
                          className="secondary"
                          onClick={() => setInvoice(visit.order_id)}
                        >
                          <Receipt size={15} />
                          View
                        </button>
                      ) : (
                        <span className="badge warning">Awaiting checkout</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <UserPlus size={30} />
            <h3>Ready for the first visitor</h3>
            <p>Completed walk-ins and scheduled visits appear here.</p>
          </div>
        )}
        <small className="section-note">
          Shows the latest 200 completed visits today. Updates automatically.
        </small>
      </section>
      {customerOpen && (
        <CustomerPicker
          onClose={() => setCustomerOpen(false)}
          onSelect={(selected) => {
            setCustomer(selected);
            setCustomerOpen(false);
            setSendInvoice(false);
          }}
        />
      )}
      {invoice && <InvoiceDialog id={invoice} onClose={() => setInvoice("")} />}
    </div>
  );
}
function CustomerPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (customer: any) => void;
}) {
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["quick-customers", debounced],
    placeholderData: (previous) => previous,
    queryFn: () =>
      request("quick-work/customers?" + new URLSearchParams({ q: debounced })),
  });
  return (
    <Modal
      title="Choose a returning customer"
      onClose={onClose}
      className="quick-customer-dialog"
    >
      <label className="module-search quick-customer-search">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Search returning customers"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email or phone"
        />
        {search && (
          <button
            type="button"
            className="quick-search-clear"
            aria-label="Clear customer search"
            onClick={() => setSearch("")}
          >
            <X size={16} />
          </button>
        )}
      </label>
      <p className="quick-search-status" role="status">
        {query.isFetching
          ? "Searching…"
          : `${query.data?.length || 0} customers found`}
      </p>
      <div className="quick-customer-results" aria-busy={query.isFetching}>
        {query.isPending ? (
          <p role="status">Finding customers…</p>
        ) : query.error ? (
          <p role="alert">{query.error.message}</p>
        ) : query.data?.length ? (
          query.data.map((customer: any) => (
            <button
              type="button"
              key={customer.id}
              disabled={query.isPlaceholderData || debounced !== search}
              onClick={() => onSelect(customer)}
            >
              <CustomerAvatar customer={customer} />
              <span>
                <strong>{customer.name}</strong>
                <small>
                  {customer.phone || "No phone"}
                  {customer.email ? " · " + customer.email : ""}
                </small>
              </span>
              <Check size={17} />
            </button>
          ))
        ) : (
          <div className="empty">
            No match found. Try a shorter name, phone or email.
          </div>
        )}
      </div>
    </Modal>
  );
}
function InvoiceDialog({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <Modal title="Invoice" onClose={onClose} className="invoice-dialog">
      <InvoiceView id={id} />
    </Modal>
  );
}
