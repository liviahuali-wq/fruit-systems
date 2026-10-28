import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  // Null when the sign-in account has no profile in any tenant yet.
  profile: { fullName: string; tenantName: string; roles: string[] } | null;
}

// The one place that decides who is signed in. Sends anyone without both factors back to sign in.
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/sign-in");
  if (claims.aal !== "aal2") redirect("/mfa");

  // Row-level security limits both reads to the user's own tenant.
  const [{ data: person }, { data: roleRows }] = await Promise.all([
    supabase
      .from("app_user")
      .select("full_name, tenant(name)")
      .eq("id", claims.sub)
      .maybeSingle<{ full_name: string; tenant: { name: string } | null }>(),
    supabase
      .from("user_role")
      .select("role(name)")
      .eq("user_id", claims.sub)
      .returns<{ role: { name: string } | null }[]>(),
  ]);

  return {
    id: claims.sub,
    email: String(claims.email ?? ""),
    profile: person
      ? {
          fullName: person.full_name,
          tenantName: person.tenant?.name ?? "",
          roles: (roleRows ?? []).flatMap((row) => (row.role ? [row.role.name] : [])).sort(),
        }
      : null,
  };
}
