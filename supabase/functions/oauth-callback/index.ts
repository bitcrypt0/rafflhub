// DEPRECATED: This generic oauth-callback function is replaced by platform-specific functions:
//   - oauth-twitter
//   - oauth-discord
//   - oauth-telegram
// This file can be safely deleted once all deployments are confirmed working.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'This endpoint is deprecated. Use platform-specific OAuth endpoints instead.' 
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

// Original interface kept for reference only
interface OAuthCallbackRequest {
  platform: 'twitter' | 'discord' | 'telegram';
  code?: string;
  state?: string;
  oauth_token?: string;
  oauth_verifier?: string;
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

    const { platform, code, state, oauth_token, oauth_verifier }: OAuthCallbackRequest = await req.json()

    let authResult = null

    // Handle OAuth callback based on platform
    switch (platform) {
      case 'twitter':
        authResult = await handleTwitterCallback(code, state, oauth_token, oauth_verifier)
        break
      case 'discord':
        authResult = await handleDiscordCallback(code, state)
        break
      case 'telegram':
        authResult = await handleTelegramCallback(code, state)
        break
      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid platform' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    if (!authResult || !authResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: authResult?.error || 'Authentication failed' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Store or update social account in database
    const { data: existingAccount } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    const accountData = {
      user_id: user.id,
      platform,
      platform_user_id: authResult.user_id,
      platform_username: authResult.username,
      access_token: authResult.access_token,
      refresh_token: authResult.refresh_token,
      token_expires_at: authResult.expires_at,
      profile_data: authResult.profile_data || {},
      updated_at: new Date().toISOString()
    }

    let socialAccount
    if (existingAccount) {
      // Update existing account
      const { data, error } = await supabaseClient
        .from('user_social_accounts')
        .update(accountData)
        .eq('id', existingAccount.id)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating social account:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update account' 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      socialAccount = data
    } else {
      // Create new account
      const { data, error } = await supabaseClient
        .from('user_social_accounts')
        .insert({
          ...accountData,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating social account:', error)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to create account' 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      socialAccount = data
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform,
        account: {
          id: socialAccount.id,
          platform,
          username: socialAccount.platform_username,
          user_id: socialAccount.platform_user_id,
          connected_at: socialAccount.created_at
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('OAuth callback error:', error)
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

// Twitter OAuth callback handler
async function handleTwitterCallback(
  code?: string, 
  state?: string, 
  oauth_token?: string, 
  oauth_verifier?: string
) {
  try {
    const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID')
    const twitterClientSecret = Deno.env.get('TWITTER_CLIENT_SECRET')
    const twitterRedirectUri = Deno.env.get('TWITTER_REDIRECT_URI')

    if (!twitterClientId || !twitterClientSecret || !twitterRedirectUri) {
      return { success: false, error: 'Twitter OAuth credentials not configured' }
    }

    // Handle OAuth 2.0 flow (newer Twitter API)
    if (code) {
      const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${twitterClientId}:${twitterClientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: twitterRedirectUri,
          code_verifier: state || '' // PKCE verifier
        })
      })

      if (!tokenResponse.ok) {
        console.error('Twitter token exchange failed:', await tokenResponse.text())
        return { success: false, error: 'Token exchange failed' }
      }

      const tokenData = await tokenResponse.json()

      // Get user profile
      const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      })

      if (!userResponse.ok) {
        console.error('Twitter user fetch failed:', await userResponse.text())
        return { success: false, error: 'Failed to fetch user profile' }
      }

      const userData = await userResponse.json()

      return {
        success: true,
        user_id: userData.data.id,
        username: userData.data.username,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        profile_data: userData.data
      }
    }

    return { success: false, error: 'Invalid Twitter OAuth parameters' }
  } catch (error) {
    console.error('Twitter OAuth error:', error)
    return { success: false, error: 'Twitter authentication failed' }
  }
}

// Discord OAuth callback handler
async function handleDiscordCallback(code?: string, state?: string) {
  try {
    const discordClientId = Deno.env.get('DISCORD_CLIENT_ID')
    const discordClientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')
    const discordRedirectUri = Deno.env.get('DISCORD_REDIRECT_URI')

    if (!discordClientId || !discordClientSecret || !discordRedirectUri || !code) {
      return { success: false, error: 'Discord OAuth credentials not configured or code missing' }
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: discordRedirectUri
      })
    })

    if (!tokenResponse.ok) {
      console.error('Discord token exchange failed:', await tokenResponse.text())
      return { success: false, error: 'Token exchange failed' }
    }

    const tokenData = await tokenResponse.json()

    // Get user profile
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    })

    if (!userResponse.ok) {
      console.error('Discord user fetch failed:', await userResponse.text())
      return { success: false, error: 'Failed to fetch user profile' }
    }

    const userData = await userResponse.json()

    return {
      success: true,
      user_id: userData.id,
      username: userData.username,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
      profile_data: userData
    }
  } catch (error) {
    console.error('Discord OAuth error:', error)
    return { success: false, error: 'Discord authentication failed' }
  }
}

// Telegram OAuth callback handler
async function handleTelegramCallback(code?: string, state?: string) {
  try {
    // Telegram uses a different OAuth flow via Telegram Login Widget
    // This is a simplified implementation - in practice, you'd verify the hash
    // and handle the Telegram-specific authentication flow
    
    return { success: false, error: 'Telegram OAuth not implemented - use Telegram Login Widget' }
  } catch (error) {
    console.error('Telegram OAuth error:', error)
    return { success: false, error: 'Telegram authentication failed' }
  }
}