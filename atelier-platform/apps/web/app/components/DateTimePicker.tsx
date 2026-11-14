"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Check,
} from "lucide-react";
import { CustomSelect } from "./CustomSelect";

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function DateTimePicker({
  type = "datetime-local",
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  id,
  min,
  max,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const [internal, setInternal] = useState(String(defaultValue || ""));
  const selected = String(value === undefined ? internal : value || "");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [month, setMonth] = useState(() => new Date());
  const [invalid, setInvalid] = useState(false);
  const root = useRef<HTMLSpanElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  const datePart = type === "time" ? "" : draft.split("T")[0];
  const timePart = (type === "time" ? draft : draft.split("T")[1]) || "09:00";
  const [hour = "09", minute = "00"] = timePart.split(":");
  const minimum = min === undefined ? "" : String(min),
    maximum = max === undefined ? "" : String(max);
  const allowed = (candidate: string) =>
    !!candidate &&
    (!minimum || candidate >= minimum) &&
    (!maximum || candidate <= maximum);
  function expand() {
    const date =
      type === "time"
        ? new Date()
        : new Date(
            (selected.split("T")[0] || localDate(new Date())) + "T12:00:00",
          );
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setDraft(
      selected ||
        (type === "time"
          ? "09:00"
          : `${localDate(new Date())}${type === "datetime-local" ? "T09:00" : ""}`),
    );
    setOpen(true);
  }
  function commit(candidate: string) {
    if (!allowed(candidate)) return;
    if (value === undefined) setInternal(candidate);
    onChange?.({
      target: { value: candidate, name: name || "" },
      currentTarget: { value: candidate, name: name || "" },
    } as ChangeEvent<HTMLInputElement>);
    setInvalid(false);
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    const frame = requestAnimationFrame(() => {
      panel.current
        ?.querySelector<HTMLElement>(
          '[aria-selected="true"], .date-picker-day:not(:disabled), .custom-select-trigger',
        )
        ?.focus();
      panel.current
        ?.querySelectorAll<HTMLElement>(
          '.time-picker-option[aria-selected="true"]',
        )
        .forEach((element) => element.scrollIntoView({ block: "nearest" }));
    });
    return () => {
      document.removeEventListener("pointerdown", outside);
      cancelAnimationFrame(frame);
    };
  }, [open]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(month.getFullYear(), month.getMonth(), i - first.getDay() + 1),
  );
  const display = selected
    ? type === "time"
      ? selected.slice(0, 5)
      : new Date(
          selected + (type === "date" ? "T12:00:00" : ""),
        ).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          ...(type === "datetime-local"
            ? { hour: "2-digit", minute: "2-digit" }
            : {}),
        })
    : type === "time"
      ? "Choose time"
      : type === "date"
        ? "Choose date"
        : "Choose date & time";
  function setTime(nextHour: string, nextMinute: string) {
    setDraft(
      type === "time"
        ? `${nextHour}:${nextMinute}`
        : `${datePart}T${nextHour}:${nextMinute}`,
    );
  }
  return (
    <span
      ref={root}
      className={`date-time-picker ${className || ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        id={id}
        type="button"
        className="date-picker-trigger"
        aria-label={
          props["aria-label"] ||
          (name
            ? name.replaceAll("_", " ")
            : type === "time"
              ? "Choose time"
              : "Choose date and time")
        }
        aria-expanded={open}
        aria-controls={generated}
        aria-labelledby={props["aria-labelledby"]}
        aria-haspopup="dialog"
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : expand())}
      >
        {type === "time" ? <Clock3 size={18} /> : <CalendarDays size={18} />}
        <span>{display}</span>
      </button>
      <input
        className="select-validation"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={selected}
        required={required}
        disabled={disabled}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          expand();
          trigger.current?.focus();
        }}
      />
      {open && (
        <div
          ref={panel}
          id={generated}
          className={`date-picker-panel ${type === "time" ? "time-only" : ""}`}
          role="dialog"
          aria-label={type === "time" ? "Select time" : "Select date and time"}
        >
          {type !== "time" && (
            <div className="date-picker-calendar">
              <div className="date-picker-month">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <strong aria-live="polite">
                  {month.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="date-picker-weekdays" aria-hidden="true">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="date-picker-grid" role="grid" aria-label="Dates">
                {days.map((day) => {
                  const key = localDate(day);
                  return (
                    <button
                      type="button"
                      role="gridcell"
                      className={`date-picker-day ${day.getMonth() !== month.getMonth() ? "outside-month" : ""}`}
                      key={key}
                      aria-label={day.toLocaleDateString(undefined, {
                        dateStyle: "full",
                      })}
                      aria-selected={datePart === key}
                      aria-current={
                        key === localDate(new Date()) ? "date" : undefined
                      }
                      disabled={
                        (!!minimum && key < minimum.split("T")[0]) ||
                        (!!maximum && key > maximum.split("T")[0])
                      }
                      onKeyDown={(event) => {
                        const delta =
                          event.key === "ArrowRight"
                            ? 1
                            : event.key === "ArrowLeft"
                              ? -1
                              : event.key === "ArrowDown"
                                ? 7
                                : event.key === "ArrowUp"
                                  ? -7
                                  : 0;
                        if (delta) {
                          event.preventDefault();
                          const next = new Date(day);
                          next.setDate(day.getDate() + delta);
                          const target =
                            panel.current?.querySelector<HTMLButtonElement>(
                              `[data-date="${localDate(next)}"]`,
                            );
                          if (target && !target.disabled) target.focus();
                        }
                      }}
                      data-date={key}
                      onClick={() => {
                        if (type === "date") commit(key);
                        else setDraft(`${key}T${hour}:${minute}`);
                      }}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="date-picker-today"
                onClick={() => {
                  const today = localDate(new Date());
                  setMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  );
                  if (type === "date") commit(today);
                  else setDraft(`${today}T${hour}:${minute}`);
                }}
              >
                Today
              </button>
            </div>
          )}
          {type !== "date" && (
            <div className="time-picker-compact">
              <Clock3 size={16} />
              <div>
                <small>Hour</small>
                <CustomSelect
                  aria-label="Hour"
                  value={hour}
                  onChange={(event) => setTime(event.target.value, minute)}
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const v = String(i).padStart(2, "0");
                    return (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    );
                  })}
                </CustomSelect>
              </div>
              <span>:</span>
              <div>
                <small>Minute</small>
                <CustomSelect
                  aria-label="Minute"
                  value={minute}
                  onChange={(event) => setTime(hour, event.target.value)}
                >
                  {Array.from({ length: 60 }, (_, i) => {
                    const v = String(i).padStart(2, "0");
                    return (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    );
                  })}
                </CustomSelect>
              </div>
              <small>24 hour</small>
            </div>
          )}
          {type !== "date" && (
            <div className="date-picker-footer">
              <small>
                {datePart
                  ? new Date(datePart + "T12:00:00").toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    ) + " · "
                  : ""}
                {hour}:{minute}
              </small>
              <button
                type="button"
                className="primary"
                disabled={!allowed(draft)}
                onClick={() => commit(draft)}
              >
                <Check size={15} />
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
