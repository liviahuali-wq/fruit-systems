"use client";

import { AuthForm, Field } from "@/components/auth-form";
import { deactivatePerson, invitePerson, updateRoles } from "./actions";

export interface RoleOption {
  id: string;
  name: string;
}

function RoleChoices({ roles, held = [] }: { roles: RoleOption[]; held?: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Roles</legend>
      {roles.map((role) => (
        <label key={role.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="roleId" value={role.id} defaultChecked={held.includes(role.id)} />
          {role.name}
        </label>
      ))}
    </fieldset>
  );
}

export function InviteForm({ roles }: { roles: RoleOption[] }) {
  return (
    <AuthForm action={invitePerson} submitLabel="Send invitation">
      <Field label="Full name" name="fullName" required autoFocus />
      <Field label="Email" name="email" type="email" required />
      <RoleChoices roles={roles} />
    </AuthForm>
  );
}

export function RolesForm({ userId, roles, held }: { userId: string; roles: RoleOption[]; held: string[] }) {
  return (
    <AuthForm action={updateRoles} submitLabel="Save roles">
      <input type="hidden" name="userId" value={userId} />
      <RoleChoices roles={roles} held={held} />
    </AuthForm>
  );
}

export function DeactivateForm({ userId, name }: { userId: string; name: string }) {
  return (
    <AuthForm action={deactivatePerson} submitLabel="Deactivate">
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {name} will be signed out and lose access at once. Their name stays on records and in the audit trail.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" value="yes" required />
        I understand
      </label>
    </AuthForm>
  );
}
