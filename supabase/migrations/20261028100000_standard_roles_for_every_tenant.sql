-- Every tenant gets the ten standard roles (task 4.2a follow-up).
-- Hosted projects run the seed file only once, so roles cannot come from seed.sql:
-- a new tenant gets them from this trigger, and existing tenants from the line below.

create or replace function private.tenant_created()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.create_standard_roles(new.id);
  return null;
end;
$$;

create trigger tenant_create_standard_roles
  after insert on public.tenant
  for each row execute function private.tenant_created();

select private.create_standard_roles(id) from public.tenant;
