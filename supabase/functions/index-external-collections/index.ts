// Supabase Edge Function: index-external-collections
// Indexes external NFT collections that are used as prizes in pools.
// Fetches dropURI() and unrevealedBaseURI() from external collection contracts
// and stores them in the collections table for fast artwork resolution.
//
// This indexer is triggered:
// 1. Manually via API call with specific collection addresses
// 2. Automatically when a pool with an external collection is created (via index-pool-deployer)
// 3. Periodically to refresh stale collection data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders } from '../_shared/helpers.ts';
import { providerCache } from '../_shared/provider-cache.ts';
import { isSupportedNetwork } from '../_shared/networks.ts';

// ABI for fetching collection URIs - covers both ERC721 and ERC1155 patterns
const COLLECTION_URI_ABI = [
  // ERC721 patterns
  'function dropURI() view returns (string)',
  'function unrevealedBaseURI() view returns (string)',
  'function baseURI() view returns (string)',
  'function unrevealedURIHash() view returns (bytes32)',
  'function dropURIHash() view returns (bytes32)',
  'function isRevealed() view returns (bool)',
  // ERC1155 patterns
  'function unrevealedURI() view returns (string)',
  'function uri(uint256) view returns (string)',
  // Common metadata
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
];

interface IndexRequest {
  chainId: number;
  collectionAddresses?: string[]; // Specific collections to index
  refreshStale?: boolean; // Refresh collections not synced in last 24h
  poolAddress?: string; // Index collection from a specific pool
}

interface CollectionURIData {
  dropUri: string | null;
  unrevealedUri: string | null;
  baseUri: string | null;
  dropUriHash: string | null;
  unrevealedUriHash: string | null;
  isRevealed: boolean;
  name: string | null;
  symbol: string | null;
}

/**
 * Check if a string is a bytes32 hash
 */
function isBytes32Hash(str: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(str);
}

/**
 * Check if a hash is zero
 */
function isZeroHash(hash: string): boolean {
  return hash === '0x0000000000000000000000000000000000000000000000000000000000000000';
}

/**
 * Fetch URI data from an external collection contract
 */
