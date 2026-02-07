// Supabase Edge Function: index-rewards
// Indexes all RewardsFlywheel events for comprehensive flywheel data tracking.
// Tracks: points system, pool rewards, creator rewards, participant claims.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders, verifyInternalAuth, fetchBlockMap } from '../_shared/helpers.ts';
import { providerCache } from '../_shared/provider-cache.ts';
import { getContractAddress, isSupportedNetwork } from '../_shared/networks.ts';

const REWARDS_FLYWHEEL_ABI = [
  // Points System Events
  'event PointsSystemActivated(bool active)',
  'event PointsClaimsActivated()',
  'event PointsRewardTokenDeposited(address indexed token, uint256 amount)',
  'event PointsRewardClaimed(address indexed user, uint256 pointsClaimed, uint256 tokenAmount)',
  // Pool Participant Rewards Events
  'event RewardsDeposited(address indexed pool, address indexed token, uint256 amount, address indexed depositor)',
  'event RewardsClaimed(address indexed pool, address indexed user, address indexed token, uint256 amount)',
  'event RewardsWithdrawn(address indexed pool, address indexed token, uint256 amount, address indexed depositor)',
  'event RewardPerSlotCalculated(address indexed pool, uint256 rewardPerSlot, uint256 totalEligibleSlots)',
  // Creator Rewards Events
  'event CreatorRewardsDeposited(address indexed token, uint256 amount, uint128 rewardAmount, uint256 eligiblePoolCount)',
  'event CreatorRewardsClaimed(address indexed pool, address indexed creator, address indexed token, uint256 amount, uint256 fillPercentage)',
  'event CreatorRewardsWithdrawn(address indexed token, uint256 amount)',
  'event CreatorRewardAmountUpdated(address indexed token, uint128 oldAmount, uint128 newAmount)',
];

// ABI for reading contract state
const REWARDS_FLYWHEEL_READ_ABI = [
  'function getPointsSystemInfo() view returns (bool active, bool claimsActive, address token, uint256 rate, uint256 totalDeposited)',
  'function getCreatorRewardTokens() view returns (address[])',
  'function getCreatorRewardConfig(address token) view returns (uint128 rewardAmount, uint256 totalDeposited, address tokenAddress)',
  'function poolRewards(address pool) view returns (uint256 totalDeposited, uint256 totalClaimedAmount, uint256 rewardPerSlot, uint256 totalEligibleSlots, uint256 claimedSlots, address token, address depositor, bool rewardPerSlotCalculated)',
];

