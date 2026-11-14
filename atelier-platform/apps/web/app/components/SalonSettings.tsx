"use client";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  CalendarDays,
  Wallet,
  Palette,
  ShieldCheck,
  Check,
} from "lucide-react";
import { CustomSelect } from "./CustomSelect";
import { toast } from "./Toasts";
async function request(body?: unknown) {
  const r = await fetch("/api/v1/settings", {
      method: body ? "PATCH" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    b = await r.json();
  if (!r.ok) throw Error(b.error?.message || "Unable to save settings");
  return b.data;
}
export function SalonSettings({ security }: { security: ReactNode }) {
  const query = useQuery({ queryKey: ["settings"], queryFn: () => request() });
  if (query.isPending)
    return <div className="loading">Loading salon settings…</div>;
  if (query.isError)
    return (
      <div className="error-box" role="alert">
        {query.error.message}
      </div>
    );
  const data = query.data;
  const timezones = Array.from(
    new Set([
      data.timezone,
      "Europe/Paris",
      "Europe/London",
      "Europe/Berlin",
      "Europe/Amsterdam",
      "Europe/Madrid",
      "Europe/Rome",
      "Europe/Lisbon",
      ...Intl.supportedValuesOf("timeZone"),
    ]),
  );
  return (
    <div className="salon-settings">
      <nav className="settings-index" aria-label="Settings sections">
        {[
          ["identity", "Salon profile", Building2],
          ["contact", "Contact details", MapPin],
          ["bookings", "Booking rules", CalendarDays],
          ["regional", "Currency & region", Wallet],
          ["appearance", "Booking appearance", Palette],
          ["security", "Account security", ShieldCheck],
        ].map(([id, label, Icon]: any) => (
          <a key={id} href={"#settings-" + id}>
            <Icon size={17} />
            {label}
          </a>
        ))}
      </nav>
      <div className="settings-sections">
        <div className="settings-salon-summary">
          <span className="settings-monogram">
            {data.name
              .split(" ")
              .slice(0, 2)
              .map((s: string) => s[0])
              .join("")}
          </span>
          <div>
            <h2>{data.name}</h2>
            <p>
              {data.currency} · {data.timezone}
            </p>
          </div>
          <span className="badge on">Private salon workspace</span>
        </div>
        <SettingsCard
          id="identity"
          title="Salon profile"
          description="The business name shown in your workspace and customer documents."
          initial={{ name: data.name }}
        >
          {(v, set) => (
            <label>
              Salon name
              <input
                required
                minLength={2}
                maxLength={100}
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
          )}
        </SettingsCard>
        <SettingsCard
          id="contact"
          title="Contact details"
          description="Give customers a clear way to reach your salon."
          initial={{
            contact_email: data.contact_email || "",
            phone: data.phone || "",
            address: data.address || "",
          }}
          body={(v) => ({
            ...v,
            contact_email: v.contact_email || null,
            phone: v.phone || null,
          })}
        >
          {(v, set) => (
            <>
              <div className="settings-fields">
                <label>
                  Business email
                  <input
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={v.contact_email}
                    onChange={(e) => set("contact_email", e.target.value)}
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={v.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Business address
                <textarea
                  rows={3}
                  maxLength={1000}
                  autoComplete="street-address"
                  value={v.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </label>
            </>
          )}
        </SettingsCard>
        <SettingsCard
          id="bookings"
          title="Booking rules"
          description="Set how far ahead customers can book and the cancellation window."
          initial={{
            booking_min_hours: data.booking_min_hours,
            booking_max_days: data.booking_max_days,
            cancel_hours: data.cancel_hours,
          }}
          body={(v) =>
            Object.fromEntries(
              Object.entries(v).map(([k, value]) => [k, Number(value)]),
            )
          }
        >
          {(v, set) => (
            <div className="settings-fields three">
              {[
                ["booking_min_hours", "Minimum notice", "hours", 0, 720],
                ["booking_max_days", "Book ahead up to", "days", 1, 730],
                ["cancel_hours", "Cancellation notice", "hours", 0, 720],
              ].map(([key, label, unit, min, max]) => (
                <label key={String(key)}>
                  {label}
                  <div className="settings-unit-input">
                    <input
                      required
                      type="number"
                      min={Number(min)}
                      max={Number(max)}
                      step="1"
                      value={v[String(key)]}
                      onChange={(e) => set(String(key), e.target.value)}
                    />
                    <span>{unit}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </SettingsCard>
        <SettingsCard
          id="regional"
          title="Currency & region"
          description="Use the salon’s local timezone for bookings, daily reporting and payroll."
          initial={{
            currency: data.currency,
            timezone: data.timezone,
            tax_percent: Number(data.tax_basis_points) / 100,
          }}
          body={(v) => ({
            currency: v.currency,
            timezone: v.timezone,
            tax_basis_points: Math.round(Number(v.tax_percent) * 100),
            ...(v.currency !== data.currency
              ? { currency_change_confirmed: true }
              : {}),
          })}
          confirmation={(v) =>
            v.currency !== data.currency
              ? `All existing amounts will use ${v.currency}. Their numbers will stay the same. No exchange rate will be applied. For example, 100 ${data.currency} will become 100 ${v.currency}.`
              : ""
          }
        >
          {(v, set) => (
            <div className="settings-fields">
              <label>
                Currency
                <CustomSelect
                  required
                  value={v.currency}
                  onChange={(e) => set("currency", e.target.value)}
                >
                  {Array.from(
                    new Set([
                      "EUR",
                      "GBP",
                      "CHF",
                      "USD",
                      "CAD",
                      "AUD",
                      "PKR",
                      "AED",
                      "SAR",
                      "INR",
                      data.currency,
                    ]),
                  ).map((code) => (
                    <option key={code} value={code}>
                      {code} ·{" "}
                      {new Intl.NumberFormat("en", {
                        style: "currency",
                        currency: code,
                      }).format(100)}
                    </option>
                  ))}
                </CustomSelect>
              </label>
              <label>
                Sales tax
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={v.tax_percent}
                  onChange={(e) => set("tax_percent", e.target.value)}
                />
                <small>Percentage applied to new invoices.</small>
              </label>
              <label className="settings-full">
                Salon timezone
                <CustomSelect
                  required
                  value={v.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                >
                  {timezones.map((zone) => (
                    <option value={zone} key={zone}>
                      {zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </CustomSelect>
              </label>
            </div>
          )}
        </SettingsCard>
        <SettingsCard
          id="appearance"
          title="Booking appearance"
          description="Choose the accent for your public booking page."
          initial={{ brand_color: data.brand_color }}
        >
          {(v, set) => (
            <div className="settings-swatches">
              {[
                ["Forest", "#234c40"],
                ["Sage", "#5c6d50"],
                ["Terracotta", "#8b5e49"],
                ["Charcoal", "#343c36"],
                ...(!["#234c40", "#5c6d50", "#8b5e49", "#343c36"].includes(
                  data.brand_color,
                )
                  ? [["Current", data.brand_color]]
                  : []),
              ].map(([name, color]) => (
                <button
                  type="button"
                  key={color}
                  aria-pressed={v.brand_color === color}
                  onClick={() => set("brand_color", color)}
                >
                  <span style={{ background: color }}>
                    {v.brand_color === color && <Check size={19} />}
                  </span>
                  {name}
                </button>
              ))}
            </div>
          )}
        </SettingsCard>
        <section id="settings-security" className="panel settings-card">
          <div className="settings-card-heading">
            <h3>Account security</h3>
            <p>
              Keep your account protected. Changing your password signs out
              existing sessions.
            </p>
          </div>
          {security}
        </section>
      </div>
    </div>
  );
}
function SettingsCard({
  id,
  title,
  description,
  initial,
  children,
  body,
  confirmation,
}: {
  id: string;
  title: string;
  description: string;
  initial: Record<string, any>;
  children: (v: any, set: (key: string, value: any) => void) => ReactNode;
  body?: (v: any) => unknown;
  confirmation?: (v: any) => string;
}) {
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const cache = useQueryClient();
  const changed = Object.entries(values).some(
      ([key, value]) => String(value ?? "") !== String(initial[key] ?? ""),
    ),
    warning = confirmation?.(values);
  return (
    <section id={"settings-" + id} className="panel settings-card">
      <div className="settings-card-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (warning && !confirmed) return;
          setBusy(true);
          setError("");
          try {
            const saved = await request(body ? body(values) : values);
            await cache.invalidateQueries();
            setValues(
              Object.fromEntries(
                Object.keys(values).map((key) => [
                  key,
                  key === "tax_percent"
                    ? Number(saved.tax_basis_points) / 100
                    : (saved[key] ?? ""),
                ]),
              ),
            );
            setConfirmed(false);
            toast.success(title + " saved.");
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {children(values, (key, value) => {
          setValues((previous) => ({ ...previous, [key]: value }));
          setConfirmed(false);
        })}
        {warning && (
          <div className="currency-change-warning">
            <strong>Confirm currency change</strong>
            <p>{warning}</p>
            <label className="payroll-checkbox">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I understand and want to change currency.
            </label>
          </div>
        )}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div className="settings-card-footer">
          <span>{changed ? "You have unsaved changes" : "Up to date"}</span>
          <button className="primary" disabled={!changed || busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
