-- Migration: Switch pg_cron from calling index-orchestrator directly
-- to calling indexer-ticker, which loops internally with 10-second sleeps
-- to achieve sub-minute indexing cadence.
--
-- The indexer-ticker Edge Function calls index-orchestrator 4 times per
-- invocation (every ~10s), giving ~4 index cycles per minute instead of 1.
-- The orchestrator's existing concurrency lock prevents overlapping runs.
--
-- MANAGEMENT:
--   View jobs:       SELECT * FROM cron.job;
--   View job logs:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--   Remove job:      SELECT cron.unschedule('run-blockchain-indexer-ticker');
--   Revert:          Re-run the old migration (20260203_setup_indexer_cron.sql)

-- 1. Remove the old cron job that called index-orchestrator directly.
--    Use DO block so the migration doesn't fail if the job doesn't exist.
DO $$
BEGIN
  PERFORM cron.unschedule('run-blockchain-indexer');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job run-blockchain-indexer did not exist, skipping unschedule.';
END $$;

-- 2. Also remove the legacy per-function cron jobs if they exist.
DO $$
BEGIN
  PERFORM cron.unschedule('index-pool-deployer-base-sepolia');
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if not found
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('index-all-pools-base-sepolia');
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if not found
END $$;

-- 3. Ensure required extensions are present (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 4. Vault secrets (supabase_url, supabase_service_role_key) are expected
--    to already exist from migration 20260203_setup_indexer_cron.sql.
--    No re-insertion needed — the cron.schedule below reads them via vault.decrypted_secrets.

-- 5. Schedule the new ticker job — calls indexer-ticker every minute.
--    The ticker internally loops 4 times with 10s sleeps, so the orchestrator
--    effectively runs every ~10-15 seconds.
SELECT cron.schedule(
  'run-blockchain-indexer-ticker',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1)
                 || '/functions/v1/indexer-ticker',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer '
                     || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
                 ),
      body    := '{}'::jsonb
    );
  $$
);
