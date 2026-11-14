"use client";
import { useEffect, useRef, useState } from "react";
import { CustomerAvatar } from "./CustomerPhoto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Eye,
  Send,
  ClipboardList,
  CheckCircle2,
  Clock3,
  Monitor,
  Link2,
  Pencil,
  X,
} from "lucide-react";
import { useUrlParam, goToUrl } from "./UrlState";
import { CustomSelect } from "./CustomSelect";
import { IntakeQuestions, type IntakeQuestion } from "./IntakeQuestions";
import { toast } from "./Toasts";
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
function navigate(form = "", screen = "", response = "") {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries({ form, screen, response })) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  goToUrl(url.pathname + url.search);
  window.scrollTo(0, 0);
}
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const freshQuestion = (): IntakeQuestion => ({
  key: "q_" + crypto.randomUUID().replaceAll("-", ""),
  label: "",
  type: "text",
  required: false,
});
function Loading({ query }: { query: any }) {
  return query.isPending ? (
    <div className="panel empty" role="status">
      Loading forms…
    </div>
  ) : query.error ? (
    <div className="panel empty" role="alert">
      <p>{query.error.message}</p>
      <button className="secondary" onClick={() => query.refetch()}>
        Try again
      </button>
    </div>
  ) : null;
}
function NewLinks({ links }: { links: any[] }) {
  return (
    <div className="intake-new-links">
      {links.map((link) => (
        <section className="panel intake-new-link" key={link.id}>
          <div>
            <strong>{link.customer_name || "New form link"}</strong>
            <span
              className={`badge ${link.status === "failed" ? "warning" : "on"}`}
            >
              {link.status === "sent"
                ? "Email sent"
                : link.status === "failed"
                  ? "Email failed · copy link instead"
                  : "Ready to share"}
            </span>
          </div>
          <p>
            Expires {date(link.expires_at)} · {link.max_uses} submission
            {link.max_uses === 1 ? "" : "s"} allowed
          </p>
          <div className="intake-copy-row">
            <input aria-label="New form link" readOnly value={link.url} />
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  toast.success("Link copied.");
                } catch {
                  toast.error("Select and copy the link manually.");
                }
              }}
            >
              <Copy size={16} />
              Copy
            </button>
            <a
              className="secondary"
              href={link.url}
              target="_blank"
              rel="noreferrer"
            >
              <Eye size={16} />
              Open form
            </a>
          </div>
          <small>
            Save this link now. For privacy, the full link is only shown when it
            is generated.
          </small>
        </section>
      ))}
    </div>
  );
}
function QuickCopyLink({
  formId,
  disabled = false,
}: {
  formId: string;
  disabled?: boolean;
}) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [fallback, setFallback] = useState("");
  async function copy() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const links = await request(`intake-forms/${formId}/links`, "POST", {
        delivery: "copy",
        expires_hours: 24,
        max_uses: 1,
        request_key: crypto.randomUUID(),
      });
      const url = links[0].url;
      try {
        await navigator.clipboard.writeText(url);
        setFallback("");
        toast.success("Link copied · valid for 24 hours · one submission.");
      } catch {
        setFallback(url);
        toast.error(
          "Your browser blocked automatic copying. Select and copy the link below.",
        );
      }
      await cache.invalidateQueries();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="intake-quick-copy">
      <button
        type="button"
        className="secondary"
        disabled={busy || disabled}
        title="Generate and copy a new single-use link valid for 24 hours"
        onClick={copy}
      >
        <Copy size={16} />
        {busy ? "Copying…" : "Copy link · 24 hours"}
      </button>
      {fallback && (
        <input
          aria-label="Form link to copy"
          readOnly
          value={fallback}
          onFocus={(event) => event.target.select()}
        />
      )}
    </div>
  );
}

