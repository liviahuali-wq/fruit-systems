import type { Metadata } from "next";
import { signOut, verifyCode } from "@/app/auth-actions";
import { AuthCard } from "@/components/auth-card";
import { AuthForm, CodeField } from "@/components/auth-form";

export const metadata: Metadata = { title: "Enter your code · Fruit Systems" };

// The Server Function checks the session; the proxy sends signed-out visitors to sign in.
export default function VerifyPage() {
  return (
    <AuthCard title="Enter your code">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Open your authenticator app and enter the 6-digit code for Fruit Systems.
      </p>
      <AuthForm action={verifyCode} submitLabel="Sign in">
        <CodeField />
      </AuthForm>
      <form action={signOut}>
        <button type="submit" className="text-sm text-zinc-500 underline">
          Use a different account
        </button>
      </form>
    </AuthCard>
  );
}
