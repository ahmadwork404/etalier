"use client";
import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

type ToastKind = "success" | "error";
type ToastItem = { id: string; message: string; kind: ToastKind };
export const TOAST_DURATION = { success: 5000, error: 10000 } as const;
export const toast = {
  success: (message: string) => publish(message, "success"),
  error: (message: string) => publish(message, "error"),
};
function publish(message: string, kind: ToastKind) {
  if (typeof window !== "undefined" && message)
    window.dispatchEvent(
      new CustomEvent("atelier:toast", {
        detail: { message, kind, id: crypto.randomUUID() },
      }),
    );
}
function ToastCard({
  item,
  dismiss,
}: {
  item: ToastItem;
  dismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), TOAST_DURATION[item.kind]);
    return () => clearTimeout(timer);
  }, [item.id, item.kind, dismiss]);
  const Icon = item.kind === "success" ? CheckCircle2 : CircleAlert;
  return (
    <div
      className={`toast-card toast-${item.kind}`}
      role={item.kind === "error" ? "alert" : "status"}
    >
      <Icon size={21} aria-hidden="true" />
      <div>
        <p>{item.message}</p>
      </div>
      <button
        aria-label="Dismiss notification"
        onClick={() => dismiss(item.id)}
      >
        <X size={17} />
      </button>
    </div>
  );
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const receive = (event: Event) => {
      const item = (event as CustomEvent<ToastItem>).detail;
      setItems((previous) =>
        [
          ...previous.filter(
            (existing) =>
              existing.message !== item.message || existing.kind !== item.kind,
          ),
          item,
        ].slice(-4),
      );
    };
    window.addEventListener("atelier:toast", receive);
    return () => window.removeEventListener("atelier:toast", receive);
  }, []);
  // Stable callback prevents unrelated notifications from restarting an existing timer.
  const [dismiss] = useState(
    () => (id: string) =>
      setItems((previous) => previous.filter((item) => item.id !== id)),
  );
  return (
    <>
      {children}
      <section className="toast-stack" aria-label="Notifications">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} dismiss={dismiss} />
        ))}
      </section>
    </>
  );
}
export function ToastNotice({
  message,
  kind = "error",
  onDismiss,
}: {
  message: string;
  kind?: ToastKind;
  onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    // Schedule after the root provider mounts, including initial loading errors.
    const timer = setTimeout(() => {
      toast[kind](message);
    }, 0);
    const clear = setTimeout(() => onDismiss?.(), TOAST_DURATION[kind]);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, [message, kind]);
  return null;
}
