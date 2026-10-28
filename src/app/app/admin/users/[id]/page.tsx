import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuditList, loadAuditEvents } from "@/app/app/admin/audit/audit-list";
import { AdminFrame, Notice, Panel, StatusBadge } from "@/components/admin-frame";
import { requirePermission } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { DeactivateForm, RolesForm } from "../person-forms";

export const metadata: Metadata = { title: "Person · Fruit Systems" };

export default function PersonPage({ params, searchParams }: PageProps<"/app/admin/users/[id]">) {
  return (
    <AdminFrame title="Person" back={{ href: "/app/admin/users", label: "People and roles" }}>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Person params={params} searchParams={searchParams} />
      </Suspense>
    </AdminFrame>
  );
}

const NOTICES: Record<string, string> = {
  invited: "Invitation sent.",
  saved: "Roles saved. They apply from the person's next action.",
  deactivated: "Deactivated. They have lost access.",
};

async function Person({ params, searchParams }: Pick<PageProps<"/app/admin/users/[id]">, "params" | "searchParams">) {
  const admin = await requirePermission("users", "approve");
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabase();

  const [{ data: person }, { data: roles }, { data: held }] = await Promise.all([
    supabase.from("app_user").select("id, full_name, email, status, created_at").eq("id", id).maybeSingle(),
    supabase.from("role").select("id, name").is("archived_at", null).order("name"),
    supabase.from("user_role").select("role_id").eq("user_id", id),
  ]);
  if (!person) notFound(); // also another tenant's person: row-level security hides them

  const notice = Object.keys(NOTICES).find((key) => query[key]);
  const events = await loadAuditEvents({ rowId: id, limit: 20 }); // the person and their role changes

  return (
    <>
      {notice && <Notice>{NOTICES[notice]}</Notice>}
      {query.roles === "failed" && (
        <p role="alert" className="text-sm text-red-700">The invitation was sent but the roles were not saved. Choose them again below.</p>
      )}
      <Panel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">{person.full_name}</p>
            <p className="text-sm text-zinc-500">{person.email}</p>
          </div>
          <StatusBadge status={person.status} />
        </div>
      </Panel>
      {person.status !== "deactivated" && (
        <Panel title="Roles">
          <RolesForm userId={person.id} roles={roles ?? []} held={(held ?? []).map((row) => row.role_id as string)} />
        </Panel>
      )}
      {person.status !== "deactivated" && person.id !== admin.id && (
        <Panel title="Deactivate">
          <DeactivateForm userId={person.id} name={person.full_name} />
        </Panel>
      )}
      <Panel title="Changes">
        <AuditList events={events} />
      </Panel>
    </>
  );
}
