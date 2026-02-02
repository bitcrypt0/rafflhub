// Supabase Edge Function: index-nft-factory
// Indexes CollectionCreated events from NFTFactory contract
// Creates new collection records and fetches initial collection state from blockchain

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NFTFactory ABI - CollectionCreated event
const NFT_FACTORY_ABI = [
  'event CollectionCreated(address indexed collection, address indexed creator, uint8 standard)',
];

// Collection ABI - for fetching collection state
const COLLECTION_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function creator() view returns (address)',
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

    if (!chainId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: chainId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get RPC URL and contract address from environment or use defaults
    const rpcUrl = Deno.env.get(`RPC_URL_${chainId}`) || 'https://base-sepolia-rpc.publicnode.com';
    const nftFactoryAddress = chainId === 84532
      ? '0x45D4f0dC925056e6203BFBf14E56762217e47cb4'
      : null;

    if (!nftFactoryAddress) {
      return new Response(
        JSON.stringify({ error: `No NFTFactory contract deployed on chain ${chainId}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chain ${chainId}] Starting indexer for NFTFactory at ${nftFactoryAddress}`);

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const nftFactory = new ethers.Contract(nftFactoryAddress, NFT_FACTORY_ABI, provider);

    // Get sync state
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'nft_factory')
      .eq('contract_address', nftFactoryAddress.toLowerCase())
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined ? fromBlock : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : Math.max(0, currentBlock - 1000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    // Query CollectionCreated events
    const filter = nftFactory.filters.CollectionCreated();
    const events = await nftFactory.queryFilter(filter, startBlock, endBlock);

    console.log(`[Chain ${chainId}] Found ${events.length} CollectionCreated events`);

    let successCount = 0;
    let errorCount = 0;

    // Process each event
    for (const event of events) {
      try {
        const collectionAddress = event.args!.collection.toLowerCase();
        const creator = event.args!.creator.toLowerCase();
        const standard = event.args!.standard;
        const block = await provider.getBlock(event.blockNumber);

        // Fetch collection state from blockchain
        const collectionContract = new ethers.Contract(collectionAddress, COLLECTION_ABI, provider);

        const [
          name,
          symbol,
          totalSupply,
          maxSupply,
          baseURI,
          isRevealed,
          royaltyRecipient,
          royaltyBps,
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

        // Insert collection into database
        const { error: collectionError } = await supabase
          .from('collections')
          .upsert({
            address: collectionAddress,
            chain_id: chainId,
            name: name || null,
            symbol: symbol || null,
            creator: creator,
            standard: standard,
            total_supply: totalSupply.toNumber(),
            max_supply: maxSupply.toNumber(),
            base_uri: baseURI || null,
            is_revealed: isRevealed,
            royalty_recipient: royaltyRecipient !== ethers.constants.AddressZero ? royaltyRecipient.toLowerCase() : null,
            royalty_bps: royaltyBps.toNumber(),
            created_at_block: event.blockNumber,
            created_at_timestamp: new Date(block.timestamp * 1000).toISOString(),
            last_synced_block: event.blockNumber,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'address,chain_id'
          });

        if (collectionError) {
          console.error(`Error inserting collection ${collectionAddress}:`, JSON.stringify(collectionError, null, 2));
          errorCount++;
        } else {
          // Create user activity record for collection creation
          await supabase
            .from('user_activity')
            .upsert({
              user_address: creator,
              chain_id: chainId,
              activity_type: 'collection_created',
              collection_address: collectionAddress,
              collection_name: name || null,
              block_number: event.blockNumber,
              transaction_hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000).toISOString(),
            }, {
              onConflict: 'chain_id,transaction_hash,activity_type,user_address',
              ignoreDuplicates: true
            });

          successCount++;
        }
      } catch (err) {
        console.error(`Error processing event:`, err);
        console.error(`Error details:`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
        errorCount++;
      }
    }

    // Update sync state
    await supabase
      .from('indexer_sync_state')
      .upsert({
        chain_id: chainId,
        contract_type: 'nft_factory',
        contract_address: nftFactoryAddress.toLowerCase(),
        last_indexed_block: endBlock,
        last_block_hash: (await provider.getBlock(endBlock)).hash,
        last_indexed_at: new Date().toISOString(),
        is_healthy: true,
        error_message: null,
      }, {
        onConflict: 'chain_id,contract_type,contract_address'
      });

    console.log(`[Chain ${chainId}] Indexing complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        blocksScanned: { from: startBlock, to: endBlock, total: endBlock - startBlock + 1 },
        eventsFound: events.length,
        recordsProcessed: { success: successCount, errors: errorCount },
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
