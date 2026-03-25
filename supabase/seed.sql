-- ═══════════════════════════════════════════════════════════
--  JJ Ledger Pro — Seed Script
--  Run AFTER:
--    1. schema.sql has been executed
--    2. You created users in Supabase Auth → Users:
--       owner@jjledger.com  (strong password)
--       staff@jjledger.com  (strong password)
--  Replace the UUIDs below with the real user IDs from Auth → Users table
-- ═══════════════════════════════════════════════════════════

-- 1. Create the organisation
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'JJ Jewellers')
on conflict do nothing;

-- 2. Link users to the org with roles
--    ⚠️  Replace these UUIDs with the actual IDs from Auth → Users
update public.profiles
set org_id = '00000000-0000-0000-0000-000000000001',
    role   = 'owner',
    display_name = 'Owner'
where id = 'ac2a4baa-6282-41fd-836a-828ef5689d99';

update public.profiles
set org_id = '00000000-0000-0000-0000-000000000001',
    role   = 'staff',
    display_name = 'Staff'
where id = '2275548a-5e7c-4bbb-a0b8-0b098cfac0f6';

-- 3. Seed default chit schemes
insert into public.chit_schemes (org_id, name, is_default) values
    ('00000000-0000-0000-0000-000000000001', 'CHIT',           true),
    ('00000000-0000-0000-0000-000000000001', 'DIWALI FUND',    true),
    ('00000000-0000-0000-0000-000000000001', 'GOLD SCHEME',    true),
    ('00000000-0000-0000-0000-000000000001', 'SILVER SCHEME',  true),
    ('00000000-0000-0000-0000-000000000001', 'MONTHLY SCHEME', true)
on conflict do nothing;
