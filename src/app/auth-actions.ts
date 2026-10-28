"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IDLE_COOKIE } from "@/lib/idle";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  email?: string; // returned after a failed sign-in so the form can keep it
}

const SIX_DIGITS = /^\d{6}$/;

// Step 1: email and password. The second factor follows on /mfa.
export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Never say which of the two was wrong.
    return error.status === 429
      ? { error: "Too many attempts. Wait a few minutes, then try again.", email }
      : { error: "Email or password is incorrect.", email };
  }
  redirect("/mfa");
}

export interface SetupState {
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
}

// First sign-in: create the authenticator key. Done on request, never while rendering, because
// a page re-renders after every Server Function and would replace a key already scanned.
export async function startAuthenticatorSetup(): Promise<SetupState> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.length) redirect("/mfa/verify");

  // A set-up abandoned earlier leaves an unconfirmed key; replace it.
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data: enrolled, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Fruit Systems",
  });
  if (error || !enrolled) return { error: "Could not start the set-up. Try again." };
  return { factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret };
}

// First sign-in: confirm the authenticator app by entering its first code.
export async function confirmNewAuthenticator(_: FormState, formData: FormData): Promise<FormState> {
  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!SIX_DIGITS.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };

  const supabase = await createServerSupabase();
  // Auth only accepts a factor that belongs to the signed-in user.
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: "That code did not match. Try the newest code in the app." };
  redirect("/app");
}

// Every later sign-in: the 6-digit code from the registered app.
export async function verifyCode(_: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!SIX_DIGITS.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };

  const supabase = await createServerSupabase();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp[0];
  if (!factor) redirect("/mfa/setup");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "That code did not match. Try the newest code in the app." };
  redirect("/app");
}

// Accepting an invitation: choose a password, become active, then set up the authenticator app.
export async function setPassword(_: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 12) return { error: "Use at least 12 characters." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords do not match." };

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in?reason=link");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return error.code === "weak_password"
      ? { error: "That password is too easy to guess. Try a longer one." }
      : { error: "Could not save the password. Try again." };
  }

  // Only an invited person becomes active here; a deactivated one stays deactivated.
  await createAdminSupabase()
    .from("app_user")
    .update({ status: "active", updated_by: data.claims.sub })
    .eq("id", data.claims.sub)
    .eq("status", "invited");
  redirect("/mfa/setup");
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(IDLE_COOKIE);
  redirect("/sign-in");
}
