-- Fictional demo data. Loaded by `supabase db reset` locally and by the staging reload script.
-- Fixed IDs so tests can refer to each tenant. No real business or person appears here.
-- ABNs are left empty on purpose: a made-up 11-digit number could belong to a real business.

insert into public.tenant (id, name, plan, status) values
  ('00000000-0000-4000-8000-000000000001', 'Sunridge Orchards', 'large_grower', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'Bluegum Test Growers', 'starter', 'trial');
