-- Users, roles, the audit log and the sign-in token hook (task 4.2a)
-- Rules come from the Solution Design: Security (sign-in, multi-factor, tenant isolation),
-- Users, roles and permissions, and X-04 (audit trail).

-- ---------------------------------------------------------------------------------------------
-- Multi-factor: the database refuses business data to a session without the second factor.
-- Every tenant policy goes through current_tenant_id(), so it returns null below aal2.
-- ---------------------------------------------------------------------------------------------
create or replace function private.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when auth.jwt() ->> 'aal' = 'aal2' then nullif(auth.jwt() ->> 'tenant_id', '')::uuid
  end
$$;

-- Fills created_by and updated_by from the signed-in user. System jobs leave them as given.
create or replace function private.stamp_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger tenant_stamp_actor
  before insert or update on public.tenant
  for each row execute function private.stamp_actor();

-- ---------------------------------------------------------------------------------------------
-- Permissions: a module and an action. The list is fixed in code; this copy lets the database
-- reject a role holding a permission that does not exist.
-- An action includes the ones below it: approve includes edit, and edit includes view.
-- ---------------------------------------------------------------------------------------------
create or replace function private.permission_catalogue()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_agg(m || '.' || a order by m, a)
  from unnest(array['customers', 'orders', 'inventory', 'dispatch', 'receivables',
                    'licences', 'users', 'reports']) as m,
       unnest(array['view', 'edit', 'approve']) as a
$$;

-- ---------------------------------------------------------------------------------------------
-- People. One row per sign-in account; one person, one account, one tenant.
-- Leavers are deactivated, never deleted, so the audit trail keeps their name.
-- ---------------------------------------------------------------------------------------------
create table public.app_user (
  id             uuid primary key references auth.users (id) on delete restrict,
  tenant_id      uuid not null references public.tenant (id),
  full_name      text not null check (length(trim(full_name)) > 0),
  email          text not null,
  status         text not null default 'active'
                 check (status in ('invited', 'active', 'deactivated')),
  deactivated_at timestamptz,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  unique (tenant_id, id)
);

comment on table public.app_user is 'A person''s profile, linked to their Supabase sign-in account (Solution Design, Data model).';

create index app_user_tenant_idx on public.app_user (tenant_id);

-- Roles: named sets of permissions. Ten standard roles per tenant; administrators may adjust them.
create table public.role (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant (id),
  key             text not null check (key ~ '^[a-z_]+$'),
  name            text not null check (length(trim(name)) > 0),
  permissions     text[] not null default '{}'
                  check (permissions <@ private.permission_catalogue()),
  -- Limits for approvals within a role, such as credit notes; filled in by later modules.
  approval_limits jsonb not null default '{}',
  is_standard     boolean not null default false,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  archived_at     timestamptz,
  unique (tenant_id, key),
  unique (tenant_id, id)
);

comment on table public.role is 'A named set of permissions; one person can hold several (Solution Design, Users and roles).';

-- Who holds which role. The composite keys keep a person and a role in the same tenant.
create table public.user_role (
  tenant_id  uuid not null references public.tenant (id),
  user_id    uuid not null,
  role_id    uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (user_id, role_id),
  foreign key (tenant_id, user_id) references public.app_user (tenant_id, id),
  foreign key (tenant_id, role_id) references public.role (tenant_id, id)
);

create index user_role_tenant_idx on public.user_role (tenant_id);
create index user_role_role_idx on public.user_role (role_id);

create trigger app_user_set_updated_at
  before update on public.app_user
  for each row execute function private.set_updated_at();
create trigger app_user_stamp_actor
  before insert or update on public.app_user
  for each row execute function private.stamp_actor();
create trigger role_set_updated_at
  before update on public.role
  for each row execute function private.set_updated_at();
create trigger role_stamp_actor
  before insert or update on public.role
  for each row execute function private.stamp_actor();

create or replace function private.stamp_user_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger user_role_stamp_actor
  before insert on public.user_role
  for each row execute function private.stamp_user_role();

