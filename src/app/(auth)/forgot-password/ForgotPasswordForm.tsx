"use client";

import { useActionState } from "react";
import { forgotPassword } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState(forgotPassword, null) as [
    { error?: Record<string, string[]>; success?: boolean } | null,
    (payload: FormData) => void,
    boolean
  ];
  const errors = state?.error;

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="text-sm text-gray-500">
          We sent a password reset link to your email address. Click the link in the email to reset your password.
        </p>
        <Link href="/login" className="inline-block text-sm text-gray-900 underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Forgot password?</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form action={action} className="space-y-4">
        {errors?._form && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errors._form[0]}
          </div>
        )}

        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            error={errors?.email?.[0]}
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Send Reset Link
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-gray-900 underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
