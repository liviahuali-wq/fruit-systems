import type { Metadata } from "next";
import { setPassword } from "@/app/auth-actions";
import { AuthCard } from "@/components/auth-card";
import { AuthForm, Field } from "@/components/auth-form";

export const metadata: Metadata = { title: "Choose a password · Fruit Systems" };

// Reached from an invitation link. The Server Function checks the session itself.
export default function SetPasswordPage() {
  return (
    <AuthCard title="Choose a password">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Use at least 12 characters. Next you will set up your authenticator app.
      </p>
      <AuthForm action={setPassword} submitLabel="Save and continue">
        <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={12} required autoFocus />
        <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
      </AuthForm>
    </AuthCard>
  );
}