-- Does the signed-in user hold this permission (or a higher action in the same module)?
-- Read from the tables, not the token, so a role change takes effect at the next action.
create or replace function private.has_permission(module text, action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_role ur
    join public.role r on r.id = ur.role_id
    join public.app_user u on u.id = ur.user_id
    where ur.user_id = auth.uid()
      and u.tenant_id = private.current_tenant_id()
      and u.status = 'active'
      and r.archived_at is null
      and r.permissions && case action
        when 'view'    then array[module || '.view', module || '.edit', module || '.approve']
        when 'edit'    then array[module || '.edit', module || '.approve']
        when 'approve' then array[module || '.approve']
      end
  )
$$;

grant execute on function private.has_permission(text, text) to authenticated;

-- Everyone in a tenant can see its people and roles (names on records, role pickers).
-- Role changes need users.approve. People are added and deactivated by server code,
-- because that also changes their sign-in account.
alter table public.app_user enable row level security;
alter table public.role enable row level security;
alter table public.user_role enable row level security;

create policy app_user_read_own_tenant on public.app_user
  for select to authenticated
  using (tenant_id = private.current_tenant_id());

create policy role_read_own_tenant on public.role
  for select to authenticated
  using (tenant_id = private.current_tenant_id());

create policy role_manage on public.role
  for all to authenticated
  using (tenant_id = private.current_tenant_id() and private.has_permission('users', 'approve'))
  with check (tenant_id = private.current_tenant_id() and private.has_permission('users', 'approve'));

create policy user_role_read_own_tenant on public.user_role
  for select to authenticated
  using (tenant_id = private.current_tenant_id());

create policy user_role_manage on public.user_role
  for all to authenticated
  using (tenant_id = private.current_tenant_id() and private.has_permission('users', 'approve'))
  with check (tenant_id = private.current_tenant_id() and private.has_permission('users', 'approve'));

revoke insert, update, delete on public.app_user from anon, authenticated;
revoke all on public.role, public.user_role from anon;

