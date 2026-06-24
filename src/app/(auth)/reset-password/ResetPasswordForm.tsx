"use client";

import { useActionState } from "react";
import { updatePassword } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm() {
  const [state, action, isPending] = useActionState(updatePassword, null) as [
    { error?: Record<string, string[]> } | null,
    (payload: FormData) => void,
    boolean
  ];
  const errors = state?.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
        <p className="mt-1 text-sm text-gray-500">Choose a strong password for your account.</p>
      </div>

      <form action={action} className="space-y-4">
        {errors?._form && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errors._form[0]}
          </div>
        )}

        <div>
          <Label htmlFor="password" required>New Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            error={errors?.password?.[0]}
            required
          />
        </div>

        <div>
          <Label htmlFor="confirm_password" required>Confirm Password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            error={errors?.confirm_password?.[0]}
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Update Password
        </Button>
      </form>
    </div>
  );
}
