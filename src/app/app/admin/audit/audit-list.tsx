import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

export interface AuditView {
  id: number;
  when: string;
  who: string;
  what: string;
}

interface AuditRow {
  id: number;
  occurred_at: string;
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete";
  actor_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

const IGNORED = new Set(["updated_at", "updated_by", "created_at", "created_by"]);

// Reads the trail through row-level security (tenant administrators only) and turns each
// change into a sentence. rowId narrows it to one person, including their role changes.
export async function loadAuditEvents({ rowId, limit }: { rowId?: string; limit: number }): Promise<AuditView[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("audit_event")
    .select("id, occurred_at, table_name, row_id, action, actor_id, before, after")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (rowId) query = query.like("row_id", `${rowId}%`);
  const { data } = await query.returns<AuditRow[]>();
  const rows = data ?? [];

  const [{ data: people }, { data: roles }] = await Promise.all([
    supabase.from("app_user").select("id, full_name"),
    supabase.from("role").select("id, name"),
  ]);
  const personName = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));
  const roleName = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));

  return rows.map((row) => ({
    id: row.id,
    when: sydneyTime(row.occurred_at),
    who: row.actor_id ? personName.get(row.actor_id) ?? "Someone no longer listed" : "System",
    what: describe(row, personName, roleName),
  }));
}

function describe(row: AuditRow, personName: Map<string, string>, roleName: Map<string, string>): string {
  const subject = row.after ?? row.before ?? {};
  if (row.table_name === "user_role") {
    const person = personName.get(String(subject.user_id)) ?? "someone";
    const role = roleName.get(String(subject.role_id)) ?? "a role";
    return row.action === "insert" ? `Gave ${person} the role ${role}` : `Removed the role ${role} from ${person}`;
  }
  const label = { app_user: "person", role: "role", tenant: "grower account" }[row.table_name] ?? row.table_name;
  const name = String(subject.full_name ?? subject.name ?? "");
  if (row.action === "insert") return `Added ${label} ${name}`.trim();
  if (row.action === "delete") return `Removed ${label} ${name}`.trim();

  const changes = Object.keys(row.after ?? {})
    .filter((key) => !IGNORED.has(key) && JSON.stringify(row.before?.[key]) !== JSON.stringify(row.after?.[key]))
    .map((key) => `${key.replaceAll("_", " ")}: ${show(row.before?.[key])} → ${show(row.after?.[key])}`);
  return `Changed ${label} ${name}: ${changes.join("; ")}`;
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return sydneyTime(value);
  return String(value);
}

function sydneyTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });
}

export function AuditList({ events }: { events: AuditView[] }) {
  if (events.length === 0) return <p className="text-sm text-zinc-500">No changes recorded yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-0.5 py-2">
          <span>{event.what}</span>
          <span className="text-zinc-500">{event.who} · {event.when}</span>
        </li>
      ))}
    </ul>
  );
}
