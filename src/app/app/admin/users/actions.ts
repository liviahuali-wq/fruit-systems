"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/auth-actions";
import { requirePermission } from "@/lib/auth";
import { holds, parsePersonForm } from "@/lib/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

// Every function here checks users.approve itself; the page check is not enough on its own.

// The tenant's own roles among those submitted. Row-level security limits the read to the tenant.
async function tenantRoles(roleIds: string[]) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("role").select("id, permissions").is("archived_at", null);
  return (data ?? []).filter((role) => roleIds.includes(role.id));
}

// Add a person: create their sign-in account, send the invitation, record their profile and roles.
export async function invitePerson(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("users", "approve");
  const parsed = parsePersonForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { fullName, email, roleIds } = parsed.value;

  const roles = await tenantRoles(roleIds);
  if (roles.length !== roleIds.length) return { error: "Choose roles from the list." };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const service = createAdminSupabase();
  const { data: invited, error } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
    data: { full_name: fullName },
  });
  if (error || !invited.user) {
    if (error?.code === "email_exists") return { error: "Someone with this email already has an account." };
    // The free email service only reaches the project's own team (D-14).
    return { error: "The invitation email could not be sent. On the demo, people are added by script; see the runbook." };
  }

  const { error: profileError } = await service.from("app_user").insert({
    id: invited.user.id,
    tenant_id: admin.profile.tenantId, // always the administrator's own tenant
    full_name: fullName,
    email,
    status: "invited",
    created_by: admin.id,
    updated_by: admin.id,
  });
  if (profileError) {
    await service.auth.admin.deleteUser(invited.user.id);
    return { error: "Could not add this person. Nothing was saved; try again." };
  }

  // Roles go through the administrator's own session, so the audit trail names them.
  const supabase = await createServerSupabase();
  const { error: rolesError } = await supabase.from("user_role").insert(
    roles.map((role) => ({ tenant_id: admin.profile.tenantId, user_id: invited.user.id, role_id: role.id })),
  );
  // The person exists and is invited; their page shows the roles, so they can be set again there.
  redirect(`/app/admin/users/${invited.user.id}?${rolesError ? "roles=failed" : "invited=1"}`);
}

// Replace a person's roles with the ones ticked.
export async function updateRoles(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("users", "approve");
  const userId = String(formData.get("userId") ?? "");
  const roleIds = formData.getAll("roleId").map(String);
  if (roleIds.length === 0) return { error: "Choose at least one role." };

  const roles = await tenantRoles(roleIds);
  if (roles.length !== roleIds.length) return { error: "Choose roles from the list." };
  if (userId === admin.id && !holds(roles.flatMap((role) => role.permissions), "users", "approve")) {
    return { error: "You cannot remove your own access to people and roles. Ask another administrator." };
  }

  const supabase = await createServerSupabase();
  const { data: current } = await supabase.from("user_role").select("role_id").eq("user_id", userId);
  const held = (current ?? []).map((row) => row.role_id as string);
  const toRemove = held.filter((id) => !roleIds.includes(id));
  const toAdd = roleIds.filter((id) => !held.includes(id));

  if (toRemove.length) {
    const { error } = await supabase.from("user_role").delete().eq("user_id", userId).in("role_id", toRemove);
    if (error) return { error: "Could not change the roles. Try again." };
  }
  if (toAdd.length) {
    const { error } = await supabase.from("user_role").insert(
      toAdd.map((roleId) => ({ tenant_id: admin.profile.tenantId, user_id: userId, role_id: roleId })),
    );
    if (error) return { error: "Could not change the roles. Try again." };
  }
  redirect(`/app/admin/users/${userId}?saved=1`);
}

// A leaver keeps their name in the trail but loses access at once: no data, no new sign-ins.
export async function deactivatePerson(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("users", "approve");
  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) return { error: "You cannot deactivate yourself. Ask another administrator." };
  if (formData.get("confirm") !== "yes") return { error: "Tick the box to confirm." };

  const service = createAdminSupabase();
  const { data: updated, error } = await service
    .from("app_user")
    .update({ status: "deactivated", deactivated_at: new Date().toISOString(), updated_by: admin.id })
    .eq("id", userId)
    .eq("tenant_id", admin.profile.tenantId) // never another tenant's person
    .neq("status", "deactivated")
    .select("id");
  if (error || !updated?.length) return { error: "Could not deactivate this person. Try again." };

  // Blocks new sign-ins and token refreshes. Tokens already issued see no data (private.current_tenant_id).
  await service.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  redirect(`/app/admin/users/${userId}?deactivated=1`);
}
