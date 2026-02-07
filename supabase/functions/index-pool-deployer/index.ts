// Supabase Edge Function: index-pool-deployer
// Indexes PoolCreated and PoolMetadataSet events from PoolDeployer contract.
// Creates new pool records, updates metadata, and fetches initial pool state from the blockchain.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { corsHeaders, verifyInternalAuth, fetchBlockMap } from '../_shared/helpers.ts';
import { providerCache } from '../_shared/provider-cache.ts';
import { getContractAddress, isSupportedNetwork } from '../_shared/networks.ts';
import { fetchPrizeArtworkURL } from '../_shared/artwork-fetcher.ts';

const POOL_DEPLOYER_ABI = [
  'event PoolCreated(address indexed pool, address indexed creator, uint256 poolId)',
  'event PoolMetadataSet(address indexed pool, string description, string twitterLink, string discordLink, string telegramLink)',
];

const SOCIAL_ENGAGEMENT_MANAGER_ABI = [
  'event SocialTasksEnabled(address indexed pool, string taskDescription)',
];

const POOL_ABI = [
  'function name() view returns (string)',
  'function startTime() view returns (uint256)',
  'function duration() view returns (uint256)',
  'function slotFee() view returns (uint256)',
  'function slotLimit() view returns (uint256)',
  'function winnersCount() view returns (uint256)',
  'function maxSlotsPerAddress() view returns (uint256)',
  'function state() view returns (uint8)',
  'function isPrized() view returns (bool)',
  'function prizeCollection() view returns (address)',
  'function prizeTokenId() view returns (uint256)',
  'function standard() view returns (uint8)',
  'function isCollabPool() view returns (bool)',
  'function usesCustomFee() view returns (bool)',
  'function revenueRecipient() view returns (address)',
  'function isExternalCollection() view returns (bool)',
  'function isRefundable() view returns (bool)',
  'function amountPerWinner() view returns (uint256)',
  'function erc20PrizeToken() view returns (address)',
  'function erc20PrizeAmount() view returns (uint256)',
  'function nativePrizeAmount() view returns (uint256)',
  'function isEscrowedPrize() view returns (bool)',
];

// ABI for fetching holder token data
const HOLDER_DATA_ABI = [
  'function holderData() view returns (address holderTokenAddress, uint8 holderTokenStandard, uint256 minHolderTokenBalance)',
];

// ABI for fetching ERC20 token symbol
const ERC20_ABI = [
  'function symbol() view returns (string)',
];

