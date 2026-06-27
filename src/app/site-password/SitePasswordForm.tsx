"use client";

import { useActionState } from "react";
import { verifySitePassword } from "@/lib/actions/sitePassword";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  bgColor: string;
  fontColor: string;
}

export function SitePasswordForm({ bgColor, fontColor }: Props) {
  const [state, action, isPending] = useActionState(verifySitePassword, null);

  const inputStyle: React.CSSProperties = {
    backgroundColor: "color-mix(in srgb, var(--sp-fg, #ffffff) 8%, var(--sp-bg, #000000))",
    color: "var(--sp-fg, #ffffff)",
    border: "1px solid color-mix(in srgb, var(--sp-fg, #ffffff) 25%, transparent)",
  };

  return (
    <form
      action={action}
      className="space-y-4"
      style={{ "--sp-bg": bgColor, "--sp-fg": fontColor } as React.CSSProperties}
    >
      <div>
        <input
          type="password"
          name="password"
          placeholder="Enter password"
          autoComplete="current-password"
          autoFocus
          required
          className="w-full rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-current"
          style={inputStyle}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md py-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ backgroundColor: fontColor, color: bgColor }}
      >
        {isPending && <Spinner className="h-4 w-4" />}
        {isPending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
