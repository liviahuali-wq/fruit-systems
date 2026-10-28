-- Users, roles, the sign-in token hook and the audit trail (task 4.2a).
-- Run with `supabase test db` locally, on every pull request and on staging before each release.
begin;
-- On hosted projects the CLI signs in as a temporary role that cannot see the extensions
-- schema, so run as postgres (the role is a member). Locally this is already postgres.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(21);

-- Test people, removed again by the rollback at the end. Fixed IDs:
--   a1 Sunridge administrator   a2 Sunridge sales administrator   a3 Sunridge leaver
--   b1 Bluegum administrator
insert into auth.users (id, instance_id, aud, role, email) values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@sunridge.test'),
  ('a2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales@sunridge.test'),
  ('a3000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leaver@sunridge.test'),
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@bluegum.test');

insert into public.app_user (id, tenant_id, full_name, email, status) values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Sunridge Admin', 'admin@sunridge.test', 'active'),
  ('a2000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Sunridge Sales', 'sales@sunridge.test', 'active'),
  ('a3000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Sunridge Leaver', 'leaver@sunridge.test', 'deactivated'),
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Bluegum Admin', 'admin@bluegum.test', 'active');

insert into public.user_role (tenant_id, user_id, role_id)
select r.tenant_id, u.id, r.id
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'tenant_admin'),
  ('a2000000-0000-4000-8000-000000000002'::uuid, 'sales_admin'),
  ('a3000000-0000-4000-8000-000000000003'::uuid, 'sales_admin'),
  ('b1000000-0000-4000-8000-000000000001'::uuid, 'tenant_admin')
) as wanted (user_id, role_key)
join public.app_user u on u.id = wanted.user_id
join public.role r on r.tenant_id = u.tenant_id and r.key = wanted.role_key;

-- Roles ------------------------------------------------------------------------------------------

-- 1. Each demo tenant starts with the ten standard roles.
select results_eq(
  $$ select tenant_id::text, count(*)::int from public.role
      where is_standard and tenant_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
      group by tenant_id order by tenant_id $$,
  $$ values ('00000000-0000-4000-8000-000000000001', 10), ('00000000-0000-4000-8000-000000000002', 10) $$,
  'each demo tenant has the ten standard roles'
);

-- 1b. A new tenant gets the ten standard roles as soon as it is created.
insert into public.tenant (id, name) values ('00000000-0000-4000-8000-0000000000ff', 'New Test Grower');
select is(
  (select count(*)::int from public.role where tenant_id = '00000000-0000-4000-8000-0000000000ff' and is_standard),
  10,
  'a new tenant gets the ten standard roles'
);

-- 2. A role cannot hold a permission that does not exist.
select throws_ok(
  $$ insert into public.role (tenant_id, key, name, permissions)
     values ('00000000-0000-4000-8000-000000000001', 'bad_role', 'Bad role', array['orders.delete']) $$,
  '23514',
  null,
  'a role cannot hold an unknown permission'
);

-- Sign-in token hook -----------------------------------------------------------------------------

-- 3. An active user's token gets their tenant and role keys.
select is(
  (private.custom_access_token_hook(jsonb_build_object(
    'user_id', 'a1000000-0000-4000-8000-000000000001',
    'claims', jsonb_build_object('sub', 'a1000000-0000-4000-8000-000000000001', 'role', 'authenticated', 'aal', 'aal1')
  )) -> 'claims') - 'sub' - 'role' - 'aal',
  '{"tenant_id": "00000000-0000-4000-8000-000000000001", "app_roles": ["tenant_admin"]}'::jsonb,
  'the token hook adds the tenant and roles of an active user'
);

-- 4. A deactivated user's token gets no tenant, even if an old one was there.
select is(
  private.custom_access_token_hook(jsonb_build_object(
    'user_id', 'a3000000-0000-4000-8000-000000000003',
    'claims', jsonb_build_object('sub', 'a3000000-0000-4000-8000-000000000003', 'role', 'authenticated',
                                 'tenant_id', '00000000-0000-4000-8000-000000000001')
  )) -> 'claims' ->> 'tenant_id',
  null,
  'the token hook gives a deactivated user no tenant'
);

-- 5. Someone with a sign-in account but no profile gets no tenant.
select is(
  private.custom_access_token_hook(jsonb_build_object(
    'user_id', '99999999-9999-4999-8999-999999999999',
    'claims', jsonb_build_object('sub', '99999999-9999-4999-8999-999999999999', 'role', 'authenticated')
  )) -> 'claims' ->> 'tenant_id',
  null,
  'the token hook gives an unknown user no tenant'
);

-- 6. Signed-in users cannot call the hook to mint their own claims.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a2000000-0000-4000-8000-000000000002", "role": "authenticated", "aal": "aal2", "tenant_id": "00000000-0000-4000-8000-000000000001"}';
select throws_ok(
  $$ select private.custom_access_token_hook('{"user_id": "a2000000-0000-4000-8000-000000000002", "claims": {}}'::jsonb) $$,
  '42501',
  null,
  'signed-in users cannot call the token hook'
);

-- Managing roles ---------------------------------------------------------------------------------

-- 7. A sales administrator cannot give anyone a role.
select throws_ok(
  $$ insert into public.user_role (tenant_id, user_id, role_id)
     select tenant_id, 'a2000000-0000-4000-8000-000000000002', id from public.role
      where tenant_id = '00000000-0000-4000-8000-000000000001' and key = 'sales_manager' $$,
  '42501',
  null,
  'a sales administrator cannot assign roles'
);