// ABI for fetching NFT collection metadata and URIs
const COLLECTION_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  // URI methods for external collections
  'function dropURI() view returns (string)',
  'function unrevealedBaseURI() view returns (string)',
  'function unrevealedURI() view returns (string)',
  'function baseURI() view returns (string)',
  'function dropURIHash() view returns (bytes32)',
  'function unrevealedURIHash() view returns (bytes32)',
  'function isRevealed() view returns (bool)',
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

    const poolDeployerAddress = getContractAddress(chainId, 'poolDeployer');
    if (!poolDeployerAddress || poolDeployerAddress === '0x...') {
      return new Response(
        JSON.stringify({ error: `No PoolDeployer contract deployed on chain ${chainId}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get SocialEngagementManager address for this chain
    const socialEngagementManagerAddress = getContractAddress(chainId, 'socialEngagementManager');

    console.log(`[Chain ${chainId}] Starting indexer for PoolDeployer at ${poolDeployerAddress}`);
    if (socialEngagementManagerAddress && socialEngagementManagerAddress !== '0x...') {
      console.log(`[Chain ${chainId}] SocialEngagementManager at ${socialEngagementManagerAddress}`);
    }

    const provider = providerCache.getProvider(chainId);
    const poolDeployer = new ethers.Contract(poolDeployerAddress, POOL_DEPLOYER_ABI, provider);

    // Resume from last indexed block
    const { data: syncState } = await supabase
      .from('indexer_sync_state')
      .select('last_indexed_block')
      .eq('chain_id', chainId)
      .eq('contract_type', 'pool_deployer')
      .eq('contract_address', poolDeployerAddress.toLowerCase())
      .single();

    const currentBlock = await provider.getBlockNumber();
    // Handle sync state: if last_indexed_block is explicitly 0 or null, scan from beginning
    // Otherwise resume from last_indexed_block + 1
    const startBlock = fromBlock !== undefined
      ? fromBlock
      : (syncState?.last_indexed_block !== null && syncState?.last_indexed_block !== undefined && syncState.last_indexed_block > 0
          ? syncState.last_indexed_block + 1
          : Math.max(0, currentBlock - 100000)); // Scan last 100k blocks when resetting
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock;

    console.log(`[Chain ${chainId}] Scanning blocks ${startBlock} to ${endBlock}`);

    // Query PoolCreated, PoolMetadataSet, and SocialTasksEnabled events in parallel
    const hasSocialManager = socialEngagementManagerAddress && socialEngagementManagerAddress !== '0x...';
    const socialManager = hasSocialManager
      ? new ethers.Contract(socialEngagementManagerAddress, SOCIAL_ENGAGEMENT_MANAGER_ABI, provider)
      : null;

    const [poolCreatedEvents, metadataSetEvents] = await Promise.all([
      poolDeployer.queryFilter(poolDeployer.filters.PoolCreated(), startBlock, endBlock),
      poolDeployer.queryFilter(poolDeployer.filters.PoolMetadataSet(), startBlock, endBlock),
    ]);

    // Query SocialTasksEnabled separately with error handling (different contract)
    let socialTaskEvents: any[] = [];
    if (socialManager) {
      try {
        socialTaskEvents = await socialManager.queryFilter(socialManager.filters.SocialTasksEnabled(), startBlock, endBlock);
      } catch (socialErr) {
        console.warn(`[Chain ${chainId}] Failed to query SocialTasksEnabled events:`, socialErr);
      }
    }
    
    console.log(`[Chain ${chainId}] Found ${poolCreatedEvents.length} PoolCreated, ${metadataSetEvents.length} PoolMetadataSet, ${socialTaskEvents.length} SocialTasksEnabled events`);

    // Batch-fetch all required blocks in one round of parallel RPC calls
    const allEvents = [...poolCreatedEvents, ...metadataSetEvents, ...socialTaskEvents];
    const blockMap = await fetchBlockMap(provider, allEvents.map((e) => e.blockNumber));

    let successCount = 0;
    let errorCount = 0;

    // Process PoolCreated events
    for (const event of poolCreatedEvents) {
      try {
        console.log('Processing PoolCreated event:', {
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          hasArgs: !!event.args,
          args: event.args,
          topics: event.topics,
          data: event.data,
        });
        
        if (!event.args) {
          console.error('Event args is null, skipping event');
          errorCount++;
          continue;
        }
        
        const poolAddress = event.args.pool.toLowerCase();
        const creator = event.args.creator.toLowerCase();
        const block = blockMap.get(event.blockNumber)!;

        const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);

        // Create contract instances for different ABIs
        const holderContract = new ethers.Contract(poolAddress, HOLDER_DATA_ABI, provider);

        const [
          name, startTime, duration, slotFee, slotLimit, winnersCount,
          maxSlotsPerAddress, state, isPrized, prizeCollection, prizeTokenId,
          standard, isCollabPool, usesCustomFee, revenueRecipient,
          isExternalCollection, isRefundable, amountPerWinner,
          erc20PrizeToken, erc20PrizeAmount, nativePrizeAmount, isEscrowedPrize,
          holderData,
        ] = await Promise.all([
          poolContract.name().catch(() => ''),
          poolContract.startTime(),
          poolContract.duration(),
          poolContract.slotFee(),
          poolContract.slotLimit(),
          poolContract.winnersCount(),
          poolContract.maxSlotsPerAddress(),
          poolContract.state(),
          poolContract.isPrized(),
          poolContract.prizeCollection().catch(() => ethers.constants.AddressZero),
          poolContract.prizeTokenId().catch(() => 0),
          poolContract.standard().catch(() => 0),
          poolContract.isCollabPool().catch(() => false),
          poolContract.usesCustomFee().catch(() => false),
          poolContract.revenueRecipient().catch(() => ethers.constants.AddressZero),
          poolContract.isExternalCollection().catch(() => false),
          poolContract.isRefundable().catch(() => false),
          poolContract.amountPerWinner().catch(() => ethers.BigNumber.from(1)),
          poolContract.erc20PrizeToken().catch(() => ethers.constants.AddressZero),
          poolContract.erc20PrizeAmount().catch(() => ethers.BigNumber.from(0)),
          poolContract.nativePrizeAmount().catch(() => ethers.BigNumber.from(0)),
          poolContract.isEscrowedPrize().catch(() => false),
          holderContract.holderData().catch(() => [ethers.constants.AddressZero, 0, ethers.BigNumber.from(0)]),
        ]);

        // Extract holder data
        const holderTokenAddress = holderData[0];
        const holderTokenStandard = holderData[1];
        const minHolderTokenBalance = holderData[2];

        // Fetch ERC20 prize token symbol if applicable
        let erc20PrizeTokenSymbol: string | null = null;
        if (erc20PrizeToken && erc20PrizeToken !== ethers.constants.AddressZero) {
          try {
            const erc20Contract = new ethers.Contract(erc20PrizeToken, ERC20_ABI, provider);
            erc20PrizeTokenSymbol = await erc20Contract.symbol();
          } catch (e) {
            console.warn(`Failed to fetch ERC20 symbol for ${erc20PrizeToken}:`, e);
          }
        }

        // Fetch artwork URL for NFT prizes (both mintable and escrowed)
        let artworkUrl: string | null = null;
        if (isPrized && prizeCollection && prizeCollection !== ethers.constants.AddressZero) {
          try {
            console.log(`Fetching artwork for pool ${poolAddress}, collection ${prizeCollection}`);
            artworkUrl = await fetchPrizeArtworkURL(
              provider,
              prizeCollection,
              prizeTokenId.toNumber ? prizeTokenId.toNumber() : Number(prizeTokenId),
              standard,
              isEscrowedPrize
            );
            if (artworkUrl) {
              console.log(`✅ Cached artwork URL for pool ${poolAddress}: ${artworkUrl.slice(0, 80)}...`);
            } else {
              console.log(`⚠️ No artwork URL found for pool ${poolAddress}`);
            }
          } catch (e) {
            console.warn(`Failed to fetch artwork for pool ${poolAddress}:`, e);
          }
        }

        const { error: poolError } = await supabase
          .from('pools')
          .upsert(
            {
              address: poolAddress,
              chain_id: chainId,
              name: name || null,
              creator: creator,
              start_time: startTime.toNumber(),
              duration: duration.toNumber(),
              created_at_block: event.blockNumber,
              created_at_timestamp: new Date(block.timestamp * 1000).toISOString(),
              slot_fee: slotFee.toString(),
              slot_limit: slotLimit.toNumber(),
              winners_count: winnersCount.toNumber(),
              max_slots_per_address: maxSlotsPerAddress.toNumber(),
              state: state,
              is_prized: isPrized,
              prize_collection: isPrized ? prizeCollection.toLowerCase() : null,
              prize_token_id: isPrized ? prizeTokenId.toNumber() : null,
              standard: isPrized ? standard : null,
              is_collab_pool: isCollabPool,
              uses_custom_fee: usesCustomFee,
              revenue_recipient: revenueRecipient !== ethers.constants.AddressZero ? revenueRecipient.toLowerCase() : null,
              is_external_collection: isExternalCollection,
              is_refundable: isRefundable,
              // New fields for frontend integration
              amount_per_winner: amountPerWinner.toNumber ? amountPerWinner.toNumber() : Number(amountPerWinner),
              erc20_prize_token: erc20PrizeToken !== ethers.constants.AddressZero ? erc20PrizeToken.toLowerCase() : null,
              erc20_prize_amount: erc20PrizeAmount.toString(),
              native_prize_amount: nativePrizeAmount.toString(),
              is_escrowed_prize: isEscrowedPrize,
              holder_token_address: holderTokenAddress !== ethers.constants.AddressZero ? holderTokenAddress.toLowerCase() : null,
              holder_token_standard: holderTokenAddress !== ethers.constants.AddressZero ? holderTokenStandard : null,
              min_holder_token_balance: holderTokenAddress !== ethers.constants.AddressZero ? minHolderTokenBalance.toString() : null,
              erc20_prize_token_symbol: erc20PrizeTokenSymbol,
              artwork_url: artworkUrl,
              last_synced_block: event.blockNumber,
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'address,chain_id' }
          );

        if (poolError) {
          console.error(`❌ ERROR inserting pool ${poolAddress}`);
          console.error(`Error code: ${poolError.code}`);
          console.error(`Error message: ${poolError.message}`);
          console.error(`Error details: ${poolError.details}`);
          console.error(`Error hint: ${poolError.hint}`);
          console.error(`Full error object:`, poolError);
          errorCount++;
        } else {
          console.log(`✅ Successfully inserted pool ${poolAddress}`);
          successCount++;
          await supabase
            .from('user_activity')
            .upsert(
              {
                user_address: creator,
                chain_id: chainId,
                activity_type: 'raffle_created',
                pool_address: poolAddress,
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

          // Track external collections in the collections table with URI data
          if (isExternalCollection && prizeCollection && prizeCollection !== ethers.constants.AddressZero) {
            try {
              // Fetch collection metadata and URIs from blockchain
              const collectionContract = new ethers.Contract(prizeCollection, COLLECTION_ABI, provider);
              
              // Fetch all data in parallel
              const [
                collName, collSymbol, totalSupply, collOwner,
                dropUri, unrevealedBaseUri, unrevealedUri, baseUri,
                dropUriHash, unrevealedUriHash, isRevealed
              ] = await Promise.all([
                collectionContract.name().catch(() => 'Unknown'),
                collectionContract.symbol().catch(() => ''),
                collectionContract.totalSupply().catch(() => ethers.BigNumber.from(0)),
                collectionContract.owner().catch(() => creator),
                // URI methods
                collectionContract.dropURI().catch(() => null),
                collectionContract.unrevealedBaseURI().catch(() => null), // ERC721
                collectionContract.unrevealedURI().catch(() => null), // ERC1155
                collectionContract.baseURI().catch(() => null),
                collectionContract.dropURIHash().catch(() => null),
                collectionContract.unrevealedURIHash().catch(() => null),
                collectionContract.isRevealed().catch(() => false),
              ]);

              // Helper to check if value is a bytes32 hash
              const isBytes32Hash = (str: string) => /^0x[a-fA-F0-9]{64}$/.test(str);
              const isZeroHash = (hash: string) => hash === '0x0000000000000000000000000000000000000000000000000000000000000000';

              // Process URIs - use ERC721 or ERC1155 pattern based on standard
              const processedDropUri = dropUri && typeof dropUri === 'string' && dropUri.trim() !== '' && !isBytes32Hash(dropUri) ? dropUri : null;
              const processedUnrevealedUri = standard === 0
                ? (unrevealedBaseUri && typeof unrevealedBaseUri === 'string' && unrevealedBaseUri.trim() !== '' && !isBytes32Hash(unrevealedBaseUri) ? unrevealedBaseUri : null)
                : (unrevealedUri && typeof unrevealedUri === 'string' && unrevealedUri.trim() !== '' && !isBytes32Hash(unrevealedUri) ? unrevealedUri : null);
              const processedBaseUri = baseUri && typeof baseUri === 'string' && baseUri.trim() !== '' && !isBytes32Hash(baseUri) ? baseUri : null;
              const processedDropUriHash = dropUriHash && !isZeroHash(dropUriHash) ? dropUriHash : null;
              const processedUnrevealedUriHash = unrevealedUriHash && !isZeroHash(unrevealedUriHash) ? unrevealedUriHash : null;

              await supabase
                .from('collections')
                .upsert(
                  {
                    address: prizeCollection.toLowerCase(),
                    chain_id: chainId,
                    name: collName || null,
                    symbol: collSymbol || null,
                    creator: collOwner.toLowerCase(),
                    standard: standard,
                    current_supply: totalSupply.toNumber ? totalSupply.toNumber() : Number(totalSupply),
                    // URI data for fast artwork resolution
                    drop_uri: processedDropUri,
                    unrevealed_uri: processedUnrevealedUri,
                    base_uri: processedBaseUri,
                    drop_uri_hash: processedDropUriHash,
                    unrevealed_uri_hash: processedUnrevealedUriHash,
                    is_revealed: isRevealed === true,
                    is_external: true,
                    created_at: new Date().toISOString(),
                    last_synced_at: new Date().toISOString(),
                  },
                  { onConflict: 'address,chain_id' }
                );

              console.log(`[Chain ${chainId}] Indexed external collection ${prizeCollection} with URIs:`, {
                dropUri: processedDropUri?.slice(0, 50),
                unrevealedUri: processedUnrevealedUri?.slice(0, 50),
                baseUri: processedBaseUri?.slice(0, 50),
              });
            } catch (collErr) {
              console.warn(`Failed to index external collection ${prizeCollection}:`, collErr);
            }
          }

          successCount++;
        }
      } catch (err) {
        console.error('Error processing PoolCreated event:', err);
        errorCount++;
      }
    }

    // Process PoolMetadataSet events
    for (const event of metadataSetEvents) {
      try {
        const poolAddress = event.args!.pool.toLowerCase();
        const description = event.args!.description || '';
        const twitterLink = event.args!.twitterLink || '';
        const discordLink = event.args!.discordLink || '';
        const telegramLink = event.args!.telegramLink || '';

        // Update pool with metadata fields
        const { error: updateError } = await supabase
          .from('pools')
          .update({
            description: description || null,
            twitter_link: twitterLink || null,
            discord_link: discordLink || null,
            telegram_link: telegramLink || null,
            updated_at: new Date().toISOString(),
          })
          .eq('address', poolAddress)
          .eq('chain_id', chainId);

        if (updateError) {
          console.error(`Error updating pool metadata for ${poolAddress}:`, JSON.stringify(updateError));
          errorCount++;
        } else {
          successCount++;
          console.log(`[Chain ${chainId}] Updated metadata for pool ${poolAddress}: desc=${description.slice(0, 50)}, twitter=${twitterLink}, discord=${discordLink}, telegram=${telegramLink}`);
        }
      } catch (err) {
        console.error('Error processing PoolMetadataSet event:', err);
        errorCount++;
      }
    }

    // Process SocialTasksEnabled events
    for (const event of socialTaskEvents) {
      try {
        const poolAddress = event.args!.pool.toLowerCase();
        const taskDescription = event.args!.taskDescription || '';

        const { error: updateError } = await supabase
          .from('pools')
          .update({
            social_task_description: taskDescription || null,
            social_engagement_required: true,
            updated_at: new Date().toISOString(),
          })
          .eq('address', poolAddress)
          .eq('chain_id', chainId);

        if (updateError) {
          console.error(`Error updating social tasks for ${poolAddress}:`, JSON.stringify(updateError));
          errorCount++;
        } else {
          successCount++;
          console.log(`[Chain ${chainId}] Updated social tasks for pool ${poolAddress}: ${taskDescription.slice(0, 80)}`);
        }
      } catch (err) {
        console.error('Error processing SocialTasksEnabled event:', err);
        errorCount++;
      }
    }

    // Advance sync pointer
    await supabase
      .from('indexer_sync_state')
      .upsert(
        {
          chain_id: chainId,
          contract_type: 'pool_deployer',
          contract_address: poolDeployerAddress.toLowerCase(),
          last_indexed_block: endBlock,
          last_block_hash: (await provider.getBlock(endBlock)).hash,
          last_indexed_at: new Date().toISOString(),
          is_healthy: true,
          error_message: null,
        },
        { onConflict: 'chain_id,contract_type,contract_address' }
      );

    console.log(`[Chain ${chainId}] Indexing complete: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        blocksScanned: { from: startBlock, to: endBlock, total: endBlock - startBlock + 1 },
        eventsFound: { poolCreated: poolCreatedEvents.length, metadataSet: metadataSetEvents.length, socialTasks: socialTaskEvents.length },
        recordsProcessed: { success: successCount, errors: errorCount },
        errorDetails: errorCount > 0 ? 'Check console logs for detailed error messages' : null,
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
