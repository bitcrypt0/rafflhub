// Supabase Edge Function: index-collection-events
// Indexes events from NFT collections: Revealed, Transfer (mints), VestingScheduleSet
// Updates collection metadata and creates user activity records

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders, verifyInternalAuth } from '../_shared/helpers.ts';

// Collection ABI - for monitoring events
const COLLECTION_ABI = [
  'event Revealed(string baseURI)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event VestingScheduleSet(address indexed beneficiary, uint256 amount, uint256 startTime, uint256 duration)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function baseURI() view returns (string)',
  'function isRevealed() view returns (bool)',
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

    if (!chainId || !collectionAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: chainId, collectionAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const collectionAddr = collectionAddress.toLowerCase();

    // Get RPC URL
    const rpcUrl = Deno.env.get(`RPC_URL_${chainId}`) || 'https://base-sepolia-rpc.publicnode.com';

    console.log(`[Chain ${chainId}] Starting collection events indexer for ${collectionAddr}`);

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const collection = new ethers.Contract(collectionAddr, COLLECTION_ABI, provider);

    // Get collection name for activity records
    const collectionName = await collection.name().catch(() => null);

    // Get sync state
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'collection')
      .eq('contract_address', collectionAddr)
      .single();

    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock !== undefined ? fromBlock : (syncState?.last_indexed_block ? syncState.last_indexed_block + 1 : Math.max(0, currentBlock - 1000));
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    let successCount = 0;
    let errorCount = 0;

    // 1. Index Revealed events
    const revealedFilter = collection.filters.Revealed();
    const revealedEvents = await collection.queryFilter(revealedFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${revealedEvents.length} Revealed events`);

    for (const event of revealedEvents) {
      try {
        const baseURI = event.args!.baseURI;
        const block = await provider.getBlock(event.blockNumber);

        // Update collection to mark as revealed
        const { error: updateError } = await supabase
          .from('collections')
          .update({
            is_revealed: true,
            base_uri: baseURI,
            last_synced_block: event.blockNumber,
            last_synced_at: new Date().toISOString(),
          })
          .eq('address', collectionAddr)
          .eq('chain_id', chainId);

        if (updateError) {
          console.error(`Error updating collection ${collectionAddr}:`, updateError);
          errorCount++;
        } else {
          // Get collection creator for activity record
          const { data: collectionData } = await supabase
            .from('collections')
            .select('creator')
            .eq('address', collectionAddr)
            .eq('chain_id', chainId)
            .single();

          if (collectionData) {
            await supabase
              .from('user_activity')
              .upsert({
                user_address: collectionData.creator,
                chain_id: chainId,
                activity_type: 'collection_revealed',
                collection_address: collectionAddr,
                collection_name: collectionName,
                block_number: event.blockNumber,
                transaction_hash: event.transactionHash,
                timestamp: new Date(block.timestamp * 1000).toISOString(),
              }, {
                onConflict: 'chain_id,transaction_hash,activity_type,user_address',
                ignoreDuplicates: true
              });
          }

          successCount++;
        }
      } catch (err) {
        console.error(`Error processing Revealed event:`, err);
        errorCount++;
      }
    }

    // 2. Index Transfer events (mints only: from = 0x0)
    const transferFilter = collection.filters.Transfer(ethers.constants.AddressZero, null, null);
    const mintEvents = await collection.queryFilter(transferFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${mintEvents.length} mint events`);

    for (const event of mintEvents) {
      try {
        const to = event.args!.to.toLowerCase();
        const tokenId = event.args!.tokenId.toNumber();
        const block = await provider.getBlock(event.blockNumber);

        // Create user activity record for NFT mint
        await supabase
          .from('user_activity')
          .upsert({
            user_address: to,
            chain_id: chainId,
            activity_type: 'nft_minted',
            collection_address: collectionAddr,
            collection_name: collectionName,
            token_id: tokenId,
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
          }, {
            onConflict: 'chain_id,transaction_hash,activity_type,user_address',
            ignoreDuplicates: true
          });

        successCount++;
      } catch (err) {
        console.error(`Error processing mint event:`, err);
        errorCount++;
      }
    }

    // Update collection total supply
    try {
      const totalSupply = await collection.totalSupply();
      await supabase
        .from('collections')
        .update({
          total_supply: totalSupply.toNumber(),
          last_synced_block: endBlock,
          last_synced_at: new Date().toISOString(),
        })
        .eq('address', collectionAddr)
        .eq('chain_id', chainId);
    } catch (err) {
      console.error(`Error updating total supply:`, err);
    }

    // 3. Index VestingScheduleSet events
    const vestingFilter = collection.filters.VestingScheduleSet();
    const vestingEvents = await collection.queryFilter(vestingFilter, startBlock, endBlock);
    console.log(`[Chain ${chainId}] Found ${vestingEvents.length} vesting events`);

    for (const event of vestingEvents) {
      try {
        const beneficiary = event.args!.beneficiary.toLowerCase();
        const amount = event.args!.amount;
        const block = await provider.getBlock(event.blockNumber);

        // Create user activity record for vesting schedule
        await supabase
          .from('user_activity')
          .upsert({
            user_address: beneficiary,
            chain_id: chainId,
            activity_type: 'vesting_scheduled',
            collection_address: collectionAddr,
            collection_name: collectionName,
            quantity: amount.toNumber(),
            block_number: event.blockNumber,
            transaction_hash: event.transactionHash,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
          }, {
            onConflict: 'chain_id,transaction_hash,activity_type,user_address',
            ignoreDuplicates: true
          });

        successCount++;
      } catch (err) {
        console.error(`Error processing vesting event:`, err);
        errorCount++;
      }
    }

    // Update sync state
    await supabase
      .from('indexer_sync_state')
      .upsert({
        chain_id: chainId,
        contract_type: 'collection',
        contract_address: collectionAddr,
        last_indexed_block: endBlock,
        last_block_hash: (await provider.getBlock(endBlock)).hash,
        last_indexed_at: new Date().toISOString(),
        is_healthy: true,
        error_message: null,
      }, {
        onConflict: 'chain_id,contract_type,contract_address'
      });

    const totalEvents = revealedEvents.length + mintEvents.length + vestingEvents.length;
    console.log(`[Chain ${chainId}] Indexing complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        collectionAddress: collectionAddr,
        blocksScanned: { from: startBlock, to: endBlock, total: endBlock - startBlock + 1 },
        eventsFound: totalEvents,
        eventBreakdown: {
          revealed: revealedEvents.length,
          minted: mintEvents.length,
          vesting: vestingEvents.length,
        },
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
