"use client";

import { useState, InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
}

export function PasswordInput({ className, error, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={cn(
            "flex h-11 w-full rounded-md border px-3 py-2 pr-10 text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          style={{
            backgroundColor: "var(--input-bg, white)",
            color: "var(--input-text, #111827)",
            borderColor: error ? undefined : "var(--input-border, #d1d5db)",
          }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            insetBlock: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            paddingInline: "0.75rem",
            opacity: 0.5,
            background: "none",
            border: "none",
            cursor: "pointer",
            minHeight: 0,
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "0.5")}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
