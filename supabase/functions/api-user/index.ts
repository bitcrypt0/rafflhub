// Supabase Edge Function: api-user
// REST API for user activity, statistics, and profile data
// Aggregates user participation across pools, collections, and rewards

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserQuery {
  address: string;
  chainId?: number;
  includeActivity?: boolean;
  includeStats?: boolean;
  activityLimit?: number;
  activityOffset?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const params: UserQuery = {
      address: url.searchParams.get('address')?.toLowerCase() || '',
      chainId: url.searchParams.get('chainId') ? parseInt(url.searchParams.get('chainId')!) : undefined,
      includeActivity: url.searchParams.get('includeActivity') !== 'false', // Default true
      includeStats: url.searchParams.get('includeStats') !== 'false', // Default true
      activityLimit: Math.min(parseInt(url.searchParams.get('activityLimit') || '50'), 100),
      activityOffset: parseInt(url.searchParams.get('activityOffset') || '0'),
    };

    if (!params.address) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: any = {
      success: true,
      address: params.address,
      chainId: params.chainId,
    };

    // Get user statistics
    if (params.includeStats) {
      const stats: any = {
        pools: { created: 0, participated: 0, won: 0, totalSpent: '0', totalWon: '0' },
        collections: { created: 0, minted: 0 },
        rewards: { claimed: 0, totalClaimed: '0' },
      };

      // Pools created
      let poolsCreatedQuery = supabase
        .from('pools')
        .select('*', { count: 'exact' })
        .eq('creator', params.address);
      if (params.chainId) poolsCreatedQuery = poolsCreatedQuery.eq('chain_id', params.chainId);
      const { count: poolsCreated } = await poolsCreatedQuery;
      stats.pools.created = poolsCreated || 0;

      // Pools participated
      let participatedQuery = supabase
        .from('pool_participants')
        .select('*', { count: 'exact' })
        .eq('participant_address', params.address);
      if (params.chainId) participatedQuery = participatedQuery.eq('chain_id', params.chainId);
      const { data: participations, count: participatedCount } = await participatedQuery;
      stats.pools.participated = participatedCount || 0;

      // Calculate total spent and total slots purchased
      let totalSlotsPurchased = 0;
      if (participations) {
        stats.pools.totalSpent = participations
          .reduce((sum, p) => sum + BigInt(p.total_spent || '0'), BigInt(0))
          .toString();
        
        // Sum up all slots purchased across all pools
        totalSlotsPurchased = participations.reduce((sum, p) => sum + (p.slots_purchased || 0), 0);
      }
      stats.pools.totalSlotsPurchased = totalSlotsPurchased;

      // Pools won
      let winsQuery = supabase
        .from('pool_winners')
        .select('*', { count: 'exact' })
        .eq('winner_address', params.address);
      if (params.chainId) winsQuery = winsQuery.eq('chain_id', params.chainId);
      const { data: wins, count: winsCount } = await winsQuery;
      stats.pools.won = winsCount || 0;

      // Calculate total won (prize value would need to be calculated separately)
      stats.pools.totalWon = wins ? wins.length.toString() : '0';

      // Calculate total refundable amount across all pools
      let refundableQuery = supabase
        .from('pool_participants')
        .select('refundable_amount, refund_claimed')
        .eq('participant_address', params.address)
        .eq('refund_claimed', false);
      if (params.chainId) refundableQuery = refundableQuery.eq('chain_id', params.chainId);
      const { data: refundableData } = await refundableQuery;
      
      let totalRefundable = BigInt(0);
      if (refundableData) {
        for (const p of refundableData) {
          if (p.refundable_amount) {
            totalRefundable += BigInt(p.refundable_amount);
          }
        }
      }
      stats.pools.totalRefundable = totalRefundable.toString();

      // Collections created
      let collectionsQuery = supabase
        .from('collections')
        .select('*', { count: 'exact' })
        .eq('creator', params.address);
      if (params.chainId) collectionsQuery = collectionsQuery.eq('chain_id', params.chainId);
      const { count: collectionsCreated } = await collectionsQuery;
      stats.collections.created = collectionsCreated || 0;

      // NFTs minted (count from user_activity)
      let mintsQuery = supabase
        .from('user_activity')
        .select('*', { count: 'exact' })
        .eq('user_address', params.address)
        .eq('activity_type', 'nft_minted');
      if (params.chainId) mintsQuery = mintsQuery.eq('chain_id', params.chainId);
      const { count: mintCount } = await mintsQuery;
      stats.collections.minted = mintCount || 0;

      // Rewards claimed
      let rewardsQuery = supabase
        .from('rewards_claims')
        .select('*', { count: 'exact' })
        .eq('user_address', params.address);
      if (params.chainId) rewardsQuery = rewardsQuery.eq('chain_id', params.chainId);
      const { data: rewardsClaims, count: rewardsCount } = await rewardsQuery;
      stats.rewards.claimed = rewardsCount || 0;

      if (rewardsClaims) {
        stats.rewards.totalClaimed = rewardsClaims
          .reduce((sum, r) => sum + BigInt(r.amount || '0'), BigInt(0))
          .toString();
      }

      result.stats = stats;
    }

    // Get user activity feed with pool prize type information
    if (params.includeActivity) {
      let activityQuery = supabase
        .from('user_activity')
        .select('*', { count: 'exact' })
        .eq('user_address', params.address)
        .order('timestamp', { ascending: false })
        .range(params.activityOffset!, params.activityOffset! + params.activityLimit! - 1);

      if (params.chainId) {
        activityQuery = activityQuery.eq('chain_id', params.chainId);
      }

      const { data: activity, count: activityCount } = await activityQuery;

      // Get unique pool addresses from prize_claimed activities to fetch prize type info
      const prizeClaimActivities = (activity || []).filter(
        (a: any) => a.activity_type === 'prize_claimed' && a.pool_address
      );
      const uniquePoolKeys: string[] = Array.from(new Set(
        prizeClaimActivities.map((a: any) => `${a.chain_id}:${a.pool_address}`)
      )) as string[];

      // Fetch pool prize info for these pools
      const poolPrizeMap: Record<string, { prize_type: string; prize_symbol: string | null }> = {};
      
      if (uniquePoolKeys.length > 0) {
        try {
          // Build OR conditions for each chain_id + pool_address pair
          const poolConditions = uniquePoolKeys.map((key: string) => {
            const [chainId, poolAddr] = key.split(':');
            return `and(chain_id.eq.${chainId},address.eq.${poolAddr})`;
          });

          const { data: pools, error: poolsError } = await supabase
            .from('pools')
            .select('address, chain_id, prize_collection, erc20_prize_token, erc20_prize_token_symbol, native_prize_amount')
            .or(poolConditions.join(','));

          if (poolsError) {
            console.error('Error fetching pool prize info:', poolsError);
          }

          if (pools) {
            for (const pool of pools) {
              const key = `${pool.chain_id}:${pool.address}`;
              const hasNFTPrize = pool.prize_collection && 
                                 pool.prize_collection !== '0x0000000000000000000000000000000000000000';
              const hasERC20Prize = pool.erc20_prize_token && 
                                   pool.erc20_prize_token !== '0x0000000000000000000000000000000000000000';
              const hasNativePrize = pool.native_prize_amount && 
                                    pool.native_prize_amount !== '0';

              let prizeType = 'unknown';
              let prizeSymbol = null;

              if (hasNFTPrize) {
                prizeType = 'nft';
              } else if (hasERC20Prize) {
                prizeType = 'erc20';
                prizeSymbol = pool.erc20_prize_token_symbol || 'TOKEN';
              } else if (hasNativePrize) {
                prizeType = 'native';
              }

              poolPrizeMap[key] = { prize_type: prizeType, prize_symbol: prizeSymbol };
            }
          }
        } catch (poolLookupError) {
          console.error('Pool lookup failed:', poolLookupError);
        }
      }

      // Enrich activity items with prize type information
      const enrichedActivity = (activity || []).map((item: any) => {
        if (item.activity_type === 'prize_claimed' && item.pool_address) {
          const key = `${item.chain_id}:${item.pool_address}`;
          const prizeInfo = poolPrizeMap[key] || { prize_type: 'native', prize_symbol: null };
          return {
            ...item,
            prize_type: prizeInfo.prize_type,
            prize_symbol: prizeInfo.prize_symbol,
          };
        }
        return item;
      });

      result.activity = {
        items: enrichedActivity,
        pagination: {
          total: activityCount || 0,
          limit: params.activityLimit,
          offset: params.activityOffset,
          hasMore: (params.activityOffset! + params.activityLimit!) < (activityCount || 0),
        },
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ error: 'API request failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
