-- Migration: Setup pg_cron job to trigger the blockchain indexer every 60 seconds.
--
-- NOTES:
--   • pg_net.http_post is fire-and-forget — it returns immediately with a request ID.
--     The orchestrator edge function handles concurrency via a lock row in
--     indexer_sync_state (contract_type = 'orchestrator_lock').
--   • If a pg_cron trigger fires while the previous orchestrator run is still active,
--     the orchestrator returns immediately with { skipped: true }.
--   • pg_cron minimum granularity is 1 minute.
--
-- MANAGEMENT:
--   View jobs:       SELECT * FROM cron.job;
--   View job logs:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--   Remove job:      SELECT cron.unschedule('run-blockchain-indexer');

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store secrets in Vault (idempotent: skips if secret already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_service_role_key') THEN
    PERFORM vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhbnVoY3VzZmJ5cmNtbnV3d3lzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAwMzE4OSwiZXhwIjoyMDg1NTc5MTg5fQ.uVVzOEdQNkf0k2b-IV33UTK5DAYOtZ_HFV6P1P3UiCg',
      'supabase_service_role_key'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_url') THEN
    PERFORM vault.create_secret(
      'https://xanuhcusfbyrcmnuwwys.supabase.co',
      'supabase_url'
    );
  END IF;
END $$;

SELECT cron.schedule(
  'run-blockchain-indexer',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT vault.get('supabase_url')) || '/functions/v1/index-orchestrator',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || (SELECT vault.get('supabase_service_role_key'))
                 ),
      body    := '{}'::jsonb
    );
  $$
);
