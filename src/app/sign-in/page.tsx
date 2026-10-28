import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · Fruit Systems" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthCard title="Sign in">
      <Suspense fallback={null}>
        <ReasonNotice searchParams={searchParams} />
      </Suspense>
      <SignInForm />
      <p className="text-sm text-zinc-500">
        Next you will enter a code from your authenticator app. Demo accounts only; all data is fictional.
      </p>
    </AuthCard>
  );
}

async function ReasonNotice({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const { reason } = await searchParams;
  const message = {
    idle: "You were signed out after 12 hours without activity.",
    link: "That link has expired or was already used. Ask your administrator to invite you again.",
  }[String(reason)];
  if (!message) return null;
  return (
    <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      {message}
    </p>
  );
}
