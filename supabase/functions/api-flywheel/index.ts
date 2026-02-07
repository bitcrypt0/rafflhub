// Supabase Edge Function: api-flywheel
// REST API for flywheel rewards data - points system, pool rewards, creator rewards.
// Replaces direct RPC calls in FlywheelRewardsComponent.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/helpers.ts';

interface FlywheelRequest {
  chainId: number;
  userAddress?: string;
  poolAddress?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const url = new URL(req.url);
    const chainId = parseInt(url.searchParams.get('chainId') || '84532');
    const userAddress = url.searchParams.get('userAddress')?.toLowerCase();
    const poolAddress = url.searchParams.get('poolAddress')?.toLowerCase();
    const includePoolRewards = url.searchParams.get('includePoolRewards') === 'true';
    const includeCreatorRewards = url.searchParams.get('includeCreatorRewards') === 'true';
    const includeUserPoints = url.searchParams.get('includeUserPoints') === 'true';

    const response: Record<string, unknown> = {
      success: true,
      chainId,
    };

    // Always fetch points system info
    const { data: pointsSystem } = await supabase
      .from('flywheel_points_system')
      .select('*')
      .eq('chain_id', chainId)
      .single();

    if (pointsSystem) {
      // Fetch token metadata if available
      let tokenSymbol = null;
      let tokenDecimals = 18;
      if (pointsSystem.reward_token) {
        const { data: tokenMeta } = await supabase
          .from('token_metadata')
          .select('symbol, decimals')
          .eq('chain_id', chainId)
          .eq('token_address', pointsSystem.reward_token)
          .single();
        if (tokenMeta) {
          tokenSymbol = tokenMeta.symbol;
          tokenDecimals = tokenMeta.decimals;
        }
      }

      response.pointsSystem = {
        active: pointsSystem.is_active,
        claimsActive: pointsSystem.claims_active,
        token: pointsSystem.reward_token,
        tokenSymbol,
        tokenDecimals,
        rate: pointsSystem.points_per_token,
        totalDeposited: pointsSystem.total_deposited,
        cooldownPeriod: pointsSystem.cooldown_period,
        lastSyncedAt: pointsSystem.last_synced_at,
      };
    }

    // Fetch user points if userAddress provided
    if (userAddress && (includeUserPoints || !poolAddress)) {
      const { data: userPoints } = await supabase
        .from('flywheel_user_points')
        .select('*')
        .eq('chain_id', chainId)
        .eq('user_address', userAddress)
        .single();

      if (userPoints) {
        response.userPoints = {
          totalPoints: userPoints.total_points,
          claimedPoints: userPoints.claimed_points,
          lastClaimTime: userPoints.last_claim_time,
        };
      } else {
        response.userPoints = {
          totalPoints: '0',
          claimedPoints: '0',
          lastClaimTime: null,
        };
      }

      // Fetch user's participant claims
      const { data: participantClaims } = await supabase
        .from('flywheel_participant_claims')
        .select('*')
        .eq('chain_id', chainId)
        .eq('participant_address', userAddress);

      response.userParticipantClaims = participantClaims || [];

      // Fetch user's creator claims
      const { data: creatorClaims } = await supabase
        .from('flywheel_creator_claims')
        .select('*')
        .eq('chain_id', chainId)
        .eq('creator_address', userAddress);

      response.userCreatorClaims = creatorClaims || [];
    }

    // Fetch pool rewards if poolAddress provided
    if (poolAddress && includePoolRewards) {
      const { data: poolRewards } = await supabase
        .from('flywheel_pool_rewards')
        .select('*')
        .eq('chain_id', chainId)
        .eq('pool_address', poolAddress)
        .single();

      if (poolRewards) {
        // Fetch token metadata
        let tokenSymbol = null;
        let tokenDecimals = 18;
        if (poolRewards.reward_token) {
          const { data: tokenMeta } = await supabase
            .from('token_metadata')
            .select('symbol, decimals')
            .eq('chain_id', chainId)
            .eq('token_address', poolRewards.reward_token)
            .single();
          if (tokenMeta) {
            tokenSymbol = tokenMeta.symbol;
            tokenDecimals = tokenMeta.decimals;
          }
        }

        response.poolRewards = {
          totalDeposited: poolRewards.total_deposited,
          totalClaimed: poolRewards.total_claimed,
          rewardPerSlot: poolRewards.reward_per_slot,
          totalEligibleSlots: poolRewards.total_eligible_slots,
          claimedSlots: poolRewards.claimed_slots,
          token: poolRewards.reward_token,
          tokenSymbol,
          tokenDecimals,
          depositor: poolRewards.depositor,
          rewardPerSlotCalculated: poolRewards.reward_per_slot_calculated,
        };

        // Check if user has claimed from this pool
        if (userAddress) {
          const { data: userClaim } = await supabase
            .from('flywheel_participant_claims')
            .select('*')
            .eq('chain_id', chainId)
            .eq('pool_address', poolAddress)
            .eq('participant_address', userAddress)
            .single();

          response.userPoolClaim = userClaim || null;
        }
      }
    }

    // Fetch creator rewards config
    if (includeCreatorRewards) {
      const { data: creatorRewards } = await supabase
        .from('flywheel_creator_rewards')
        .select('*')
        .eq('chain_id', chainId)
        .eq('is_active', true);

      response.creatorRewards = (creatorRewards || []).map((reward) => ({
        token: reward.reward_token,
        tokenSymbol: reward.token_symbol,
        tokenDecimals: reward.token_decimals,
        rewardAmountPerCreator: reward.reward_amount_per_creator,
        totalDeposited: reward.total_deposited,
        totalClaimed: reward.total_claimed,
      }));

      // Check if user has claimed creator rewards for this pool
      if (userAddress && poolAddress) {
        const { data: creatorClaim } = await supabase
          .from('flywheel_creator_claims')
          .select('*')
          .eq('chain_id', chainId)
          .eq('pool_address', poolAddress)
          .eq('creator_address', userAddress);

        response.userCreatorClaimsForPool = creatorClaim || [];
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
