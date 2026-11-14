"use client";
import { DateTimePicker } from "./DateTimePicker";
import { CustomSelect } from "./CustomSelect";
import { useCurrencySymbol } from "./Currency";
import { ToastNotice, toast } from "./Toasts";
import { RecordVisual } from "./RecordVisual";
import { CustomerPhotoUpload } from "./CustomerPhoto";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error?.message || "Request failed");
  if (method !== "GET") toast.success("Changes saved.");
  return d.data;
}
export function DirectoryDetails({
  kind,
  row,
  onClose,
}: {
  kind: string;
  row: any;
  onClose: () => void;
}) {
  const currencySymbol = useCurrencySymbol();
  const cache = useQueryClient(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Record details"
      >
        <div className="modal-heading">
          {kind !== "customers" && (
            <RecordVisual name={row.name} kind={kind} identity={row.id} />
          )}
          <h2>{row.name}</h2>
          <button aria-label="Close details" onClick={onClose}>
            <X />
          </button>
        </div>
        {kind === "customers" && <CustomerPhotoUpload customer={row} />}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const d: any = Object.fromEntries(new FormData(e.currentTarget));
            if (kind === "customers") {
              d.marketing_consent = d.marketing_consent === "on";
              d.tags = String(d.tags || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              if (!d.email) d.email = null;
              if (!d.birthday) d.birthday = null;
            }
            if (kind === "employees" && !d.email) d.email = null;
            if (kind === "services")
              for (const key of [
                "price_minor",
                "duration_minutes",
                "buffer_minutes",
              ])
                d[key] =
                  key === "price_minor"
                    ? Math.round(Number(d[key]) * 100)
                    : Number(d[key]);
            try {
              await api(kind + "/" + row.id, "PATCH", d);
              await cache.invalidateQueries();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Name
            <input name="name" defaultValue={row.name} required />
          </label>
          {kind === "customers" && (
            <>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={row.email || ""}
                />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" defaultValue={row.phone || ""} />
              </label>
              <label>
                Birthday
                <DateTimePicker
                  name="birthday"
                  type="date"
                  defaultValue={row.birthday?.slice(0, 10) || ""}
                />
              </label>
              <label>
                Tags (comma separated)
                <input name="tags" defaultValue={row.tags?.join(", ") || ""} />
              </label>
              <label>
                Customer notes
                <textarea name="notes" defaultValue={row.notes} />
              </label>
              <label>
                Preferred channel
                <CustomSelect
                  name="preferred_channel"
                  defaultValue={row.preferred_channel}
                >
                  {["email", "sms", "whatsapp", "none"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </CustomSelect>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="marketing_consent"
                  defaultChecked={row.marketing_consent}
                />
                Customer explicitly consented to marketing
              </label>
            </>
          )}
          {kind === "employees" && (
            <>
              <label>
                Title
                <input required name="title" defaultValue={row.title} />
              </label>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={row.email || ""}
                />
              </label>
              <label>
                Phone
                <input name="phone" defaultValue={row.phone || ""} />
              </label>
            </>
          )}
          {kind === "services" && (
            <>
              <label>
                Price ({currencySymbol})
                <input
                  name="price_minor"
                  type="number"
                  min="0"
                  required
                  defaultValue={Number(row.price_minor) / 100}
                />
              </label>
              <label>
                Duration (minutes)
                <input
                  name="duration_minutes"
                  type="number"
                  min="5"
                  required
                  defaultValue={row.duration_minutes}
                />
              </label>
              <label>
                Buffer (minutes)
                <input
                  name="buffer_minutes"
                  type="number"
                  min="0"
                  required
                  defaultValue={row.buffer_minutes}
                />
              </label>
            </>
          )}
          {error && <ToastNotice message={error} />}
          <div className="form-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save record"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
