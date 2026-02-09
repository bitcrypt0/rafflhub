import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ethers } from 'https://esm.sh/ethers@5.7.2'
import { isSupportedNetwork, getContractAddress } from '../_shared/networks.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting constants
const MAX_REQUESTS_PER_MINUTE = 5    // Max signature requests per wallet per minute
const COOLDOWN_SECONDS = 2           // Minimum seconds between requests from same wallet
const SIGNATURE_VALIDITY_MINUTES = 15 // How long a signature remains valid

interface PurchaseAuthRequest {
  user_address: string;
  pool_address: string;
  chain_id: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Fail fast if signing key is missing
    const signingKey = Deno.env.get('SIGNATURE_PRIVATE_KEY')
    if (!signingKey) {
      console.error('SIGNATURE_PRIVATE_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Server signing key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for DB operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_address, pool_address, chain_id }: PurchaseAuthRequest = await req.json()

    // --- Input Validation ---
    if (!user_address || !pool_address || chain_id === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: user_address, pool_address, and chain_id' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isValidEthereumAddress(user_address)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isValidEthereumAddress(pool_address)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid pool address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isSupportedNetwork(chain_id)) {
      return new Response(
        JSON.stringify({ success: false, error: `Chain ID ${chain_id} is not supported` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Get PurchaseAuthorizer contract address ---
    const purchaseAuthorizerAddress = getContractAddress(chain_id, 'purchaseAuthorizer');
    if (!purchaseAuthorizerAddress || purchaseAuthorizerAddress === '0x...') {
      return new Response(
        JSON.stringify({ success: false, error: `PurchaseAuthorizer not deployed on chain ${chain_id}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedUserAddress = user_address.toLowerCase()
    const normalizedPoolAddress = pool_address.toLowerCase()

    // --- Anti-Bot Rate Limiting ---
    const rateLimitResult = await checkRateLimit(supabaseClient, normalizedUserAddress, normalizedPoolAddress, chain_id)
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rateLimitResult.reason,
          retry_after: rateLimitResult.retryAfter
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Generate EIP-712 Signature ---
    const deadline = Math.floor(Date.now() / 1000) + (SIGNATURE_VALIDITY_MINUTES * 60)

    const wallet = new ethers.Wallet(signingKey)

    // EIP-712 domain — must match PurchaseAuthorizer.sol constructor: EIP712("Dropr Purchase Authorization", "1")
    const domain = {
      name: 'Dropr Purchase Authorization',
      version: '1',
      chainId: chain_id,
      verifyingContract: purchaseAuthorizerAddress
    }

    // EIP-712 types — must match PurchaseAuthorizer.sol PURCHASE_TYPEHASH
    const types = {
      PurchaseAuthorization: [
        { name: 'buyer', type: 'address' },
        { name: 'pool', type: 'address' },
        { name: 'deadline', type: 'uint256' }
      ]
    }

    // Message values
    const message = {
      buyer: user_address,  // Use original case for checksum compatibility
      pool: pool_address,
      deadline: deadline
    }

    const signature = await wallet._signTypedData(domain, types, message)

    // --- Store audit record ---
    const expiresAt = new Date(Date.now() + SIGNATURE_VALIDITY_MINUTES * 60 * 1000).toISOString()

    const { error: insertError } = await supabaseClient
      .from('purchase_authorizations')
      .insert({
        user_address: normalizedUserAddress,
        pool_address: normalizedPoolAddress,
        chain_id: chain_id,
        signature,
        deadline,
        expires_at: expiresAt,
        is_used: false
      })

    if (insertError) {
      // Log but don't fail — the signature is still valid even if audit record fails
      console.error('Error storing purchase authorization record:', insertError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        deadline,
        expires_at: expiresAt,
        user_address: normalizedUserAddress,
        pool_address: normalizedPoolAddress,
        chain_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Purchase authorization error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// --- Rate Limiting ---

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

async function checkRateLimit(
  supabase: any,
  userAddress: string,
  poolAddress: string,
  chainId: number
): Promise<RateLimitResult> {
  try {
    const now = new Date()

    // Check cooldown: minimum COOLDOWN_SECONDS between requests from same wallet
    const cooldownThreshold = new Date(now.getTime() - COOLDOWN_SECONDS * 1000).toISOString()

    const { data: recentRecords, error: recentError } = await supabase
      .from('purchase_authorizations')
      .select('created_at')
      .eq('user_address', userAddress)
      .gte('created_at', cooldownThreshold)
      .order('created_at', { ascending: false })
      .limit(1)

    if (recentError) {
      console.error('Rate limit check error (cooldown):', recentError)
      // If rate limit check fails, allow the request (fail open for UX)
      return { allowed: true }
    }

    if (recentRecords && recentRecords.length > 0) {
      const lastRequestTime = new Date(recentRecords[0].created_at)
      const timeSinceLastRequest = (now.getTime() - lastRequestTime.getTime()) / 1000
      const retryAfter = Math.ceil(COOLDOWN_SECONDS - timeSinceLastRequest)
      return {
        allowed: false,
        reason: `Please wait ${retryAfter} second(s) before requesting another authorization.`,
        retryAfter
      }
    }

    // Check per-minute rate: max MAX_REQUESTS_PER_MINUTE requests per wallet per minute
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString()

    const { count, error: countError } = await supabase
      .from('purchase_authorizations')
      .select('id', { count: 'exact', head: true })
      .eq('user_address', userAddress)
      .gte('created_at', oneMinuteAgo)

    if (countError) {
      console.error('Rate limit check error (per-minute):', countError)
      return { allowed: true }
    }

    if (count !== null && count >= MAX_REQUESTS_PER_MINUTE) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Maximum ${MAX_REQUESTS_PER_MINUTE} authorization requests per minute.`,
        retryAfter: 60
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Fail open — don't block legitimate users if rate limiter has issues
    return { allowed: true }
  }
}

// --- Helpers ---

function isValidEthereumAddress(address: string): boolean {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
  return ethAddressRegex.test(address)
}
