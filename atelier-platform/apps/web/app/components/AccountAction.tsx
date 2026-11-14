"use client";
import { BrandStar } from "./BrandStar";
import { PasswordInput } from "./PasswordInput";
import { ToastNotice, toast } from "./Toasts";
import { useEffect, useState } from "react";
export function AccountAction({
  kind,
}: {
  kind: "reset" | "verify" | "invite";
}) {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <main className="customer-page">
      <a className="brand" href="/">
        etalier<span><BrandStar /></span>
      </a>
      <section className="panel customer-panel">
        <h1>
          {kind === "reset"
            ? "A fresh start."
            : kind === "verify"
              ? "Verify your email."
              : "Join your salon team."}
        </h1>
        <p>
          {kind === "invite"
            ? "Sign in with the invited email before accepting this invitation."
            : "Your link is private, time-limited and can only be used once."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const token = new URLSearchParams(location.search).get("token");
              if (!token)
                throw Error(
                  "This link is incomplete. Request a new link from your salon.",
                );
              const password = new FormData(e.currentTarget).get("password");
              const response = await fetch(
                "/api/v1/" +
                  (kind === "invite" ? "invitations/accept" : "auth/" + kind),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    token,
                    ...(kind === "reset" ? { password } : {}),
                  }),
                },
              );
              const payload = await response.json();
              if (!response.ok)
                throw Error(
                  payload.error?.message ||
                    "Unable to complete this request. Please try again.",
                );
              setSuccess(true);
              toast.success(
                "Request completed. You can return to your workspace.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {kind === "reset" && (
            <label>
              New password
              <PasswordInput
                required
                name="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          )}
          {success ? (
            <div className="success">
              Done. You can return to your workspace.
            </div>
          ) : (
            <button className="primary full" disabled={busy}>
              {busy
                ? "Please wait…"
                : kind === "reset"
                  ? "Reset password"
                  : kind === "verify"
                    ? "Verify email"
                    : "Accept invitation"}
            </button>
          )}
          {error && <ToastNotice message={error} />}
          <a className="text-button" href="/">
            Back to sign in
          </a>
        </form>
      </section>
    </main>
  );
}
