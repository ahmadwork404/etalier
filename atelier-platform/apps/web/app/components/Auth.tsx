"use client";
import { BrandStar } from "./BrandStar";
import { PasswordInput } from "./PasswordInput";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ToastNotice } from "./Toasts";
async function api(path: string, method: string, body: unknown) {
  const response = await fetch("/api/v1/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok)
    throw Error(payload.error?.message || "Unable to complete your request.");
  return payload.data;
}
export function Auth({
  onDone,
  forgotPassword = false,
}: {
  onDone?: () => void;
  forgotPassword?: boolean;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(
      z
        .object({
          email: z.string().email("Enter a valid email address"),
          password: z.string().optional(),
        })
        .superRefine((data, context) => {
          if (
            !forgotPassword &&
            (!data.password ||
              data.password.length < 12 ||
              data.password.length > 128)
          )
            context.addIssue({
              code: "custom",
              path: ["password"],
              message: "Use 12–128 characters for your password.",
            });
        }),
    ),
  });
  return (
    <div className="auth">
      <section className="intro">
        <a className="brand" href="/">
          etalier<span><BrandStar /></span>
        </a>
        <div>
          <h1>
            Your craft.
            <br />
            Your people.
            <br />
            Your Etalier.
          </h1>
          <p>
            A thoughtful workspace for the business behind every beautiful
            transformation.
          </p>
          <div className="intro-tags">
            <span>Independent salons</span>
            <span>Growing teams</span>
            <span>Beautiful businesses</span>
          </div>
        </div>
        <small>Salon & beauty business management</small>
      </section>
      <section className="auth-form">
        <div className="auth-box">
          <h2>
            {forgotPassword
              ? "Forgot your password?"
              : "Welcome back to your Etalier."}
          </h2>
          <p>
            {forgotPassword
              ? "Enter your account email and we’ll send you a password reset link."
              : "Sign in to take care of your business."}
          </p>
          <form
            onSubmit={handleSubmit(async (data) => {
              setError("");
              setMessage("");
              try {
                if (forgotPassword) {
                  const result = await api("auth/request-reset", "POST", {
                    email: data.email,
                  });
                  setMessage(result.message);
                } else {
                  await api("auth/login", "POST", data);
                  onDone?.();
                }
              } catch (error) {
                setError((error as Error).message);
              }
            })}
          >
            <label>
              Email address
              <input
                type="email"
                {...field("email")}
                autoComplete="email"
                aria-invalid={!!errors.email}
              />
            </label>
            {errors.email && (
              <span className="error">{errors.email.message}</span>
            )}
            {!forgotPassword && (
              <>
                <label>
                  Password
                  <PasswordInput
                    {...field("password")}
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                  />
                </label>
                {errors.password && (
                  <span className="error">{errors.password.message}</span>
                )}
              </>
            )}
            <ToastNotice message={error} />
            {message && (
              <p className="reset-confirmation" role="status">
                {message}
              </p>
            )}
            <button className="primary full" disabled={isSubmitting}>
              {isSubmitting
                ? "Please wait…"
                : forgotPassword
                  ? "Send reset link"
                  : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <a
            className="text-button"
            href={forgotPassword ? "/login" : "/forgot-password"}
          >
            {forgotPassword ? "Back to sign in" : "Forgot password?"}
          </a>
          <p className="secure">
            <ShieldCheck size={16} />
            Your workspace stays private to your team.
          </p>
        </div>
      </section>
    </div>
  );
}
