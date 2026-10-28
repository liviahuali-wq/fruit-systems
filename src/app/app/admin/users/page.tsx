import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame, Panel, StatusBadge } from "@/components/admin-frame";
import { requirePermission } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People and roles · Fruit Systems" };

export default function PeoplePage() {
  return (
    <AdminFrame title="People and roles">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <People />
      </Suspense>
    </AdminFrame>
  );
}

interface PersonRow {
  id: string;
  full_name: string;
  email: string;
  status: string;
  user_role: { role: { name: string } | null }[];
}

async function People() {
  await requirePermission("users", "approve");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("app_user")
    .select("id, full_name, email, status, user_role(role(name))")
    .order("status")
    .order("full_name")
    .returns<PersonRow[]>();

  return (
    <>
      <div>
        <Link href="/app/admin/users/new" className="inline-block rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Add a person
        </Link>
      </div>
      <Panel>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Roles</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((person) => (
              <tr key={person.id} className="border-t border-zinc-100 dark:border-zinc-900">
                <td className="py-2">
                  <Link href={`/app/admin/users/${person.id}`} className="font-medium underline">{person.full_name}</Link>
                  <div className="text-zinc-500">{person.email}</div>
                </td>
                <td className="py-2">{person.user_role.flatMap((ur) => (ur.role ? [ur.role.name] : [])).sort().join(", ") || "None"}</td>
                <td className="py-2"><StatusBadge status={person.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
