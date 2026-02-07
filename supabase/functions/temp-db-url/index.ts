// Supabase Edge Function: temp-db-url
// Database setup utility for pg_cron and vault configuration
// SECURED: Requires service role authentication

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, verifyInternalAuth } from '../_shared/helpers.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Require service role authentication
  const authError = verifyInternalAuth(req);
  if (authError) return authError;

  try {
    // Dynamic import for postgres
    const { default: sql } = await import('https://esm.sh/postgres@3.4.0?target=deno');
    
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_DB_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const client = sql({ connection: dbUrl, ssl: true });
    const results: string[] = [];

    // Extensions
    await client`CREATE EXTENSION IF NOT EXISTS pg_cron`;
    results.push('pg_cron: OK');
    
    await client`CREATE EXTENSION IF NOT EXISTS pg_net`;
    results.push('pg_net: OK');

    // Vault secrets - use environment variables instead of hardcoded values
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (serviceRoleKey && supabaseUrl) {
      await client`
        DO $v$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_service_role_key') THEN
            PERFORM vault.create_secret(
              ${serviceRoleKey},
              'supabase_service_role_key'
            );
          END IF;
          IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_url') THEN
            PERFORM vault.create_secret(
              ${supabaseUrl},
              'supabase_url'
            );
          END IF;
        END $v$
      `;
      results.push('vault: OK');
    } else {
      results.push('vault: SKIPPED (missing env vars)');
    }

    // Cron job for indexer
    try {
      await client`
        SELECT cron.schedule(
          'run-blockchain-indexer',
          '* * * * *',
          $c$
            SELECT net.http_post(
              url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/index-orchestrator',
              headers := jsonb_build_object(
                           'Content-Type',  'application/json',
                           'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
                         ),
              body    := '{}'::jsonb
            );
          $c$
        )
      `;
      results.push('cron: OK');
    } catch (cronErr) {
      results.push(`cron: ${cronErr.message}`);
    }

    await client.end();
    
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message, stack: e.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