// ERC20 ABI for token metadata
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
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

    if (!chainId || !isSupportedNetwork(chainId)) {
      return new Response(
        JSON.stringify({ error: 'Missing or unsupported chainId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rewardsFlywheelAddress = getContractAddress(chainId, 'rewardsFlywheel');
    if (!rewardsFlywheelAddress || rewardsFlywheelAddress === '0x...') {
      return new Response(
        JSON.stringify({ error: `No RewardsFlywheel contract deployed on chain ${chainId}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chain ${chainId}] Starting indexer for RewardsFlywheel at ${rewardsFlywheelAddress}`);

    const provider = providerCache.getProvider(chainId);
    const rewardsFlywheel = new ethers.Contract(rewardsFlywheelAddress, REWARDS_FLYWHEEL_ABI, provider);
    const rewardsFlywheelRead = new ethers.Contract(rewardsFlywheelAddress, REWARDS_FLYWHEEL_READ_ABI, provider);

    // Resume from last indexed block
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'rewards_flywheel')
      .eq('contract_address', rewardsFlywheelAddress.toLowerCase())
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined
      ? fromBlock
      : (syncState?.last_indexed_block !== null && syncState?.last_indexed_block !== undefined && syncState.last_indexed_block > 0
          ? syncState.last_indexed_block + 1
          : Math.max(0, currentBlock - 100000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    // Query all event types in parallel
    const [
      pointsSystemEvents,
      pointsClaimsActivatedEvents,
      pointsDepositedEvents,
      pointsClaimedEvents,
      rewardsDepositedEvents,
      rewardsClaimedEvents,
      rewardsWithdrawnEvents,
      rewardPerSlotEvents,
      creatorDepositedEvents,
      creatorClaimedEvents,
      creatorWithdrawnEvents,
    ] = await Promise.all([
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.PointsSystemActivated(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.PointsClaimsActivated(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.PointsRewardTokenDeposited(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.PointsRewardClaimed(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.RewardsDeposited(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.RewardsClaimed(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.RewardsWithdrawn(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.RewardPerSlotCalculated(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.CreatorRewardsDeposited(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.CreatorRewardsClaimed(), startBlock, endBlock),
      rewardsFlywheel.queryFilter(rewardsFlywheel.filters.CreatorRewardsWithdrawn(), startBlock, endBlock),
    ]);

    const allEvents = [
      ...pointsSystemEvents, ...pointsClaimsActivatedEvents, ...pointsDepositedEvents,
      ...pointsClaimedEvents, ...rewardsDepositedEvents, ...rewardsClaimedEvents,
      ...rewardsWithdrawnEvents, ...rewardPerSlotEvents, ...creatorDepositedEvents,
      ...creatorClaimedEvents, ...creatorWithdrawnEvents,
    ];

    console.log(`[Chain ${chainId}] Found ${allEvents.length} total events`);

    // Batch-fetch all required blocks
    const blockMap = await fetchBlockMap(provider, allEvents.map((e) => e.blockNumber));

    let successCount = 0;
    let errorCount = 0;

    // Helper to fetch token metadata
    const getTokenMetadata = async (tokenAddress: string) => {
      if (!tokenAddress || tokenAddress === ethers.constants.AddressZero) return { symbol: null, decimals: 18 };
      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const [symbol, decimals] = await Promise.all([
          tokenContract.symbol().catch(() => null),
          tokenContract.decimals().catch(() => 18),
        ]);
        return { symbol, decimals };
      } catch {
        return { symbol: null, decimals: 18 };
      }
    };

    // Process PointsSystemActivated events
    for (const event of pointsSystemEvents) {
      try {
        const active = event.args!.active;
        await supabase
          .from('flywheel_points_system')
          .upsert({
            chain_id: chainId,
            contract_address: rewardsFlywheelAddress.toLowerCase(),
            is_active: active,
            last_synced_block: event.blockNumber,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'chain_id,contract_address' });
        successCount++;
      } catch (err) {
        console.error('Error processing PointsSystemActivated:', err);
        errorCount++;
      }
    }

    // Process PointsClaimsActivated events
    for (const event of pointsClaimsActivatedEvents) {
      try {
        await supabase
          .from('flywheel_points_system')
          .upsert({
            chain_id: chainId,
            contract_address: rewardsFlywheelAddress.toLowerCase(),
            claims_active: true,
            last_synced_block: event.blockNumber,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'chain_id,contract_address' });
        successCount++;
      } catch (err) {
        console.error('Error processing PointsClaimsActivated:', err);
        errorCount++;
      }
    }

    // Process PointsRewardTokenDeposited events
    for (const event of pointsDepositedEvents) {
      try {
        const token = event.args!.token.toLowerCase();
        const amount = event.args!.amount;
        
        // Get current total and add
        const { data: current } = await supabase
          .from('flywheel_points_system')
          .select('total_deposited')
          .eq('chain_id', chainId)
          .eq('contract_address', rewardsFlywheelAddress.toLowerCase())
          .single();
        
        const currentTotal = ethers.BigNumber.from(current?.total_deposited || '0');
        const newTotal = currentTotal.add(amount);

        await supabase
          .from('flywheel_points_system')
          .upsert({
            chain_id: chainId,
            contract_address: rewardsFlywheelAddress.toLowerCase(),
            reward_token: token,
            total_deposited: newTotal.toString(),
            last_synced_block: event.blockNumber,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'chain_id,contract_address' });
        successCount++;
      } catch (err) {
        console.error('Error processing PointsRewardTokenDeposited:', err);
        errorCount++;
      }
    }

    // Process PointsRewardClaimed events
    for (const event of pointsClaimedEvents) {
      try {
        const user = event.args!.user.toLowerCase();
        const pointsClaimed = event.args!.pointsClaimed;
        const tokenAmount = event.args!.tokenAmount;
        const block = blockMap.get(event.blockNumber)!;

        // Update user points
        const { data: currentUser } = await supabase
          .from('flywheel_user_points')
          .select('claimed_points')
          .eq('chain_id', chainId)
          .eq('user_address', user)
          .single();

        const currentClaimed = ethers.BigNumber.from(currentUser?.claimed_points || '0');
        const newClaimed = currentClaimed.add(pointsClaimed);

        await supabase
          .from('flywheel_user_points')
          .upsert({
            chain_id: chainId,
            user_address: user,
            claimed_points: newClaimed.toString(),
            last_claim_time: new Date(block.timestamp * 1000).toISOString(),
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'chain_id,user_address' });

        // Also record in rewards_claims for history
        await supabase
          .from('rewards_claims')
          .upsert({
            claimant_address: user,
            chain_id: chainId,
            pool_address: rewardsFlywheelAddress.toLowerCase(),
            claim_type: 'points_rewards',
            points_claimed: pointsClaimed.toString(),
            amount: tokenAmount.toString(),
            block_number: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            transaction_hash: event.transactionHash,
          }, { onConflict: 'chain_id,transaction_hash,claimant_address,claim_type' });

        successCount++;
      } catch (err) {
        console.error('Error processing PointsRewardClaimed:', err);
        errorCount++;
      }
    }

    // Process RewardsDeposited events (pool participant rewards)
    for (const event of rewardsDepositedEvents) {
      try {
        const pool = event.args!.pool.toLowerCase();
        const token = event.args!.token.toLowerCase();
        const amount = event.args!.amount;
        const depositor = event.args!.depositor.toLowerCase();
        const block = blockMap.get(event.blockNumber)!;

        // Get current total and add
        const { data: current } = await supabase
          .from('flywheel_pool_rewards')
          .select('total_deposited')
          .eq('chain_id', chainId)
          .eq('pool_address', pool)
          .single();

        const currentTotal = ethers.BigNumber.from(current?.total_deposited || '0');
        const newTotal = currentTotal.add(amount);

        await supabase
          .from('flywheel_pool_rewards')
          .upsert({
            chain_id: chainId,
            pool_address: pool,
            depositor: depositor,
            reward_token: token,
            total_deposited: newTotal.toString(),
            deposit_block: event.blockNumber,
            deposit_tx_hash: event.transactionHash,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'chain_id,pool_address' });

        successCount++;
      } catch (err) {
        console.error('Error processing RewardsDeposited:', err);
        errorCount++;
      }
    }

    // Process RewardsClaimed events (participant claims)
    for (const event of rewardsClaimedEvents) {
      try {
        const pool = event.args!.pool.toLowerCase();
        const user = event.args!.user.toLowerCase();
        const token = event.args!.token.toLowerCase();
        const amount = event.args!.amount;
        const block = blockMap.get(event.blockNumber)!;

        // Record participant claim
        await supabase
          .from('flywheel_participant_claims')
          .upsert({
            chain_id: chainId,
            pool_address: pool,
            participant_address: user,
            amount_claimed: amount.toString(),
            claim_block: event.blockNumber,
            claim_tx_hash: event.transactionHash,
            claimed_at: new Date(block.timestamp * 1000).toISOString(),
          }, { onConflict: 'chain_id,pool_address,participant_address' });

        // Update pool rewards claimed count
        const { data: poolData } = await supabase
          .from('flywheel_pool_rewards')
          .select('total_claimed, claimed_slots')
          .eq('chain_id', chainId)
          .eq('pool_address', pool)
          .single();

        if (poolData) {
          const currentClaimed = ethers.BigNumber.from(poolData.total_claimed || '0');
          await supabase
            .from('flywheel_pool_rewards')
            .update({
              total_claimed: currentClaimed.add(amount).toString(),
              claimed_slots: (poolData.claimed_slots || 0) + 1,
              last_synced_at: new Date().toISOString(),
            })
            .eq('chain_id', chainId)
            .eq('pool_address', pool);
        }

        // Also record in rewards_claims for history
        await supabase
          .from('rewards_claims')
          .upsert({
            claimant_address: user,
            chain_id: chainId,
            pool_address: pool,
            claim_type: 'participant_rewards',
            token_address: token,
            amount: amount.toString(),
            block_number: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            transaction_hash: event.transactionHash,
          }, { onConflict: 'chain_id,transaction_hash,claimant_address,claim_type' });

        // User activity
        await supabase
          .from('user_activity')
          .upsert({
            user_address: user,
            chain_id: chainId,
            activity_type: 'rewards_claimed',
            pool_address: pool,
            amount: amount.toString(),
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
          }, { onConflict: 'chain_id,transaction_hash,activity_type,user_address', ignoreDuplicates: true });

        successCount++;
      } catch (err) {
        console.error('Error processing RewardsClaimed:', err);
        errorCount++;
      }
    }

    // Process RewardPerSlotCalculated events
    for (const event of rewardPerSlotEvents) {
      try {
        const pool = event.args!.pool.toLowerCase();
        const rewardPerSlot = event.args!.rewardPerSlot;
        const totalEligibleSlots = event.args!.totalEligibleSlots;

        await supabase
          .from('flywheel_pool_rewards')
          .update({
            reward_per_slot: rewardPerSlot.toString(),
            total_eligible_slots: totalEligibleSlots.toNumber(),
            reward_per_slot_calculated: true,
            last_synced_at: new Date().toISOString(),
          })
          .eq('chain_id', chainId)
          .eq('pool_address', pool);

        successCount++;
      } catch (err) {
        console.error('Error processing RewardPerSlotCalculated:', err);
        errorCount++;
      }
    }

    // Process CreatorRewardsDeposited events
    for (const event of creatorDepositedEvents) {
      try {
        const token = event.args!.token.toLowerCase();
        const amount = event.args!.amount;
        const rewardAmount = event.args!.rewardAmount;

        const tokenMeta = await getTokenMetadata(token);

        // Get current total and add
        const { data: current } = await supabase
          .from('flywheel_creator_rewards')
          .select('total_deposited')
          .eq('chain_id', chainId)
          .eq('reward_token', token)
          .single();

        const currentTotal = ethers.BigNumber.from(current?.total_deposited || '0');
        const newTotal = currentTotal.add(amount);

        await supabase
          .from('flywheel_creator_rewards')
          .upsert({
            chain_id: chainId,
            reward_token: token,
            token_symbol: tokenMeta.symbol,
            token_decimals: tokenMeta.decimals,
            reward_amount_per_creator: rewardAmount.toString(),
            total_deposited: newTotal.toString(),
            is_active: true,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'chain_id,reward_token' });

        successCount++;
      } catch (err) {
        console.error('Error processing CreatorRewardsDeposited:', err);
        errorCount++;
      }
    }

    // Process CreatorRewardsClaimed events
    for (const event of creatorClaimedEvents) {
      try {
        const pool = event.args!.pool.toLowerCase();
        const creator = event.args!.creator.toLowerCase();
        const token = event.args!.token.toLowerCase();
        const amount = event.args!.amount;
        const fillPercentage = event.args!.fillPercentage;
        const block = blockMap.get(event.blockNumber)!;

        // Record creator claim
        await supabase
          .from('flywheel_creator_claims')
          .upsert({
            chain_id: chainId,
            pool_address: pool,
            creator_address: creator,
            reward_token: token,
            amount_claimed: amount.toString(),
            fill_percentage: fillPercentage.toNumber(),
            claim_block: event.blockNumber,
            claim_tx_hash: event.transactionHash,
            claimed_at: new Date(block.timestamp * 1000).toISOString(),
          }, { onConflict: 'chain_id,pool_address,creator_address,reward_token' });

        // Update creator rewards total claimed
        const { data: rewardData } = await supabase
          .from('flywheel_creator_rewards')
          .select('total_claimed')
          .eq('chain_id', chainId)
          .eq('reward_token', token)
          .single();

        if (rewardData) {
          const currentClaimed = ethers.BigNumber.from(rewardData.total_claimed || '0');
          await supabase
            .from('flywheel_creator_rewards')
            .update({
              total_claimed: currentClaimed.add(amount).toString(),
              last_synced_at: new Date().toISOString(),
            })
            .eq('chain_id', chainId)
            .eq('reward_token', token);
        }

        // Also record in rewards_claims for history
        await supabase
          .from('rewards_claims')
          .upsert({
            claimant_address: creator,
            chain_id: chainId,
            pool_address: pool,
            claim_type: 'creator_rewards',
            token_address: token,
            amount: amount.toString(),
            fill_percentage: fillPercentage.toNumber(),
            block_number: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            transaction_hash: event.transactionHash,
          }, { onConflict: 'chain_id,transaction_hash,claimant_address,claim_type' });

        successCount++;
      } catch (err) {
        console.error('Error processing CreatorRewardsClaimed:', err);
        errorCount++;
      }
    }

    // Sync current points system state from contract
    try {
      const systemInfo = await rewardsFlywheelRead.getPointsSystemInfo();
      await supabase
        .from('flywheel_points_system')
        .upsert({
          chain_id: chainId,
          contract_address: rewardsFlywheelAddress.toLowerCase(),
          is_active: systemInfo.active,
          claims_active: systemInfo.claimsActive,
          reward_token: systemInfo.token.toLowerCase(),
          points_per_token: systemInfo.rate.toString(),
          total_deposited: systemInfo.totalDeposited.toString(),
          last_synced_block: endBlock,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'chain_id,contract_address' });
    } catch (err) {
      console.warn('Could not sync points system state:', err);
    }

    // Sync creator reward tokens from contract
    try {
      const creatorTokens = await rewardsFlywheelRead.getCreatorRewardTokens();
      for (const token of creatorTokens) {
        try {
          const config = await rewardsFlywheelRead.getCreatorRewardConfig(token);
          const tokenMeta = await getTokenMetadata(token);
          
          await supabase
            .from('flywheel_creator_rewards')
            .upsert({
              chain_id: chainId,
              reward_token: token.toLowerCase(),
              token_symbol: tokenMeta.symbol,
              token_decimals: tokenMeta.decimals,
              reward_amount_per_creator: config.rewardAmount.toString(),
              total_deposited: config.totalDeposited.toString(),
              is_active: true,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: 'chain_id,reward_token' });
        } catch (e) {
          console.warn(`Could not sync creator reward config for ${token}:`, e);
        }
      }
    } catch (err) {
      console.warn('Could not sync creator reward tokens:', err);
    }

    // Advance sync pointer
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
      }, { onConflict: 'chain_id,contract_type,contract_address' });

    console.log(`[Chain ${chainId}] Indexing complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        blocksScanned: { from: startBlock, to: endBlock, total: endBlock - startBlock + 1 },
        eventsFound: {
          pointsSystem: pointsSystemEvents.length,
          pointsClaims: pointsClaimsActivatedEvents.length,
          pointsDeposited: pointsDepositedEvents.length,
          pointsClaimed: pointsClaimedEvents.length,
          rewardsDeposited: rewardsDepositedEvents.length,
          rewardsClaimed: rewardsClaimedEvents.length,
          rewardsWithdrawn: rewardsWithdrawnEvents.length,
          rewardPerSlot: rewardPerSlotEvents.length,
          creatorDeposited: creatorDepositedEvents.length,
          creatorClaimed: creatorClaimedEvents.length,
          creatorWithdrawn: creatorWithdrawnEvents.length,
          total: allEvents.length,
        },
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
