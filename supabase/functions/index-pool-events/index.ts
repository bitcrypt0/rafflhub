// Supabase Edge Function: index-pool-events
// Indexes Pool contract events: SlotsPurchased, WinnersSelected, RandomRequested, PrizeClaimed, RefundClaimed
// Updates pools, pool_participants, pool_winners, and user_activity tables

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Pool ABI - Events
const POOL_ABI = [
  'event SlotsPurchased(address indexed participant, uint256 quantity)',
  'event WinnersSelected(address[] winners)',
  'event RandomRequested(uint256 requestId)',
  'event PrizeClaimed(address indexed winner, uint256 tokenId)',
  'event RefundClaimed(address indexed participant, uint256 amount)',
  'function name() view returns (string)',
  'function slotFee() view returns (uint256)',
];

interface IndexRequest {
  chainId: number;
  poolAddress: string;
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

    const { chainId, poolAddress, fromBlock, toBlock = 'latest' }: IndexRequest = await req.json();

    if (!chainId || !poolAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: chainId, poolAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const poolAddr = poolAddress.toLowerCase();

    // Get RPC URL from environment
    const rpcUrl = Deno.env.get(`RPC_URL_${chainId}`) || 'https://base-sepolia-rpc.publicnode.com';

    console.log(`[Chain ${chainId}] Indexing pool events for ${poolAddr}`);

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const poolContract = new ethers.Contract(poolAddr, POOL_ABI, provider);

    // Get pool name and slot fee for activity records
    const [poolName, slotFee] = await Promise.all([
      poolContract.name().catch(() => ''),
      poolContract.slotFee(),
    ]);

    // Get sync state
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'pool')
      .eq('contract_address', poolAddr)
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined ? fromBlock : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : Math.max(0, currentBlock - 1000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    let eventsProcessed = 0;
    let errors = 0;

    // ============================================
    // 1. SlotsPurchased Events
    // ============================================
    const slotsPurchasedFilter = poolContract.filters.SlotsPurchased();
    const slotsPurchasedEvents = await poolContract.queryFilter(slotsPurchasedFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${slotsPurchasedEvents.length} SlotsPurchased events`);

    for (const event of slotsPurchasedEvents) {
      try {
        const participant = event.args!.participant.toLowerCase();
        const quantity = event.args!.quantity.toNumber();
        const block = await provider.getBlock(event.blockNumber);

        // Update or create participant record
        const { data: existing } = await supabase
          .from('pool_participants')
          .select('slots_purchased, total_spent')
          .eq('pool_address', poolAddr)
          .eq('chain_id', chainId)
          .eq('participant_address', participant)
          .single();

        const newSlotsPurchased = (existing?.slots_purchased || 0) + quantity;
        const newTotalSpent = ethers.BigNumber.from(existing?.total_spent || '0')
          .add(slotFee.mul(quantity))
          .toString();

        await supabase
          .from('pool_participants')
          .upsert({
            pool_address: poolAddr,
            chain_id: chainId,
            participant_address: participant,
            slots_purchased: newSlotsPurchased,
            total_spent: newTotalSpent,
            first_purchase_block: existing ? undefined : event.blockNumber,
            first_purchase_at: existing ? undefined : new Date(block.timestamp * 1000).toISOString(),
            last_purchase_block: event.blockNumber,
            last_purchase_at: new Date(block.timestamp * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'pool_address,chain_id,participant_address'
          });

        // Create user activity record
        await supabase
          .from('user_activity')
          .upsert({
            user_address: participant,
            chain_id: chainId,
            activity_type: 'slot_purchase',
            pool_address: poolAddr,
            pool_name: poolName || null,
            quantity: quantity,
            amount: slotFee.mul(quantity).toString(),
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
          }, {
            onConflict: 'chain_id,transaction_hash,activity_type,user_address',
            ignoreDuplicates: true
          });

        eventsProcessed++;
      } catch (err) {
        console.error(`Error processing SlotsPurchased event:`, err);
        errors++;
      }
    }

    // Update pool slots_sold count
    if (slotsPurchasedEvents.length > 0) {
      const { data: participants } = await supabase
        .from('pool_participants')
        .select('slots_purchased')
        .eq('pool_address', poolAddr)
        .eq('chain_id', chainId);

      const totalSlotsSold = participants?.reduce((sum, p) => sum + p.slots_purchased, 0) || 0;

      await supabase
        .from('pools')
        .update({ slots_sold: totalSlotsSold })
        .eq('address', poolAddr)
        .eq('chain_id', chainId);
    }

    // ============================================
    // 2. WinnersSelected Events
    // ============================================
    const winnersSelectedFilter = poolContract.filters.WinnersSelected();
    const winnersSelectedEvents = await poolContract.queryFilter(winnersSelectedFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${winnersSelectedEvents.length} WinnersSelected events`);

    for (const event of winnersSelectedEvents) {
      try {
        const winners = event.args!.winners.map((w: string) => w.toLowerCase());
        const block = await provider.getBlock(event.blockNumber);

        for (let i = 0; i < winners.length; i++) {
          const winner = winners[i];

          // Insert winner record
          await supabase
            .from('pool_winners')
            .upsert({
              pool_address: poolAddr,
              chain_id: chainId,
              winner_address: winner,
              winner_index: i,
              selected_block: event.blockNumber,
              selected_at: new Date(block.timestamp * 1000).toISOString(),
            }, {
              onConflict: 'pool_address,chain_id,winner_address,winner_index'
            });

          // Create user activity record
          await supabase
            .from('user_activity')
            .upsert({
              user_address: winner,
              chain_id: chainId,
              activity_type: 'prize_won',
              pool_address: poolAddr,
              pool_name: poolName || null,
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000).toISOString(),
            }, {
              onConflict: 'chain_id,transaction_hash,activity_type,user_address',
              ignoreDuplicates: true
            });

          // Update participant wins_count
          await supabase.rpc('execute_sql', {
            sql: `UPDATE pool_participants
                  SET wins_count = wins_count + 1
                  WHERE pool_address = $1 AND chain_id = $2 AND participant_address = $3`,
            params: [poolAddr, chainId, winner]
          }).catch(() => {}); // Ignore if function doesn't exist
        }

        // Update pool winners_selected count
        await supabase
          .from('pools')
          .update({ winners_selected: winners.length, state: 4 }) // State 4 = completed
          .eq('address', poolAddr)
          .eq('chain_id', chainId);

        eventsProcessed++;
      } catch (err) {
        console.error(`Error processing WinnersSelected event:`, err);
        errors++;
      }
    }

