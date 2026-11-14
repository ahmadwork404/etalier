"use client";
import { BrandStar } from "../../components/BrandStar";
import { useEffect, useState, use } from "react";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { IntakeQuestions } from "../../components/IntakeQuestions";
export default function IntakeViewer({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [form, setForm] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    document
      .querySelector('meta[name="referrer"]')
      ?.setAttribute("content", "no-referrer");
    let alive = true;
    fetch("/api/v1/intake/" + encodeURIComponent(token))
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw Error(payload.error?.message || "Unable to open this form");
        if (alive) setForm(payload.data);
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [token]);
  return (
    <main className="intake-public">
      <a className="brand" href="/">
        etalier<span><BrandStar /></span>
      </a>
      <section className="panel intake-public-panel">
        {done ? (
          <div className="intake-thanks" role="status">
            <CheckCircle2 size={44} />
            <h1>Thank you</h1>
            <p>Your answers have been securely submitted to the salon.</p>
            <small>You can close this page.</small>
          </div>
        ) : form ? (
          <>
            <span className="eyebrow">{form.salon_name} · CUSTOMER INTAKE</span>
            <h1>{form.name}</h1>
            {form.description && (
              <p className="intake-description">{form.description}</p>
            )}
            {form.customer_name && <p>Hello, {form.customer_name}.</p>}
            <div className="intake-viewer-meta">
              <span>
                <Clock3 size={15} />
                Expires {new Date(form.expires_at).toLocaleString()}
              </span>
              <span>
                {form.remaining} submission{form.remaining === 1 ? "" : "s"}{" "}
                remaining
              </span>
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                setBusy(true);
                setError("");
                const data = new FormData(event.currentTarget);
                try {
                  const response = await fetch(
                    "/api/v1/intake/" + encodeURIComponent(token),
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        answers,
                        ...(form.identify
                          ? {
                              respondent_name: data.get("respondent_name"),
                              respondent_email: data.get("respondent_email"),
                            }
                          : {}),
                        device: {
                          language: navigator.language,
                          timezone:
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                          screen: `${window.screen.width} × ${window.screen.height}`,
                        },
                      }),
                    },
                  );
                  const payload = await response.json();
                  if (!response.ok)
                    throw Error(
                      payload.error?.message || "Unable to submit your answers",
                    );
                  setDone(true);
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {form.identify && (
                <div className="intake-identify">
                  <label>
                    Your name
                    <input
                      name="respondent_name"
                      required
                      maxLength={120}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="respondent_email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </label>
                </div>
              )}
              <IntakeQuestions
                questions={form.fields}
                answers={answers}
                onChange={(key, value) =>
                  setAnswers((previous) => ({ ...previous, [key]: value }))
                }
              />
              <p className="intake-device-notice">
                <ShieldCheck size={16} />
                Your answers and basic browser, device, language, timezone and
                screen details are shared with the salon. No device fingerprint
                or precise location is collected.
              </p>
              {error && (
                <p className="error-box" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "Submitting…" : "Submit answers"}
              </button>
            </form>
          </>
        ) : error ? (
          <div role="alert">
            <h1>This link is unavailable</h1>
            <p>{error}</p>
          </div>
        ) : (
          <p role="status">Opening your form…</p>
        )}
      </section>
    </main>
  );
}
