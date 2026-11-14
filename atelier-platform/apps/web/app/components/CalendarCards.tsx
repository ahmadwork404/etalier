"use client";
import { useEffect, useRef } from "react";
import { CheckCircle2, CircleX, Clock3, Layers, X } from "lucide-react";
import {
  appointmentPhase,
  prioritizeAppointments,
  type CalendarAppointment,
} from "./calendar-order";

export function AppointmentCard({
  appointment: a,
  now,
  onClick,
  stackLabel,
}: {
  appointment: CalendarAppointment;
  now: number;
  onClick: () => void;
  stackLabel?: string;
}) {
  const phase = appointmentPhase(a, now);
  const failed = ["cancelled", "no_show", "rescheduled"].includes(a.status);
  const past = Date.parse(a.ends_at || a.starts_at) <= now;
  return (
    <button
      type="button"
      className={`appointment-card${past ? " appointment-past" : ""}`}
      draggable={
        !stackLabel &&
        !["completed", "cancelled", "no_show", "rescheduled"].includes(a.status)
      }
      onDragStart={(event) =>
        event.dataTransfer.setData("text/plain", JSON.stringify(a))
      }
      onClick={onClick}
    >
      {stackLabel && <span className="calendar-stack-label">{stackLabel}</span>}
      <strong>
        {new Date(a.starts_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · {a.customer_name}
      </strong>
      <span>{a.services?.map((service: any) => service.name).join(", ")}</span>
      <small>
        {a.employee_name}
        {a.kind === "walkin"
          ? " · Quick visit / walk-in"
          : a.paid_in_advance
            ? " · Paid in advance"
            : ""}
      </small>
      <span className="appointment-indicators">
        <span
          className={`appointment-outcome ${a.status === "completed" ? "outcome-success" : failed ? "outcome-failed" : ""}`}
        >
          {a.status === "completed" ? (
            <CheckCircle2 size={13} />
          ) : failed ? (
            <CircleX size={13} />
          ) : (
            <Clock3 size={13} />
          )}
          {a.status.replaceAll("_", " ")}
        </span>
        {past && <span className="appointment-time-note">Time passed</span>}
        {phase === "now" && <span className="appointment-time-note">Now</span>}
      </span>
    </button>
  );
}
export function AppointmentStack({
  items,
  now,
  onOpen,
}: {
  items: CalendarAppointment[];
  now: number;
  onOpen: () => void;
}) {
  const top = prioritizeAppointments(items, now)[0];
  if (!top) return null;
  const phase = appointmentPhase(top, now);
  return (
    <div className={`appointment-stack ${items.length > 1 ? "has-stack" : ""}`}>
      {items.length > 1 && (
        <>
          <div
            className="appointment-stack-sheet sheet-back"
            aria-hidden="true"
          />
          <div
            className="appointment-stack-sheet sheet-front"
            aria-hidden="true"
          />
        </>
      )}
      <AppointmentCard
        appointment={top}
        now={now}
        onClick={onOpen}
        stackLabel={
          phase === "now"
            ? "Happening now"
            : phase === "upcoming"
              ? "Next up"
              : "Latest appointment"
        }
      />
      <button type="button" className="calendar-stack-expand" onClick={onOpen}>
        <Layers size={15} />
        {items.length} appointment{items.length === 1 ? "" : "s"} · View{" "}
        {items.length === 1 ? "details" : "all"}
      </button>
    </div>
  );
}
export function CalendarDayDialog({
  day,
  items,
  now,
  onClose,
  onSelect,
}: {
  day: Date;
  items: CalendarAppointment[];
  now: number;
  onClose: () => void;
  onSelect: (appointment: CalendarAppointment) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const ordered = [...items].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  );
  return (
    <dialog
      ref={ref}
      className="record-dialog modal calendar-day-dialog"
      aria-labelledby="calendar-day-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <small>FULL DAY SCHEDULE · {items.length} APPOINTMENTS</small>
          <h2 id="calendar-day-title">
            {day.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h2>
        </div>
        <button type="button" aria-label="Close day schedule" onClick={onClose}>
          <X />
        </button>
      </div>
      <p className="calendar-schedule-hint">
        All appointments in time order. Select one to view or update it.
      </p>
      <div className="calendar-day-list">
        {ordered.map((a) => (
          <AppointmentCard
            key={a.id}
            appointment={a}
            now={now}
            onClick={() => onSelect(a)}
          />
        ))}
      </div>
    </dialog>
  );
}
