"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/auth-actions";

// A form posting to a Server Function, showing its error and a busy button while it runs.
export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  // A function receives the last result, for example to keep the email after a failed attempt.
  children: ReactNode | ((state: FormState) => ReactNode);
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {typeof children === "function" ? children(state) : children}
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

export function Field({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        {...input}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}

export function CodeField() {
  return (
    <Field
      label="6-digit code"
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      required
      autoFocus
    />
  );
}
