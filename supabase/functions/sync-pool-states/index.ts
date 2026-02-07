// Supabase Edge Function: sync-pool-states
// Actively fetches and syncs pool states from blockchain for all pools
// Handles states that don't emit events: Pending, Unengaged, Deleted, AllPrizesClaimed
// Also updates states for pools that may have missed event indexing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders, verifyInternalAuth } from '../_shared/helpers.ts';
import { providerCache } from '../_shared/provider-cache.ts';
import { isSupportedNetwork } from '../_shared/networks.ts';

const POOL_ABI = [
  'function state() view returns (uint8)',
  'function winnersCount() view returns (uint256)',
  'function getWinners() view returns (address[])',
];

interface SyncRequest {
  chainId: number;
  poolAddress?: string; // Optional: sync specific pool, otherwise sync all pools
  batchSize?: number; // Number of pools to sync per run (default 50)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chainId, poolAddress, batchSize = 50 }: SyncRequest = await req.json();

    if (!chainId || !isSupportedNetwork(chainId)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid chainId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const provider = providerCache.getProvider(chainId);
    console.log(`[Chain ${chainId}] Starting pool state sync...`);

    // Get pools to sync
    let query = supabase
      .from('pools')
      .select('address, state, winners_selected')
      .eq('chain_id', chainId);

    if (poolAddress) {
      // Sync specific pool
      query = query.eq('address', poolAddress.toLowerCase());
    } else {
      // Sync pools that haven't been synced recently or are in active states
      // Priority: Active (1), Ended (2), Drawing (3), Pending (0), Completed (4)
      // State 4 (Completed) is included so pools can transition to AllPrizesClaimed (6)
      query = query
        .in('state', [0, 1, 2, 3, 4])
        .order('last_synced_at', { ascending: true, nullsFirst: true })
        .limit(batchSize);
    }

    const { data: pools, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching pools:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pools', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pools || pools.length === 0) {
      console.log('No pools to sync');
      return new Response(
        JSON.stringify({ success: true, poolsSynced: 0, message: 'No pools to sync' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pools.length} pools to sync`);

    let synced = 0;
    let errors = 0;
    const stateChanges: Array<{ address: string; oldState: number; newState: number }> = [];

    // Batch RPC calls for efficiency
    const statePromises = pools.map(async (pool) => {
      try {
        const poolContract = new ethers.Contract(pool.address, POOL_ABI, provider);
        
        const [onChainState, winnersCount] = await Promise.all([
          poolContract.state(),
          poolContract.winnersCount().catch(() => ethers.BigNumber.from(0)),
        ]);

        const stateNum = typeof onChainState === 'number' ? onChainState : onChainState.toNumber();
        const winnersCountNum = winnersCount.toNumber ? winnersCount.toNumber() : Number(winnersCount);

        return {
          address: pool.address,
          onChainState: stateNum,
          winnersCount: winnersCountNum,
          dbState: pool.state,
          dbWinnersSelected: pool.winners_selected || 0,
        };
      } catch (err) {
        console.error(`Error fetching state for ${pool.address}:`, err);
        return null;
      }
    });

    const results = await Promise.all(statePromises);

    // Update database for pools with state changes
    for (const result of results) {
      if (!result) {
        errors++;
        continue;
      }

      const { address, onChainState, winnersCount, dbState, dbWinnersSelected } = result;

      // Check if state or winner count has changed
      const stateChanged = onChainState !== dbState;
      const winnersChanged = winnersCount !== dbWinnersSelected;

      if (stateChanged || winnersChanged) {
        console.log(`Updating ${address}: state ${dbState} → ${onChainState}, winners ${dbWinnersSelected} → ${winnersCount}`);

        const { error: updateError } = await supabase
          .from('pools')
          .update({
            state: onChainState,
            winners_selected: winnersCount,
            last_synced_at: new Date().toISOString(),
          })
          .eq('address', address)
          .eq('chain_id', chainId);

        if (updateError) {
          console.error(`Failed to update ${address}:`, updateError);
          errors++;
        } else {
          synced++;
          if (stateChanged) {
            stateChanges.push({ address, oldState: dbState, newState: onChainState });
          }
        }
      } else {
        // No changes, just update last_synced_at
        await supabase
          .from('pools')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('address', address)
          .eq('chain_id', chainId);
        
        synced++;
      }
    }

    console.log(`✅ Sync complete: ${synced} pools synced, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        poolsSynced: synced,
        errors,
        stateChanges,
        totalPoolsChecked: pools.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync failed:', error);
    return new Response(
      JSON.stringify({ error: 'State sync failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
