import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminFrame, Panel } from "@/components/admin-frame";
import { requirePermission } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { InviteForm } from "../person-forms";

export const metadata: Metadata = { title: "Add a person · Fruit Systems" };

export default function NewPersonPage() {
  return (
    <AdminFrame title="Add a person" back={{ href: "/app/admin/users", label: "People and roles" }}>
      <Panel>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          They get an email to choose a password and set up their authenticator app. The link expires after 7 days.
        </p>
        <Suspense fallback={<p className="text-zinc-500">Loading roles…</p>}>
          <Form />
        </Suspense>
      </Panel>
    </AdminFrame>
  );
}

async function Form() {
  await requirePermission("users", "approve");
  const supabase = await createServerSupabase();
  const { data: roles } = await supabase.from("role").select("id, name").is("archived_at", null).order("name");
  return <InviteForm roles={roles ?? []} />;
}
