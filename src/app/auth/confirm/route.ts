import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// The link in an invitation email. Exchanges the one-time token for a session, then asks the
// person to choose a password. Expired or reused links go back to sign in with a message.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type === "invite") {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect("/set-password");
  }
  redirect("/sign-in?reason=link");
}
