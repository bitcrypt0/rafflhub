// Supabase Edge Function: api-pools
// REST API for querying pool data with filters, sorting, and pagination
// Provides fast access to cached pool data without blockchain RPC calls

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PoolQuery {
  chainId?: number;
  creator?: string;
  state?: number | number[]; // 0=pending, 1=active, 2=ended, 3=drawing, 4=completed
  isPrized?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'start_time' | 'slots_sold' | 'slot_fee';
  sortOrder?: 'asc' | 'desc';
  address?: string; // Get specific pool
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
    const params: PoolQuery = {
      chainId: url.searchParams.get('chainId') ? parseInt(url.searchParams.get('chainId')!) : undefined,
      creator: url.searchParams.get('creator')?.toLowerCase(),
      state: url.searchParams.get('state') ?
        (url.searchParams.get('state')!.includes(',')
          ? url.searchParams.get('state')!.split(',').map(Number)
          : parseInt(url.searchParams.get('state')!))
        : undefined,
      isPrized: url.searchParams.get('isPrized') === 'true' ? true :
                url.searchParams.get('isPrized') === 'false' ? false : undefined,
      limit: Math.min(parseInt(url.searchParams.get('limit') || '50'), 100), // Max 100
      offset: parseInt(url.searchParams.get('offset') || '0'),
      sortBy: (url.searchParams.get('sortBy') as any) || 'created_at_timestamp',
      sortOrder: (url.searchParams.get('sortOrder') as any) || 'desc',
      address: url.searchParams.get('address')?.toLowerCase(),
    };

    // Build query
    let query = supabase
      .from('pools')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.address) {
      // Get specific pool
      query = query.eq('address', params.address);
      if (params.chainId) {
        query = query.eq('chain_id', params.chainId);
      }
    } else {
      // List pools with filters
      if (params.chainId) {
        query = query.eq('chain_id', params.chainId);
      }
      if (params.creator) {
        query = query.eq('creator', params.creator);
      }
      if (params.state !== undefined) {
        if (Array.isArray(params.state)) {
          query = query.in('state', params.state);
        } else {
          query = query.eq('state', params.state);
        }
      }
      if (params.isPrized !== undefined) {
        query = query.eq('is_prized', params.isPrized);
      }

      // Apply sorting
      query = query.order(params.sortBy!, { ascending: params.sortOrder === 'asc' });

      // Apply pagination
      query = query.range(params.offset!, params.offset! + params.limit! - 1);
    }

    const { data: pools, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to query pools', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If getting a specific pool, also fetch participants and winners
    if (params.address && pools && pools.length > 0) {
      const pool = pools[0];

      // Get participants count and list
      const { data: participants, count: participantsCount } = await supabase
        .from('pool_participants')
        .select('*', { count: 'exact' })
        .eq('pool_address', params.address)
        .eq('chain_id', pool.chain_id)
        .order('slots_purchased', { ascending: false })
        .limit(100);

      // Get winners if completed
      const { data: winners } = await supabase
        .from('pool_winners')
        .select('*')
        .eq('pool_address', params.address)
        .eq('chain_id', pool.chain_id)
        .order('winner_index', { ascending: true });

      return new Response(
        JSON.stringify({
          success: true,
          pool: {
            ...pool,
            participants_count: participantsCount || 0,
            participants: participants || [],
            winners: winners || [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return list of pools
    return new Response(
      JSON.stringify({
        success: true,
        pools: pools || [],
        pagination: {
          total: count || 0,
          limit: params.limit,
          offset: params.offset,
          hasMore: (params.offset! + params.limit!) < (count || 0),
        },
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
