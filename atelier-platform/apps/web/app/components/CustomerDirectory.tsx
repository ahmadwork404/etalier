"use client";
import { RecordActions, RecordDialog } from "./RecordActions";
import { CustomSelect } from "./CustomSelect";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Mail,
  Phone,
  Pencil,
  Copy,
  Search,
  SlidersHorizontal,
  X,
  Users,
} from "lucide-react";
import { useUrlParam, useUrlPage, replaceLocation, goToUrl } from "./UrlState";
import { CustomerAvatar } from "./CustomerPhoto";
import { DirectoryDetails } from "./DirectoryDetails";
import { toast } from "./Toasts";
type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  marketing_consent: boolean;
  created_at: string;
  photo_media_id?: string | null;
  tags?: string[];
};
async function getData(path: string) {
  const response = await fetch("/api/v1/" + path);
  const payload = await response.json();
  if (!response.ok)
    throw Error(payload.error?.message || "Unable to load customers");
  return payload.data;
}
async function copyContact(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(label + " copied");
  } catch {
    toast.error(
      "Could not copy " + label.toLowerCase() + ". Please try again.",
    );
  }
}
export function CustomerDirectory({
  tenantId,
  canEdit,
}: {
  tenantId: string;
  canEdit: boolean;
}) {
  const [search, setSearch] = useUrlParam("q");
  const [contact, setContact] = useUrlParam("contact", "all", (value) =>
    [
      "all",
      "email",
      "phone",
      "missing_email",
      "missing_phone",
      "none",
    ].includes(value),
  );
  const [consent, setConsent] = useUrlParam("consent", "all", (value) =>
    ["all", "yes", "no"].includes(value),
  );
  const [sort, setSort] = useUrlParam("sort", "name_asc", (value) =>
    ["name_asc", "name_desc", "newest", "oldest"].includes(value),
  );
  const [page, setPage] = useUrlPage();
  const [selected, setSelected] = useState<{
    customer: Customer;
    mode: "view" | "edit";
  } | null>(null);
  const params = new URLSearchParams({
    q: search,
    contact,
    consent,
    sort,
    page: String(page),
  });
  const customers = useQuery({
    queryKey: [
      "customer-table",
      tenantId,
      search,
      contact,
      consent,
      sort,
      page,
    ],
    queryFn: () => getData("customers?" + params),
  });
  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filtered =
    !!search || contact !== "all" || consent !== "all" || sort !== "name_asc";
  return (
    <>
      <section className="panel customer-directory">
        <div className="customer-table-toolbar">
          <label className="customer-search">
            <Search size={18} />
            <input
              aria-label="Search customers"
              placeholder="Search name, email or cellphone…"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button
            className="mobile-filter-toggle secondary"
            type="button"
            aria-expanded={mobileFiltersOpen}
            aria-controls="customer-directory-filters"
            onClick={() => setMobileFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={16} />
            Filters{filtered ? " · On" : ""}
          </button>
          <span className="customer-count">
            {customers.data
              ? `${customers.data.total} ${customers.data.total === 1 ? "customer" : "customers"}`
              : "Loading customers…"}
          </span>
        </div>
        <div
          id="customer-directory-filters"
          className={"customer-filters " + (mobileFiltersOpen ? "is-open" : "")}
        >
          <span className="filter-caption">
            <SlidersHorizontal size={16} />
            Filters
          </span>
          <label>
            Contact details
            <CustomSelect
              aria-label="Filter contact details"
              value={contact}
              onChange={(event) => updateFilter(setContact, event.target.value)}
            >
              <option value="all">All contact details</option>
              <option value="email">Has email</option>
              <option value="phone">Has cellphone</option>
              <option value="missing_email">Missing email</option>
              <option value="missing_phone">Missing cellphone</option>
              <option value="none">No contact details</option>
            </CustomSelect>
          </label>
          <label>
            Marketing consent
            <CustomSelect
              aria-label="Filter marketing consent"
              value={consent}
              onChange={(event) => updateFilter(setConsent, event.target.value)}
            >
              <option value="all">Any consent status</option>
              <option value="yes">Opted in</option>
              <option value="no">Not opted in</option>
            </CustomSelect>
          </label>
          <label>
            Sort by
            <CustomSelect
              aria-label="Sort customers"
              value={sort}
              onChange={(event) => updateFilter(setSort, event.target.value)}
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </CustomSelect>
          </label>
          {filtered && (
            <button
              className="text-button clear-filters"
              onClick={() => goToUrl("/customers")}
            >
              <X size={15} />
              Clear filters
            </button>
          )}
        </div>
        {customers.error ? (
          <div className="empty" role="alert">
            <p>{customers.error.message}</p>
            <button className="secondary" onClick={() => customers.refetch()}>
              Try again
            </button>
          </div>
        ) : customers.isPending ? (
          <div className="loading" role="status">
            Loading customers…
          </div>
        ) : (
          <>
            <div className="customer-cards">
              {customers.data.items.map((customer: Customer) => (
                <article className="customer-mobile-card" key={customer.id}>
                  <div className="customer-mobile-heading">
                    <CustomerAvatar customer={customer} />
                    <strong>{customer.name}</strong>
                    <div className="customer-table-actions">
                      <a
                        className="table-icon-button"
                        href={`/customers/${customer.id}`}
                        aria-label={`View ${customer.name}`}
                        onClick={(event) => {
                          if (event.ctrlKey || event.metaKey) return;
                          event.preventDefault();
                          goToUrl(`/customers/${customer.id}`);
                        }}
                      >
                        <Eye size={18} />
                      </a>
                      {canEdit && (
                        <button
                          className="table-icon-button"
                          aria-label={`Edit ${customer.name}`}
                          onClick={() =>
                            setSelected({ customer, mode: "edit" })
                          }
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                      {canEdit && (
                        <RecordActions
                          kind="customers"
                          row={customer}
                          deleteOnly
                        />
                      )}
                    </div>
                  </div>
                  <div className="customer-mobile-contacts">
                    {customer.email && (
                      <button
                        className="mobile-contact"
                        aria-label={`Copy email for ${customer.name}`}
                        title={customer.email}
                        onClick={() => copyContact(customer.email!, "Email")}
                      >
                        <Mail size={15} />
                        <span>{customer.email}</span>
                      </button>
                    )}
                    <button
                      className="mobile-contact"
                      disabled={!customer.phone}
                      aria-label={
                        customer.phone
                          ? `Copy cellphone for ${customer.name}`
                          : `No cellphone for ${customer.name}`
                      }
                      onClick={() =>
                        customer.phone &&
                        copyContact(customer.phone, "Cellphone")
                      }
                    >
                      <Phone size={15} />
                      <span>{customer.phone || "-"}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="customer-table-scroll">
              <table className="customer-table">
                <caption className="sr-only">
                  Customer contact directory
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Email</th>
                    <th scope="col">Cellphone</th>
                    <th scope="col" className="table-actions-heading">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.data.items.map((customer: Customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="customer-identity">
                          <CustomerAvatar customer={customer} />
                          <span>
                            <strong>{customer.name}</strong>
                          </span>
                        </div>
                      </td>
                      <td>
                        {customer.email ? (
                          <button
                            className="contact-copy"
                            title="Copy email"
                            aria-label={`Copy email for ${customer.name}`}
                            onClick={() =>
                              copyContact(customer.email!, "Email")
                            }
                          >
                            <span>{customer.email}</span>
                            <Copy size={14} />
                          </button>
                        ) : (
                          <span className="missing-contact">No email</span>
                        )}
                      </td>
                      <td>
                        {customer.phone ? (
                          <button
                            className="contact-copy"
                            title="Copy cellphone"
                            aria-label={`Copy cellphone for ${customer.name}`}
                            onClick={() =>
                              copyContact(customer.phone!, "Cellphone")
                            }
                          >
                            <span>{customer.phone}</span>
                            <Copy size={14} />
                          </button>
                        ) : (
                          <span className="missing-contact">-</span>
                        )}
                      </td>
                      <td>
                        <div className="customer-table-actions">
                          <a
                            className="table-icon-button"
                            href={`/customers/${customer.id}`}
                            title="View customer"
                            aria-label={`View ${customer.name}`}
                            onClick={(event) => {
                              if (event.ctrlKey || event.metaKey) return;
                              event.preventDefault();
                              goToUrl(`/customers/${customer.id}`);
                            }}
                          >
                            <Eye size={18} />
                          </a>
                          {canEdit && (
                            <button
                              className="table-icon-button"
                              title="Edit customer"
                              aria-label={`Edit ${customer.name}`}
                              onClick={() =>
                                setSelected({ customer, mode: "edit" })
                              }
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                          {canEdit && (
                            <RecordActions
                              kind="customers"
                              row={customer}
                              deleteOnly
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!customers.data.items.length && (
              <div className="empty">
                <Users size={30} />
                <h2>
                  {filtered
                    ? "No customers match your filters"
                    : "No customers yet"}
                </h2>
                <p>
                  {filtered
                    ? "Try another search or clear the filters."
                    : "Add your first customer to start building your directory."}
                </p>
                {filtered && (
                  <button
                    className="secondary"
                    onClick={() => goToUrl("/customers")}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            <div className="pagination">
              <span>
                {customers.data.total
                  ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, customers.data.total)} of ${customers.data.total}`
                  : "0 customers"}
              </span>
              <div className="row-actions">
                <button
                  className="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((previous) => previous - 1)}
                >
                  Previous
                </button>
                <span className="page-number">Page {page}</span>
                <button
                  className="secondary"
                  disabled={!customers.data.hasMore}
                  onClick={() => setPage((previous) => previous + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <RecordDialog kind="customers" rows={customers.data?.items || []} />
      {selected?.mode === "edit" && (
        <DirectoryDetails
          kind="customers"
          row={selected.customer}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
