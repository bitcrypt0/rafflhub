// Supabase Edge Function: add-pool-manually
// Manually adds a pool to the database by fetching its state from blockchain
// Useful when a pool wasn't indexed via PoolDeployer events

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface AddPoolRequest {
  chainId: number;
  poolAddress: string;
  createdAtBlock?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chainId, poolAddress, createdAtBlock }: AddPoolRequest = await req.json();

    if (!chainId || !poolAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: chainId, poolAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const poolAddr = poolAddress.toLowerCase();
    const rpcUrl = Deno.env.get(`RPC_URL_${chainId}`) || 'https://base-sepolia-rpc.publicnode.com';

    console.log(`[Chain ${chainId}] Manually adding pool ${poolAddr}`);

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const poolContract = new ethers.Contract(poolAddr, POOL_ABI, provider);

    // Fetch pool state from blockchain
    const [
      name,
      creator,
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
      poolContract.creator(),
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
      poolContract.revenueRecipient(),
      poolContract.isExternalCollection().catch(() => false),
      poolContract.isRefundable().catch(() => true),
    ]);

    const currentBlock = await provider.getBlockNumber();
    const blockNumber = createdAtBlock || currentBlock;
    const block = await provider.getBlock(blockNumber);

    // Insert pool into database
    const { data, error } = await supabase
      .from('pools')
      .upsert({
        address: poolAddr,
        chain_id: chainId,
        name: name || 'Unnamed Pool',
        creator: creator.toLowerCase(),
        start_time: startTime.toNumber(),
        duration: duration.toNumber(),
        created_at_block: blockNumber,
        created_at_timestamp: new Date(block.timestamp * 1000).toISOString(),
        slot_fee: slotFee.toString(),
        slot_limit: slotLimit.toNumber(),
        winners_count: winnersCount.toNumber(),
        max_slots_per_address: maxSlotsPerAddress.toNumber(),
        state: state,
        is_prized: isPrized,
        prize_collection: prizeCollection !== ethers.constants.AddressZero ? prizeCollection.toLowerCase() : null,
        prize_token_id: isPrized ? prizeTokenId.toNumber() : null,
        standard: isPrized ? standard : null,
        is_collab_pool: isCollabPool,
        uses_custom_fee: usesCustomFee,
        revenue_recipient: revenueRecipient.toLowerCase(),
        is_external_collection: isExternalCollection,
        is_refundable: isRefundable,
        last_synced_block: currentBlock,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'address,chain_id'
      });

    if (error) {
      throw error;
    }

    console.log(`✅ Pool ${poolAddr} added successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        poolAddress: poolAddr,
        poolData: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error adding pool:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to add pool', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
