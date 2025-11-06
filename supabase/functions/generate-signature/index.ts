import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@5.7.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignatureRequest {
  user_address: string;
  raffle_id: string;
  raffle_address?: string;
  slot_count?: number;
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

    const { user_address, raffle_id, raffle_address, slot_count = 1 }: SignatureRequest = await req.json()

    // Validate required parameters
    if (!user_address || !raffle_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: user_address and raffle_id' 
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

    // Get current nonce for this user-pool pair from the blockchain
    // Note: In production, you'd query the blockchain directly
    // For now, we'll track nonces in the database
    const { data: nonceData, error: nonceError } = await supabaseClient
      .from('user_nonces')
      .select('nonce')
      .eq('user_address', user_address.toLowerCase())
      .eq('pool_address', (raffle_address || raffle_id).toLowerCase())
      .single()

    let currentNonce = 0
    if (nonceData) {
      currentNonce = nonceData.nonce
    } else {
      // Initialize nonce for this user-pool pair
      await supabaseClient
        .from('user_nonces')
        .insert({
          user_address: user_address.toLowerCase(),
          pool_address: (raffle_address || raffle_id).toLowerCase(),
          nonce: 0
        })
    }

    // Generate deadline (15 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + (15 * 60)

    // Generate signature
    const signature = await generatePurchaseSignature(
      user_address,
      raffle_address || raffle_id,
      currentNonce,
      deadline
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
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes expiry
        metadata: {
          generated_at: new Date().toISOString(),
          verification_records: verificationRecords.length
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
        nonce: currentNonce,
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

// Helper function to generate purchase signature using EIP-712
async function generatePurchaseSignature(
  userAddress: string,
  poolAddress: string,
  nonce: number,
  deadline: number
): Promise<string | null> {
  try {
    // Get the private key for signing (should be stored securely in environment variables)
    const signingKey = Deno.env.get('SIGNATURE_PRIVATE_KEY')
    
    if (!signingKey) {
      console.error('Signature private key not configured')
      return null
    }

    // Get the Social Engagement Manager contract address
    const socialEngagementManagerAddress = Deno.env.get('SOCIAL_ENGAGEMENT_MANAGER_ADDRESS')
    if (!socialEngagementManagerAddress) {
      console.error('Social Engagement Manager address not configured')
      return null
    }

    // Get chain ID from environment
    const chainId = parseInt(Deno.env.get('CHAIN_ID') || '84532') // Default to Base Sepolia

    // Create wallet from private key
    const wallet = new ethers.Wallet(signingKey)
    
    // EIP-712 domain
    const domain = {
      name: 'FairPad Social Verification',
      version: '1',
      chainId: chainId,
      verifyingContract: socialEngagementManagerAddress
    }
    
    // EIP-712 types
    const types = {
      SocialVerification: [
        { name: 'user', type: 'address' },
        { name: 'pool', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    }
    
    // Message to sign
    const message = {
      user: userAddress,
      pool: poolAddress,
      nonce: nonce,
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