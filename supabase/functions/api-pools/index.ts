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
  state?: number | number[]; // 0=pending, 1=active, 2=ended, 3=drawing, 4=completed, 5=deleted, 6=allPrizesClaimed, 7=unengaged
  isPrized?: boolean;
  isCollabPool?: boolean; // NFT Collab pools
  hasHolderToken?: boolean; // Whitelist Collab pools (has holder token address)
  prizeType?: 'nft' | 'erc20' | 'native' | 'none'; // Filter by prize type
  prizeStandard?: number; // 0=ERC721, 1=ERC1155
  search?: string; // Search by name or address
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'start_time' | 'slots_sold' | 'slot_fee';
  sortOrder?: 'asc' | 'desc';
  address?: string; // Get specific pool
  includeFilterCounts?: boolean; // Include counts for filter sidebar
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
      isCollabPool: url.searchParams.get('isCollabPool') === 'true' ? true :
                    url.searchParams.get('isCollabPool') === 'false' ? false : undefined,
      hasHolderToken: url.searchParams.get('hasHolderToken') === 'true' ? true :
                      url.searchParams.get('hasHolderToken') === 'false' ? false : undefined,
      prizeType: url.searchParams.get('prizeType') as PoolQuery['prizeType'] || undefined,
      prizeStandard: url.searchParams.get('prizeStandard') ? parseInt(url.searchParams.get('prizeStandard')!) : undefined,
      search: url.searchParams.get('search') || undefined,
      limit: Math.min(parseInt(url.searchParams.get('limit') || '50'), 100), // Max 100
      offset: parseInt(url.searchParams.get('offset') || '0'),
      sortBy: (url.searchParams.get('sortBy') as any) || 'created_at_timestamp',
      sortOrder: (url.searchParams.get('sortOrder') as any) || 'desc',
      address: url.searchParams.get('address')?.toLowerCase(),
      includeFilterCounts: url.searchParams.get('includeFilterCounts') === 'true',
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
      if (params.isCollabPool !== undefined) {
        query = query.eq('is_collab_pool', params.isCollabPool);
      }
      if (params.hasHolderToken !== undefined) {
        if (params.hasHolderToken) {
          // Has holder token - not null and not zero address
          query = query.not('holder_token_address', 'is', null)
                       .neq('holder_token_address', '0x0000000000000000000000000000000000000000');
        } else {
          // No holder token - null or zero address
          query = query.or('holder_token_address.is.null,holder_token_address.eq.0x0000000000000000000000000000000000000000');
        }
      }
      if (params.prizeType) {
        switch (params.prizeType) {
          case 'nft':
            query = query.not('prize_collection', 'is', null)
                         .neq('prize_collection', '0x0000000000000000000000000000000000000000');
            break;
          case 'erc20':
            query = query.not('erc20_prize_token', 'is', null)
                         .neq('erc20_prize_token', '0x0000000000000000000000000000000000000000');
            break;
          case 'native':
            query = query.gt('native_prize_amount', '0');
            break;
          case 'none':
            query = query.eq('is_prized', false);
            break;
        }
      }
      if (params.prizeStandard !== undefined) {
        query = query.eq('standard', params.prizeStandard);
      }
      if (params.search) {
        const searchTerm = params.search.toLowerCase();
        // Search by name or address (case-insensitive)
        query = query.or(`name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`);
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

      // Get pool activity (slot purchases, refunds, prize claims, randomness requests)
      const { data: activity } = await supabase
        .from('user_activity')
        .select('*')
        .eq('pool_address', params.address)
        .eq('chain_id', pool.chain_id)
        .order('timestamp', { ascending: false })
        .limit(50);

      // Get collection artwork data if pool has an NFT prize collection (for mintable pools)
      let collectionArtwork = null;
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      if (pool.prize_collection && pool.prize_collection !== ZERO_ADDRESS) {
        const { data: collection } = await supabase
          .from('collections')
          .select('drop_uri, unrevealed_uri, drop_uri_hash, unrevealed_uri_hash, base_uri, is_revealed')
          .eq('address', pool.prize_collection.toLowerCase())
          .eq('chain_id', pool.chain_id)
          .single();
        
        if (collection) {
          collectionArtwork = {
            dropUri: collection.drop_uri,
            unrevealedUri: collection.unrevealed_uri,
            dropUriHash: collection.drop_uri_hash,
            unrevealedUriHash: collection.unrevealed_uri_hash,
            baseUri: collection.base_uri,
            isRevealed: collection.is_revealed,
          };
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          pool: {
            ...pool,
            participants_count: participantsCount || 0,
            participants: participants || [],
            winners: winners || [],
            activity: activity || [],
            collection_artwork: collectionArtwork,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compute filter counts if requested
    let filterCounts = null;
    if (params.includeFilterCounts && params.chainId) {
      // Get all pools for this chain to compute counts (without pagination)
      const { data: allPools } = await supabase
        .from('pools')
        .select('state, is_prized, is_collab_pool, holder_token_address, prize_collection, erc20_prize_token, native_prize_amount, standard')
        .eq('chain_id', params.chainId);

      if (allPools) {
        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
        
        // State counts
        const stateCounts: Record<string, number> = {
          pending: 0, active: 0, ended: 0, drawing: 0, completed: 0,
          deleted: 0, all_prizes_claimed: 0, unengaged: 0
        };
        const stateMap: Record<number, string> = {
          0: 'pending', 1: 'active', 2: 'ended', 3: 'drawing', 4: 'completed',
          5: 'deleted', 6: 'all_prizes_claimed', 7: 'unengaged'
        };

        // Raffle type counts
        const typeCounts: Record<string, number> = {
          non_prized: 0, prized: 0, nft_collab: 0, whitelist_collab: 0
        };

        // Prize type counts
        const prizeTypeCounts: Record<string, number> = {
          nft: 0, erc20: 0, native: 0
        };

        // Prize standard counts
        const prizeStandardCounts: Record<string, number> = {
          erc721: 0, erc1155: 0, erc20: 0, native: 0
        };

        for (const pool of allPools) {
          // State counts
          const stateKey = stateMap[pool.state];
          if (stateKey) stateCounts[stateKey]++;

          // Raffle type counts
          const hasNFTPrize = pool.prize_collection && pool.prize_collection !== ZERO_ADDRESS;
          const hasHolderToken = pool.holder_token_address && pool.holder_token_address !== ZERO_ADDRESS;

          if (pool.is_collab_pool) {
            typeCounts.nft_collab++;
          } else if (hasHolderToken && !pool.is_prized) {
            typeCounts.whitelist_collab++;
          } else if (pool.is_prized) {
            typeCounts.prized++;
          } else {
            typeCounts.non_prized++;
          }

          // Prize type counts
          if (hasNFTPrize) {
            prizeTypeCounts.nft++;
            // Prize standard
            if (pool.standard === 0) prizeStandardCounts.erc721++;
            else if (pool.standard === 1) prizeStandardCounts.erc1155++;
          }
          if (pool.erc20_prize_token && pool.erc20_prize_token !== ZERO_ADDRESS) {
            prizeTypeCounts.erc20++;
            prizeStandardCounts.erc20++;
          }
          if (pool.native_prize_amount && pool.native_prize_amount !== '0' && pool.native_prize_amount !== 0) {
            prizeTypeCounts.native++;
            prizeStandardCounts.native++;
          }
        }

        filterCounts = {
          raffleState: stateCounts,
          raffleType: typeCounts,
          prizeType: prizeTypeCounts,
          prizeStandard: prizeStandardCounts
        };
      }
    }

    // Enrich pools with collection artwork data for NFT prize pools
    let enrichedPools = pools || [];
    if (pools && pools.length > 0) {
      const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
      
      // Get unique prize collection addresses
      const prizeCollections = [...new Set(
        pools
          .filter(p => p.prize_collection && p.prize_collection !== ZERO_ADDR)
          .map(p => p.prize_collection.toLowerCase())
      )];
      
      if (prizeCollections.length > 0) {
        // Batch fetch collection artwork data
        const { data: collections } = await supabase
          .from('collections')
          .select('address, chain_id, drop_uri, unrevealed_uri, drop_uri_hash, unrevealed_uri_hash, base_uri, is_revealed')
          .in('address', prizeCollections);
        
        // Build lookup map
        const collectionMap = new Map();
        if (collections) {
          for (const c of collections) {
            const key = `${c.address.toLowerCase()}-${c.chain_id}`;
            collectionMap.set(key, {
              dropUri: c.drop_uri,
              unrevealedUri: c.unrevealed_uri,
              dropUriHash: c.drop_uri_hash,
              unrevealedUriHash: c.unrevealed_uri_hash,
              baseUri: c.base_uri,
              isRevealed: c.is_revealed,
            });
          }
        }
        
        // Enrich pools with collection artwork
        enrichedPools = pools.map(pool => {
          if (pool.prize_collection && pool.prize_collection !== ZERO_ADDR) {
            const key = `${pool.prize_collection.toLowerCase()}-${pool.chain_id}`;
            const artwork = collectionMap.get(key);
            if (artwork) {
              return { ...pool, collection_artwork: artwork };
            }
          }
          return pool;
        });
      }
    }

    // Return list of pools
    const response: any = {
      success: true,
      pools: enrichedPools,
      pagination: {
        total: count || 0,
        limit: params.limit,
        offset: params.offset,
        hasMore: (params.offset! + params.limit!) < (count || 0),
      },
    };

    if (filterCounts) {
      response.filterCounts = filterCounts;
    }

    return new Response(
      JSON.stringify(response),
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
