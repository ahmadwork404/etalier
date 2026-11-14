"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Mail, ArrowLeft, RefreshCw, ExternalLink } from "lucide-react";
import { useUrlParam } from "./UrlState";
import { toast } from "./Toasts";

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/v1/admin/leads" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Unable to load enquiries");
  return data.data;
}
type Lead = {
  id: string;
  name: string;
  email: string;
  salon_name: string;
  phone: string;
  team_size: string;
  message: string;
  status: string;
  admin_notes: string;
  notification_status: string;
  notification_attempts: number;
  notification_error: string;
  created_at: string;
  notified_at: string;
};
const statuses = ["new", "contacted", "qualified", "closed", "spam"];
function LeadDetail({ lead, onBack }: { lead: Lead; onBack: () => void }) {
  const cache = useQueryClient(),
    [status, setStatus] = useState(lead.status),
    [notes, setNotes] = useState(lead.admin_notes),
    [busy, setBusy] = useState(false);
  async function save(retry = false) {
    setBusy(true);
    try {
      await request(
        "/" + lead.id + (retry ? "/retry" : ""),
        retry ? "POST" : "PATCH",
        retry ? undefined : { status, admin_notes: notes },
      );
      await cache.invalidateQueries({ queryKey: ["admin-leads"] });
      toast.success(retry ? "Notification queued." : "Enquiry updated.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-lead-detail">
      <button className="secondary" onClick={onBack}>
        <ArrowLeft size={16} /> All enquiries
      </button>
      <div className="admin-lead-columns">
        <section className="panel">
          <span className="eyebrow">WEBSITE ENQUIRY</span>
          <h2>{lead.name}</h2>
          <p className="muted">{new Date(lead.created_at).toLocaleString()}</p>
          <dl className="admin-lead-facts">
            <div>
              <dt>Email</dt>
              <dd>
                <a href={"mailto:" + lead.email}>{lead.email}</a>
              </dd>
            </div>
            <div>
              <dt>Salon</dt>
              <dd>{lead.salon_name || "Not provided"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{lead.phone || "Not provided"}</dd>
            </div>
            <div>
              <dt>Team size</dt>
              <dd>{lead.team_size || "Not provided"}</dd>
            </div>
          </dl>
          <h3>Message</h3>
          <p className="admin-lead-message">{lead.message}</p>
          <a
            className="secondary"
            href={
              "mailto:" +
              lead.email +
              "?subject=" +
              encodeURIComponent("Your Etalier enquiry")
            }
          >
            <Mail size={16} /> Reply by email <ExternalLink size={14} />
          </a>
        </section>
        <section className="panel">
          <h2>Follow up</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Private notes
              <textarea
                rows={7}
                maxLength={10000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Record the next step or your conversation."
              />
            </label>
            <button disabled={busy}>Save changes</button>
          </form>
          <div className="admin-lead-delivery">
            <h3>Owner notification</h3>
            <p
              className={
                lead.notification_status === "failed" ? "error-box" : "muted"
              }
            >
              {lead.notification_status === "sent"
                ? "Sent to the lead notification inbox."
                : lead.notification_status === "failed"
                  ? lead.notification_error
                  : "Queued for delivery. Your enquiry is safely saved."}
            </p>
            {lead.notified_at && (
              <small>{new Date(lead.notified_at).toLocaleString()}</small>
            )}
            {lead.notification_status === "failed" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                <RefreshCw size={15} /> Retry notification
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
export function AdminLeads() {
  const [id, setId] = useUrlParam("lead"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-leads", "list", search, filter, page],
    queryFn: () =>
      request(
        "?" +
          new URLSearchParams({
            q: search,
            status: filter,
            page: String(page),
          }),
      ),
    refetchInterval: 30000,
  });
  const detail = useQuery({
    queryKey: ["admin-leads", id],
    queryFn: () => request("/" + id),
    enabled: !!id,
    refetchInterval: 30000,
  });
  if (id)
    return detail.isPending ? (
      <p role="status">Loading enquiry…</p>
    ) : detail.error ? (
      <div className="error-box" role="alert">
        {detail.error.message}
        <button onClick={() => setId("")}>Back to enquiries</button>
      </div>
    ) : (
      <LeadDetail key={id} lead={detail.data} onBack={() => setId("")} />
    );
  const data = query.data;
  return (
    <>
      <div className="admin-lead-stats">
        {[
          ["All enquiries", data?.summary.total],
          ["New", data?.summary.new],
          ["Qualified", data?.summary.qualified],
          ["Email delivery issues", data?.summary.failed],
        ].map(([label, value]) => (
          <section className="panel" key={label}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </section>
        ))}
      </div>
      <div className="list-toolbar">
        <form
          className="customer-search"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setSearch(String(form.get("search") || ""));
            setPage(1);
          }}
        >
          <Search size={17} />
          <input
            name="search"
            placeholder="Search name, email or salon"
            aria-label="Search enquiries"
          />
          <button className="secondary">Search</button>
        </form>
        <select
          aria-label="Filter enquiries by status"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {query.error && (
        <p className="error-box" role="alert">
          {query.error.message}
        </p>
      )}
      <div className="panel admin-lead-table">
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Salon</th>
              <th>Received</th>
              <th>Status</th>
              <th>Email notification</th>
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((lead: Lead) => (
              <tr key={lead.id}>
                <td>
                  <strong>{lead.name}</strong>
                  <small>{lead.email}</small>
                </td>
                <td>{lead.salon_name || "—"}</td>
                <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                <td>
                  <span className="badge">{lead.status}</span>
                </td>
                <td>{lead.notification_status}</td>
                <td>
                  <button className="secondary" onClick={() => setId(lead.id)}>
                    View enquiry
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.isPending ? (
          <p role="status">Loading enquiries…</p>
        ) : (
          !data?.items.length && (
            <div className="admin-lead-empty">
              <Mail size={28} />
              <h3>No enquiries here yet.</h3>
              <p>Messages from the website contact form will appear here.</p>
            </div>
          )
        )}
      </div>
      <div className="admin-lead-pagination">
        <span>{data?.total || 0} enquiries</span>
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
          disabled={!data || page * 25 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
