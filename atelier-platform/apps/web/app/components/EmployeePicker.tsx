"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown, Check } from "lucide-react";
import { EmployeeAvatar } from "./EmployeePhoto";
async function load(path: string) {
  const r = await fetch("/api/v1/employee-options?" + path),
    b = await r.json();
  if (!r.ok) throw Error(b.error?.message || "Unable to load employees");
  return b.data;
}
export function EmployeePicker({
  value,
  onChange,
  required = true,
  branchId,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  branchId?: string;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setTerm(search), 180);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const options = useQuery({
    queryKey: ["employee-picker", term, branchId],
    queryFn: () =>
      load(
        "q=" +
          encodeURIComponent(term) +
          (branchId ? "&branch_id=" + branchId : ""),
      ),
    enabled: open,
    placeholderData: (previous) => previous,
  });
  const selected = useQuery({
    queryKey: ["employee-picker-selected", value],
    queryFn: () => load("id=" + value),
    enabled: !!value,
  });
  const person = selected.data?.[0];
  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };
  return (
    <div className="employee-picker" ref={root}>
      <input
        className="sr-only"
        aria-label="Selected employee"
        required={required}
        value={value || ""}
        onChange={() => {}}
        onInvalid={() => setOpen(true)}
      />
      <button
        type="button"
        className="employee-picker-trigger"
        role="combobox"
        aria-label="Employee"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {person ? (
          <>
            <EmployeeAvatar employee={person} />
            <span>
              {person.name}
              <small>{person.branch_name}</small>
            </span>
          </>
        ) : (
          <span>Choose employee…</span>
        )}
        <ChevronDown size={17} />
      </button>
      {open && (
        <div className="employee-picker-panel">
          <div className="employee-picker-search">
            <Search size={17} />
            <input
              ref={input}
              value={search}
              placeholder="Search employees…"
              aria-label="Search employees"
              onChange={(e) => {
                setSearch(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive(
                    Math.min(active + 1, (options.data?.length || 1) - 1),
                  );
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(Math.max(0, active - 1));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (options.data?.[active] && !options.isPlaceholderData)
                    choose(options.data[active].id);
                }
              }}
            />
          </div>
          <div
            className="employee-picker-options"
            role="listbox"
            aria-label="Employees"
          >
            {options.isPending ? (
              <p>Loading employees…</p>
            ) : options.isError ? (
              <p role="alert">{options.error.message}</p>
            ) : options.data.length ? (
              options.data.map((employee: any, index: number) => (
                <button
                  key={employee.id}
                  type="button"
                  role="option"
                  aria-selected={value === employee.id}
                  data-active={active === index}
                  disabled={options.isPlaceholderData}
                  onClick={() => choose(employee.id)}
                >
                  <EmployeeAvatar employee={employee} />
                  <span>
                    <strong>{employee.name}</strong>
                    <small>
                      {employee.title} · {employee.branch_name}
                    </small>
                  </span>
                  {value === employee.id && <Check size={16} />}
                </button>
              ))
            ) : (
              <p>No employees found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
