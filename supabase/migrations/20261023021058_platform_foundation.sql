-- Platform foundation (task 4.1)
-- The tenant table, the helpers every later table relies on, and a health check.
-- Rules come from the Solution Design: Data model conventions and Security, D-05.

-- Helpers live in a schema the public API does not expose.
create schema if not exists private;

-- The signed-in user's tenant, read from their sign-in token.
-- The token hook that puts tenant_id there is built in task 4.2; until then it is null,
-- so every tenant policy returns no rows.
create or replace function private.current_tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_tenant_id() to authenticated;

-- Keeps updated_at current on every table that has it.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- One grower. Parent of every business row.
create table public.tenant (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  abn         char(11) check (abn ~ '^[0-9]{11}$'),
  web_address text,
  plan        text not null default 'growth'
              check (plan in ('starter', 'growth', 'large_grower')),
  status      text not null default 'trial'
              check (status in ('trial', 'active', 'past_due', 'read_only', 'cancelled')),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  archived_at timestamptz
);

comment on table public.tenant is 'One grower. Parent of every business row (Solution Design, Data model).';

create trigger tenant_set_updated_at
  before update on public.tenant
  for each row execute function private.set_updated_at();

-- A user sees only their own tenant. Tenants are created and changed by the system
-- (sign-up and billing), never directly by users, so there are no write policies.
alter table public.tenant enable row level security;

create policy tenant_read_own on public.tenant
  for select
  to authenticated
  using (id = private.current_tenant_id());

-- Health check for the /api/health page and the uptime monitor.
-- Returns no tenant data, so anyone may call it.
create or replace function public.health()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('database', 'ok', 'checked_at', now())
$$;

grant execute on function public.health() to anon, authenticated;
