"use client";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
export const PasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <span className="password-input">
      <input {...props} ref={ref} type={visible ? "text" : "password"} />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((previous) => !previous)}
      >
        <Icon size={19} />
      </button>
    </span>
  );
});
