// Supabase Edge Function: api-artwork
// REST API for NFT artwork and metadata with caching
// Provides fast access to cached artwork URLs without IPFS gateway delays

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/helpers.ts';

interface ArtworkQuery {
  collectionAddress: string;
  chainId: number;
  type?: 'unrevealed' | 'drop' | 'revealed' | 'token';
  tokenId?: number;
}

interface ArtworkResponse {
  collectionAddress: string;
  chainId: number;
  type: string;
  metadata: {
    name: string | null;
    description: string | null;
    imageUrl: string | null;
    originalUri: string | null;
    animationUrl?: string | null;
    attributes?: any;
  };
  cached: boolean;
  cachedAt: string | null;
  expiresAt: string | null;
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

    // Handle POST request for refresh
    if (req.method === 'POST') {
      const body = await req.json();
      const { collectionAddress, chainId, type, tokenId } = body;

      if (!collectionAddress || !chainId) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters: collectionAddress, chainId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const collectionAddr = collectionAddress.toLowerCase();

      // Mark existing cache entry as pending to trigger re-fetch
      let updateQuery = supabase
        .from('nft_metadata_cache')
        .update({
          fetch_status: 'pending',
          retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('collection_address', collectionAddr)
        .eq('chain_id', chainId);

      if (tokenId !== undefined) {
        updateQuery = updateQuery.eq('token_id', tokenId);
      } else if (type) {
        updateQuery = updateQuery.eq('metadata_type', type).is('token_id', null);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) {
        console.error('Error marking cache for refresh:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to trigger refresh', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Trigger fetch-nft-metadata function
      try {
        await supabase.functions.invoke('fetch-nft-metadata', {
          body: {
            chainId,
            collectionAddress: collectionAddr,
            tokenIds: tokenId !== undefined ? [tokenId] : undefined,
          },
        });
      } catch (fetchErr) {
        console.warn('Could not invoke fetch-nft-metadata:', fetchErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Refresh triggered',
          collectionAddress: collectionAddr,
          chainId,
          type: type || null,
          tokenId: tokenId || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle GET request for artwork retrieval
    const params: ArtworkQuery = {
      collectionAddress: url.searchParams.get('collectionAddress')?.toLowerCase() || '',
      chainId: parseInt(url.searchParams.get('chainId') || '0'),
      type: (url.searchParams.get('type') as ArtworkQuery['type']) || 'unrevealed',
      tokenId: url.searchParams.get('tokenId') ? parseInt(url.searchParams.get('tokenId')!) : undefined,
    };

    if (!params.collectionAddress || !params.chainId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: collectionAddress, chainId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query based on whether requesting token or collection-level metadata
    let query = supabase
      .from('nft_metadata_cache')
      .select('*')
      .eq('collection_address', params.collectionAddress)
      .eq('chain_id', params.chainId);

    if (params.tokenId !== undefined) {
      // Token-specific metadata
      query = query.eq('token_id', params.tokenId).eq('metadata_type', 'token');
    } else {
      // Collection-level metadata (unrevealed, drop, revealed)
      query = query.eq('metadata_type', params.type!).is('token_id', null);
    }

    const { data: cacheEntry, error } = await query.single();

    if (error || !cacheEntry) {
      // No cache entry found
      return new Response(
        JSON.stringify({
          success: true,
          collectionAddress: params.collectionAddress,
          chainId: params.chainId,
          type: params.tokenId !== undefined ? 'token' : params.type,
          tokenId: params.tokenId || null,
          metadata: null,
          cached: false,
          cachedAt: null,
          expiresAt: null,
          message: 'No cached artwork found. Use POST /api-artwork/refresh to trigger fetch.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if cache is still valid
    const isExpired = cacheEntry.expires_at && new Date(cacheEntry.expires_at) < new Date();
    const isFailed = cacheEntry.fetch_status === 'failed';

    const response: ArtworkResponse = {
      collectionAddress: params.collectionAddress,
      chainId: params.chainId,
      type: params.tokenId !== undefined ? 'token' : params.type!,
      metadata: {
        name: cacheEntry.name,
        description: cacheEntry.description,
        imageUrl: cacheEntry.resolved_image_uri,
        originalUri: cacheEntry.metadata_uri,
        animationUrl: cacheEntry.animation_uri,
        attributes: cacheEntry.attributes,
      },
      cached: cacheEntry.fetch_status === 'success',
      cachedAt: cacheEntry.last_fetched_at,
      expiresAt: cacheEntry.expires_at,
    };

    // Add status info if expired or failed
    if (isExpired || isFailed) {
      return new Response(
        JSON.stringify({
          success: true,
          ...response,
          tokenId: params.tokenId || null,
          status: isExpired ? 'expired' : 'failed',
          fetchError: cacheEntry.fetch_error,
          message: isExpired
            ? 'Cache expired. Use POST /api-artwork/refresh to update.'
            : 'Previous fetch failed. Use POST /api-artwork/refresh to retry.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...response,
        tokenId: params.tokenId || null,
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
