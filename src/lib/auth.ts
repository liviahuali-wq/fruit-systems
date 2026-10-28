import "server-only";
import { notFound, redirect } from "next/navigation";
import { holds, type Action, type Module } from "@/lib/permissions";
import { createServerSupabase } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  // Null when the sign-in account has no active profile in any tenant.
  profile: {
    fullName: string;
    tenantId: string;
    tenantName: string;
    roles: string[];
    permissions: string[];
  } | null;
}

// The one place that decides who is signed in. Sends anyone without both factors back to sign in.
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/sign-in");
  if (claims.aal !== "aal2") redirect("/mfa");

  // Row-level security limits both reads to the user's own tenant, and hides leavers.
  const [{ data: person }, { data: roleRows }] = await Promise.all([
    supabase
      .from("app_user")
      .select("full_name, tenant_id, tenant(name)")
      .eq("id", claims.sub)
      .maybeSingle<{ full_name: string; tenant_id: string; tenant: { name: string } | null }>(),
    supabase
      .from("user_role")
      .select("role(name, permissions)")
      .eq("user_id", claims.sub)
      .returns<{ role: { name: string; permissions: string[] } | null }[]>(),
  ]);

  const roles = (roleRows ?? []).flatMap((row) => (row.role ? [row.role] : []));
  return {
    id: claims.sub,
    email: String(claims.email ?? ""),
    profile: person
      ? {
          fullName: person.full_name,
          tenantId: person.tenant_id,
          tenantName: person.tenant?.name ?? "",
          roles: roles.map((role) => role.name).sort(),
          permissions: [...new Set(roles.flatMap((role) => role.permissions))],
        }
      : null,
  };
}

// For pages and Server Functions that need a permission. Someone without it gets "not found",
// so the page does not reveal that it exists.
export async function requirePermission(module: Module, action: Action) {
  const user = await requireUser();
  if (!user.profile || !holds(user.profile.permissions, module, action)) notFound();
  return { ...user, profile: user.profile };
}
