"use client";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
type Option = { value: string; label: string; disabled: boolean };
function text(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? text(child.props.children)
        : String(child ?? ""),
    )
    .join("");
}
function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === Fragment || child.type === "optgroup")
      return readOptions(child.props.children);
    return child.type === "option"
      ? [
          {
            value: String(child.props.value ?? text(child.props.children)),
            label: text(child.props.children),
            disabled: !!child.props.disabled,
          },
        ]
      : [];
  });
}
export function CustomSelect({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  id,
  className,
  style,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(() => readOptions(children), [children]);
  const generatedId = useId();
  const listId = generatedId + "-options";
  const [internal, setInternal] = useState(String(defaultValue ?? ""));
  const controlled = value !== undefined;
  const selected = String(controlled ? value : internal);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [invalid, setInvalid] = useState(false),
    [label, setLabel] = useState("");
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    validation = useRef<HTMLInputElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  useEffect(() => {
    if (
      !controlled &&
      defaultValue === undefined &&
      options.length &&
      !options.some((option) => option.value === internal)
    ) {
      const first = options.find((option) => !option.disabled);
      if (first) setInternal(first.value);
    }
  }, [options, controlled, defaultValue, internal]);
  useLayoutEffect(() => {
    if (props["aria-label"] || props["aria-labelledby"]) return;
    const outer = trigger.current?.closest("label");
    if (outer) {
      const caption = Array.from(outer.childNodes)
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent)
        .join(" ")
        .trim();
      if (caption) setLabel(caption);
    }
  }, [children, props["aria-label"], props["aria-labelledby"]]);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
      const availableBelow = window.innerHeight - rect.bottom - 12,
        availableAbove = rect.top - 12;
      const height = Math.min(options.length * 43 + 12, 288);
      const above =
        availableBelow < Math.min(height, 160) &&
        availableAbove > availableBelow;
      const maxHeight = Math.max(
        90,
        Math.min(height, above ? availableAbove : availableBelow),
      );
      setPosition({
        top: above ? Math.max(8, rect.top - maxHeight - 5) : rect.bottom + 5,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        maxHeight,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, options.length]);
  useEffect(() => {
    if (open && active >= 0)
      panel.current
        ?.querySelector(`[data-option-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setInternal(option.value);
    setInvalid(false);
    setOpen(false);
    onChange?.({
      target: { value: option.value, name: name || "" },
      currentTarget: { value: option.value, name: name || "" },
      type: "change",
      preventDefault() {},
      stopPropagation() {},
      persist() {},
    } as unknown as ChangeEvent<HTMLSelectElement>);
    trigger.current?.focus();
  }
  function expand() {
    if (disabled) return;
    const currentIndex = options.findIndex(
      (option) => option.value === selected && !option.disabled,
    );
    setActive(
      currentIndex >= 0
        ? currentIndex
        : options.findIndex((option) => !option.disabled),
    );
    setOpen(true);
  }
  function move(direction: number) {
    const enabled = options
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index >= 0);
    if (!enabled.length) return;
    const index = enabled.indexOf(active);
    setActive(enabled[(index + direction + enabled.length) % enabled.length]);
  }
  const current = options.find((option) => option.value === selected);
  return (
    <span className={"custom-select " + (className || "")} style={style}>
      <button
        ref={trigger}
        id={id || generatedId}
        type="button"
        className={"custom-select-trigger " + (invalid ? "invalid" : "")}
        role="combobox"
        disabled={disabled}
        aria-label={props["aria-label"] || label || undefined}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={invalid || props["aria-invalid"]}
        aria-required={required}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        onClick={() => (open ? setOpen(false) : expand())}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (
            ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            if (!open) {
              expand();
              return;
            }
            if (event.key === "ArrowDown") move(1);
            else if (event.key === "ArrowUp") move(-1);
            else if (event.key === "Home")
              setActive(options.findIndex((option) => !option.disabled));
            else if (event.key === "End")
              setActive(
                options
                  .map((option, index) => (option.disabled ? -1 : index))
                  .filter((index) => index >= 0)
                  .at(-1) ?? -1,
              );
            else choose(active);
            return;
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            const now = Date.now();
            typeahead.current = {
              text:
                (now - typeahead.current.time < 700
                  ? typeahead.current.text
                  : "") + event.key.toLowerCase(),
              time: now,
            };
            const match = options.findIndex(
              (option) =>
                !option.disabled &&
                option.label.toLowerCase().startsWith(typeahead.current.text),
            );
            if (match >= 0) {
              setActive(match);
              setOpen(true);
            }
          }
        }}
      >
        <span>{current?.label || "Choose…"}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <input
        ref={validation}
        className="select-validation"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={selected}
        disabled={disabled}
        required={required}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          expand();
          trigger.current?.focus();
        }}
      />
      {open &&
        position &&
        createPortal(
          <div
            ref={panel}
            id={listId}
            className="custom-select-options"
            role="listbox"
            aria-label={props["aria-label"] || label || "Options"}
            style={position}
          >
            {options.length ? (
              options.map((option, index) => (
                <div
                  role="option"
                  id={`${listId}-${index}`}
                  data-option-index={index}
                  key={option.value + index}
                  aria-selected={selected === option.value}
                  aria-disabled={option.disabled}
                  className={
                    "custom-select-option " +
                    (active === index ? "highlighted" : "")
                  }
                  onMouseEnter={() => !option.disabled && setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {selected === option.value && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </div>
              ))
            ) : (
              <p>No options available</p>
            )}
          </div>,
          trigger.current?.closest(".date-picker-panel") ||
            trigger.current?.closest("dialog") ||
            document.body,
        )}
    </span>
  );
}
