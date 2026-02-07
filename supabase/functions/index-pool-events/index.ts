// Supabase Edge Function: index-pool-events
// Indexes all pool contract events: SlotsPurchased, WinnersSelected, RandomRequested,
// PrizeClaimed, RefundClaimed, PoolActivated, PoolEnded.
//
// Design decisions:
//   - All 7 queryFilter calls fire in parallel (single block-range scan each).
//   - All block data is fetched in one batched round via fetchBlockMap.
//   - SlotsPurchased: checks user_activity for already-indexed tx hashes before
//     accumulating into pool_participants, preventing double-counting on re-index.
//   - WinnersSelected: wins_count is set to the absolute count derived from
//     pool_winners (not incremented), making it safe to re-run.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders, verifyInternalAuth, fetchBlockMap } from '../_shared/helpers.ts';
import { providerCache } from '../_shared/provider-cache.ts';
import { isSupportedNetwork } from '../_shared/networks.ts';

const POOL_ABI = [
  'event SlotsPurchased(address indexed participant, uint256 quantity)',
  'event WinnersSelected(address[] winners)',
  'event RandomRequested(uint256 requestId, address indexed caller)',
  'event PrizeClaimed(address indexed winner, uint256 amount)',
  'event RefundClaimed(address indexed participant, uint256 amount)',
  'event PoolActivated(uint256 timestamp)',
  'event PoolEnded(uint256 timestamp)',
  'function name() view returns (string)',
  'function slotFee() view returns (uint256)',
  'function getRefundableAmount(address participant) view returns (uint256)',
  'function isRefundable() view returns (bool)',
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

    if (!chainId || !isSupportedNetwork(chainId) || !poolAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid parameters: chainId, poolAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const poolAddr = poolAddress.toLowerCase();
    const provider = providerCache.getProvider(chainId);
    const poolContract = new ethers.Contract(poolAddr, POOL_ABI, provider);

    console.log(`[Chain ${chainId}] Indexing pool events for ${poolAddr}`);

    const [poolName, slotFee] = await Promise.all([
      poolContract.name().catch(() => ''),
      poolContract.slotFee(),
    ]);

    // Resume from last indexed block
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'pool')
      .eq('contract_address', poolAddr)
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined
      ? fromBlock
      : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : Math.max(0, currentBlock - 10000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    // ---------------------------------------------------------------
    // Fire all 7 event filters in parallel — single pass over the block range
    // ---------------------------------------------------------------
    const [
      slotsPurchasedEvents,
      winnersSelectedEvents,
      randomRequestedEvents,
      prizeClaimedEvents,
      refundClaimedEvents,
      poolActivatedEvents,
      poolEndedEvents,
    ] = await Promise.all([
      poolContract.queryFilter(poolContract.filters.SlotsPurchased(), startBlock, endBlock),
      poolContract.queryFilter(poolContract.filters.WinnersSelected(), startBlock, endBlock),
      poolContract.queryFilter(poolContract.filters.RandomRequested(), startBlock, endBlock),
      poolContract.queryFilter(poolContract.filters.PrizeClaimed(), startBlock, endBlock),
      poolContract.queryFilter(poolContract.filters.RefundClaimed(), startBlock, endBlock),
      poolContract.queryFilter(poolContract.filters.PoolActivated(), startBlock, endBlock),
      poolContract.queryFilter(poolContract.filters.PoolEnded(), startBlock, endBlock),
    ]);

    // Batch-fetch all block data across every event type in one round
    const allEvents = [
      ...slotsPurchasedEvents,
      ...winnersSelectedEvents,
      ...randomRequestedEvents,
      ...prizeClaimedEvents,
      ...refundClaimedEvents,
      ...poolActivatedEvents,
      ...poolEndedEvents,
    ];
    const blockMap = await fetchBlockMap(provider, allEvents.map((e) => e.blockNumber));

    // ---------------------------------------------------------------
    // Idempotency: batch-fetch already-indexed tx hashes for the two
    // event types that mutate accumulated state (SlotsPurchased and
    // WinnersSelected).  Events whose tx hash is already present in
    // user_activity are skipped to avoid double-counting.
    // ---------------------------------------------------------------
    const slotsTxHashes = slotsPurchasedEvents.map((e) => e.transactionHash);
    const winnersTxHashes = winnersSelectedEvents.map((e) => e.transactionHash);

    const [processedSlotsTxs, processedWinnersTxs] = await Promise.all([
      slotsTxHashes.length > 0
        ? supabase
            .from('user_activity')
            .select('transaction_hash')
            .eq('chain_id', chainId)
            .eq('pool_address', poolAddr)
            .eq('activity_type', 'slot_purchase')
            .in('transaction_hash', slotsTxHashes)
        : { data: [] as { transaction_hash: string }[] },
      winnersTxHashes.length > 0
        ? supabase
            .from('user_activity')
            .select('transaction_hash')
            .eq('chain_id', chainId)
            .eq('pool_address', poolAddr)
            .eq('activity_type', 'prize_won')
            .in('transaction_hash', winnersTxHashes)
        : { data: [] as { transaction_hash: string }[] },
    ]);

    const processedSlotsTxSet = new Set(
      (processedSlotsTxs.data || []).map((r: { transaction_hash: string }) => r.transaction_hash)
    );
    const processedWinnersTxSet = new Set(
      (processedWinnersTxs.data || []).map((r: { transaction_hash: string }) => r.transaction_hash)
    );

    let eventsProcessed = 0;
    let errors = 0;

    // ============================================
    // 1. SlotsPurchased
    // ============================================
    console.log(`[Chain ${chainId}] Found ${slotsPurchasedEvents.length} SlotsPurchased events`);

    for (const event of slotsPurchasedEvents) {
      try {
        // Skip if this tx was already indexed — prevents double-accumulation
        if (processedSlotsTxSet.has(event.transactionHash)) {
          eventsProcessed++;
          continue;
        }

        const participant = event.args!.participant.toLowerCase();
        const quantity = event.args!.quantity.toNumber();
        const block = blockMap.get(event.blockNumber)!;

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
          .upsert(
            {
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
            },
            { onConflict: 'pool_address,chain_id,participant_address' }
          );

        // Activity record — idempotent via ignoreDuplicates; also serves as the
        // dedup marker for future runs.
        await supabase
          .from('user_activity')
          .upsert(
            {
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
            },
            {
              onConflict: 'chain_id,transaction_hash,activity_type,user_address',
              ignoreDuplicates: true,
            }
          );

        eventsProcessed++;
      } catch (err) {
        console.error('Error processing SlotsPurchased event:', err);
        errors++;
      }
    }

    // Recompute total slots_sold for the pool from current participant data
    if (slotsPurchasedEvents.length > 0) {
      const { data: participants } = await supabase
        .from('pool_participants')
        .select('slots_purchased')
        .eq('pool_address', poolAddr)
        .eq('chain_id', chainId);

      const totalSlotsSold = (participants || []).reduce(
        (sum: number, p: { slots_purchased: number }) => sum + p.slots_purchased, 0
      );

      await supabase
        .from('pools')
        .update({ slots_sold: totalSlotsSold })
        .eq('address', poolAddr)
        .eq('chain_id', chainId);
    }

    // ============================================
    // 2. WinnersSelected
    // ============================================
    console.log(`[Chain ${chainId}] Found ${winnersSelectedEvents.length} WinnersSelected events`);

    for (const event of winnersSelectedEvents) {
      try {
        const winners = event.args!.winners.map((w: string) => w.toLowerCase());
        const block = blockMap.get(event.blockNumber)!;

        for (let i = 0; i < winners.length; i++) {
          const winner = winners[i];

          // Upsert is idempotent on the composite key
          // Include selection_tx_hash for block explorer linking
          await supabase
            .from('pool_winners')
            .upsert(
              {
                pool_address: poolAddr,
                chain_id: chainId,
                winner_address: winner,
                winner_index: i,
                selected_block: event.blockNumber,
                selected_at: new Date(block.timestamp * 1000).toISOString(),
                selection_tx_hash: event.transactionHash,
              },
              { onConflict: 'pool_address,chain_id,winner_address,winner_index' }
            );

          await supabase
            .from('user_activity')
            .upsert(
              {
                user_address: winner,
                chain_id: chainId,
                activity_type: 'prize_won',
                pool_address: poolAddr,
                pool_name: poolName || null,
                block_number: event.blockNumber,
                transaction_hash: event.transactionHash,
                timestamp: new Date(block.timestamp * 1000).toISOString(),
              },
              {
                onConflict: 'chain_id,transaction_hash,activity_type,user_address',
                ignoreDuplicates: true,
              }
            );
        }

        // Only advance state to Completed (4) if current DB state is less advanced.
        // This prevents overwriting AllPrizesClaimed (6) back to Completed (4) on re-index.
        const { data: currentPool } = await supabase
          .from('pools')
          .select('state')
          .eq('address', poolAddr)
          .eq('chain_id', chainId)
          .single();

        const updatePayload: Record<string, unknown> = { winners_selected: winners.length };
        if (!currentPool || currentPool.state < 4) {
          updatePayload.state = 4;
        }

        await supabase
          .from('pools')
          .update(updatePayload)
          .eq('address', poolAddr)
          .eq('chain_id', chainId);

        eventsProcessed++;
      } catch (err) {
        console.error('Error processing WinnersSelected event:', err);
        errors++;
      }
    }

    // Recompute wins_count from pool_winners — absolute count, not an increment,
    // so re-running this block is safe.
    if (winnersSelectedEvents.length > 0) {
      const { data: allWinners } = await supabase
        .from('pool_winners')
        .select('winner_address')
        .eq('pool_address', poolAddr)
        .eq('chain_id', chainId);

      const winCounts = new Map<string, number>();
      for (const w of (allWinners || [])) {
        winCounts.set(w.winner_address, (winCounts.get(w.winner_address) || 0) + 1);
      }

      for (const [address, count] of winCounts) {
        await supabase
          .from('pool_participants')
          .update({ wins_count: count })
          .eq('pool_address', poolAddr)
          .eq('chain_id', chainId)
          .eq('participant_address', address);
      }

      // Calculate and store refundable amounts for all participants
      // This happens when winners are selected (pool becomes completed)
      // Always use getRefundableAmount() for accurate values - the contract handles winner logic
      try {
        const { data: allParticipants } = await supabase
          .from('pool_participants')
          .select('participant_address, refund_claimed')
          .eq('pool_address', poolAddr)
          .eq('chain_id', chainId);

        for (const participant of (allParticipants || [])) {
          // Skip if already claimed refund - amount is already 0
          if (participant.refund_claimed) continue;

          // Fetch refundable amount from contract for ALL participants
          // The contract's getRefundableAmount() handles winner/non-winner logic correctly
          try {
            const refundableAmount = await poolContract.getRefundableAmount(participant.participant_address);
            await supabase
              .from('pool_participants')
              .update({ refundable_amount: refundableAmount.toString() })
              .eq('pool_address', poolAddr)
              .eq('chain_id', chainId)
              .eq('participant_address', participant.participant_address);
          } catch (refundErr) {
            console.warn(`Failed to get refundable amount for ${participant.participant_address}:`, refundErr);
          }
        }
        console.log(`[Chain ${chainId}] Updated refundable amounts for ${allParticipants?.length || 0} participants`);
      } catch (refundCalcErr) {
        console.error('Error calculating refundable amounts:', refundCalcErr);
      }
    }

    // ============================================
    // 3. RandomRequested
    // ============================================
    console.log(`[Chain ${chainId}] Found ${randomRequestedEvents.length} RandomRequested events`);

    for (const event of randomRequestedEvents) {
      try {
        const requestId = event.args!.requestId.toString();
        const caller = event.args!.caller.toLowerCase();
        const block = blockMap.get(event.blockNumber)!;

        const { error: activityError } = await supabase
          .from('user_activity')
          .upsert(
            {
              user_address: caller,
              chain_id: chainId,
              activity_type: 'randomness_requested',
              pool_address: poolAddr,
              pool_name: poolName || null,
              request_id: requestId,
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000).toISOString(),
            },
            {
              onConflict: 'chain_id,transaction_hash,activity_type,user_address',
              ignoreDuplicates: true,
            }
          );

        if (activityError) {
          console.error('Failed to insert randomness_requested activity:', activityError);
          throw activityError;
        }

        const { error: poolError } = await supabase
          .from('pools')
          .update({ state: 3 })
          .eq('address', poolAddr)
          .eq('chain_id', chainId);

        if (poolError) {
          console.error('Failed to update pool state:', poolError);
        }

        eventsProcessed++;
      } catch (err) {
        console.error('Error processing RandomRequested event:', err);
        errors++;
      }
    }

    // ============================================
    // 4. PrizeClaimed
    // ============================================
    console.log(`[Chain ${chainId}] Found ${prizeClaimedEvents.length} PrizeClaimed events`);

    for (const event of prizeClaimedEvents) {
      try {
        const winner = event.args!.winner.toLowerCase();
        const amount = event.args!.amount.toString();
        const block = blockMap.get(event.blockNumber)!;

        // Idempotent: sets the same values on re-run
        await supabase
          .from('pool_winners')
          .update({
            prize_claimed: true,
            prize_claimed_at: new Date(block.timestamp * 1000).toISOString(),
            prize_claimed_block: event.blockNumber,
            prize_claimed_tx_hash: event.transactionHash,
          })
          .eq('pool_address', poolAddr)
          .eq('chain_id', chainId)
          .eq('winner_address', winner);

        await supabase
          .from('user_activity')
          .upsert(
            {
              user_address: winner,
              chain_id: chainId,
              activity_type: 'prize_claimed',
              pool_address: poolAddr,
              pool_name: poolName || null,
              amount: amount,
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000).toISOString(),
            },
            {
              onConflict: 'chain_id,transaction_hash,activity_type,user_address',
              ignoreDuplicates: true,
            }
          );

        eventsProcessed++;
      } catch (err) {
        console.error('Error processing PrizeClaimed event:', err);
        errors++;
      }
    }

    // ============================================
    // 5. RefundClaimed
    // ============================================
    console.log(`[Chain ${chainId}] Found ${refundClaimedEvents.length} RefundClaimed events`);

    for (const event of refundClaimedEvents) {
      try {
        const participant = event.args!.participant.toLowerCase();
        const amount = event.args!.amount.toString();
        const block = blockMap.get(event.blockNumber)!;

        // Idempotent: sets the same final state on re-run
        await supabase
          .from('pool_participants')
          .update({ refund_claimed: true, refundable_amount: '0' })
          .eq('pool_address', poolAddr)
          .eq('chain_id', chainId)
          .eq('participant_address', participant);

        await supabase
          .from('user_activity')
          .upsert(
            {
              user_address: participant,
              chain_id: chainId,
              activity_type: 'refund_claimed',
              pool_address: poolAddr,
              pool_name: poolName || null,
              amount: amount,
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000).toISOString(),
            },
            {
              onConflict: 'chain_id,transaction_hash,activity_type,user_address',
              ignoreDuplicates: true,
            }
          );

        eventsProcessed++;
      } catch (err) {
        console.error('Error processing RefundClaimed event:', err);
        errors++;
      }
    }

    // ============================================
    // 6. PoolActivated
    // ============================================
    console.log(`[Chain ${chainId}] Found ${poolActivatedEvents.length} PoolActivated events`);

    for (const event of poolActivatedEvents) {
      try {
        const activatedTimestamp = event.args!.timestamp.toNumber();
        const block = blockMap.get(event.blockNumber)!;

        await supabase
          .from('pools')
          .update({
            state: 1,
            activated_at: new Date(activatedTimestamp * 1000).toISOString(),
            activated_block: event.blockNumber,
          })
          .eq('address', poolAddr)
          .eq('chain_id', chainId);

        await supabase
          .from('blockchain_events')
          .upsert(
            {
              chain_id: chainId,
              contract_address: poolAddr,
              event_name: 'PoolActivated',
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              log_index: event.logIndex,
              block_timestamp: new Date(block.timestamp * 1000).toISOString(),
              event_data: { activatedTimestamp },
            },
            {
              onConflict: 'chain_id,transaction_hash,log_index',
              ignoreDuplicates: true,
            }
          );

        eventsProcessed++;
      } catch (err) {
        console.error('Error processing PoolActivated event:', err);
        errors++;
      }
    }

    // ============================================
    // 7. PoolEnded
    // ============================================
    console.log(`[Chain ${chainId}] Found ${poolEndedEvents.length} PoolEnded events`);

    for (const event of poolEndedEvents) {
      try {
        const endedTimestamp = event.args!.timestamp.toNumber();
        const block = blockMap.get(event.blockNumber)!;

        const { data: poolData } = await supabase
          .from('pools')
          .select('activated_at')
          .eq('address', poolAddr)
          .eq('chain_id', chainId)
          .single();

        let actualDuration = null;
        if (poolData?.activated_at) {
          const activatedTime = new Date(poolData.activated_at).getTime() / 1000;
          actualDuration = endedTimestamp - activatedTime;
        }

        await supabase
          .from('pools')
          .update({
            state: 2,
            ended_at: new Date(endedTimestamp * 1000).toISOString(),
            ended_block: event.blockNumber,
            actual_duration: actualDuration,
          })
          .eq('address', poolAddr)
          .eq('chain_id', chainId);

        await supabase
          .from('blockchain_events')
          .upsert(
            {
              chain_id: chainId,
              contract_address: poolAddr,
              event_name: 'PoolEnded',
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              log_index: event.logIndex,
              block_timestamp: new Date(block.timestamp * 1000).toISOString(),
              event_data: { endedTimestamp, actualDuration },
            },
            {
              onConflict: 'chain_id,transaction_hash,log_index',
              ignoreDuplicates: true,
            }
          );

        eventsProcessed++;
      } catch (err) {
        console.error('Error processing PoolEnded event:', err);
        errors++;
      }
    }

    // Advance sync pointer
    await supabase
      .from('indexer_sync_state')
      .upsert(
        {
          chain_id: chainId,
          contract_type: 'pool',
          contract_address: poolAddr,
          last_indexed_block: endBlock,
          last_block_hash: (await provider.getBlock(endBlock)).hash,
          last_indexed_at: new Date().toISOString(),
          is_healthy: true,
          error_message: null,
        },
        { onConflict: 'chain_id,contract_type,contract_address' }
      );

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
