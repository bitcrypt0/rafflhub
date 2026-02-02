import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@5.7.2'
import { isSupportedNetwork, getNetworkConfig, getContractAddress } from '../_shared/networks.ts'
import { providerCache } from '../_shared/provider-cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignatureRequest {
  user_address: string;
  raffle_id: string;
  raffle_address?: string;
  slot_count?: number;
  chain_id: number; // Required: Chain ID for multi-network support
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the request
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { user_address, raffle_id, raffle_address, slot_count = 1, chain_id }: SignatureRequest = await req.json()

    // Validate required parameters
    if (!user_address || !raffle_id || chain_id === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: user_address, raffle_id, and chain_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate chain is supported
    if (!isSupportedNetwork(chain_id)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Chain ID ${chain_id} is not supported` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate Ethereum address format
    if (!isValidEthereumAddress(user_address)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid Ethereum address format' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has completed all required social media tasks for this raffle
    const { data: verificationRecords, error: verificationError } = await supabaseClient
      .from('verification_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('raffle_id', raffle_id)
      .eq('chain_id', chain_id) // Filter by network to ensure proper isolation
      .eq('status', 'verified')

    if (verificationError) {
      console.error('Error checking verification records:', verificationError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error checking verification status' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For now, we'll assume verification is complete if there are any verified records
    // In a real implementation, you'd check against the specific requirements for the raffle
    if (!verificationRecords || verificationRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Social media verification not completed for this raffle' 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has already purchased slots from this pool (hasCompletedSocialEngagement on-chain)
    // If so, they don't need a new signature since the contract skips verification after first purchase
    const hasPurchasedBefore = await checkUserHasPurchased(user_address, raffle_address || raffle_id, chain_id)
    
    if (hasPurchasedBefore) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyVerified: true,
          message: 'User has already completed social verification for this pool. No signature needed for subsequent purchases.',
          signature: '0x', // Empty signature since it won't be checked
          nonce: 0,
          deadline: 0,
          user_address,
          raffle_id,
          raffle_address,
          slot_count
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate deadline (15 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + (15 * 60)

    // Generate signature (no nonce needed)
    const signature = await generatePurchaseSignature(
      user_address,
      raffle_address || raffle_id,
      deadline,
      chain_id
    )

    if (!signature) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to generate signature' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Store signature record in database
    const { data: signatureRecord, error: signatureError } = await supabaseClient
      .from('purchase_signatures')
      .insert({
        user_id: user.id,
        user_address,
        raffle_id,
        raffle_address,
        signature,
        slot_count,
        chain_id: chain_id, // Track signature per network
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes expiry
        metadata: {
          generated_at: new Date().toISOString(),
          verification_records: verificationRecords.length,
          chain_id: chain_id
        }
      })
      .select()
      .single()

    if (signatureError) {
      console.error('Error storing signature:', signatureError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to store signature' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        deadline,
        signature_id: signatureRecord.id,
        expires_at: signatureRecord.expires_at,
        user_address,
        raffle_id,
        raffle_address,
        slot_count
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Signature generation error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to check if user has already purchased from the pool
async function checkUserHasPurchased(
  userAddress: string,
  poolAddress: string,
  chainId: number
): Promise<boolean> {
  try {
    // Get provider from cache
    const provider = providerCache.getProvider(chainId);
    
    // ABI for hasCompletedSocialEngagement function
    const abi = [
      'function hasCompletedSocialEngagement(address) external view returns (bool)'
    ]
    
    // Create contract instance
    const contract = new ethers.Contract(poolAddress, abi, provider)
    
    // Check if user has completed social engagement (i.e., has purchased before)
    const hasCompleted = await contract.hasCompletedSocialEngagement(userAddress)
    
    return hasCompleted
    
  } catch (error) {
    console.error('Error checking user purchase status:', error)
    // If we can't check, assume they haven't purchased yet
    return false
  }
}


// Helper function to generate purchase signature using EIP-712
async function generatePurchaseSignature(
  userAddress: string,
  poolAddress: string,
  deadline: number,
  chainId: number
): Promise<string | null> {
  try {
    // Get the private key for signing (should be stored securely in environment variables)
    const signingKey = Deno.env.get('SIGNATURE_PRIVATE_KEY')
    
    if (!signingKey) {
      console.error('Signature private key not configured')
      return null
    }

    // Get the Social Engagement Manager contract address for this network
    const socialEngagementManagerAddress = getContractAddress(chainId, 'socialEngagementManager');
    if (!socialEngagementManagerAddress) {
      console.error(`Social Engagement Manager address not configured for chain ${chainId}`)
      return null
    }

    // Create wallet from private key
    const wallet = new ethers.Wallet(signingKey)
    
    // EIP-712 domain
    const domain = {
      name: 'Dropr Social Verification',
      version: '1',
      chainId: chainId, // Use the actual chainId for network-specific signatures
      verifyingContract: socialEngagementManagerAddress
    }
    
    // EIP-712 types (without nonce)
    const types = {
      SocialVerification: [
        { name: 'user', type: 'address' },
        { name: 'pool', type: 'address' },
        { name: 'deadline', type: 'uint256' }
      ]
    }
    
    // Message to sign (without nonce)
    const message = {
      user: userAddress,
      pool: poolAddress,
      deadline: deadline
    }
    
    // Sign with EIP-712
    const signature = await wallet._signTypedData(domain, types, message)
    
    return signature
    
  } catch (error) {
    console.error('Error generating signature:', error)
    return null
  }
}

// Helper function to validate Ethereum address
function isValidEthereumAddress(address: string): boolean {
  // Basic Ethereum address validation
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
  return ethAddressRegex.test(address)
}

// Helper function to verify signature (for future use)
async function verifyPurchaseSignature(
  signature: string,
  userAddress: string,
  raffleId: string,
  raffleAddress?: string,
  slotCount: number = 1
): Promise<boolean> {
  try {
    const signingKey = Deno.env.get('SIGNATURE_PRIVATE_KEY')
    
    if (!signingKey) {
      return false
    }

    // Parse signature components
    const [signatureHash, timestamp, nonce] = signature.split(':')
    
    if (!signatureHash || !timestamp || !nonce) {
      return false
    }

    // Recreate the original message
    const messageComponents = [
      userAddress.toLowerCase(),
      raffleId,
      raffleAddress?.toLowerCase() || '',
      slotCount.toString(),
      timestamp,
      nonce
    ]
    
    const message = messageComponents.join('|')
    
    // Generate expected signature
    const encoder = new TextEncoder()
    const data = encoder.encode(message + signingKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return signatureHash === expectedSignature
    
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}