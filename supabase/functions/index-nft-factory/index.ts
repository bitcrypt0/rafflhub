// Supabase Edge Function: index-nft-factory
// Indexes CollectionCreated events from NFTFactory contract.
// Creates new collection records and fetches initial collection state from the blockchain.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders, fetchBlockMap } from '../_shared/helpers.ts';
import { providerCache } from '../_shared/provider-cache.ts';
import { getContractAddress, isSupportedNetwork } from '../_shared/networks.ts';

// Max blocks per queryFilter call — public RPC nodes typically reject ranges > 2000-10000
const MAX_BLOCK_RANGE = 2000;

const NFT_FACTORY_ABI = [
  'event CollectionDeployed(address indexed collection, address indexed creator, uint8 standard)',
  'event CollectionURIsSet(address indexed collection, string dropURI, string unrevealedURI, bytes32 dropURIHash, bytes32 unrevealedURIHash)',
];

const COLLECTION_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function baseURI() view returns (string)',
  'function isRevealed() view returns (bool)',
  'function royaltyRecipient() view returns (address)',
  'function royaltyBps() view returns (uint256)',
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

    const nftFactoryAddress = getContractAddress(chainId, 'nftFactory');
    if (!nftFactoryAddress || nftFactoryAddress === '0x...') {
      return new Response(
        JSON.stringify({ error: `No NFTFactory contract deployed on chain ${chainId}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chain ${chainId}] Starting indexer for NFTFactory at ${nftFactoryAddress}`);

    const provider = providerCache.getProvider(chainId);
    const nftFactory = new ethers.Contract(nftFactoryAddress, NFT_FACTORY_ABI, provider);

    // Resume from last indexed block
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'nft_factory')
      .eq('contract_address', nftFactoryAddress.toLowerCase())
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined
      ? fromBlock
      : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : Math.max(0, currentBlock - 10000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock} (range: ${endBlock - startBlock + 1})`);

    // Query events in chunks to avoid RPC range-too-large errors
    const collectionDeployedFilter = nftFactory.filters.CollectionDeployed();
    const urisSetFilter = nftFactory.filters.CollectionURIsSet();

    const collectionDeployedEvents: ethers.Event[] = [];
    const urisSetEvents: ethers.Event[] = [];

    for (let from = startBlock; from <= endBlock; from += MAX_BLOCK_RANGE) {
      const to = Math.min(from + MAX_BLOCK_RANGE - 1, endBlock);
      const [deployed, uris] = await Promise.all([
        nftFactory.queryFilter(collectionDeployedFilter, from, to),
        nftFactory.queryFilter(urisSetFilter, from, to),
      ]);
      collectionDeployedEvents.push(...deployed);
      urisSetEvents.push(...uris);
    }

    console.log(`[Chain ${chainId}] Found ${collectionDeployedEvents.length} CollectionDeployed events`);
    console.log(`[Chain ${chainId}] Found ${urisSetEvents.length} CollectionURIsSet events`);
    
    // Combine all events for block fetching
    const allEvents = [...collectionDeployedEvents, ...urisSetEvents];

    // Batch-fetch all required blocks in one round of parallel RPC calls
    const blockMap = await fetchBlockMap(provider, allEvents.map((e) => e.blockNumber));
    
    // Build a map of collection address -> URI data from CollectionURIsSet events
    const uriDataMap = new Map<string, {
      dropURI: string;
      unrevealedURI: string;
      dropURIHash: string;
      unrevealedURIHash: string;
    }>();
    
    for (const event of urisSetEvents) {
      const collectionAddress = event.args!.collection.toLowerCase();
      uriDataMap.set(collectionAddress, {
        dropURI: event.args!.dropURI || '',
        unrevealedURI: event.args!.unrevealedURI || '',
        dropURIHash: event.args!.dropURIHash || null,
        unrevealedURIHash: event.args!.unrevealedURIHash || null,
      });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const event of collectionDeployedEvents) {
      try {
        const collectionAddress = event.args!.collection.toLowerCase();
        const creator = event.args!.creator.toLowerCase();
        const standard = event.args!.standard;
        const block = blockMap.get(event.blockNumber)!;
        
        // Get URI data if CollectionURIsSet was emitted for this collection
        const uriData = uriDataMap.get(collectionAddress);

        const collectionContract = new ethers.Contract(collectionAddress, COLLECTION_ABI, provider);

        const [
          name, symbol, totalSupply, maxSupply,
          baseURI, isRevealed, royaltyRecipient, royaltyBps,
        ] = await Promise.all([
          collectionContract.name().catch(() => ''),
          collectionContract.symbol().catch(() => ''),
          collectionContract.totalSupply().catch(() => ethers.BigNumber.from(0)),
          collectionContract.maxSupply().catch(() => ethers.BigNumber.from(0)),
          collectionContract.baseURI().catch(() => ''),
          collectionContract.isRevealed().catch(() => false),
          collectionContract.royaltyRecipient().catch(() => ethers.constants.AddressZero),
          collectionContract.royaltyBps().catch(() => ethers.BigNumber.from(0)),
        ]);

        const { error: collectionError } = await supabase
          .from('collections')
          .upsert(
            {
              address: collectionAddress,
              chain_id: chainId,
              name: name || null,
              symbol: symbol || null,
              creator: creator,
              standard: standard,
              current_supply: totalSupply.toNumber(),
              max_supply: maxSupply.toNumber(),
              base_uri: baseURI || null,
              is_revealed: isRevealed,
              // Include URI data from CollectionURIsSet event if available
              drop_uri: uriData?.dropURI || null,
              unrevealed_uri: uriData?.unrevealedURI || null,
              drop_uri_hash: uriData?.dropURIHash || null,
              unrevealed_uri_hash: uriData?.unrevealedURIHash || null,
              deployed_block: event.blockNumber,
              deployed_at: new Date(block.timestamp * 1000).toISOString(),
              last_synced_block: event.blockNumber,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'address,chain_id' }
          );

        if (collectionError) {
          console.error(`Error inserting collection ${collectionAddress}:`, JSON.stringify(collectionError));
          errorCount++;
        } else {
          await supabase
            .from('user_activity')
            .upsert(
              {
                user_address: creator,
                chain_id: chainId,
                activity_type: 'collection_created',
                pool_address: collectionAddress,
                pool_name: name || null,
                block_number: event.blockNumber,
                transaction_hash: event.transactionHash,
                timestamp: new Date(block.timestamp * 1000).toISOString(),
              },
              {
                onConflict: 'chain_id,transaction_hash,activity_type,user_address',
                ignoreDuplicates: true,
              }
            );
          successCount++;
        }
      } catch (err) {
        console.error('Error processing CollectionCreated event:', err);
        errorCount++;
      }
    }

    // Advance sync pointer
    await supabase
      .from('indexer_sync_state')
      .upsert(
        {
          chain_id: chainId,
          contract_type: 'nft_factory',
          contract_address: nftFactoryAddress.toLowerCase(),
          last_indexed_block: endBlock,
          last_block_hash: (await provider.getBlock(endBlock)).hash,
          last_indexed_at: new Date().toISOString(),
          is_healthy: true,
          error_message: null,
        },
        { onConflict: 'chain_id,contract_type,contract_address' }
      );

    // Process standalone CollectionURIsSet events (for collections already in DB)
    // This handles cases where URIs are set after initial collection creation
    let uriUpdateCount = 0;
    for (const event of urisSetEvents) {
      const collectionAddress = event.args!.collection.toLowerCase();
      
      // Update existing collection with URI data
      const { error: uriUpdateError } = await supabase
        .from('collections')
        .update({
          drop_uri: event.args!.dropURI || null,
          unrevealed_uri: event.args!.unrevealedURI || null,
          drop_uri_hash: event.args!.dropURIHash || null,
          unrevealed_uri_hash: event.args!.unrevealedURIHash || null,
          last_synced_at: new Date().toISOString(),
        })
        .eq('address', collectionAddress)
        .eq('chain_id', chainId);
      
      if (!uriUpdateError) {
        uriUpdateCount++;
      }
    }

    console.log(`[Chain ${chainId}] Indexing complete: ${successCount} collections created, ${uriUpdateCount} URI updates, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        blocksScanned: { from: startBlock, to: endBlock, total: endBlock - startBlock + 1 },
        eventsFound: { collectionDeployed: collectionDeployedEvents.length, urisSet: urisSetEvents.length },
        recordsProcessed: { collectionsCreated: successCount, uriUpdates: uriUpdateCount, errors: errorCount },
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
