// Supabase Edge Function: index-rewards
// Indexes RewardsClaimed events from RewardsFlywheel contract
// Tracks user reward claims and updates rewards_claims table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RewardsFlywheel ABI - RewardsClaimed event
const REWARDS_FLYWHEEL_ABI = [
  'event RewardsClaimed(address indexed user, address indexed rewardToken, uint256 amount)',
  'function getAccruedRewards(address user) view returns (uint256)',
];

interface IndexRequest {
  chainId: number;
  fromBlock?: number;
  toBlock?: number | 'latest';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chainId, fromBlock, toBlock = 'latest' }: IndexRequest = await req.json();

    if (!chainId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: chainId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get RPC URL and contract address from environment or use defaults
    const rpcUrl = Deno.env.get(`RPC_URL_${chainId}`) || 'https://base-sepolia-rpc.publicnode.com';
    const rewardsFlywheelAddress = chainId === 84532
      ? '0xEe9AEE229b531888b5a3E704eC86035962997811'
      : null;

    if (!rewardsFlywheelAddress) {
      return new Response(
        JSON.stringify({ error: `No RewardsFlywheel contract deployed on chain ${chainId}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chain ${chainId}] Starting indexer for RewardsFlywheel at ${rewardsFlywheelAddress}`);

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const rewardsFlywheel = new ethers.Contract(rewardsFlywheelAddress, REWARDS_FLYWHEEL_ABI, provider);

    // Get sync state
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'rewards_flywheel')
      .eq('contract_address', rewardsFlywheelAddress.toLowerCase())
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined ? fromBlock : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : Math.max(0, currentBlock - 1000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    // Query RewardsClaimed events
    const filter = rewardsFlywheel.filters.RewardsClaimed();
    const events = await rewardsFlywheel.queryFilter(filter, startBlock, endBlock);

    console.log(`[Chain ${chainId}] Found ${events.length} RewardsClaimed events`);

    let successCount = 0;
    let errorCount = 0;

    // Process each event
    for (const event of events) {
      try {
        const user = event.args!.user.toLowerCase();
        const rewardToken = event.args!.rewardToken.toLowerCase();
        const amount = event.args!.amount;
        const block = await provider.getBlock(event.blockNumber);

        // Insert reward claim into database
        const { error: claimError } = await supabase
          .from('rewards_claims')
          .upsert({
            user_address: user,
            chain_id: chainId,
            reward_token: rewardToken,
            amount: amount.toString(),
            claimed_at_block: event.blockNumber,
            claimed_at_timestamp: new Date(block.timestamp * 1000).toISOString(),
            transaction_hash: event.transactionHash,
          }, {
            onConflict: 'chain_id,transaction_hash,user_address'
          });

        if (claimError) {
          console.error(`Error inserting reward claim for ${user}:`, JSON.stringify(claimError, null, 2));
          errorCount++;
        } else {
          // Create user activity record for reward claim
          await supabase
            .from('user_activity')
            .upsert({
              user_address: user,
              chain_id: chainId,
              activity_type: 'rewards_claimed',
              amount: amount.toString(),
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000).toISOString(),
            }, {
              onConflict: 'chain_id,transaction_hash,activity_type,user_address',
              ignoreDuplicates: true
            });

          successCount++;
        }
      } catch (err) {
        console.error(`Error processing event:`, err);
        console.error(`Error details:`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
        errorCount++;
      }
    }

    // Update sync state
    await supabase
      .from('indexer_sync_state')
      .upsert({
        chain_id: chainId,
        contract_type: 'rewards_flywheel',
        contract_address: rewardsFlywheelAddress.toLowerCase(),
        last_indexed_block: endBlock,
        last_block_hash: (await provider.getBlock(endBlock)).hash,
        last_indexed_at: new Date().toISOString(),
        is_healthy: true,
        error_message: null,
      }, {
        onConflict: 'chain_id,contract_type,contract_address'
      });

    console.log(`[Chain ${chainId}] Indexing complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        blocksScanned: { from: startBlock, to: endBlock, total: endBlock - startBlock + 1 },
        eventsFound: events.length,
        recordsProcessed: { success: successCount, errors: errorCount },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Indexer error:', error);
    return new Response(
      JSON.stringify({ error: 'Indexing failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
