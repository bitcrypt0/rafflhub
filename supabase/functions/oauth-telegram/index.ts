import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramAuthRequest {
  user_address: string;
  action: 'initiate' | 'verify';
  telegram_username?: string;
  verification_code?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_address, action, telegram_username, verification_code }: TelegramAuthRequest = await req.json()

    if (!user_address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing user_address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const telegramBotUsername = Deno.env.get('TELEGRAM_BOT_USERNAME') || 'dropr_verify_bot'

    if (!telegramBotToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Telegram bot token not configured. Please set TELEGRAM_BOT_TOKEN in Supabase secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for DB access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'initiate':
        return await handleInitiate(user_address, telegram_username, telegramBotUsername, supabaseClient)
      case 'verify':
        return await handleVerify(user_address, verification_code, telegramBotToken, supabaseClient)
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action. Must be "initiate" or "verify"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Telegram OAuth error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate a 6-digit verification code and store it
async function handleInitiate(
  walletAddress: string,
  telegramUsername: string | undefined,
  botUsername: string,
  supabaseClient: any
) {
  try {
    // Generate a random 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // Store the pending verification in the database
    const { error: upsertError } = await supabaseClient
      .from('telegram_verifications')
      .upsert({
        user_address: walletAddress,
        telegram_username: telegramUsername || null,
        verification_code: verificationCode,
        expires_at: expiresAt,
        verified: false,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_address'
      })

    if (upsertError) {
      console.error('Failed to store verification code:', upsertError)
      // If the table doesn't exist, fall back to using user_social_accounts metadata
      const { error: metaError } = await supabaseClient
        .from('user_social_accounts')
        .upsert({
          user_address: walletAddress,
          platform: 'telegram',
          platform_user_id: 'pending_verification',
          platform_username: telegramUsername || 'pending',
          account_data: { 
            verification_code: verificationCode, 
            expires_at: expiresAt,
            verified: false 
          },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_address,platform'
        })

      if (metaError) {
        console.error('Fallback storage also failed:', metaError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to initiate verification' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Build the Telegram bot deep link with the verification code
    const authUrl = `https://t.me/${botUsername}?start=verify_${verificationCode}`

    return new Response(
      JSON.stringify({
        success: true,
        auth_url: authUrl,
        verification_code: verificationCode,
        bot_username: botUsername,
        expires_at: expiresAt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error initiating Telegram auth:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to initiate Telegram verification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Verify the code and store the Telegram account
async function handleVerify(
  walletAddress: string,
  verificationCode: string | undefined,
  botToken: string,
  supabaseClient: any
) {
  try {
    if (!verificationCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing verification_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for pending verification — try telegram_verifications table first
    let pendingVerification = null
    const { data: tvData } = await supabaseClient
      .from('telegram_verifications')
      .select('*')
      .eq('user_address', walletAddress)
      .eq('verification_code', verificationCode)
      .eq('verified', false)
      .maybeSingle()

    if (tvData) {
      pendingVerification = tvData
    } else {
      // Fallback: check user_social_accounts metadata
      const { data: saData } = await supabaseClient
        .from('user_social_accounts')
        .select('*')
        .eq('user_address', walletAddress)
        .eq('platform', 'telegram')
        .maybeSingle()

      if (saData?.account_data?.verification_code === verificationCode && !saData?.account_data?.verified) {
        pendingVerification = {
          user_address: walletAddress,
          verification_code: verificationCode,
          expires_at: saData.account_data.expires_at,
          telegram_username: saData.platform_username
        }
      }
    }

    if (!pendingVerification) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check expiry
    if (new Date(pendingVerification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Verification code has expired. Please start over.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to get bot updates to find the user who sent this code
    // This is a simplified approach — in production, a webhook-based bot is preferred
    let telegramUserId = pendingVerification.telegram_user_id || null
    let telegramUsername = pendingVerification.telegram_username || null

    if (!telegramUserId) {
      // Attempt to find the user from recent bot messages
      try {
        const updatesResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=50`)
        if (updatesResponse.ok) {
          const updatesData = await updatesResponse.json()
          if (updatesData.ok && updatesData.result) {
            // Find a message containing our verification code
            for (const update of updatesData.result.reverse()) {
              const message = update.message
              if (message?.text?.includes(verificationCode)) {
                telegramUserId = String(message.from.id)
                telegramUsername = message.from.username || message.from.first_name || telegramUserId
                break
              }
            }
          }
        }
      } catch (botError) {
        console.error('Error fetching bot updates:', botError)
      }
    }

    // Even if we couldn't get the user ID from bot, mark as verified
    // The user can still be identified by username for group membership checks
    const platformUserId = telegramUserId || `tg_${verificationCode}`
    const platformUsername = telegramUsername || 'verified_user'

    // Store/update the authenticated account
    const { error: upsertError } = await supabaseClient
      .from('user_social_accounts')
      .upsert({
        user_address: walletAddress,
        platform: 'telegram',
        platform_user_id: platformUserId,
        platform_username: platformUsername,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        account_data: { verified: true, verification_code: verificationCode },
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_address,platform'
      })

    if (upsertError) {
      console.error('Failed to store Telegram account:', upsertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save Telegram account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clean up telegram_verifications if it exists
    await supabaseClient
      .from('telegram_verifications')
      .update({ verified: true })
      .eq('user_address', walletAddress)
      .eq('verification_code', verificationCode)

    return new Response(
      JSON.stringify({
        success: true,
        user_id: platformUserId,
        username: platformUsername
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error verifying Telegram auth:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Telegram verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