export function IntakeForms() {
  const [id] = useUrlParam("form"),
    [screen] = useUrlParam("screen"),
    [response] = useUrlParam("response");
  const [fresh, setFresh] = useState<{ form: string; links: any[] } | null>(
    null,
  );
  const access = useQuery({
    queryKey: ["record-access"],
    queryFn: () => request("access"),
  });
  const canEdit = !!access.data?.permissions?.includes("forms.write");
  const list = useQuery({
    queryKey: ["intake-forms"],
    queryFn: () => request("intake-forms"),
    enabled: !id && screen !== "create",
  });
  const detail = useQuery({
    queryKey: ["intake-form", id],
    queryFn: () => request("intake-forms/" + id),
    enabled: !!id,
  });
  const [search, setSearch] = useState("");
  if (screen === "create")
    return (
      <IntakeBuilder
        canEdit={canEdit}
        onSaved={(result) => {
          setFresh({
            form: result.form.id,
            links: result.link ? [result.link] : [],
          });
          navigate(result.form.id);
        }}
      />
    );
  if (id) {
    if (detail.isPending || detail.error) return <Loading query={detail} />;
    if (screen === "edit")
      return (
        <IntakeBuilder
          key={id}
          initial={detail.data.form}
          canEdit={canEdit}
          onSaved={() => navigate(id)}
        />
      );
    if (screen === "send")
      return (
        <DistributeForm
          form={detail.data.form}
          emailConfigured={detail.data.email_configured}
          canEdit={canEdit}
          canSetUsage={!!access.data?.is_owner}
          onDone={(links) => {
            setFresh({ form: id, links });
            navigate(id);
          }}
        />
      );
    return (
      <>
        <FormDetail
          data={detail.data}
          canEdit={canEdit}
          freshLinks={fresh?.form === id ? fresh.links : []}
        />
        {response && <ResponseDialog id={response} canEdit={canEdit} />}
      </>
    );
  }
  return (
    <div className="intake-workspace">
      <div className="operation-heading">
        <div>
          <h2>Forms & responses</h2>
          <p>
            Create reusable intake forms, share secure links and review customer
            answers.
          </p>
        </div>
        {canEdit && (
          <button className="primary" onClick={() => navigate("", "create")}>
            <Plus size={17} />
            Create form
          </button>
        )}
      </div>
      <Loading query={list} />
      {list.data && (
        <>
          <div className="customer-value-metrics">
            <article className="panel value-metric">
              <span>
                <ClipboardList size={17} />
                Reusable forms
              </span>
              <strong>{list.data.length}</strong>
              <small>One template, many customers</small>
            </article>
            <article className="panel value-metric">
              <span>
                <CheckCircle2 size={17} />
                Customer responses
              </span>
              <strong>
                {list.data.reduce(
                  (sum: number, form: any) => sum + form.response_count,
                  0,
                )}
              </strong>
              <small>Answers live inside each form</small>
            </article>
            <article className="panel value-metric">
              <span>
                <Clock3 size={17} />
                Awaiting review
              </span>
              <strong>
                {list.data.reduce(
                  (sum: number, form: any) => sum + form.unreviewed_count,
                  0,
                )}
              </strong>
              <small>New answers to read</small>
            </article>
          </div>
          <label className="module-search intake-search">
            <input
              placeholder="Search forms…"
              aria-label="Search forms"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="intake-form-grid">
            {list.data
              .filter((form: any) =>
                form.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((form: any) => (
                <article className="panel intake-form-card" key={form.id}>
                  <div>
                    <ClipboardList size={23} />
                    <span className={`badge ${form.active ? "on" : "warning"}`}>
                      {form.active ? "Accepting responses" : "Archived"}
                    </span>
                  </div>
                  <h3>
                    <button
                      type="button"
                      className="intake-form-title"
                      onClick={() => navigate(form.id)}
                    >
                      {form.name}
                    </button>
                  </h3>
                  <p>{form.description || "Reusable customer intake form"}</p>
                  <div className="intake-card-counts">
                    <span>{form.fields.length} questions</span>
                    <span>{form.response_count} responses</span>
                    {form.unreviewed_count > 0 && (
                      <strong>{form.unreviewed_count} new</strong>
                    )}
                  </div>
                  <small>Created {date(form.created_at)}</small>
                  <div className="intake-card-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => navigate(form.id)}
                    >
                      <Eye size={16} />
                      View form
                    </button>
                    {canEdit && (
                      <QuickCopyLink formId={form.id} disabled={!form.active} />
                    )}
                  </div>
                </article>
              ))}
          </div>
          {!list.data.length && (
            <section className="panel empty">
              <ClipboardList size={32} />
              <h3>Your first intake form starts here</h3>
              <p>
                Create a form once, then send it to as many customers as needed.
              </p>
              {canEdit && (
                <button
                  className="primary"
                  onClick={() => navigate("", "create")}
                >
                  Create form
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function IntakeBuilder({
  initial,
  canEdit,
  onSaved,
}: {
  initial?: any;
  canEdit: boolean;
  onSaved: (result: any) => void;
}) {
  const cache = useQueryClient();
  const [name, setName] = useState(initial?.name || ""),
    [description, setDescription] = useState(initial?.description || ""),
    [fields, setFields] = useState<IntakeQuestion[]>(
      initial?.fields || [freshQuestion()],
    ),
    [preview, setPreview] = useState(false),
    [answers, setAnswers] = useState<Record<string, string | boolean>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [activeQuestion, setActiveQuestion] = useState(-1);
  function jumpTo(index: number) {
    setActiveQuestion(index);
    const section = document.getElementById(
      index < 0
        ? "intake-builder-details"
        : "intake-builder-" + fields[index]?.key,
    );
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    section
      ?.querySelector<HTMLInputElement>("input,textarea")
      ?.focus({ preventScroll: true });
  }
  const update = (index: number, changes: Partial<IntakeQuestion>) =>
    setFields((previous) =>
      previous.map((field, i) =>
        i === index ? { ...field, ...changes } : field,
      ),
    );
  const move = (index: number, delta: number) =>
    setFields((previous) => {
      const next = [...previous];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  if (!canEdit)
    return (
      <section className="panel empty">
        You need form management permission to create or edit forms.
      </section>
    );
  return (
    <div className="intake-workspace">
      <button
        className="secondary intake-back"
        onClick={() => navigate(initial?.id || "")}
      >
        <ArrowLeft size={16} />
        {initial ? "Back to form" : "Back to forms"}
      </button>
      <div className="operation-heading">
        <div>
          <h2>{initial ? "Edit form" : "Create a reusable intake form"}</h2>
          <p>
            {initial
              ? "Existing links and submitted answers keep their original questions."
              : "Build the form, preview it, then share it with your customers."}
          </p>
        </div>
        <button className="secondary" onClick={() => setPreview(!preview)}>
          <Eye size={16} />
          {preview ? "Back to builder" : "Preview form"}
        </button>
      </div>
      {preview ? (
        <section className="panel intake-preview">
          <span className="eyebrow">PREVIEW · ANSWERS ARE NOT SAVED</span>
          <h2>{name || "Untitled form"}</h2>
          <p>{description}</p>
          <IntakeQuestions
            questions={fields.map((field, index) => ({
              ...field,
              label: field.label || `Question ${index + 1}`,
            }))}
            answers={answers}
            onChange={(key, value) =>
              setAnswers((previous) => ({ ...previous, [key]: value }))
            }
          />
        </section>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const body = {
                name,
                description,
                fields: fields.map((field) => ({
                  ...field,
                  ...(field.type === "select"
                    ? {
                        options: (field.options || [])
                          .map((option) => option.trim())
                          .filter(Boolean),
                      }
                    : { options: undefined }),
                })),
                active: initial?.active ?? true,
              };
              const result = await request(
                "intake-forms" + (initial ? "/" + initial.id : ""),
                initial ? "PATCH" : "POST",
                body,
              );
              await cache.invalidateQueries();
              toast.success(
                initial
                  ? "Form updated."
                  : "Form created. Your first link is ready.",
              );
              onSaved(result);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <nav
            className="intake-question-nav panel"
            aria-label="Form question navigation"
          >
            <CustomSelect
              aria-label="Jump to form question"
              value={String(activeQuestion)}
              onChange={(event) => jumpTo(Number(event.target.value))}
            >
              <option value="-1">Form details</option>
              {fields.map((field, index) => (
                <option value={index} key={field.key}>
                  {index + 1}. {field.label || "Untitled question"}
                </option>
              ))}
            </CustomSelect>
            <div>
              <button
                type="button"
                className="secondary"
                disabled={activeQuestion < 0}
                onClick={() => jumpTo(activeQuestion - 1)}
              >
                <ArrowLeft size={16} />
                Previous
              </button>
              <span>
                {activeQuestion < 0
                  ? "Details"
                  : `${activeQuestion + 1} / ${fields.length}`}
              </span>
              <button
                type="button"
                className="secondary"
                disabled={activeQuestion >= fields.length - 1}
                onClick={() => jumpTo(activeQuestion + 1)}
              >
                Next
                <ArrowDown size={16} />
              </button>
            </div>
          </nav>
          <section
            className="panel intake-editor-section"
            id="intake-builder-details"
            onFocusCapture={() => setActiveQuestion(-1)}
          >
            <h3>Form details</h3>
            <label>
              Form name
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. First visit consultation"
              />
            </label>
            <label>
              Introduction <small>Optional</small>
              <textarea
                maxLength={2000}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell customers what this form is for."
              />
            </label>
          </section>
          <div className="intake-builder-questions">
            {fields.map((field, index) => (
              <section
                className="panel intake-editor-section"
                key={field.key}
                id={"intake-builder-" + field.key}
                onFocusCapture={() => setActiveQuestion(index)}
              >
                <div className="intake-question-heading">
                  <strong>Question {index + 1}</strong>
                  <div>
                    <button
                      type="button"
                      aria-label={`Move question ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move question ${index + 1} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove question ${index + 1}`}
                      disabled={fields.length === 1}
                      onClick={() =>
                        setFields((previous) =>
                          previous.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <label>
                  Question
                  <input
                    required
                    maxLength={200}
                    value={field.label}
                    onChange={(event) =>
                      update(index, { label: event.target.value })
                    }
                    placeholder="What would you like to ask?"
                  />
                </label>
                <div className="intake-question-settings">
                  <label>
                    Answer type
                    <CustomSelect
                      value={field.type}
                      onChange={(event) =>
                        update(index, {
                          type: event.target.value,
                          ...(event.target.value === "select"
                            ? { options: ["Option 1", "Option 2"] }
                            : { options: undefined }),
                        })
                      }
                    >
                      {[
                        ["text", "Short answer"],
                        ["textarea", "Long answer"],
                        ["email", "Email address"],
                        ["phone", "Phone number"],
                        ["number", "Number"],
                        ["select", "Multiple choice"],
                        ["checkbox", "Yes / no checkbox"],
                        ["date", "Date"],
                        ["consent", "Consent confirmation"],
                      ].map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </CustomSelect>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) =>
                        update(index, { required: event.target.checked })
                      }
                    />
                    Required
                  </label>
                </div>
                {field.type === "select" && (
                  <label>
                    Choices <small>One choice per line · up to 30</small>
                    <textarea
                      required
                      rows={4}
                      value={field.options?.join("\n") || ""}
                      onChange={(event) =>
                        update(index, {
                          options: event.target.value.split("\n"),
                        })
                      }
                    />
                  </label>
                )}
              </section>
            ))}
          </div>
          <button
            type="button"
            className="secondary"
            disabled={fields.length >= 50}
            onClick={() =>
              setFields((previous) => [...previous, freshQuestion()])
            }
          >
            <Plus size={16} />
            Add question
          </button>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions intake-save-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => navigate(initial?.id || "")}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy
                ? "Saving…"
                : initial
                  ? "Save form"
                  : "Create form & first link"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function FormDetail({
  data,
  canEdit,
  freshLinks,
}: {
  data: any;
  canEdit: boolean;
  freshLinks: any[];
}) {
  const { form, links } = data;
  const cache = useQueryClient();
  const [tab, setTab] = useState("responses"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false);
  const [responsePage, setResponsePage] = useState(1);
  const responseQuery = useQuery({
    queryKey: ["intake-responses", form.id, search, responsePage],
    queryFn: () =>
      request(
        `intake-forms/${form.id}/responses?${new URLSearchParams({ q: search, page: String(responsePage) })}`,
      ),
    enabled: tab === "responses",
  });
  const responses = responseQuery.data?.items || [];
  async function archive() {
    setBusy(true);
    try {
      await request("intake-forms/" + form.id, "PATCH", {
        name: form.name,
        description: form.description,
        fields: form.fields,
        active: !form.active,
      });
      await cache.invalidateQueries();
      toast.success(
        form.active ? "Form archived. All links are paused." : "Form reopened.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="intake-workspace">
      <button className="secondary intake-back" onClick={() => navigate()}>
        <ArrowLeft size={16} />
        All forms & responses
      </button>
      <section className="panel intake-detail-header intake-form-header">
        <div>
          <span className={`badge ${form.active ? "on" : "warning"}`}>
            {form.active ? "Accepting responses" : "Archived"}
          </span>
          <h2>{form.name}</h2>
          <p className="intake-description">
            {form.description || "A reusable intake form for your customers."}
          </p>
          <small>
            Created {date(form.created_at)} · Updated {date(form.updated_at)}
          </small>
        </div>
        {canEdit && (
          <div className="intake-header-actions">
            <QuickCopyLink formId={form.id} disabled={!form.active} />
            <button
              className="secondary"
              onClick={() => navigate(form.id, "edit")}
            >
              <Pencil size={16} />
              Edit form
            </button>
            <button
              className="primary"
              disabled={!form.active}
              onClick={() => navigate(form.id, "send")}
            >
              <Send size={16} />
              Share & send
            </button>
            <button className="text-button" disabled={busy} onClick={archive}>
              {form.active ? "Archive form" : "Reopen form"}
            </button>
          </div>
        )}
      </section>
      {!!freshLinks.length && <NewLinks links={freshLinks} />}
      <div className="customer-value-metrics">
        <article className="panel value-metric">
          <span>Questions</span>
          <strong>{form.fields.length}</strong>
          <small>Reuse this form for many customers</small>
        </article>
        <article className="panel value-metric">
          <span>Responses</span>
          <strong>{data.summary.responses}</strong>
          <small>{data.summary.unreviewed} awaiting review</small>
        </article>
        <article className="panel value-metric">
          <span>Available links</span>
          <strong>
            {form.active
              ? links.filter((link: any) => link.status === "active").length
              : 0}
          </strong>
          <small>Expiry and usage limits are enforced</small>
        </article>
      </div>
      <div
        className="tabs intake-tabs"
        role="tablist"
        aria-label="Form detail sections"
      >
        {[
          ["responses", "Customer answers"],
          ["preview", "Form preview"],
          ["links", "Links & deliveries"],
        ].map(([value, label]) => (
          <button
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "preview" ? (
        <FormPreview form={form} />
      ) : tab === "responses" ? (
        <section className="panel intake-section">
          <div className="intake-section-heading">
            <h3>Customer answers</h3>
            <input
              aria-label="Search customer responses"
              placeholder="Search customers…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setResponsePage(1);
              }}
            />
          </div>
          <Loading query={responseQuery} />
          <div className="intake-response-list">
            {responses.map((response: any) => (
              <button
                className="intake-response-row"
                key={response.id}
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("response", response.id);
                  goToUrl(url.pathname + url.search);
                }}
              >
                <ResponseAvatar response={response} />
                <div>
                  <strong>{response.customer_name}</strong>
                  <small>{date(response.created_at)}</small>
                </div>
                <span className="intake-device-brief">
                  <Monitor size={15} />
                  {response.device?.browser || "Device not recorded"}
                  {response.device?.os ? " · " + response.device.os : ""}
                </span>
                <span
                  className={`badge ${response.reviewed ? "on" : "warning"}`}
                >
                  {response.reviewed ? "Reviewed" : "New response"}
                </span>
                <Eye size={17} />
              </button>
            ))}
          </div>
          {!responseQuery.isPending &&
            !responseQuery.error &&
            !responses.length && (
              <div className="empty">
                <ClipboardList size={30} />
                <h3>{search ? "No matching responses" : "No responses yet"}</h3>
                <p>
                  Share this form with a customer. Their answers will appear
                  here.
                </p>
              </div>
            )}
          {responseQuery.data && (
            <div className="pagination">
              <button
                className="secondary"
                disabled={responsePage === 1}
                onClick={() => setResponsePage((value) => value - 1)}
              >
                Previous
              </button>
              <span>
                Page {responsePage} · {responseQuery.data.total} responses
              </span>
              <button
                className="secondary"
                disabled={!responseQuery.data.hasMore}
                onClick={() => setResponsePage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel intake-section">
          <h3>Links & delivery history</h3>
          <p className="section-note">
            Copyable links last at most 24 hours. Customer emails can use 48
            hours. Each customer receives a separate link.
          </p>
          <div className="intake-link-history">
            {links.map((link: any) => (
              <article key={link.id}>
                <div>
                  <strong>
                    {link.customer_name || "Anyone with the link"}
                  </strong>
                  <small>Created {date(link.created_at)}</small>
                  <small>Expires {date(link.expires_at)}</small>
                </div>
                <div>
                  <span
                    className={`badge ${link.status === "active" && form.active ? "on" : "warning"}`}
                  >
                    {!form.active ? "Form archived" : link.status}
                  </span>
                  <small>
                    {link.uses} / {link.max_uses} submissions ·{" "}
                    {link.delivery === "email"
                      ? "Email " + link.delivery_status
                      : "Copyable link"}
                  </small>
                </div>
                {canEdit && link.status === "active" && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await request(
                          `intake-forms/${form.id}/links/${link.id}/revoke`,
                          "POST",
                          {},
                        );
                        await cache.invalidateQueries();
                        toast.success("Link revoked.");
                      } catch (error) {
                        toast.error((error as Error).message);
                      }
                    }}
                  >
                    Revoke
                  </button>
                )}
              </article>
            ))}
          </div>
          {!links.length && <p>No links generated yet.</p>}
          <small>
            Showing up to the 200 most recent links. Full URLs are shown only
            when generated.
          </small>
        </section>
      )}
    </div>
  );
}
function FormPreview({ form }: { form: any }) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  return (
    <section className="panel intake-preview">
      <span className="eyebrow">FORM PREVIEW · ANSWERS ARE NOT SAVED</span>
      <h2>{form.name}</h2>
      <p className="intake-description">{form.description}</p>
      <IntakeQuestions
        questions={form.fields}
        answers={answers}
        onChange={(key, value) =>
          setAnswers((previous) => ({ ...previous, [key]: value }))
        }
      />
    </section>
  );
}

function DistributeForm({
  form,
  emailConfigured,
  canEdit,
  canSetUsage,
  onDone,
}: {
  form: any;
  emailConfigured: boolean;
  canEdit: boolean;
  canSetUsage: boolean;
  onDone: (links: any[]) => void;
}) {
  const cache = useQueryClient();
  const [delivery, setDelivery] = useState("copy"),
    [hours, setHours] = useState("24"),
    [uses, setUses] = useState(1),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Record<string, any>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const customers = useQuery({
    queryKey: ["intake-recipients", search],
    queryFn: () => request("customers?" + new URLSearchParams({ q: search })),
    enabled: canEdit,
  });
  const customerIds = Object.keys(selected);
  if (!canEdit)
    return <p>You need form management permission to share forms.</p>;
  return (
    <div className="intake-workspace">
      <button
        className="secondary intake-back"
        onClick={() => navigate(form.id)}
      >
        <ArrowLeft size={16} />
        Back to form
      </button>
      <div>
        <h2>Share {form.name}</h2>
        <p>
          Use a copyable link, or send a unique private link to each selected
          customer.
        </p>
      </div>
      <form
        className="panel intake-section"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const links = await request(
              `intake-forms/${form.id}/links`,
              "POST",
              {
                delivery,
                customer_ids: customerIds,
                expires_hours: Number(hours),
                max_uses: uses,
                request_key: requestKey,
              },
            );
            setRequestKey(crypto.randomUUID());
            await cache.invalidateQueries();
            onDone(links);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="intake-delivery-options">
          <button
            type="button"
            className={delivery === "copy" ? "selected" : ""}
            onClick={() => {
              setDelivery("copy");
              setHours((value) => (Number(value) > 24 ? "24" : value));
            }}
          >
            <Link2 size={22} />
            <strong>Copy a link</strong>
            <small>Up to 24 hours · share it yourself</small>
          </button>
          <button
            type="button"
            className={delivery === "email" ? "selected" : ""}
            onClick={() => setDelivery("email")}
          >
            <Send size={22} />
            <strong>Send to customers</strong>
            <small>Individual emails · up to 48 hours</small>
          </button>
        </div>
        {delivery === "email" && !emailConfigured && (
          <p className="warning">
            Email delivery is not configured. Configure Resend in Integrations
            before sending, or copy a link instead.
          </p>
        )}
        <div className="intake-link-settings">
          <label>
            Link expires after
            <CustomSelect
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            >
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              {delivery === "email" && <option value="48">48 hours</option>}
            </CustomSelect>
          </label>
          <label>
            Maximum submissions per link
            <input
              type="number"
              min={1}
              max={100}
              disabled={!canSetUsage}
              required
              value={uses}
              onChange={(event) => setUses(Number(event.target.value))}
            />
            <small>
              One use by default. Choose a higher limit only when needed.
            </small>
          </label>
        </div>
        <h3>
          {delivery === "email"
            ? "Select recipients"
            : "Assign to customers (optional)"}
        </h3>
        <p className="section-note">
          {delivery === "email"
            ? "The system sends an email immediately when you click Send. Each customer receives their own link."
            : "Leave empty for a general link that asks for name and email. Selecting customers creates a separate link for each."}
        </p>
        <input
          aria-label="Search customers for form"
          placeholder="Search customers by name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="intake-selected-customers">
          {Object.values(selected).map((customer: any) => (
            <button
              type="button"
              key={customer.id}
              onClick={() =>
                setSelected((previous) => {
                  const next = { ...previous };
                  delete next[customer.id];
                  return next;
                })
              }
            >
              {customer.name} ×
            </button>
          ))}
        </div>
        <Loading query={customers} />
        <div className="intake-customer-picker">
          {customers.data?.items.map((customer: any) => {
            const unavailable =
              delivery === "email" &&
              (!customer.email || customer.preferred_channel === "none");
            return (
              <label className="checkbox" key={customer.id}>
                <input
                  type="checkbox"
                  checked={!!selected[customer.id]}
                  disabled={
                    unavailable ||
                    (!selected[customer.id] && customerIds.length >= 50)
                  }
                  onChange={(event) =>
                    setSelected((previous) => {
                      const next = { ...previous };
                      if (event.target.checked) next[customer.id] = customer;
                      else delete next[customer.id];
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.email || "No email address"}
                    {customer.preferred_channel === "none"
                      ? " · Contact disabled"
                      : ""}
                  </small>
                </span>
              </label>
            );
          })}
        </div>
        <small>
          Search to find more customers · {customerIds.length} selected · up to
          50 per send
        </small>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => navigate(form.id)}
          >
            Cancel
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !form.active ||
              (delivery === "email" &&
                (!emailConfigured || !customerIds.length))
            }
          >
            {busy
              ? "Processing…"
              : delivery === "email"
                ? `Send to ${customerIds.length} customer${customerIds.length === 1 ? "" : "s"}`
                : "Generate secure link" + (customerIds.length > 1 ? "s" : "")}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResponseAvatar({ response }: { response: any }) {
  return (
    <CustomerAvatar
      customer={{
        id: response.customer_id || response.id,
        name: response.customer_name,
        photo_media_id: response.photo_media_id,
      }}
      photoUrl={
        response.customer_id && response.photo_media_id
          ? `/api/v1/intake-responses/${response.id}/photo?v=${response.photo_media_id}`
          : undefined
      }
    />
  );
}
function ResponseDialog({ id, canEdit }: { id: string; canEdit: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("response");
    goToUrl(url.pathname + url.search);
  };
  useEffect(() => {
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="record-dialog modal intake-response-dialog"
      aria-labelledby="intake-response-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-heading intake-response-modal-heading">
        <h2 id="intake-response-dialog-title">Customer answers</h2>
        <button
          type="button"
          aria-label="Close customer answers"
          onClick={close}
        >
          <X />
        </button>
      </div>
      <ResponseDetail id={id} canEdit={canEdit} />
    </dialog>
  );
}
function ResponseDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["intake-response", id],
    queryFn: () => request("intake-responses/" + id),
  });
  const [busy, setBusy] = useState(false);
  if (query.isPending || query.error) return <Loading query={query} />;
  const response = query.data,
    device = response.device || {};
  return (
    <div className="intake-workspace">
      <section className="panel intake-detail-header">
        <ResponseAvatar response={response} />
        <div>
          <span className="eyebrow">CUSTOMER RESPONSE</span>
          <h2>{response.customer_name}</h2>
          <p>
            {response.form_name} · Submitted {date(response.created_at)}
          </p>
          {response.customer_email && <p>{response.customer_email}</p>}
        </div>
        <span className={`badge ${response.reviewed ? "on" : "warning"}`}>
          {response.reviewed ? "Reviewed" : "Awaiting review"}
        </span>
        {canEdit && (
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await request("intake-responses/" + id, "PATCH", {
                  reviewed: !response.reviewed,
                });
                await cache.invalidateQueries();
                toast.success(
                  response.reviewed
                    ? "Marked as unreviewed."
                    : "Response reviewed.",
                );
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {response.reviewed ? "Mark unreviewed" : "Mark reviewed"}
          </button>
        )}
      </section>
      <section className="panel intake-section">
        <h3>Customer answers</h3>
        <dl className="intake-answer-list">
          {response.questions.map((question: IntakeQuestion, index: number) => {
            const value = response.answers[question.key];
            return (
              <div key={question.key}>
                <dt>
                  <small>{index + 1}.</small> {question.label}
                </dt>
                <dd>
                  {typeof value === "boolean"
                    ? value
                      ? "Yes / confirmed"
                      : "No"
                    : value === undefined || value === ""
                      ? "Not answered"
                      : question.type === "date"
                        ? new Date(value + "T12:00:00").toLocaleDateString(
                            undefined,
                            { dateStyle: "long" },
                          )
                        : String(value)}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
      <section className="panel intake-section">
        <h3>
          <Monitor size={18} />
          Submission device
        </h3>
        {Object.keys(device).length ? (
          <>
            <dl className="record-detail-grid">
              {[
                ["type", "Device type"],
                ["os", "Operating system"],
                ["browser", "Browser"],
                ["screen", "Screen dimensions"],
                ["language", "Language"],
                ["timezone", "Timezone"],
              ].map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{device[key] || "Not provided"}</dd>
                </div>
              ))}
            </dl>
            <small>
              Browser and device information is indicative and can be changed by
              the submitting device. Screen, language and timezone are reported
              by the customer’s browser.
            </small>
            {device.user_agent && (
              <details>
                <summary>Browser identifier</summary>
                <p className="intake-user-agent">{device.user_agent}</p>
              </details>
            )}
          </>
        ) : (
          <p>Device details were not recorded for this older response.</p>
        )}
      </section>
    </div>
  );
}
