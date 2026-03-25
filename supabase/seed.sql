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
--    Uses UPSERT so it works whether or not the trigger already created the profile row
--    ⚠️  Replace these UUIDs with the actual IDs from Supabase Auth → Users
insert into public.profiles (id, org_id, role, display_name)
values ('ac2a4baa-6282-41fd-836a-828ef5689d99', '00000000-0000-0000-0000-000000000001', 'owner', 'Owner')
on conflict (id) do update
    set org_id = excluded.org_id,
        role   = excluded.role,
        display_name = excluded.display_name;

insert into public.profiles (id, org_id, role, display_name)
values ('2275548a-5e7c-4bbb-a0b8-0b098cfac0f6', '00000000-0000-0000-0000-000000000001', 'staff', 'Staff')
on conflict (id) do update
    set org_id = excluded.org_id,
        role   = excluded.role,
        display_name = excluded.display_name;

-- 3. Seed default chit schemes
insert into public.chit_schemes (org_id, name, is_default) values
    ('00000000-0000-0000-0000-000000000001', 'CHIT',           true),
    ('00000000-0000-0000-0000-000000000001', 'DIWALI FUND',    true),
    ('00000000-0000-0000-0000-000000000001', 'GOLD SCHEME',    true),
    ('00000000-0000-0000-0000-000000000001', 'SILVER SCHEME',  true),
    ('00000000-0000-0000-0000-000000000001', 'MONTHLY SCHEME', true)
on conflict do nothing;
