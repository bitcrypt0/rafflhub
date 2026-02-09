import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiscordOAuthRequest {
  user_address: string;
  action: 'initiate' | 'callback' | 'refresh';
  code?: string;
  state?: string;
  refresh_token?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_address, action, code, state, refresh_token }: DiscordOAuthRequest = await req.json()

    // Get Discord OAuth credentials from environment
    const discordClientId = Deno.env.get('DISCORD_CLIENT_ID')
    const discordClientSecret = Deno.env.get('DISCORD_CLIENT_SECRET')
    const discordRedirectUri = Deno.env.get('DISCORD_REDIRECT_URI') || 'http://localhost:54321/functions/v1/oauth-discord/callback'

    if (!discordClientId || !discordClientSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Discord OAuth credentials not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in Supabase secrets.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle different actions
    switch (action) {
      case 'initiate':
        return await handleInitiate(user_address, discordClientId, discordRedirectUri)
      
      case 'callback':
      case 'refresh':
        // Create Supabase client for callback and refresh (these need database access)
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: req.headers.get('Authorization') || '' },
            },
          }
        )
        
        if (action === 'callback') {
          return await handleCallback(code, state, user_address, discordClientId, discordClientSecret, discordRedirectUri, supabaseClient)
        } else {
          return await handleRefresh(refresh_token, user_address, discordClientId, discordClientSecret, supabaseClient)
        }
      
      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid action. Must be "initiate", "callback", or "refresh"' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('Discord OAuth error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Initiate Discord OAuth flow
async function handleInitiate(walletAddress: string, clientId: string, redirectUri: string) {
  try {
    // Generate state parameter
    const state = btoa(JSON.stringify({
      user_address: walletAddress,
      timestamp: Date.now()
    }))

    // Build Discord OAuth URL
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'identify guilds guilds.members.read',
      state: state
    })

    const authUrl = `https://discord.com/api/oauth2/authorize?${authParams.toString()}`

    return new Response(
      JSON.stringify({
        success: true,
        auth_url: authUrl,
        state: state
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error initiating Discord OAuth:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to initiate OAuth flow' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

// Handle Discord OAuth callback
async function handleCallback(
  code: string | undefined,
  state: string | undefined,
  walletAddress: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  supabaseClient: any
) {
  try {
    if (!code) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing authorization code' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Discord token exchange failed:', errorText)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to exchange authorization code for token' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch user profile' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userData = await userResponse.json()

    // Store or update in database
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() 
      : null

    const { data: existingAccount } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_address', walletAddress)
      .eq('platform', 'discord')
      .single()

    const accountData = {
      user_address: walletAddress,
      platform: 'discord',
      platform_user_id: userData.id,
      platform_username: userData.username,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      profile_data: userData,
      updated_at: new Date().toISOString()
    }

    if (existingAccount) {
      await supabaseClient
        .from('user_social_accounts')
        .update(accountData)
        .eq('id', existingAccount.id)
    } else {
      await supabaseClient
        .from('user_social_accounts')
        .insert({
          ...accountData,
          created_at: new Date().toISOString()
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userData.id,
        username: userData.username
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error handling Discord callback:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to complete OAuth flow' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
    )
  }
}

// Handle token refresh
async function handleRefresh(
  refreshToken: string | undefined,
  walletAddress: string,
  clientId: string,
  clientSecret: string,
  supabaseClient: any
) {
  try {
    if (!refreshToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing refresh token' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Refresh the access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    if (!tokenResponse.ok) {
      console.error('Discord token refresh failed:', await tokenResponse.text())
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to refresh token' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const tokenData = await tokenResponse.json()

    // Update in database
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() 
      : null

    await supabaseClient
      .from('user_social_accounts')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('user_address', walletAddress)
      .eq('platform', 'discord')

    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
        expires_at: expiresAt
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error refreshing Discord token:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to refresh token' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}
