import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { createServerSupabase } from "@/lib/supabase/server";

// After the password: sends a first-time user to set up their app, everyone else to enter a code.
export default function MfaPage() {
  return (
    <Suspense fallback={<AuthCard title="Checking your sign-in">{null}</AuthCard>}>
      <ChooseStep />
    </Suspense>
  );
}

async function ChooseStep(): Promise<never> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
  if (data.claims.aal === "aal2") redirect("/app");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  redirect(factors?.totp.length ? "/mfa/verify" : "/mfa/setup");
}
