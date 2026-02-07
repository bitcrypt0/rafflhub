// Supabase Edge Function: api-collections
// REST API for NFT collection data and metadata
// Provides cached collection info and NFT metadata with IPFS URLs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CollectionQuery {
  chainId?: number;
  creator?: string;
  address?: string; // Get specific collection
  isRevealed?: boolean;
  isExternal?: boolean; // Filter by external collections
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'total_supply';
  sortOrder?: 'asc' | 'desc';
  includeMetadata?: boolean; // Include NFT metadata for specific collection
  tokenId?: number; // Get specific token metadata
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
    const params: CollectionQuery = {
      chainId: url.searchParams.get('chainId') ? parseInt(url.searchParams.get('chainId')!) : undefined,
      creator: url.searchParams.get('creator')?.toLowerCase(),
      address: url.searchParams.get('address')?.toLowerCase(),
      isRevealed: url.searchParams.get('isRevealed') === 'true' ? true :
                  url.searchParams.get('isRevealed') === 'false' ? false : undefined,
      isExternal: url.searchParams.get('isExternal') === 'true' ? true :
                  url.searchParams.get('isExternal') === 'false' ? false : undefined,
      limit: Math.min(parseInt(url.searchParams.get('limit') || '50'), 100),
      offset: parseInt(url.searchParams.get('offset') || '0'),
      sortBy: (url.searchParams.get('sortBy') as any) || 'created_at',
      sortOrder: (url.searchParams.get('sortOrder') as any) || 'desc',
      includeMetadata: url.searchParams.get('includeMetadata') === 'true',
      tokenId: url.searchParams.get('tokenId') ? parseInt(url.searchParams.get('tokenId')!) : undefined,
    };

    // Get specific token metadata
    if (params.address && params.tokenId !== undefined) {
      let metadataQuery = supabase
        .from('nft_metadata_cache')
        .select('*')
        .eq('collection_address', params.address)
        .eq('token_id', params.tokenId);

      if (params.chainId) {
        metadataQuery = metadataQuery.eq('chain_id', params.chainId);
      }

      const { data: metadata, error } = await metadataQuery.single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Token metadata not found', details: error.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          metadata,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for collections
    let query = supabase
      .from('collections')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.address) {
      query = query.eq('address', params.address);
      if (params.chainId) {
        query = query.eq('chain_id', params.chainId);
      }
    } else {
      if (params.chainId) {
        query = query.eq('chain_id', params.chainId);
      }
      if (params.creator) {
        query = query.eq('creator', params.creator);
      }
      if (params.isRevealed !== undefined) {
        query = query.eq('is_revealed', params.isRevealed);
      }
      if (params.isExternal !== undefined) {
        query = query.eq('is_external', params.isExternal);
      }

      // Apply sorting
      query = query.order(params.sortBy!, { ascending: params.sortOrder === 'asc' });

      // Apply pagination
      query = query.range(params.offset!, params.offset! + params.limit! - 1);
    }

    const { data: collections, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to query collections', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If getting a specific collection and metadata requested
    if (params.address && params.includeMetadata && collections && collections.length > 0) {
      const collection = collections[0];

      // Get cached metadata for this collection
      let metadataQuery = supabase
        .from('nft_metadata_cache')
        .select('*', { count: 'exact' })
        .eq('collection_address', params.address)
        .eq('chain_id', collection.chain_id)
        .order('token_id', { ascending: true })
        .limit(100); // Return up to 100 NFTs

      const { data: metadata, count: metadataCount } = await metadataQuery;

      return new Response(
        JSON.stringify({
          success: true,
          collection: {
            ...collection,
            metadata_cached: metadataCount || 0,
            metadata: metadata || [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return list of collections
    return new Response(
      JSON.stringify({
        success: true,
        collections: collections || [],
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
