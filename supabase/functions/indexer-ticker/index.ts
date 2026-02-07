// Supabase Edge Function: indexer-ticker
// Called every 60 seconds by pg_cron. Internally loops with 10-second sleeps
// to achieve sub-minute indexing cadence without external services.
//
// Flow:
//   pg_cron (every 1 min) → indexer-ticker → calls index-orchestrator N times
//   with 10s sleep between each call. The orchestrator's own concurrency lock
//   prevents overlapping runs, so extra ticks are harmlessly skipped.
//
// Supabase Edge Functions have a ~150s wall-clock limit. With a 10s sleep and
// ~20s orchestrator execution, we safely fit 4 ticks per invocation (~120s).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/helpers.ts';

// Number of orchestrator invocations per ticker run.
// 4 ticks × ~30s (10s sleep + ~20s call) ≈ 120s, well within the 150s limit.
const TICKS_PER_RUN = 4;

// Milliseconds to sleep between orchestrator calls.
const TICK_INTERVAL_MS = 10_000;

// Per-call timeout so a hung orchestrator doesn't consume the entire budget.
const CALL_TIMEOUT_MS = 55_000;

interface TickResult {
  tick: number;
  status: number;
  body: unknown;
  durationMs: number;
}

/**
 * Calls the index-orchestrator Edge Function once.
 * Never throws — errors are captured in the returned object.
 */
async function callOrchestrator(
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/index-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: '{}',
      signal: controller.signal,
    });
    const body = await res.json();
    return { status: res.status, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ticker] orchestrator call failed:', message);
    return { status: 0, body: { error: message } };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sleeps for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Skip auth check — this function is only called by internal pg_cron job.
  // The cron job itself is secured by pg_cron (only the postgres role can schedule).
  // This matches the pattern used by index-orchestrator.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseUrl || !serviceKey) {
    console.error('[ticker] Missing required env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── Tick loop ──
  const startedAt = Date.now();
  const results: TickResult[] = [];

  for (let i = 0; i < TICKS_PER_RUN; i++) {
    // Sleep before every tick except the first — invoke immediately on entry.
    if (i > 0) {
      await sleep(TICK_INTERVAL_MS);
    }

    const tickStart = Date.now();
    console.log(`[ticker] tick ${i + 1}/${TICKS_PER_RUN}`);

    const { status, body } = await callOrchestrator(supabaseUrl, serviceKey);
    const durationMs = Date.now() - tickStart;

    results.push({ tick: i + 1, status, body, durationMs });
    console.log(`[ticker] tick ${i + 1} completed in ${durationMs}ms (status ${status})`);
  }

  const totalDurationMs = Date.now() - startedAt;
  console.log(`[ticker] all ${TICKS_PER_RUN} ticks completed in ${totalDurationMs}ms`);

  return new Response(
    JSON.stringify({
      success: true,
      ticksPerRun: TICKS_PER_RUN,
      tickIntervalMs: TICK_INTERVAL_MS,
      totalDurationMs,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
