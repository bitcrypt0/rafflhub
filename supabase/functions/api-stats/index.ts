// Supabase Edge Function: api-stats
// REST API for platform-wide statistics and analytics
// Aggregates data across pools, collections, users, and rewards

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatsQuery {
  chainId?: number;
  period?: 'all' | '24h' | '7d' | '30d'; // Time period for trending data
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
    const params: StatsQuery = {
      chainId: url.searchParams.get('chainId') ? parseInt(url.searchParams.get('chainId')!) : undefined,
      period: (url.searchParams.get('period') as any) || 'all',
    };

    // Calculate time threshold for period
    let timeThreshold: string | null = null;
    if (params.period !== 'all') {
      const hours = params.period === '24h' ? 24 : params.period === '7d' ? 168 : 720;
      const thresholdDate = new Date(Date.now() - hours * 60 * 60 * 1000);
      timeThreshold = thresholdDate.toISOString();
    }

    const stats: any = {
      pools: {},
      collections: {},
      users: {},
      rewards: {},
      activity: {},
    };

    // Build base query with chain filter
    const buildQuery = (table: string) => {
      let q = supabase.from(table);
      if (params.chainId) {
        q = q.select('*').eq('chain_id', params.chainId);
      } else {
        q = q.select('*');
      }
      return q;
    };

    // Pool Statistics
    const { count: totalPools } = await buildQuery('pools').select('*', { count: 'exact', head: true });
    stats.pools.total = totalPools || 0;

    const { count: activePools } = await buildQuery('pools')
      .select('*', { count: 'exact', head: true })
      .eq('state', 1);
    stats.pools.active = activePools || 0;

    const { count: completedPools } = await buildQuery('pools')
      .select('*', { count: 'exact', head: true })
      .eq('state', 4);
    stats.pools.completed = completedPools || 0;

    // Get total volume (sum of all slot purchases)
    const { data: participants } = await buildQuery('pool_participants').select('total_spent');
    stats.pools.totalVolume = participants
      ? participants.reduce((sum, p) => sum + BigInt(p.total_spent || '0'), BigInt(0)).toString()
      : '0';

    // Collection Statistics
    const { count: totalCollections } = await buildQuery('collections').select('*', { count: 'exact', head: true });
    stats.collections.total = totalCollections || 0;

    const { count: revealedCollections } = await buildQuery('collections')
      .select('*', { count: 'exact', head: true })
      .eq('is_revealed', true);
    stats.collections.revealed = revealedCollections || 0;

    // Get total NFTs minted
    const { data: collections } = await buildQuery('collections').select('total_supply');
    stats.collections.totalMinted = collections
      ? collections.reduce((sum, c) => sum + (c.total_supply || 0), 0)
      : 0;

    // User Statistics
    const { count: uniqueCreators } = await buildQuery('pools')
      .select('creator', { count: 'exact', head: true });
    stats.users.uniqueCreators = uniqueCreators || 0;

    const { count: uniqueParticipants } = await buildQuery('pool_participants')
      .select('participant_address', { count: 'exact', head: true });
    stats.users.uniqueParticipants = uniqueParticipants || 0;

    const { count: totalWinners } = await buildQuery('pool_winners')
      .select('*', { count: 'exact', head: true });
    stats.users.totalWinners = totalWinners || 0;

    // Rewards Statistics
    const { data: rewardsClaims } = await buildQuery('rewards_claims').select('amount');
    stats.rewards.totalClaims = rewardsClaims?.length || 0;
    stats.rewards.totalAmount = rewardsClaims
      ? rewardsClaims.reduce((sum, r) => sum + BigInt(r.amount || '0'), BigInt(0)).toString()
      : '0';

    // Activity Statistics (by type)
    let activityQuery = buildQuery('user_activity').select('activity_type', { count: 'exact' });
    if (timeThreshold) {
      activityQuery = activityQuery.gte('timestamp', timeThreshold);
    }
    const { data: activities } = await activityQuery;

    const activityByType: Record<string, number> = {};
    if (activities) {
      activities.forEach((a: any) => {
        activityByType[a.activity_type] = (activityByType[a.activity_type] || 0) + 1;
      });
    }
    stats.activity.byType = activityByType;
    stats.activity.total = activities?.length || 0;

    // Trending Pools (most active in period)
    let trendingQuery = supabase
      .from('pools')
      .select('address, name, chain_id, slots_sold, slot_limit, creator, created_at_timestamp')
      .order('slots_sold', { ascending: false })
      .limit(10);

    if (params.chainId) {
      trendingQuery = trendingQuery.eq('chain_id', params.chainId);
    }
    if (timeThreshold) {
      trendingQuery = trendingQuery.gte('created_at_timestamp', timeThreshold);
    }

    const { data: trendingPools } = await trendingQuery;
    stats.trending = {
      pools: trendingPools || [],
    };

    // Recent Activity
    let recentActivityQuery = buildQuery('user_activity')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);

    const { data: recentActivity } = await recentActivityQuery;
    stats.recentActivity = recentActivity || [];

    return new Response(
      JSON.stringify({
        success: true,
        chainId: params.chainId,
        period: params.period,
        stats,
        generatedAt: new Date().toISOString(),
      }),
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
