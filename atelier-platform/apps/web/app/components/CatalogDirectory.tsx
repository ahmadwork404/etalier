"use client";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ModuleRecords } from "./ModuleRecords";
import { CustomSelect } from "./CustomSelect";
import { useUrlParam, useUrlPage } from "./UrlState";
import { useMoney } from "./Currency";
import { ServiceProfile } from "./ServiceProfile";
import { EmployeeProfile } from "./EmployeeProfile";
import { EmployeeStatus } from "./EmployeeStatus";

export function CatalogDirectory({ kind }: { kind: "employees" | "services" }) {
  const [record] = useUrlParam("record");
  const [search, setSearch] = useUrlParam("q");
  const [status, setStatus] = useUrlParam("status", "all", (value) =>
    ["all", "active", "inactive"].includes(value),
  );
  const [sort, setSort] = useUrlParam("sort", "name_asc", (value) =>
    ["name_asc", "name_desc"].includes(value),
  );
  const [page, setPage] = useUrlPage(),
    money = useMoney();
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: async () => {
      const response = await fetch("/api/v1/access");
      const payload = await response.json();
      if (!response.ok)
        throw Error(payload.error?.message || "Unable to load access");
      return payload.data;
    },
  });
  const result = useQuery({
    queryKey: ["catalog", kind, search, status, sort, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/${kind}?${new URLSearchParams({ q: search, status, sort, page: String(page) })}`,
      );
      const payload = await response.json();
      if (!response.ok)
        throw Error(payload.error?.message || "Unable to load records");
      return payload.data;
    },
  });
  if (kind === "services" && record) return <ServiceProfile id={record} />;
  if (kind === "employees" && record)
    return <EmployeeProfile key={record} id={record} />;
  return (
    <section className="panel module-directory">
      <div className="module-filter-bar">
        <label className="module-search">
          <Search size={17} />
          <input
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}…`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="module-filter-options">
          <CustomSelect
            aria-label="Filter status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </CustomSelect>
          <CustomSelect
            aria-label="Sort records"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
          </CustomSelect>
        </div>
      </div>
      {result.isPending ? (
        <div className="empty">Loading {kind}…</div>
      ) : result.error ? (
        <div className="empty" role="alert">
          <p>{result.error.message}</p>
          <button className="secondary" onClick={() => result.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="module-result-summary">
            <span>
              {result.data.total ?? result.data.items.length} {kind}
            </span>
            {(search || status !== "all") && (
              <button
                className="text-button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <ModuleRecords
            kind={kind}
            rows={result.data.items}
            label={kind === "employees" ? "Employees" : "Services"}
            columns={
              kind === "services"
                ? [
                    {
                      label: "Duration",
                      render: (row) => (
                        <span>
                          {row.duration_minutes} min
                          {row.buffer_minutes > 0 && (
                            <small> + {row.buffer_minutes} min buffer</small>
                          )}
                        </span>
                      ),
                    },
                    {
                      label: "Price",
                      render: (row) => (
                        <strong>{money(row.price_minor)}</strong>
                      ),
                    },
                    {
                      label: "Status",
                      render: (row) => (
                        <span
                          className={`badge ${row.active ? "on" : "warning"}`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      ),
                    },
                  ]
                : [
                    {
                      label: "Contact",
                      render: (row) => (
                        <div className="employee-table-contact">
                          <span>{row.email || "Email missing"}</span>
                          <small>{row.phone || "Phone missing"}</small>
                        </div>
                      ),
                    },
                    {
                      label: "Location",
                      render: (row) => <span>{row.branch_name || "—"}</span>,
                    },
                    {
                      label: "Working week",
                      render: (row) => (
                        <span>{row.working_days || 0} days</span>
                      ),
                    },
                    {
                      label: "Status",
                      render: (row) => (
                        <EmployeeStatus
                          employee={row}
                          canEdit={
                            !!access.data?.permissions.includes(
                              "employees.write",
                            )
                          }
                        />
                      ),
                    },
                  ]
            }
            detail={(row) =>
              kind === "employees" ? row.title || "Team member" : "Treatment"
            }
          />
          <div className="pagination">
            <button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="secondary"
              disabled={!result.data.hasMore}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