-- ---------------------------------------------------------------------------------------------
-- The ten standard roles (Solution Design, permission table). Runs for each new tenant;
-- safe to run again.
-- ---------------------------------------------------------------------------------------------
create or replace function private.create_standard_roles(p_tenant_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.role (tenant_id, key, name, permissions, is_standard)
  values
    (p_tenant_id, 'tenant_admin', 'Tenant administrator',
     array['customers.view', 'orders.view', 'inventory.view', 'dispatch.view', 'receivables.view',
           'licences.view', 'users.approve', 'reports.view'], true),
    (p_tenant_id, 'sales_manager', 'Sales manager',
     array['customers.edit', 'orders.approve', 'inventory.view', 'dispatch.view',
           'receivables.view', 'reports.view'], true),
    (p_tenant_id, 'sales_admin', 'Sales administrator',
     array['customers.edit', 'orders.edit', 'inventory.view', 'dispatch.view', 'reports.view'], true),
    (p_tenant_id, 'credit_officer', 'Credit officer',
     array['customers.approve', 'orders.view', 'dispatch.view', 'receivables.edit',
           'reports.view'], true),
    (p_tenant_id, 'packhouse_supervisor', 'Packhouse supervisor',
     array['orders.view', 'inventory.edit', 'dispatch.view', 'licences.view', 'reports.view'], true),
    (p_tenant_id, 'dispatch_coordinator', 'Dispatch coordinator',
     array['customers.view', 'orders.view', 'inventory.view', 'dispatch.edit', 'licences.view',
           'reports.view'], true),
    (p_tenant_id, 'qa_compliance_manager', 'QA and compliance manager',
     array['orders.view', 'inventory.edit', 'dispatch.view', 'licences.approve',
           'reports.view'], true),
    (p_tenant_id, 'accounts_officer', 'Accounts officer',
     array['customers.view', 'orders.view', 'dispatch.view', 'receivables.edit', 'licences.edit',
           'reports.view'], true),
    (p_tenant_id, 'finance_manager', 'Finance manager',
     array['customers.approve', 'orders.view', 'inventory.approve', 'dispatch.view',
           'receivables.approve', 'licences.view', 'reports.view'], true),
    (p_tenant_id, 'executive', 'Executive / owner',
     array['customers.view', 'orders.view', 'inventory.view', 'dispatch.view', 'receivables.view',
           'licences.view', 'reports.view'], true)
  on conflict (tenant_id, key) do nothing;
$$;

-- ---------------------------------------------------------------------------------------------
-- Audit trail (X-04): who changed what, when, with before-and-after values.
-- Written only by triggers; nobody can edit or delete it, not even the database owner.
-- ---------------------------------------------------------------------------------------------
create table public.audit_event (
  id          bigint generated always as identity primary key,
  tenant_id   uuid references public.tenant (id),
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  actor_id    uuid, -- null for system jobs
  before      jsonb,
  after       jsonb,
  occurred_at timestamptz not null default now()
);

comment on table public.audit_event is 'Every change to audited tables, written by triggers and never edited (X-04).';

create index audit_event_tenant_time_idx on public.audit_event (tenant_id, occurred_at desc);
create index audit_event_row_idx on public.audit_event (table_name, row_id);

alter table public.audit_event enable row level security;

-- Tenant administrators read their own tenant's trail.
create policy audit_event_read_own_tenant on public.audit_event
  for select to authenticated
  using (tenant_id = private.current_tenant_id() and private.has_permission('users', 'approve'));

revoke all on public.audit_event from anon, authenticated;
grant select on public.audit_event to authenticated;

create or replace function private.refuse_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_event is append-only: % is not allowed', lower(tg_op);
end;
$$;

create trigger audit_event_append_only
  before update or delete on public.audit_event
  for each row execute function private.refuse_audit_change();

create trigger audit_event_no_truncate
  before truncate on public.audit_event
  for each statement execute function private.refuse_audit_change();

-- Generic row trigger. The tenant is the row's tenant_id, or the row itself for the tenant table.
create or replace function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  any_row jsonb := coalesce(new_row, old_row);
begin
  -- An update that changed nothing but the timestamps is not worth recording.
  if tg_op = 'UPDATE'
     and old_row - 'updated_at' - 'updated_by' = new_row - 'updated_at' - 'updated_by' then
    return null;
  end if;

  insert into public.audit_event (tenant_id, table_name, row_id, action, actor_id, before, after)
  values (
    case when tg_table_name = 'tenant' then (any_row ->> 'id')::uuid
         else (any_row ->> 'tenant_id')::uuid end,
    tg_table_name,
    coalesce(any_row ->> 'id', concat_ws(':', any_row ->> 'user_id', any_row ->> 'role_id')),
    lower(tg_op),
    auth.uid(),
    old_row,
    new_row
  );
  return null;
end;
$$;

create trigger tenant_audit
  after insert or update or delete on public.tenant
  for each row execute function private.write_audit();
create trigger app_user_audit
  after insert or update or delete on public.app_user
  for each row execute function private.write_audit();
create trigger role_audit
  after insert or update or delete on public.role
  for each row execute function private.write_audit();
create trigger user_role_audit
  after insert or update or delete on public.user_role
  for each row execute function private.write_audit();

-- ---------------------------------------------------------------------------------------------
-- Sign-in token hook: adds the user's tenant and role keys to every access token.
-- Enabled in config.toml locally and under Authentication > Hooks on hosted projects.
-- No tenant (unknown, deactivated, or tenant cancelled) means no tenant_id claim, so no data.
-- ---------------------------------------------------------------------------------------------
create or replace function private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims    jsonb := event -> 'claims';
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_tenant  uuid;
  v_roles   text[];
begin
  select u.tenant_id into v_tenant
  from public.app_user u
  join public.tenant t on t.id = u.tenant_id
  where u.id = v_user_id
    and u.status = 'active'
    and t.status <> 'cancelled'
    and t.archived_at is null;

  if v_tenant is null then
    claims := claims - 'tenant_id' - 'app_roles';
  else
    select coalesce(array_agg(r.key order by r.key), '{}') into v_roles
    from public.user_role ur
    join public.role r on r.id = ur.role_id
    where ur.user_id = v_user_id
      and r.archived_at is null;

    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant::text));
    claims := jsonb_set(claims, '{app_roles}', to_jsonb(v_roles));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function private.custom_access_token_hook(jsonb) from public, anon, authenticated;

grant select on public.tenant, public.app_user, public.role, public.user_role to supabase_auth_admin;

create policy tenant_read_by_auth on public.tenant
  for select to supabase_auth_admin using (true);
create policy app_user_read_by_auth on public.app_user
  for select to supabase_auth_admin using (true);
create policy role_read_by_auth on public.role
  for select to supabase_auth_admin using (true);
create policy user_role_read_by_auth on public.user_role
  for select to supabase_auth_admin using (true);
