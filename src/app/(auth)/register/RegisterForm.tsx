"use client";

import { useActionState } from "react";
import { register } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function RegisterForm() {
  const [state, action, isPending] = useActionState(register, null) as [
    { error?: Record<string, string[]>; success?: boolean } | null,
    (payload: FormData) => void,
    boolean
  ];

  const errors = state?.error;
  const success = state?.success;

  if (success) {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="text-gray-500 text-sm">
          We sent a confirmation link to your email. Click it to activate your account, then{" "}
          <Link href="/login" className="text-gray-900 underline underline-offset-2">sign in</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-gray-900 underline underline-offset-2">Sign in</Link>
        </p>
      </div>

      <form action={action} className="space-y-4">
        {errors?._form && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errors._form[0]}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name" required>First Name</Label>
            <Input
              id="first_name"
              name="first_name"
              autoComplete="given-name"
              error={errors?.first_name?.[0]}
              required
            />
          </div>
          <div>
            <Label htmlFor="last_name" required>Last Name</Label>
            <Input
              id="last_name"
              name="last_name"
              autoComplete="family-name"
              error={errors?.last_name?.[0]}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" error={errors?.email?.[0]} required />
        </div>

        <div>
          <Label htmlFor="password" required>Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" error={errors?.password?.[0]} required />
          <p className="mt-1 text-xs text-gray-400">Minimum 8 characters</p>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Create account
        </Button>
      </form>
    </div>
  );
}
