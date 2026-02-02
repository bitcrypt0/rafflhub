// Supabase Edge Function: fetch-nft-metadata
// Fetches NFT metadata from IPFS/Arweave/HTTP and caches it in the database
// Supports batch processing and automatic retries with fallback gateways

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// IPFS Gateways (fallback order)
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
];

// Arweave Gateway
const ARWEAVE_GATEWAY = 'https://arweave.net/';

// Collection ABI - for fetching tokenURI
const COLLECTION_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function baseURI() view returns (string)',
];

interface FetchRequest {
  chainId: number;
  collectionAddress: string;
  tokenIds?: number[]; // Optional: specific tokens, otherwise fetch all unminted
  maxTokens?: number; // Optional: limit batch size (default 50)
}

interface Metadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  [key: string]: any;
}

// Convert IPFS/Arweave URI to HTTP URL
function resolveMetadataURI(uri: string, gatewayIndex = 0): string {
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[gatewayIndex]}${hash}`;
  } else if (uri.startsWith('ar://')) {
    const hash = uri.replace('ar://', '');
    return `${ARWEAVE_GATEWAY}${hash}`;
  }
  return uri; // Already HTTP
}

// Fetch metadata with retry logic across multiple IPFS gateways
async function fetchMetadataWithRetry(uri: string, maxRetries = 3): Promise<Metadata | null> {
  for (let gatewayIdx = 0; gatewayIdx < IPFS_GATEWAYS.length; gatewayIdx++) {
    const url = resolveMetadataURI(uri, gatewayIdx);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Fetching metadata from ${url} (gateway ${gatewayIdx + 1}, attempt ${attempt + 1})`);
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          console.warn(`HTTP ${response.status} for ${url}`);
          continue;
        }

        const metadata: Metadata = await response.json();
        console.log(`Successfully fetched metadata from ${url}`);
        return metadata;
      } catch (err) {
        console.error(`Error fetching from ${url} (attempt ${attempt + 1}):`, err.message);

        if (attempt === maxRetries - 1) {
          // Try next gateway
          break;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  console.error(`Failed to fetch metadata from all gateways for URI: ${uri}`);
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chainId, collectionAddress, tokenIds, maxTokens = 50 }: FetchRequest = await req.json();

    if (!chainId || !collectionAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: chainId, collectionAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const collectionAddr = collectionAddress.toLowerCase();

    // Get RPC URL
    const rpcUrl = Deno.env.get(`RPC_URL_${chainId}`) || 'https://base-sepolia-rpc.publicnode.com';

    console.log(`[Chain ${chainId}] Starting metadata fetch for collection ${collectionAddr}`);

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const collection = new ethers.Contract(collectionAddr, COLLECTION_ABI, provider);

    // Get collection info
    const { data: collectionData } = await supabase
      .from('collections')
      .select('name, total_supply, max_supply')
      .eq('address', collectionAddr)
      .eq('chain_id', chainId)
      .single();

    if (!collectionData) {
      return new Response(
        JSON.stringify({ error: 'Collection not found in database. Run index-nft-factory first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which tokens to fetch
    let tokensToFetch: number[] = [];

    if (tokenIds && tokenIds.length > 0) {
      // User specified tokens
      tokensToFetch = tokenIds;
    } else {
      // Find tokens without cached metadata
      const { data: cachedTokens } = await supabase
        .from('nft_metadata_cache')
        .select('token_id')
        .eq('collection_address', collectionAddr)
        .eq('chain_id', chainId);

      const cachedTokenIds = new Set(cachedTokens?.map(t => t.token_id) || []);

      // Fetch uncached tokens (up to maxTokens)
      for (let i = 0; i < collectionData.total_supply && tokensToFetch.length < maxTokens; i++) {
        if (!cachedTokenIds.has(i)) {
          tokensToFetch.push(i);
        }
      }
    }

    console.log(`[Chain ${chainId}] Fetching metadata for ${tokensToFetch.length} tokens`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each token
    for (const tokenId of tokensToFetch) {
      try {
        // Get tokenURI from contract
        const tokenURI = await collection.tokenURI(tokenId);

        if (!tokenURI) {
          console.warn(`No tokenURI for token ${tokenId}`);
          errorCount++;
          errors.push(`Token ${tokenId}: No tokenURI`);
          continue;
        }

        // Fetch metadata from IPFS/Arweave/HTTP
        const metadata = await fetchMetadataWithRetry(tokenURI);

        if (!metadata) {
          errorCount++;
          errors.push(`Token ${tokenId}: Failed to fetch metadata from ${tokenURI}`);
          continue;
        }

        // Resolve image URL if it's IPFS/Arweave
        let imageUrl = metadata.image;
        if (imageUrl && (imageUrl.startsWith('ipfs://') || imageUrl.startsWith('ar://'))) {
          imageUrl = resolveMetadataURI(imageUrl, 0); // Use primary gateway
        }

        // Cache metadata in database
        const { error: cacheError } = await supabase
          .from('nft_metadata_cache')
          .upsert({
            collection_address: collectionAddr,
            chain_id: chainId,
            token_id: tokenId,
            metadata_uri: tokenURI,
            name: metadata.name || null,
            description: metadata.description || null,
            image_url: imageUrl || null,
            animation_url: metadata.animation_url || null,
            external_url: metadata.external_url || null,
            attributes: metadata.attributes || null,
            raw_metadata: metadata,
            fetched_at: new Date().toISOString(),
          }, {
            onConflict: 'collection_address,chain_id,token_id'
          });

        if (cacheError) {
          console.error(`Error caching metadata for token ${tokenId}:`, cacheError);
          errorCount++;
          errors.push(`Token ${tokenId}: Database error`);
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Error processing token ${tokenId}:`, err);
        errorCount++;
        errors.push(`Token ${tokenId}: ${err.message}`);
      }
    }

    console.log(`[Chain ${chainId}] Metadata fetch complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        collectionAddress: collectionAddr,
        collectionName: collectionData.name,
        tokensProcessed: tokensToFetch.length,
        recordsProcessed: { success: successCount, errors: errorCount },
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Metadata fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Metadata fetch failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
