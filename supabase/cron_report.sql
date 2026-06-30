-- ═══════════════════════════════════════════════════════════════════════
--  JJ Bullion — Scheduled Email Reports via pg_cron + pg_net
--
--  BEFORE RUNNING:
--  1. Enable pg_net extension in Supabase Dashboard → Database → Extensions
--  2. Replace <YOUR_SUPABASE_URL>  with your project URL
--     e.g. https://abcdefghijkl.supabase.co
--  3. Replace <YOUR_ANON_KEY> with your project anon key
--  4. Replace <YOUR_CRON_SECRET> with the same value you added
--     as CRON_SECRET in Edge Function secrets
--  5. Run this entire file in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── ONE-TIME TEST: Daily report at 16:30 IST today (11:00 UTC) ──────────
-- Runs once on today's date — remove after confirming it works
select cron.schedule(
    'test-daily-report',
    '0 11 30 6 *',  -- 11:00 UTC on 30 Jun (= 16:30 IST)
    $$
    select net.http_post(
        url     := '<YOUR_SUPABASE_URL>/functions/v1/send-report?type=daily',
        headers := jsonb_build_object(
            'Content-Type',    'application/json',
            'Authorization',   'Bearer <YOUR_ANON_KEY>',
            'x-cron-secret',   '<YOUR_CRON_SECRET>'
        ),
        body    := '{}'::jsonb
    );
    $$
);

-- ── ONE-TIME TEST: Weekly report at 16:30 IST today (11:00 UTC) ─────────
-- Runs once today to test the weekly format with current data
select cron.schedule(
    'test-weekly-report',
    '5 11 30 6 *',  -- 11:05 UTC on 30 Jun (= 16:35 IST) — 5 mins after daily
    $$
    select net.http_post(
        url     := '<YOUR_SUPABASE_URL>/functions/v1/send-report?type=weekly',
        headers := jsonb_build_object(
            'Content-Type',    'application/json',
            'Authorization',   'Bearer <YOUR_ANON_KEY>',
            'x-cron-secret',   '<YOUR_CRON_SECRET>'
        ),
        body    := '{}'::jsonb
    );
    $$
);

-- ── PRODUCTION: Daily report at 23:45 IST every day (18:15 UTC) ─────────
select cron.schedule(
    'daily-report',
    '15 18 * * *',  -- 18:15 UTC = 23:45 IST
    $$
    select net.http_post(
        url     := '<YOUR_SUPABASE_URL>/functions/v1/send-report?type=daily',
        headers := jsonb_build_object(
            'Content-Type',    'application/json',
            'Authorization',   'Bearer <YOUR_ANON_KEY>',
            'x-cron-secret',   '<YOUR_CRON_SECRET>'
        ),
        body    := '{}'::jsonb
    );
    $$
);

-- ── PRODUCTION: Weekly report Sunday 8:00 AM IST (Saturday 02:30 UTC) ───
select cron.schedule(
    'weekly-report',
    '30 2 * * 0',   -- 02:30 UTC Sunday = 08:00 IST Sunday
    $$
    select net.http_post(
        url     := '<YOUR_SUPABASE_URL>/functions/v1/send-report?type=weekly',
        headers := jsonb_build_object(
            'Content-Type',    'application/json',
            'Authorization',   'Bearer <YOUR_ANON_KEY>',
            'x-cron-secret',   '<YOUR_CRON_SECRET>'
        ),
        body    := '{}'::jsonb
    );
    $$
);

-- ── Verify schedules are registered ─────────────────────────────────────
select jobname, schedule, active from cron.job order by jobname;

-- ── After confirming test emails received, remove one-time jobs: ─────────
-- select cron.unschedule('test-daily-report');
-- select cron.unschedule('test-weekly-report');
