-- Leavers lose access at once, and server jobs are named in the audit trail (task 4.2c).
-- Solution Design: Users, roles and permissions (user lifecycle) and X-04.

-- A deactivated person's access token stays valid until it expires (up to an hour), so the
-- tenant check also confirms the person is still active. Every tenant policy goes through here.
create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.tenant_id
  from public.app_user u
  where auth.jwt() ->> 'aal' = 'aal2'
    and u.id = auth.uid()
    and u.tenant_id = nullif(auth.jwt() ->> 'tenant_id', '')::uuid
    and u.status = 'active'
$$;

-- People are added and deactivated by server code acting for an administrator, which has no
-- signed-in user of its own. It stamps the administrator in created_by or updated_by, and the
-- trail falls back to that when there is no signed-in user.
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
    coalesce(
      auth.uid(),
      case when tg_op = 'INSERT' then (any_row ->> 'created_by')::uuid
           else (any_row ->> 'updated_by')::uuid end
    ),
    old_row,
    new_row
  );
  return null;
end;
$$;