async function fetchCollectionURIs(
  provider: ethers.providers.Provider,
  collectionAddress: string,
  standard: number
): Promise<CollectionURIData> {
  const contract = new ethers.Contract(collectionAddress, COLLECTION_URI_ABI, provider);
  
  const result: CollectionURIData = {
    dropUri: null,
    unrevealedUri: null,
    baseUri: null,
    dropUriHash: null,
    unrevealedUriHash: null,
    isRevealed: false,
    name: null,
    symbol: null,
  };

  // Fetch all URIs in parallel with error handling
  const [
    dropUri,
    unrevealedBaseUri,
    unrevealedUri,
    baseUri,
    dropUriHash,
    unrevealedUriHash,
    isRevealed,
    name,
    symbol,
  ] = await Promise.all([
    contract.dropURI().catch(() => null),
    contract.unrevealedBaseURI().catch(() => null), // ERC721 pattern
    contract.unrevealedURI().catch(() => null), // ERC1155 pattern
    contract.baseURI().catch(() => null),
    contract.dropURIHash().catch(() => null),
    contract.unrevealedURIHash().catch(() => null),
    contract.isRevealed().catch(() => false),
    contract.name().catch(() => null),
    contract.symbol().catch(() => null),
  ]);

  // Process dropURI
  if (dropUri && typeof dropUri === 'string' && dropUri.trim() !== '' && !isBytes32Hash(dropUri)) {
    result.dropUri = dropUri;
  }

  // Process unrevealedBaseURI (ERC721) or unrevealedURI (ERC1155)
  const unrevealed = standard === 0 ? unrevealedBaseUri : unrevealedUri;
  if (unrevealed && typeof unrevealed === 'string' && unrevealed.trim() !== '' && !isBytes32Hash(unrevealed)) {
    result.unrevealedUri = unrevealed;
  }

  // Process baseURI as fallback
  if (baseUri && typeof baseUri === 'string' && baseUri.trim() !== '' && !isBytes32Hash(baseUri)) {
    result.baseUri = baseUri;
  }

  // Process hashes
  if (dropUriHash && !isZeroHash(dropUriHash)) {
    result.dropUriHash = dropUriHash;
  }
  if (unrevealedUriHash && !isZeroHash(unrevealedUriHash)) {
    result.unrevealedUriHash = unrevealedUriHash;
  }

  result.isRevealed = isRevealed === true;
  result.name = name;
  result.symbol = symbol;

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chainId, collectionAddresses, refreshStale, poolAddress }: IndexRequest = await req.json();

    if (!chainId || !isSupportedNetwork(chainId)) {
      return new Response(
        JSON.stringify({ error: 'Missing or unsupported chainId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const provider = providerCache.getProvider(chainId);
    let collectionsToIndex: Array<{ address: string; standard: number }> = [];

    // Mode 1: Index specific collection addresses
    if (collectionAddresses && collectionAddresses.length > 0) {
      // Fetch standards from existing collection records or pools
      for (const addr of collectionAddresses) {
        const normalizedAddr = addr.toLowerCase();
        
        // Try to get standard from collections table
        const { data: existingColl } = await supabase
          .from('collections')
          .select('standard')
          .eq('address', normalizedAddr)
          .eq('chain_id', chainId)
          .single();

        if (existingColl) {
          collectionsToIndex.push({ address: normalizedAddr, standard: existingColl.standard });
        } else {
          // Try to get standard from pools table
          const { data: pool } = await supabase
            .from('pools')
            .select('standard')
            .eq('prize_collection', normalizedAddr)
            .eq('chain_id', chainId)
            .limit(1)
            .single();

          collectionsToIndex.push({ address: normalizedAddr, standard: pool?.standard ?? 0 });
        }
      }
    }
    // Mode 2: Index collection from a specific pool
    else if (poolAddress) {
      const { data: pool } = await supabase
        .from('pools')
        .select('prize_collection, standard, is_external_collection')
        .eq('address', poolAddress.toLowerCase())
        .eq('chain_id', chainId)
        .single();

      if (pool && pool.prize_collection && pool.is_external_collection) {
        collectionsToIndex.push({
          address: pool.prize_collection.toLowerCase(),
          standard: pool.standard ?? 0,
        });
      }
    }
    // Mode 3: Refresh stale external collections
    else if (refreshStale) {
      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Find external collections that haven't been synced recently
      // External collections are those in pools with is_external_collection=true
      const { data: stalePools } = await supabase
        .from('pools')
        .select('prize_collection, standard')
        .eq('chain_id', chainId)
        .eq('is_external_collection', true)
        .not('prize_collection', 'is', null);

      if (stalePools) {
        const uniqueCollections = new Map<string, number>();
        for (const pool of stalePools) {
          if (pool.prize_collection) {
            uniqueCollections.set(pool.prize_collection.toLowerCase(), pool.standard ?? 0);
          }
        }

        // Filter to only those not recently synced
        for (const [addr, standard] of uniqueCollections) {
          const { data: coll } = await supabase
            .from('collections')
            .select('last_synced_at')
            .eq('address', addr)
            .eq('chain_id', chainId)
            .single();

          if (!coll || !coll.last_synced_at || coll.last_synced_at < staleThreshold) {
            collectionsToIndex.push({ address: addr, standard });
          }
        }
      }
    }
    // Mode 4: Index ALL external collections from pools
    else {
      const { data: externalPools } = await supabase
        .from('pools')
        .select('prize_collection, standard')
        .eq('chain_id', chainId)
        .eq('is_external_collection', true)
        .not('prize_collection', 'is', null);

      if (externalPools) {
        const uniqueCollections = new Map<string, number>();
        for (const pool of externalPools) {
          if (pool.prize_collection) {
            uniqueCollections.set(pool.prize_collection.toLowerCase(), pool.standard ?? 0);
          }
        }
        collectionsToIndex = Array.from(uniqueCollections).map(([address, standard]) => ({ address, standard }));
      }
    }

    console.log(`[Chain ${chainId}] Indexing ${collectionsToIndex.length} external collections`);

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ address: string; success: boolean; error?: string }> = [];

    for (const { address, standard } of collectionsToIndex) {
      try {
        console.log(`[Chain ${chainId}] Fetching URIs for external collection ${address}`);
        
        const uriData = await fetchCollectionURIs(provider, address, standard);
        
        console.log(`[Chain ${chainId}] URI data for ${address}:`, {
          dropUri: uriData.dropUri?.slice(0, 50),
          unrevealedUri: uriData.unrevealedUri?.slice(0, 50),
          baseUri: uriData.baseUri?.slice(0, 50),
          isRevealed: uriData.isRevealed,
        });

        // Upsert collection with URI data
        const { error: upsertError } = await supabase
          .from('collections')
          .upsert(
            {
              address: address,
              chain_id: chainId,
              name: uriData.name,
              symbol: uriData.symbol,
              standard: standard,
              drop_uri: uriData.dropUri,
              unrevealed_uri: uriData.unrevealedUri,
              base_uri: uriData.baseUri,
              drop_uri_hash: uriData.dropUriHash,
              unrevealed_uri_hash: uriData.unrevealedUriHash,
              is_revealed: uriData.isRevealed,
              is_external: true,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'address,chain_id' }
          );

        if (upsertError) {
          console.error(`[Chain ${chainId}] Error upserting collection ${address}:`, upsertError);
          errorCount++;
          results.push({ address, success: false, error: upsertError.message });
        } else {
          console.log(`[Chain ${chainId}] ✅ Successfully indexed external collection ${address}`);
          successCount++;
          results.push({ address, success: true });
        }
      } catch (err) {
        console.error(`[Chain ${chainId}] Error processing collection ${address}:`, err);
        errorCount++;
        results.push({ address, success: false, error: String(err) });
      }
    }

    console.log(`[Chain ${chainId}] External collection indexing complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        collectionsProcessed: collectionsToIndex.length,
        successCount,
        errorCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('External collection indexer error:', error);
    return new Response(
      JSON.stringify({ error: 'Indexing failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
