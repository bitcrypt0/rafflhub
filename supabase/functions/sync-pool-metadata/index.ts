// Supabase Edge Function: sync-pool-metadata
// Syncs PoolMetadataSet events from blockchain to Supabase cache
// This function can be called by a cron job or manually to keep the cache updated

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@5.7.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PoolDeployer ABI - only the PoolMetadataSet event
const POOL_DEPLOYER_ABI = [
  'event PoolMetadataSet(address indexed pool, string description, string twitterLink, string discordLink, string telegramLink)'
]

interface SyncRequest {
  chainId: number
  poolDeployerAddress: string
  rpcUrl: string
  fromBlock?: number
  toBlock?: number | 'latest'
}

interface MetadataEvent {
  poolAddress: string
  description: string
  twitterLink: string
  discordLink: string
  telegramLink: string
  blockNumber: number
  transactionHash: string
  timestamp: Date
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { chainId, poolDeployerAddress, rpcUrl, fromBlock, toBlock = 'latest' }: SyncRequest = await req.json()

    // Validate inputs
    if (!chainId || !poolDeployerAddress || !rpcUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: chainId, poolDeployerAddress, rpcUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Syncing metadata for chain ${chainId} from block ${fromBlock || 'earliest'} to ${toBlock}`)

    // Connect to blockchain
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    const poolDeployer = new ethers.Contract(poolDeployerAddress, POOL_DEPLOYER_ABI, provider)

    // Determine block range
    const currentBlock = await provider.getBlockNumber()
    const startBlock = fromBlock || Math.max(0, currentBlock - 10000) // Default: last 10k blocks
    const endBlock = toBlock === 'latest' ? currentBlock : toBlock

    console.log(`Querying blocks ${startBlock} to ${endBlock}`)

    // Query PoolMetadataSet events
    const filter = poolDeployer.filters.PoolMetadataSet()
    const events = await poolDeployer.queryFilter(filter, startBlock, endBlock)

    console.log(`Found ${events.length} metadata events`)

    // Process events and prepare for batch insert
    const metadataRecords: MetadataEvent[] = []
    
    for (const event of events) {
      const block = await provider.getBlock(event.blockNumber)
      
      metadataRecords.push({
        poolAddress: event.args!.pool.toLowerCase(),
        description: event.args!.description || '',
        twitterLink: event.args!.twitterLink || '',
        discordLink: event.args!.discordLink || '',
        telegramLink: event.args!.telegramLink || '',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: new Date(block.timestamp * 1000)
      })
    }

    // Batch upsert to database
    let successCount = 0
    let errorCount = 0

    for (const record of metadataRecords) {
      try {
        const { error } = await supabase.rpc('upsert_pool_metadata', {
          p_pool_address: record.poolAddress,
          p_chain_id: chainId,
          p_description: record.description,
          p_twitter_link: record.twitterLink,
          p_discord_link: record.discordLink,
          p_telegram_link: record.telegramLink,
          p_block_number: record.blockNumber,
          p_transaction_hash: record.transactionHash,
          p_event_timestamp: record.timestamp.toISOString()
        })

        if (error) {
          console.error(`Error upserting metadata for pool ${record.poolAddress}:`, error)
          errorCount++
        } else {
          successCount++
        }
      } catch (err) {
        console.error(`Exception upserting metadata for pool ${record.poolAddress}:`, err)
        errorCount++
      }
    }

    console.log(`Sync complete: ${successCount} successful, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        chainId,
        blocksScanned: {
          from: startBlock,
          to: endBlock,
          total: endBlock - startBlock + 1
        },
        eventsFound: events.length,
        recordsProcessed: {
          success: successCount,
          errors: errorCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to sync pool metadata', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
