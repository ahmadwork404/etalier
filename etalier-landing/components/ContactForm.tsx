"use client";
import { useRef, useState } from "react";
export function ContactForm() {
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const fields = new FormData(event.currentTarget);
    key.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(fields),
          consent: fields.get("consent") === "on",
          request_key: key.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) key.current = null;
        throw new Error(
          payload.error?.message ||
            "We couldn’t send your enquiry. Please try again.",
        );
      }
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn’t send your enquiry. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <section className="contact-success" role="status">
        <span className="contact-check" aria-hidden="true">
          ✓
        </span>
        <h2>Message received.</h2>
        <p>
          Thanks for getting in touch. We’ll reply to the email address you
          provided.
        </p>
        <a className="button yellow" href="/">
          Back to Etalier ↗
        </a>
      </section>
    );
  return (
    <form className="contact-form" onSubmit={submit} aria-busy={busy}>
      <div className="contact-field-row">
        <label>
          <span className="contact-label">
            Your name <b>*</b>
          </span>
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            placeholder="Alex Morgan"
          />
        </label>
        <label>
          <span className="contact-label">
            Work email <b>*</b>
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="alex@yoursalon.com"
          />
        </label>
      </div>
      <div className="contact-field-row">
        <label>
          <span className="contact-label">Salon or business</span>
          <input
            name="salon_name"
            autoComplete="organization"
            maxLength={160}
            placeholder="Your salon name"
          />
        </label>
        <label>
          <span className="contact-label">
            Phone <small>Optional</small>
          </span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            placeholder="Include your country code"
          />
        </label>
      </div>
      <label>
        How many people are on your team?
        <select name="team_size" defaultValue="">
          <option value="">Select team size · optional</option>
          {["Just me", "2–5", "6–15", "16–30", "31+"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="contact-label">
          What would you like to talk about? <b>*</b>
        </span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          placeholder="Tell us about your salon, ask a question, or arrange a walkthrough."
        />
      </label>
      <div className="contact-honey" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="contact-consent">
        <input name="consent" type="checkbox" required />
        <span>
          I agree that Etalier may use these details to respond to my enquiry.
          This does not subscribe me to marketing emails.
        </span>
      </label>
      {error && (
        <p className="contact-error" role="alert">
          {error}
        </p>
      )}
      <button className="button yellow" disabled={busy}>
        {busy ? "Sending…" : "Send enquiry"} <span aria-hidden="true">↗</span>
      </button>
      <p className="contact-required">
        * Required fields. Please don’t include customer records or payment
        details.
      </p>
    </form>
  );
}
