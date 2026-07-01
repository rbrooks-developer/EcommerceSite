"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const [state, action, isPending] = useActionState(login, null) as [
    { error?: Record<string, string[]> } | null,
    (payload: FormData) => void,
    boolean
  ];
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "";
  const errors = (state as { error?: Record<string, string[]> } | null)?.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm opacity-70">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="opacity-100 underline underline-offset-2">Create one</Link>
        </p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="redirect" value={redirect} />

        {errors?._form && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errors._form[0]}
          </div>
        )}

        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" error={errors?.email?.[0]} required />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="password" required>Password</Label>
            <Link href="/forgot-password" className="text-xs opacity-70 hover:opacity-100 transition-opacity">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" name="password" autoComplete="current-password" error={errors?.password?.[0]} required />
        </div>

        <Button type="submit" size="lg" className="w-full font-semibold" loading={isPending} style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)", fontFamily: "inherit" }}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