    // ============================================
    // 3. RandomRequested Events
    // ============================================
    const randomRequestedFilter = poolContract.filters.RandomRequested();
    const randomRequestedEvents = await poolContract.queryFilter(randomRequestedFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${randomRequestedEvents.length} RandomRequested events`);

    for (const event of randomRequestedEvents) {
      try {
        const requestId = event.args!.requestId.toString();
        const block = await provider.getBlock(event.blockNumber);
        const tx = await event.getTransaction();
        const requester = tx.from.toLowerCase();

        // Create user activity record
        await supabase
          .from('user_activity')
          .upsert({
            user_address: requester,
            chain_id: chainId,
            activity_type: 'randomness_requested',
            pool_address: poolAddr,
            pool_name: poolName || null,
            request_id: requestId,
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
          }, {
            onConflict: 'chain_id,transaction_hash,activity_type,user_address',
            ignoreDuplicates: true
          });

        // Update pool state to drawing
        await supabase
          .from('pools')
          .update({ state: 3 }) // State 3 = drawing
          .eq('address', poolAddr)
          .eq('chain_id', chainId);

        eventsProcessed++;
      } catch (err) {
        console.error(`Error processing RandomRequested event:`, err);
        errors++;
      }
    }

    // ============================================
    // 4. PrizeClaimed Events
    // ============================================
    const prizeClaimedFilter = poolContract.filters.PrizeClaimed();
    const prizeClaimedEvents = await poolContract.queryFilter(prizeClaimedFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${prizeClaimedEvents.length} PrizeClaimed events`);

    for (const event of prizeClaimedEvents) {
      try {
        const winner = event.args!.winner.toLowerCase();
        const tokenId = event.args!.tokenId.toNumber();
        const block = await provider.getBlock(event.blockNumber);

        // Update winner record
        await supabase
          .from('pool_winners')
          .update({
            prize_claimed: true,
            prize_claimed_at: new Date(block.timestamp * 1000).toISOString(),
            prize_claimed_block: event.blockNumber,
            prize_claimed_tx_hash: event.transactionHash,
            minted_token_id: tokenId,
          })
          .eq('pool_address', poolAddr)
          .eq('chain_id', chainId)
          .eq('winner_address', winner);

        // Create user activity record
        await supabase
          .from('user_activity')
          .upsert({
            user_address: winner,
            chain_id: chainId,
            activity_type: 'prize_claimed',
            pool_address: poolAddr,
            pool_name: poolName || null,
            token_id: tokenId,
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
          }, {
            onConflict: 'chain_id,transaction_hash,activity_type,user_address',
            ignoreDuplicates: true
          });

        eventsProcessed++;
      } catch (err) {
        console.error(`Error processing PrizeClaimed event:`, err);
        errors++;
      }
    }

    // ============================================
    // 5. RefundClaimed Events
    // ============================================
    const refundClaimedFilter = poolContract.filters.RefundClaimed();
    const refundClaimedEvents = await poolContract.queryFilter(refundClaimedFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${refundClaimedEvents.length} RefundClaimed events`);

    for (const event of refundClaimedEvents) {
      try {
        const participant = event.args!.participant.toLowerCase();
        const amount = event.args!.amount.toString();
        const block = await provider.getBlock(event.blockNumber);

        // Update participant record
        await supabase
          .from('pool_participants')
          .update({
            refund_claimed: true,
            refundable_amount: '0',
          })
          .eq('pool_address', poolAddr)
          .eq('chain_id', chainId)
          .eq('participant_address', participant);

        // Create user activity record
        await supabase
          .from('user_activity')
          .upsert({
            user_address: participant,
            chain_id: chainId,
            activity_type: 'refund_claimed',
            pool_address: poolAddr,
            pool_name: poolName || null,
            amount: amount,
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
          }, {
            onConflict: 'chain_id,transaction_hash,activity_type,user_address',
            ignoreDuplicates: true
          });

        eventsProcessed++;
      } catch (err) {
        console.error(`Error processing RefundClaimed event:`, err);
        errors++;
      }
    }

    // Update sync state
    await supabase
      .from('indexer_sync_state')
      .upsert({
        chain_id: chainId,
        contract_type: 'pool',
        contract_address: poolAddr,
        last_indexed_block: endBlock,
        last_block_hash: (await provider.getBlock(endBlock)).hash,
        last_indexed_at: new Date().toISOString(),
        is_healthy: true,
        error_message: null,
      }, {
        onConflict: 'chain_id,contract_type,contract_address'
      });

    console.log(`[Chain ${chainId}] Pool indexing complete: ${eventsProcessed} events processed, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        poolAddress: poolAddr,
        blocksScanned: { from: startBlock, to: endBlock },
        eventsProcessed,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Pool indexer error:', error);
    return new Response(
      JSON.stringify({ error: 'Pool indexing failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
