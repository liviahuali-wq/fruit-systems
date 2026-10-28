// Permissions are a module and an action (Solution Design, Users and roles). An action includes
// the ones below it: approve includes edit, and edit includes view. The database applies the
// same rule in private.has_permission(); keep the two in step.

export const MODULES = [
  "customers", "orders", "inventory", "dispatch", "receivables", "licences", "users", "reports",
] as const;
export const ACTIONS = ["view", "edit", "approve"] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];

export function holds(permissions: readonly string[], module: Module, action: Action): boolean {
  const needed = ACTIONS.indexOf(action);
  return ACTIONS.some((held, rank) => rank >= needed && permissions.includes(`${module}.${held}`));
}

export interface PersonInput {
  fullName: string;
  email: string;
  roleIds: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks the "add a person" form. Role IDs are checked against the tenant's roles separately.
export function parsePersonForm(form: { get(name: string): unknown; getAll(name: string): unknown[] }):
  { ok: true; value: PersonInput } | { ok: false; error: string } {
  const fullName = String(form.get("fullName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const roleIds = form.getAll("roleId").map(String).filter(Boolean);
  if (!fullName) return { ok: false, error: "Enter the person's full name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (roleIds.length === 0) return { ok: false, error: "Choose at least one role." };
  return { ok: true, value: { fullName, email, roleIds } };
}
