-- Tenant isolation checks, run with `supabase test db` locally and on every pull request.
-- The release is blocked unless every check passes (Solution Design, Security).
begin;
create extension if not exists pgtap with schema extensions;
-- Hosted projects may already have pgtap in another schema; find its functions wherever it is.
select set_config(
  'search_path',
  (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap')
    || ', public, extensions',
  true
);

select plan(6);

-- 1. Every table in the public schema has row-level security switched on.
select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity $$,
  'every public table has row-level security on'
);

-- 2. Someone who is not signed in sees no tenants.
set local role anon;
select is_empty(
  $$ select id from public.tenant $$,
  'anonymous visitors see no tenants'
);
reset role;

-- 3. A signed-in user with no tenant in their token sees nothing.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
select is_empty(
  $$ select id from public.tenant $$,
  'a user without a tenant sees no tenants'
);

-- 4. A Bluegum user sees only Bluegum.
set local request.jwt.claims to '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated", "tenant_id": "00000000-0000-4000-8000-000000000002"}';
select results_eq(
  $$ select name from public.tenant $$,
  $$ values ('Bluegum Test Growers'::text) $$,
  'a Bluegum user sees only Bluegum'
);

-- 5. A Bluegum user cannot change Sunridge, even by asking for it by ID.
update public.tenant set name = 'Taken over'
 where id = '00000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select name from public.tenant where id = '00000000-0000-4000-8000-000000000001'),
  'Sunridge Orchards',
  'a Bluegum user cannot rename Sunridge'
);

-- 6. The health check works for anonymous visitors and reveals no tenant data.
set local role anon;
select is(
  public.health() ->> 'database',
  'ok',
  'the health check answers without signing in'
);
reset role;

select * from finish();
rollback;
