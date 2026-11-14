"use client";
import { BrandStar } from "./BrandStar";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, ArrowRight } from "lucide-react";
export type Salon = { id: string; name: string; slug: string; status: string };
export function SalonList({
  salons,
  onSelect,
  busy,
  onSignOut,
}: {
  salons: Salon[];
  onSelect: (id: string) => void;
  busy: boolean;
  onSignOut: () => void;
}) {
  return (
    <section className="salon-selection">
      <a className="brand" href="/">
        etalier<span><BrandStar /></span>
      </a>
      <h1>{salons.length ? "Choose your salon" : "No salons available"}</h1>
      <p>
        {salons.length
          ? "Select the salon you’d like to work in."
          : "Your account has no active salon access. Ask your salon administrator for an invitation."}
      </p>
      <div className="salon-list">
        {salons.map((salon) => (
          <button
            className="panel salon-choice"
            key={salon.id}
            disabled={busy}
            onClick={() => onSelect(salon.id)}
          >
            <span className="icon-tile">
              <Building2 size={23} />
            </span>
            <span>
              <strong>{salon.name}</strong>
              <small>{salon.slug}</small>
            </span>
            <ArrowRight size={20} />
          </button>
        ))}
      </div>
      {busy && <p role="status">Opening your salon…</p>}
      <button className="text-button" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}
export function SalonPicker({
  salons,
  selectedId,
  onSelect,
  busy,
  label = "YOUR SALON",
}: {
  salons: Salon[];
  selectedId: string;
  onSelect: (id: string) => void;
  busy: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const selected = salons.find((salon) => salon.id === selectedId);
  if (salons.length <= 1)
    return (
      <div className="salon-current">
        <Building2 size={20} />
        <span>
          <small>{label}</small>
          <strong>{selected?.name || salons[0]?.name || "No salon"}</strong>
        </span>
      </div>
    );
  return (
    <div className="salon-picker" ref={container}>
      <button
        ref={trigger}
        className="salon-picker-trigger"
        aria-expanded={open}
        aria-controls="salon-switcher"
        disabled={busy}
        onClick={() => setOpen(!open)}
      >
        <Building2 size={19} />
        <span>
          <small>{label}</small>
          <strong>
            {busy ? "Opening salon…" : selected?.name || "Choose a salon"}
          </strong>
        </span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div
          id="salon-switcher"
          className="salon-picker-options"
          aria-label="Available salons"
        >
          {salons.map((salon) => (
            <button
              key={salon.id}
              aria-current={selectedId === salon.id ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                if (salon.id !== selectedId) onSelect(salon.id);
              }}
            >
              <span>
                <strong>{salon.name}</strong>
                <small>{salon.slug}</small>
              </span>
              {salon.id === selectedId && <Check size={17} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
