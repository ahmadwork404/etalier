"use client";
import { BrandStar } from "../components/BrandStar";
import { DateTimePicker } from "../components/DateTimePicker";
import { CustomSelect } from "../components/CustomSelect";
import { ToastNotice, toast } from "../components/Toasts";
import { useEffect, useState } from "react";
export default function CustomerPage() {
  const [token, setToken] = useState(""),
    [data, setData] = useState<any>(null),
    [answers, setAnswers] = useState<any>({}),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [busy, setBusy] = useState(false),
    [media, setMedia] = useState(""),
    [privacyStatus, setPrivacyStatus] = useState("");
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("token") || "";
    setToken(t);
    if (!t) {
      setError(
        "This link is incomplete. Ask your salon for a new customer link.",
      );
      return;
    }
    fetch("/api/v1/customer-link/" + encodeURIComponent(t))
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error.message);
        setData(d.data);
        setAnswers(
          d.data.purpose === "form"
            ? {}
            : {
                marketing_consent: d.data.customer.marketing_consent,
                preferred_channel: d.data.customer.preferred_channel,
              },
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/v1/customer-link/" + token + "/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: file.type,
          size_bytes: file.size,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error.message);
      const uploaded = await fetch(d.data.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw Error("Upload failed");
      const v = await fetch(
        "/api/v1/customer-link/" +
          token +
          "/upload/" +
          d.data.media_id +
          "/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (!v.ok) throw Error("File could not be verified");
      setMedia(d.data.media_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="customer-page">
      <a className="brand" href="/">
        etalier<span><BrandStar /></span>
      </a>
      <section className="panel customer-panel">
        {data ? (
          <>
            <span className="eyebrow">{data.salon.name}</span>
            <h1>
              {data.purpose === "form"
                ? data.form.name
                : data.purpose === "review"
                  ? "How was your visit?"
                  : data.purpose === "ugc"
                    ? "Share your transformation."
                    : "Your salon, at your fingertips."}
            </h1>
            <p>
              Hello, {data.customer.name}.{" "}
              {data.purpose === "ugc"
                ? "Sharing content and granting marketing permission are optional and separate from your treatment."
                : "A little personal attention, wherever you are."}
            </p>
            {success ? (
              <div className="success">
                Thank you. Your response has been saved.
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    const body =
                      data.purpose === "form"
                        ? { answers }
                        : data.purpose === "ugc"
                          ? {
                              testimonial: answers.testimonial || "",
                              media_id: media || undefined,
                              consent_granted: !!answers.consent_granted,
                              consent_text:
                                "I authorize this salon to use my submitted content for its marketing. I can request withdrawal of this permission.",
                            }
                          : data.purpose === "review"
                            ? {
                                rating: Number(answers.rating),
                                body: answers.body || "",
                              }
                            : answers;
                    const r = await fetch("/api/v1/customer-link/" + token, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    });
                    const d = await r.json();
                    if (!r.ok) throw Error(d.error.message);
                    setSuccess(true);
                    toast.success("Your response has been saved.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {data.purpose === "form" &&
                  data.form.fields.map((f: any) => (
                    <label
                      key={f.key}
                      className={
                        ["checkbox", "consent"].includes(f.type)
                          ? "checkbox"
                          : ""
                      }
                    >
                      {f.label}
                      {["checkbox", "consent"].includes(f.type) ? (
                        <input
                          type="checkbox"
                          required={f.required}
                          checked={!!answers[f.key]}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [f.key]: e.target.checked,
                            })
                          }
                        />
                      ) : f.type === "select" ? (
                        <CustomSelect
                          required={f.required}
                          value={answers[f.key] || ""}
                          onChange={(e) =>
                            setAnswers({ ...answers, [f.key]: e.target.value })
                          }
                        >
                          <option value="">Choose…</option>
                          {f.options?.map((v: string) => (
                            <option key={v}>{v}</option>
                          ))}
                        </CustomSelect>
                      ) : f.type === "textarea" ? (
                        <textarea
                          required={f.required}
                          value={answers[f.key] || ""}
                          onChange={(e) =>
                            setAnswers({ ...answers, [f.key]: e.target.value })
                          }
                        />
                      ) : (
                        <input
                          type={f.type === "date" ? "date" : "text"}
                          required={f.required}
                          value={answers[f.key] || ""}
                          onChange={(e) =>
                            setAnswers({ ...answers, [f.key]: e.target.value })
                          }
                        />
                      )}
                    </label>
                  ))}
                {data.purpose === "review" && (
                  <>
                    <label>
                      Your rating
                      <CustomSelect
                        required
                        value={answers.rating || ""}
                        onChange={(e) =>
                          setAnswers({ ...answers, rating: e.target.value })
                        }
                      >
                        <option value="">Select rating</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option value={n} key={n}>
                            {n} / 5
                          </option>
                        ))}
                      </CustomSelect>
                    </label>
                    <label>
                      Your experience
                      <textarea
                        value={answers.body || ""}
                        onChange={(e) =>
                          setAnswers({ ...answers, body: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {data.purpose === "ugc" && (
                  <>
                    <label>
                      Your story
                      <textarea
                        value={answers.testimonial || ""}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            testimonial: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Optional photo or MP4 video (up to 50 MB)
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,video/mp4"
                        disabled={busy}
                        onChange={(e) => {
                          if (e.target.files?.[0]) upload(e.target.files[0]);
                        }}
                      />
                    </label>
                    {media && <p>Upload verified.</p>}
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={!!answers.consent_granted}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            consent_granted: e.target.checked,
                          })
                        }
                      />
                      I authorize the salon to use this content for marketing. I
                      may request withdrawal.
                    </label>
                  </>
                )}
                {data.purpose === "portal" && (
                  <>
                    <h2>Your appointments</h2>
                    {data.appointments.map((a: any) => (
                      <div className="record-row" key={a.id}>
                        <div>
                          <strong>
                            {new Date(a.starts_at).toLocaleString()}
                          </strong>
                          <small>{a.status.replaceAll("_", " ")}</small>
                        </div>
                        {["pending", "confirmed"].includes(a.status) && (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="secondary"
                              onClick={async () => {
                                if (!confirm("Cancel this appointment?"))
                                  return;
                                try {
                                  const r = await fetch(
                                    "/api/v1/customer-link/" +
                                      token +
                                      "/appointments/" +
                                      a.id,
                                    {
                                      method: "PATCH",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        action: "cancel",
                                      }),
                                    },
                                  );
                                  const d = await r.json();
                                  if (!r.ok) throw Error(d.error.message);
                                  setData({
                                    ...data,
                                    appointments: data.appointments.map(
                                      (row: any) =>
                                        row.id === a.id
                                          ? { ...row, status: "cancelled" }
                                          : row,
                                    ),
                                  });
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                              }}
                            >
                              Cancel appointment
                            </button>
                            <label>
                              Reschedule
                              <DateTimePicker
                                type="datetime-local"
                                onChange={async (e) => {
                                  if (!e.target.value) return;
                                  try {
                                    const starts_at = new Date(
                                      e.target.value,
                                    ).toISOString();
                                    const r = await fetch(
                                      "/api/v1/customer-link/" +
                                        token +
                                        "/appointments/" +
                                        a.id,
                                      {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          action: "reschedule",
                                          starts_at,
                                        }),
                                      },
                                    );
                                    const d = await r.json();
                                    if (!r.ok) throw Error(d.error.message);
                                    setData({
                                      ...data,
                                      appointments: data.appointments.map(
                                        (row: any) =>
                                          row.id === a.id
                                            ? { ...row, starts_at }
                                            : row,
                                      ),
                                    });
                                  } catch (e) {
                                    setError((e as Error).message);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                    <h2>Privacy and consent</h2>
                    <div className="row-actions">
                      {[
                        ["export", "Request my data"],
                        ["deletion", "Request data deletion"],
                        ["ugc_withdrawal", "Withdraw marketing media consent"],
                      ].map(([type, label]) => (
                        <button
                          key={type}
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={async () => {
                            try {
                              const r = await fetch(
                                "/api/v1/customer-link/" + token + "/privacy",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ type }),
                                },
                              );
                              const d = await r.json();
                              if (!r.ok) throw Error(d.error.message);
                              setPrivacyStatus(
                                type === "ugc_withdrawal"
                                  ? "Content consent withdrawn."
                                  : "Your request has been sent to the salon owner.",
                              );
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {privacyStatus && (
                      <div className="success">{privacyStatus}</div>
                    )}
                    <h2>Communication preferences</h2>
                    <label>
                      Preferred channel
                      <CustomSelect
                        value={answers.preferred_channel}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            preferred_channel: e.target.value,
                          })
                        }
                      >
                        {["email", "sms", "whatsapp", "none"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </CustomSelect>
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={answers.marketing_consent}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            marketing_consent: e.target.checked,
                          })
                        }
                      />
                      I consent to marketing messages.
                    </label>
                  </>
                )}
                <button className="primary full" disabled={busy}>
                  {busy ? "Please wait…" : "Submit securely"}
                </button>
              </form>
            )}
          </>
        ) : (
          !error && (
            <div className="loading">Opening your secure salon link…</div>
          )
        )}
        {error && <ToastNotice message={error} />}
      </section>
      <footer>Your information stays with your salon.</footer>
    </main>
  );
}
