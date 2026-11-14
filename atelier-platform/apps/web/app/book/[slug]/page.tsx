"use client";
import { BrandStar } from "../../components/BrandStar";
import { DateTimePicker } from "../../components/DateTimePicker";
import { CustomSelect } from "../../components/CustomSelect";
import { ToastNotice, toast } from "../../components/Toasts";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
export default function Booking() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null),
    [selected, setSelected] = useState<string[]>([]),
    [branch, setBranch] = useState(""),
    [employee, setEmployee] = useState(""),
    [date, setDate] = useState(""),
    [availability, setAvailability] = useState<any>(null),
    [error, setError] = useState(""),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/v1/booking/" + encodeURIComponent(slug))
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error.message);
        setData(d.data);
      })
      .catch((e) => setError(e.message));
  }, [slug]);
  useEffect(() => {
    const controller = new AbortController();
    setAvailability(null);
    if (employee && date) {
      fetch(
        "/api/v1/booking/" +
          encodeURIComponent(slug) +
          "/availability?employee_id=" +
          employee +
          "&date=" +
          date,
        { signal: controller.signal },
      )
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw Error(d.error.message);
          setAvailability(d.data);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }
    return () => controller.abort();
  }, [employee, date, slug]);
  return (
    <main className="customer-page">
      <a className="brand" href="/">
        etalier<span><BrandStar /></span>
      </a>
      <section className="panel customer-panel">
        {data ? (
          <>
            <span className="eyebrow">{data.salon.name}</span>
            <h1>A little time for you.</h1>
            <p>
              {data.salon.address}
              <br />
              Salon timezone: {data.salon.timezone}
            </p>
            {result ? (
              <div className="success">
                Your appointment is confirmed.
                <br />
                Reference: {result.reference}
                <br />
                {new Date(result.starts_at).toLocaleString()}
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  const d: any = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  try {
                    if (!selected.length)
                      throw Error("Select at least one service");
                    const r = await fetch(
                      "/api/v1/booking/" + encodeURIComponent(slug),
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: d.name,
                          email: d.email,
                          phone: d.phone,
                          branch_id: branch,
                          employee_id: employee,
                          service_ids: selected,
                          starts_at: new Date(d.starts_at).toISOString(),
                          notes: d.notes || "",
                          marketing_consent: d.marketing_consent === "on",
                        }),
                      },
                    );
                    const response = await r.json();
                    if (!r.ok) throw Error(response.error.message);
                    setResult(response.data);
                    toast.success("Your appointment is confirmed.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <h2>Choose your services</h2>
                {data.services.map((s: any) => (
                  <label className="checkbox" key={s.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, s.id]
                            : v.filter((id) => id !== s.id),
                        )
                      }
                    />
                    {s.name} · {s.duration_minutes} min ·{" "}
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currencyDisplay: "narrowSymbol",
                      currency: data.salon.currency,
                    }).format(Number(s.price_minor) / 100)}
                  </label>
                ))}
                <label>
                  Salon branch
                  <CustomSelect
                    required
                    value={branch}
                    onChange={(e) => {
                      setBranch(e.target.value);
                      setEmployee("");
                    }}
                  >
                    <option value="">Choose…</option>
                    {data.branches.map((b: any) => (
                      <option value={b.id} key={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </CustomSelect>
                </label>
                <label>
                  Your stylist
                  <CustomSelect
                    required
                    value={employee}
                    disabled={!branch}
                    onChange={(e) => setEmployee(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {data.employees
                      .filter((e: any) => e.branch_id === branch)
                      .map((e: any) => (
                        <option value={e.id} key={e.id}>
                          {e.name} · {e.title}
                        </option>
                      ))}
                  </CustomSelect>
                </label>
                <label>
                  Date and time (your device timezone)
                  <DateTimePicker
                    type="datetime-local"
                    name="starts_at"
                    required
                    onChange={(e) => setDate(e.target.value.split("T")[0])}
                  />
                </label>
                {availability && (
                  <div className="availability">
                    <strong>Availability in {availability.timezone}</strong>
                    {availability.hours.length ? (
                      availability.hours.map((h: any) => (
                        <p key={h.opens_at}>
                          {h.opens_at} – {h.closes_at}
                        </p>
                      ))
                    ) : (
                      <p>No working hours on this date.</p>
                    )}
                    {availability.busy.map((b: any) => (
                      <small key={b.starts_at}>
                        Reserved: {new Date(b.starts_at).toLocaleTimeString()} –{" "}
                        {new Date(b.ends_at).toLocaleTimeString()}
                      </small>
                    ))}
                  </div>
                )}
                <label>
                  Your name
                  <input
                    required
                    name="name"
                    autoComplete="name"
                    minLength={2}
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                  />
                </label>
                <label>
                  Phone
                  <input required type="tel" name="phone" autoComplete="tel" />
                </label>
                <label>
                  Anything we should know?
                  <textarea name="notes" />
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="marketing_consent" />
                  I’d like to receive salon offers. Optional.
                </label>
                <p>
                  Cancellation window: {data.salon.cancel_hours} hours before
                  your appointment.
                </p>
                <button className="primary full" disabled={busy}>
                  {busy ? "Booking…" : "Confirm appointment"}
                </button>
              </form>
            )}
          </>
        ) : (
          !error && <div className="loading">Opening salon…</div>
        )}
        {error && <ToastNotice message={error} />}
      </section>
    </main>
  );
}
