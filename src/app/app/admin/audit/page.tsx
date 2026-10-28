import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminFrame, Panel } from "@/components/admin-frame";
import { requirePermission } from "@/lib/auth";
import { AuditList, loadAuditEvents } from "./audit-list";

export const metadata: Metadata = { title: "Audit trail · Fruit Systems" };

export default function AuditPage() {
  return (
    <AdminFrame title="Audit trail">
      <Panel>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The latest 100 changes to people, roles and the grower account. Nobody can edit or delete this list.
        </p>
        <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
          <Events />
        </Suspense>
      </Panel>
    </AdminFrame>
  );
}

async function Events() {
  await requirePermission("users", "approve");
  return <AuditList events={await loadAuditEvents({ limit: 100 })} />;
}
