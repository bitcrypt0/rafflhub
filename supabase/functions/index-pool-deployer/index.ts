// Supabase Edge Function: index-pool-deployer
// Indexes PoolCreated events from PoolDeployer contract
// Creates new pool records and fetches initial pool state from blockchain

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PoolDeployer ABI - PoolCreated event
const POOL_DEPLOYER_ABI = [
  'event PoolCreated(address indexed pool, address indexed creator)',
];

// Pool ABI - for fetching pool state
const POOL_ABI = [
  'function name() view returns (string)',
  'function creator() view returns (address)',
  'function startTime() view returns (uint256)',
  'function duration() view returns (uint256)',
  'function slotFee() view returns (uint256)',
  'function slotLimit() view returns (uint256)',
  'function winnersCount() view returns (uint256)',
  'function maxSlotsPerAddress() view returns (uint256)',
  'function state() view returns (uint8)',
  'function isPrized() view returns (bool)',
  'function prizeCollection() view returns (address)',
  'function prizeTokenId() view returns (uint256)',
  'function standard() view returns (uint8)',
  'function isCollabPool() view returns (bool)',
  'function usesCustomFee() view returns (bool)',
  'function revenueRecipient() view returns (address)',
  'function isExternalCollection() view returns (bool)',
  'function isRefundable() view returns (bool)',
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
    const poolDeployerAddress = chainId === 84532
      ? '0x719bF1e882BE2Fd14785172f284a10A37a0C8fde'
      : null;

    if (!poolDeployerAddress) {
      return new Response(
        JSON.stringify({ error: `No PoolDeployer contract deployed on chain ${chainId}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chain ${chainId}] Starting indexer for PoolDeployer at ${poolDeployerAddress}`);

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const poolDeployer = new ethers.Contract(poolDeployerAddress, POOL_DEPLOYER_ABI, provider);

    // Get sync state
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'pool_deployer')
      .eq('contract_address', poolDeployerAddress.toLowerCase())
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined ? fromBlock : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : Math.max(0, currentBlock - 1000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    // Query PoolCreated events
    const filter = poolDeployer.filters.PoolCreated();
    const events = await poolDeployer.queryFilter(filter, startBlock, endBlock);

    console.log(`[Chain ${chainId}] Found ${events.length} PoolCreated events`);

    let successCount = 0;
    let errorCount = 0;

    // Process each event
    for (const event of events) {
      try {
        const poolAddress = event.args!.pool.toLowerCase();
        const creator = event.args!.creator.toLowerCase();
        const block = await provider.getBlock(event.blockNumber);

        // Fetch pool state from blockchain
        const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

        const [
          name,
          startTime,
          duration,
          slotFee,
          slotLimit,
          winnersCount,
          maxSlotsPerAddress,
          state,
          isPrized,
          prizeCollection,
          prizeTokenId,
          standard,
          isCollabPool,
          usesCustomFee,
          revenueRecipient,
          isExternalCollection,
          isRefundable,
        ] = await Promise.all([
          poolContract.name().catch(() => ''),
          poolContract.startTime(),
          poolContract.duration(),
          poolContract.slotFee(),
          poolContract.slotLimit(),
          poolContract.winnersCount(),
          poolContract.maxSlotsPerAddress(),
          poolContract.state(),
          poolContract.isPrized(),
          poolContract.prizeCollection().catch(() => ethers.constants.AddressZero),
          poolContract.prizeTokenId().catch(() => 0),
          poolContract.standard().catch(() => 0),
          poolContract.isCollabPool().catch(() => false),
          poolContract.usesCustomFee().catch(() => false),
          poolContract.revenueRecipient().catch(() => ethers.constants.AddressZero),
          poolContract.isExternalCollection().catch(() => false),
          poolContract.isRefundable().catch(() => false),
        ]);

        // Insert pool into database
        const { error: poolError } = await supabase
          .from('pools')
          .upsert({
            address: poolAddress,
            chain_id: chainId,
            name: name || null,
            creator: creator,
            start_time: startTime.toString(),
            duration: duration.toString(),
            created_at_block: event.blockNumber,
            created_at_timestamp: new Date(block.timestamp * 1000).toISOString(),
            slot_fee: slotFee.toString(),
            slot_limit: slotLimit.toNumber(),
            winners_count: winnersCount.toNumber(),
            max_slots_per_address: maxSlotsPerAddress.toNumber(),
            state: state,
            is_prized: isPrized,
            prize_collection: isPrized ? prizeCollection.toLowerCase() : null,
            prize_token_id: isPrized ? prizeTokenId.toNumber() : null,
            standard: isPrized ? standard : null,
            is_collab_pool: isCollabPool,
            uses_custom_fee: usesCustomFee,
            revenue_recipient: revenueRecipient !== ethers.constants.AddressZero ? revenueRecipient.toLowerCase() : null,
            is_external_collection: isExternalCollection,
            is_refundable: isRefundable,
            last_synced_block: event.blockNumber,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'address,chain_id'
          });

        if (poolError) {
          console.error(`Error inserting pool ${poolAddress}:`, JSON.stringify(poolError, null, 2));
          errorCount++;
        } else {
          // Create user activity record for raffle creation
          await supabase
            .from('user_activity')
            .upsert({
              user_address: creator,
              chain_id: chainId,
              activity_type: 'raffle_created',
              pool_address: poolAddress,
              pool_name: name || null,
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
        contract_type: 'pool_deployer',
        contract_address: poolDeployerAddress.toLowerCase(),
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
