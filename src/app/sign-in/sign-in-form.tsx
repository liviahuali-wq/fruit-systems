"use client";

import { signIn } from "@/app/auth-actions";
import { AuthForm, Field } from "@/components/auth-form";

// Keeps the email after a failed attempt and moves the cursor to the password.
export function SignInForm() {
  return (
    <AuthForm action={signIn} submitLabel="Continue">
      {(state) => (
        <>
          <Field label="Email" name="email" type="email" autoComplete="username" required
            defaultValue={state.email} key={state.email} autoFocus={!state.email} />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required
            autoFocus={Boolean(state.email)} />
        </>
      )}
    </AuthForm>
  );
}
