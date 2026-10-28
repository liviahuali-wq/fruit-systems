import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupFlow } from "./setup-flow";

export const metadata: Metadata = { title: "Set up your authenticator app · Fruit Systems" };

// First sign-in: every internal user must register an authenticator app before seeing any data.
export default function SetupPage() {
  return (
    <AuthCard title="Set up your authenticator app">
      <Suspense fallback={<p className="text-sm text-zinc-500">Checking your sign-in…</p>}>
        <Gate />
      </Suspense>
    </AuthCard>
  );
}

// Only reads: this re-runs after every Server Function on the page, so it must not change anything.
async function Gate() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
  if (data.claims.aal === "aal2") redirect("/app");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.length) redirect("/mfa/verify");
  return <SetupFlow />;
}
