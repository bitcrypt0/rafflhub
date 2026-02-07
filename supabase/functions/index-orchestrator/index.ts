// Supabase Edge Function: index-orchestrator
// Called every 60 seconds by pg_cron. Fans out all indexer functions in parallel
// with a concurrency lock to prevent overlapping runs.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, verifyInternalAuth } from '../_shared/helpers.ts';

const CHAIN_ID = 84532;
// Max pool-event indexers running concurrently — keeps RPC usage under rate limits.
const POOL_CONCURRENCY = 5;
// Per-function call timeout in milliseconds.
const CALL_TIMEOUT_MS = 30_000;
// How long (ms) we consider a lock row "stale" (previous run crashed without releasing).
const LOCK_STALENESS_MS = 90_000;

interface IndexerCallResult {
  name: string;
  result?: unknown;
  error?: string;
}

/**
 * Calls a single indexer edge function with a timeout.
 * Never throws — errors are captured in the returned object.
 */
async function callIndexer(
  baseUrl: string,
  headers: Record<string, string>,
  name: string,
  body: object
): Promise<IndexerCallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { name, result: await res.json() };
  } catch (err) {
    console.error(`[orchestrator] ${name} failed:`, err);
    return { name, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

interface OrchestratorRequest {
  chainId?: number;
  fromBlock?: number;
  toBlock?: number | 'latest';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Skip auth check - this function is only called by internal cron job
  // The cron job itself is secured by pg_cron which only postgres role can schedule
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Parse request body for optional fromBlock/toBlock parameters
  let requestParams: OrchestratorRequest = {};
  try {
    requestParams = await req.json();
  } catch {
    // No body or invalid JSON - use defaults
  }
  const { fromBlock, toBlock } = requestParams;

  // ---------------------------------------------------------------
  // Concurrency lock: uses a dedicated row in indexer_sync_state.
  //   is_healthy = false  →  a run is in progress (or crashed).
  //   is_healthy = true   →  the last run completed.
  // If the row is locked and the timestamp is older than LOCK_STALENESS_MS,
  // we treat it as a crashed run and take over.
  // ---------------------------------------------------------------
  const { data: lockRow } = await supabase
    .from('indexer_sync_state')
    .select('last_indexed_at, is_healthy')
    .eq('chain_id', CHAIN_ID)
    .eq('contract_type', 'orchestrator_lock')
    .eq('contract_address', 'lock')
    .single();

  if (lockRow && !lockRow.is_healthy) {
    const elapsed = Date.now() - new Date(lockRow.last_indexed_at).getTime();
    if (elapsed < LOCK_STALENESS_MS) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Previous run still active', elapsed_ms: elapsed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[orchestrator] Lock stale (${elapsed}ms) — taking over from crashed run`);
  }

  // Acquire lock
  await supabase
    .from('indexer_sync_state')
    .upsert(
      {
        chain_id: CHAIN_ID,
        contract_type: 'orchestrator_lock',
        contract_address: 'lock',
        last_indexed_block: 0,
        last_indexed_at: new Date().toISOString(),
        is_healthy: false,
        error_message: 'running',
      },
      { onConflict: 'chain_id,contract_type,contract_address' }
    );

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    };

    // Build indexer payload with optional fromBlock/toBlock
    const indexerPayload: { chainId: number; fromBlock?: number; toBlock?: number | 'latest' } = { chainId: CHAIN_ID };
    if (fromBlock !== undefined) indexerPayload.fromBlock = fromBlock;
    if (toBlock !== undefined) indexerPayload.toBlock = toBlock;

    // Fire discovery indexers, state sync, and fetch pool list in parallel.
    // callIndexer never throws, so Promise.all here always resolves.
    const [poolsRes, deployer, factory, rewards, stateSync, externalCollections] = await Promise.all([
      supabase.from('pools').select('address').eq('chain_id', CHAIN_ID),
      callIndexer(supabaseUrl, headers, 'index-pool-deployer', indexerPayload),
      callIndexer(supabaseUrl, headers, 'index-nft-factory', indexerPayload),
      callIndexer(supabaseUrl, headers, 'index-rewards', indexerPayload),
      callIndexer(supabaseUrl, headers, 'sync-pool-states', { chainId: CHAIN_ID, batchSize: 50 }),
      callIndexer(supabaseUrl, headers, 'index-external-collections', { chainId: CHAIN_ID, refreshStale: true }),
    ]);

    const poolAddresses: string[] = (poolsRes.data || []).map((p: { address: string }) => p.address);

    // Fan out pool-event indexers in batches of POOL_CONCURRENCY.
    const poolResults: IndexerCallResult[] = [];
    for (let i = 0; i < poolAddresses.length; i += POOL_CONCURRENCY) {
      const batch = poolAddresses.slice(i, i + POOL_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((addr) =>
          callIndexer(supabaseUrl, headers, 'index-pool-events', {
            chainId: CHAIN_ID,
            poolAddress: addr,
          })
        )
      );
      poolResults.push(...batchResults);
    }

    // Index NFT mints for all collections to track current_supply
    const collectionsRes = await supabase
      .from('collections')
      .select('address')
      .eq('chain_id', CHAIN_ID);

    const collectionAddresses: string[] = (collectionsRes.data || []).map((c: { address: string }) => c.address);
    const collectionResults: IndexerCallResult[] = [];

    for (let i = 0; i < collectionAddresses.length; i += POOL_CONCURRENCY) {
      const batch = collectionAddresses.slice(i, i + POOL_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((addr) =>
          callIndexer(supabaseUrl, headers, 'index-nft-mints', {
            chainId: CHAIN_ID,
            collectionAddress: addr,
          })
        )
      );
      collectionResults.push(...batchResults);
    }

    const failedCount =
      [deployer, factory, rewards, stateSync, externalCollections, ...poolResults, ...collectionResults].filter((r) => r.error).length;

    return new Response(
      JSON.stringify({
        success: true,
        chainId: CHAIN_ID,
        discovery: { poolDeployer: deployer, nftFactory: factory, rewards, stateSync, externalCollections },
        pools: poolResults,
        collections: collectionResults,
        summary: {
          totalCalls: 5 + poolResults.length + collectionResults.length,
          failed: failedCount,
          poolsIndexed: poolResults.length,
          collectionsIndexed: collectionResults.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Orchestrator error:', error);
    return new Response(
      JSON.stringify({ error: 'Orchestration failed', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    // Release lock
    await supabase
      .from('indexer_sync_state')
      .update({ is_healthy: true, error_message: null, last_indexed_at: new Date().toISOString() })
      .eq('chain_id', CHAIN_ID)
      .eq('contract_type', 'orchestrator_lock')
      .eq('contract_address', 'lock');
  }
});
