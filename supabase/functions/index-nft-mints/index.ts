// Supabase Edge Function: index-nft-mints
// Indexes Transfer events from NFT collection contracts to track current_supply.
// Mints are detected as Transfer events from address(0).
// This indexer is called per-collection, not per-factory.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders, verifyInternalAuth, fetchBlockMap } from '../_shared/helpers.ts';
import { providerCache } from '../_shared/provider-cache.ts';
import { isSupportedNetwork } from '../_shared/networks.ts';

// ERC721A and ERC1155 Transfer events based on DroprERC721A.json and DroprERC1155.json
// ERC721A: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
// ERC1155: TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
// ERC1155: TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
const COLLECTION_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
  'function totalSupply() view returns (uint256)',
];

interface IndexRequest {
  chainId: number;
  collectionAddress: string;
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

    const { chainId, collectionAddress, fromBlock, toBlock = 'latest' }: IndexRequest = await req.json();

    if (!chainId || !isSupportedNetwork(chainId) || !collectionAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid parameters: chainId, collectionAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const collectionAddr = collectionAddress.toLowerCase();
    const provider = providerCache.getProvider(chainId);
    const collectionContract = new ethers.Contract(collectionAddr, COLLECTION_ABI, provider);

    console.log(`[Chain ${chainId}] Indexing mints for collection ${collectionAddr}`);

    // Get collection info from database
    const { data: collectionData } = await supabase
      .from('collections')
      .select('standard, created_at_block')
      .eq('address', collectionAddr)
      .eq('chain_id', chainId)
      .single();

    if (!collectionData) {
      return new Response(
        JSON.stringify({ error: 'Collection not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isERC1155 = collectionData.standard === 1; // 0 = ERC721, 1 = ERC1155

    // Resume from last indexed block
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'collection_mints')
      .eq('contract_address', collectionAddr)
      .single();

    const currentBlock = await provider.getBlockNumber();
    const deployBlock = collectionData.created_at_block || Math.max(0, currentBlock - 50000);
    const startBlock = fromBlock !== undefined
      ? fromBlock
      : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : deployBlock);
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    if (startBlock > endBlock) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already up to date', currentSupply: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    let mintCount = 0;
    let burnCount = 0;

    if (isERC1155) {
      // ERC1155: Track TransferSingle and TransferBatch from address(0)
      const [singleEvents, batchEvents] = await Promise.all([
        collectionContract.queryFilter(
          collectionContract.filters.TransferSingle(null, ethers.constants.AddressZero),
          startBlock,
          endBlock
        ),
        collectionContract.queryFilter(
          collectionContract.filters.TransferBatch(null, ethers.constants.AddressZero),
          startBlock,
          endBlock
        ),
      ]);

      // Count mints from TransferSingle
      for (const event of singleEvents) {
        const value = event.args!.value.toNumber();
        mintCount += value;
      }

      // Count mints from TransferBatch
      for (const event of batchEvents) {
        const values = event.args!.values;
        for (const v of values) {
          mintCount += v.toNumber();
        }
      }

      // Also check for burns (transfers to address(0))
      const [burnSingleEvents, burnBatchEvents] = await Promise.all([
        collectionContract.queryFilter(
          collectionContract.filters.TransferSingle(null, null, ethers.constants.AddressZero),
          startBlock,
          endBlock
        ),
        collectionContract.queryFilter(
          collectionContract.filters.TransferBatch(null, null, ethers.constants.AddressZero),
          startBlock,
          endBlock
        ),
      ]);

      for (const event of burnSingleEvents) {
        burnCount += event.args!.value.toNumber();
      }
      for (const event of burnBatchEvents) {
        for (const v of event.args!.values) {
          burnCount += v.toNumber();
        }
      }

      console.log(`[Chain ${chainId}] ERC1155: ${singleEvents.length + batchEvents.length} mint events, ${mintCount} tokens minted, ${burnCount} burned`);
    } else {
      // ERC721: Track Transfer from address(0) (mints) and to address(0) (burns)
      const [mintEvents, burnEvents] = await Promise.all([
        collectionContract.queryFilter(
          collectionContract.filters.Transfer(ethers.constants.AddressZero),
          startBlock,
          endBlock
        ),
        collectionContract.queryFilter(
          collectionContract.filters.Transfer(null, ethers.constants.AddressZero),
          startBlock,
          endBlock
        ),
      ]);

      mintCount = mintEvents.length;
      burnCount = burnEvents.length;

      console.log(`[Chain ${chainId}] ERC721: ${mintCount} mints, ${burnCount} burns`);
    }

    // Fetch current total supply from contract for accuracy
    let currentSupply = 0;
    try {
      const totalSupply = await collectionContract.totalSupply();
      currentSupply = totalSupply.toNumber();
    } catch (err) {
      // If totalSupply() fails, estimate from events
      const { data: existingCollection } = await supabase
        .from('collections')
        .select('current_supply')
        .eq('address', collectionAddr)
        .eq('chain_id', chainId)
        .single();

      currentSupply = (existingCollection?.current_supply || 0) + mintCount - burnCount;
      console.warn(`[Chain ${chainId}] totalSupply() failed, estimated: ${currentSupply}`);
    }

    // Update collection with current supply
    const { error: updateError } = await supabase
      .from('collections')
      .update({
        current_supply: currentSupply,
        last_synced_block: endBlock,
        last_synced_at: new Date().toISOString(),
      })
      .eq('address', collectionAddr)
      .eq('chain_id', chainId);

    if (updateError) {
      console.error('Error updating collection supply:', updateError);
    }

    // Advance sync pointer
    await supabase
      .from('indexer_sync_state')
      .upsert(
        {
          chain_id: chainId,
          contract_type: 'collection_mints',
          contract_address: collectionAddr,
          last_indexed_block: endBlock,
          last_block_hash: (await provider.getBlock(endBlock)).hash,
          last_indexed_at: new Date().toISOString(),
          is_healthy: true,
          error_message: null,
        },
        { onConflict: 'chain_id,contract_type,contract_address' }
      );

    console.log(`[Chain ${chainId}] Collection ${collectionAddr} current_supply updated to ${currentSupply}`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        collectionAddress: collectionAddr,
        blocksScanned: { from: startBlock, to: endBlock },
        mintsFound: mintCount,
        burnsFound: burnCount,
        currentSupply,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('NFT mints indexer error:', error);
    return new Response(
      JSON.stringify({ error: 'Indexing failed', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