-- 8. A sales administrator cannot read the audit trail.
select is_empty(
  $$ select id from public.audit_event $$,
  'a sales administrator sees no audit events'
);

-- 9. A tenant administrator can give a role.
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "tenant_id": "00000000-0000-4000-8000-000000000001"}';
select lives_ok(
  $$ insert into public.user_role (tenant_id, user_id, role_id)
     select tenant_id, 'a2000000-0000-4000-8000-000000000002', id from public.role
      where tenant_id = '00000000-0000-4000-8000-000000000001' and key = 'sales_manager' $$,
  'a tenant administrator can assign roles'
);

-- 10. Before passing the second factor, the same administrator sees no people or roles.
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1", "tenant_id": "00000000-0000-4000-8000-000000000001"}';
select is_empty(
  $$ select id from public.app_user union all select id from public.role $$,
  'people and roles are hidden without the second factor'
);

-- Across tenants ---------------------------------------------------------------------------------

-- 11. A Bluegum administrator sees none of Sunridge's people.
set local request.jwt.claims to '{"sub": "b1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "tenant_id": "00000000-0000-4000-8000-000000000002"}';
select is_empty(
  $$ select id from public.app_user where tenant_id = '00000000-0000-4000-8000-000000000001' $$,
  'a Bluegum administrator sees no Sunridge people'
);

-- 12. A Bluegum administrator cannot give a Bluegum role to a Sunridge person.
select throws_ok(
  $$ insert into public.user_role (tenant_id, user_id, role_id)
     values ('00000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002',
             (select id from public.role where tenant_id = '00000000-0000-4000-8000-000000000002' and key = 'executive')) $$,
  '23503',
  null,
  'a person and a role must belong to the same tenant'
);

-- Audit trail ------------------------------------------------------------------------------------

-- 13. Giving a role is recorded with who did it.
set local role postgres;
select results_eq(
  $$ select action, actor_id::text from public.audit_event
      where table_name = 'user_role'
        and row_id = 'a2000000-0000-4000-8000-000000000002:' || (select id from public.role where tenant_id = '00000000-0000-4000-8000-000000000001' and key = 'sales_manager') $$,
  $$ values ('insert', 'a1000000-0000-4000-8000-000000000001') $$,
  'giving a role is recorded with the administrator who did it'
);

-- 14. A change is recorded with its before and after values.
update public.tenant set name = 'Bluegum Renamed' where id = '00000000-0000-4000-8000-000000000002';
select results_eq(
  $$ select before ->> 'name', after ->> 'name' from public.audit_event
      where table_name = 'tenant' and row_id = '00000000-0000-4000-8000-000000000002' and action = 'update' $$,
  $$ values ('Bluegum Test Growers', 'Bluegum Renamed') $$,
  'a change is recorded with before and after values'
);

-- 15. A Sunridge administrator sees Sunridge's trail but not Bluegum's.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "tenant_id": "00000000-0000-4000-8000-000000000001"}';
select results_eq(
  $$ select distinct tenant_id::text from public.audit_event $$,
  $$ values ('00000000-0000-4000-8000-000000000001') $$,
  'a tenant administrator sees only their own tenant''s audit events'
);

-- 16. Signed-in users cannot write to the trail.
select throws_ok(
  $$ insert into public.audit_event (tenant_id, table_name, row_id, action)
     values ('00000000-0000-4000-8000-000000000001', 'tenant', 'x', 'insert') $$,
  '42501',
  null,
  'signed-in users cannot write audit events'
);

-- 17. Nobody can change or remove the trail, not even the database owner.
set local role postgres;
select throws_ok(
  $$ update public.audit_event set action = 'delete' $$,
  'P0001',
  'audit_event is append-only: update is not allowed',
  'the audit trail cannot be changed or removed'
);

-- Leavers --------------------------------------------------------------------------------------

-- 18. A leaver whose token has not expired yet still sees nothing.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a3000000-0000-4000-8000-000000000003", "role": "authenticated", "aal": "aal2", "tenant_id": "00000000-0000-4000-8000-000000000001"}';
select is_empty(
  $$ select id from public.tenant union all select id from public.app_user $$,
  'a deactivated person sees nothing, even with a token that is still valid'
);

-- 19. Server code acting for an administrator is named in the trail through updated_by.
set local role postgres;
set local request.jwt.claims to '{}';
update public.app_user
   set status = 'deactivated', deactivated_at = now(), updated_by = 'a1000000-0000-4000-8000-000000000001'
 where id = 'a2000000-0000-4000-8000-000000000002';
select results_eq(
  $$ select actor_id::text, after ->> 'status' from public.audit_event
      where table_name = 'app_user' and row_id = 'a2000000-0000-4000-8000-000000000002' and action = 'update' $$,
  $$ values ('a1000000-0000-4000-8000-000000000001', 'deactivated') $$,
  'a change made by server code names the administrator it acted for'
);

-- 20. Deactivating someone in the trail does not let them back: their next token has no tenant.
select is(
  private.custom_access_token_hook(jsonb_build_object(
    'user_id', 'a2000000-0000-4000-8000-000000000002',
    'claims', jsonb_build_object('sub', 'a2000000-0000-4000-8000-000000000002', 'role', 'authenticated')
  )) -> 'claims' ->> 'tenant_id',
  null,
  'a newly deactivated person gets no tenant in their next token'
);

select * from finish();
rollback;
