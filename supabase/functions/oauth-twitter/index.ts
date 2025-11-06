import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwitterOAuthRequest {
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
    // Get Twitter OAuth credentials from environment
    const twitterClientId = Deno.env.get('TWITTER_CLIENT_ID')
    const twitterClientSecret = Deno.env.get('TWITTER_CLIENT_SECRET')
    const twitterRedirectUri = Deno.env.get('TWITTER_REDIRECT_URI') || 'http://localhost:54321/functions/v1/oauth-twitter/callback'

    if (!twitterClientId || !twitterClientSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twitter OAuth credentials not configured. Please set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in Supabase secrets.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle GET request (OAuth callback from Twitter)
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        return new Response(
          `<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p><p>You can close this window.</p></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
      }

      if (!code || !state) {
        return new Response(
          `<html><body><h1>Authentication Failed</h1><p>Missing authorization code or state.</p><p>You can close this window.</p></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
      }

      // Create Supabase client with service role key for callback
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      )

      // Decode state to get wallet address
      let walletAddress = ''
      try {
        const stateData = JSON.parse(atob(state))
        walletAddress = stateData.wallet_address
        
        // Validate wallet address exists
        if (!walletAddress) {
          return new Response(
            `<html><body><h1>Authentication Failed</h1><p>Missing wallet address in state.</p><p>You can close this window.</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          )
        }
      } catch (e) {
        return new Response(
          `<html><body><h1>Authentication Failed</h1><p>Invalid state parameter.</p><p>You can close this window.</p></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
      }

      const result = await handleCallback(code, state, walletAddress, twitterClientId, twitterClientSecret, twitterRedirectUri, supabaseClient)
      
      // Return HTML response for browser
      const resultData = await result.json()
      if (resultData.success) {
        return new Response(
          `<html><body><h1>Authentication Successful!</h1><p>Twitter account connected: @${resultData.username}</p><p>You can close this window and return to the app.</p><script>window.close();</script></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
      } else {
        return new Response(
          `<html><body><h1>Authentication Failed</h1><p>Error: ${resultData.error}</p><p>You can close this window.</p></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
      }
    }

    // Handle POST request (API calls from frontend)
    const { user_address, action, code, state, refresh_token }: TwitterOAuthRequest = await req.json()

    // Handle different actions
    switch (action) {
      case 'initiate':
        return await handleInitiate(user_address, twitterClientId, twitterRedirectUri)
      
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
          return await handleCallback(code, state, user_address, twitterClientId, twitterClientSecret, twitterRedirectUri, supabaseClient)
        } else {
          return await handleRefresh(refresh_token, user_address, twitterClientId, twitterClientSecret, supabaseClient)
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
    console.error('Twitter OAuth error:', error)
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

// Initiate Twitter OAuth flow
async function handleInitiate(walletAddress: string, clientId: string, redirectUri: string) {
  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateRandomString(128)
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    
    // Store code verifier temporarily (in production, use a secure session store)
    const state = btoa(JSON.stringify({
      wallet_address: walletAddress,
      code_verifier: codeVerifier,
      timestamp: Date.now()
    }))

    // Build Twitter OAuth URL
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read users.read follows.read like.read offline.access',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    })

    const authUrl = `https://twitter.com/i/oauth2/authorize?${authParams.toString()}`

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
    console.error('Error initiating Twitter OAuth:', error)
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

// Handle Twitter OAuth callback
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
    console.log('=== OAuth Callback Started ===');
    console.log('Code present:', !!code);
    console.log('State present:', !!state);
    console.log('Wallet address:', walletAddress);
    
    if (!code || !state) {
      console.error('Missing code or state parameter');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing code or state parameter' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Decode state to get code verifier
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
      console.log('State decoded successfully:', { ...stateData, code_verifier: '***' });
    } catch (e) {
      console.error('Failed to decode state:', e);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid state parameter' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const codeVerifier = stateData.code_verifier
    if (!codeVerifier) {
      console.error('Missing code_verifier in state');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing code verifier in state' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Exchanging authorization code for access token...');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Twitter token exchange failed:', errorText)
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

    console.log('Token exchange successful, fetching user profile...');

    const tokenData = await tokenResponse.json()

    // Get user profile with retry mechanism for rate limiting
    let userResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (userResponse.ok) {
        console.log('User profile fetched successfully');
        break;
      }

      if (userResponse.status === 429) {
        retryCount++;
        const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`Rate limited, retry ${retryCount}/${maxRetries} in ${waitTime}ms...`);
        
        if (retryCount >= maxRetries) {
          const errorText = await userResponse.text()
          console.error('Twitter user fetch failed after retries:', errorText)
          
          // Fallback: Store minimal account data without profile, will fetch later
          console.log('Using fallback: storing minimal account data without profile');
          
          const minimalAccountData = {
            user_address: walletAddress,
            platform: 'twitter',
            platform_user_id: 'pending', // Will be updated when profile fetch succeeds
            platform_username: 'pending', // Will be updated when profile fetch succeeds
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: tokenData.expires_in 
              ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() 
              : null,
            account_data: { status: 'profile_pending' },
            updated_at: new Date().toISOString()
          };

          try {
            const fallbackResult = await supabaseClient
              .from('user_social_accounts')
              .upsert(minimalAccountData, {
                onConflict: 'user_address,platform'
              });

            if (fallbackResult.error) {
              console.error('Fallback storage failed:', fallbackResult.error);
              return new Response(
                JSON.stringify({ 
                  success: false, 
                  error: 'Twitter API rate limit exceeded and fallback storage failed' 
                }),
                { 
                  status: 429, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              )
            }

            console.log('Fallback storage successful');
            return new Response(
              JSON.stringify({ 
                success: true, 
                username: 'pending',
                message: 'Account connected successfully. Profile will be updated shortly.' 
              }),
              { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Twitter API rate limit exceeded. Please try again in a few minutes.' 
              }),
              { 
                status: 429, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Other errors
      const errorText = await userResponse.text()
      console.error('Twitter user fetch failed:', errorText)
      
      let errorMessage = 'Failed to fetch user profile'
      if (userResponse.status === 401) {
        errorMessage = 'Twitter authorization failed. Please try again.'
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage 
        }),
        { 
          status: userResponse.status === 429 ? 429 : 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User profile fetched successfully, storing in database...');

    const userData = await userResponse.json()

    // Store or update in database
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() 
      : null

    const { data: existingAccount, error: fetchError } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_address', walletAddress)
      .eq('platform', 'twitter')
      .maybeSingle()

    console.log('Existing account check result:', { existingAccount, fetchError });

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing account:', fetchError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database error while checking existing account' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const accountData = {
      user_address: walletAddress,
      platform: 'twitter',
      platform_user_id: userData.data.id,
      platform_username: userData.data.username,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      account_data: userData.data,
      updated_at: new Date().toISOString()
    }

    let dbResult;
    if (existingAccount) {
      console.log('Updating existing account:', existingAccount.id);
      dbResult = await supabaseClient
        .from('user_social_accounts')
        .update(accountData)
        .eq('id', existingAccount.id)
    } else {
      console.log('Creating new account for user:', walletAddress);
      dbResult = await supabaseClient
        .from('user_social_accounts')
        .insert({
          ...accountData,
          created_at: new Date().toISOString()
        })
    }

    console.log('Database operation result:', { success: !dbResult.error, error: dbResult.error });

    // Check for database errors
    if (dbResult.error) {
      console.error('Database error:', dbResult.error)
      
      let errorMessage = `Database error: ${dbResult.error.message}`
      let statusCode = 500
      
      // Handle specific constraint violations
      if (dbResult.error.code === '23505') {
        // Duplicate key constraint - try to update instead
        if (dbResult.error.message.includes('platform_platform_user_id_key')) {
          console.log('Duplicate user detected, attempting to update existing record')
          const updateResult = await supabaseClient
            .from('user_social_accounts')
            .update(accountData)
            .eq('platform', 'twitter')
            .eq('platform_user_id', userData.data.id)
          
          if (updateResult.error) {
            errorMessage = 'Failed to update existing Twitter account'
          } else {
            // Update succeeded, continue with success response
            return new Response(
              JSON.stringify({ 
                success: true, 
                username: userData.data.username 
              }),
              { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }
        } else {
          errorMessage = 'This social media account is already connected to another user'
          statusCode = 409
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage 
        }),
        { 
          status: statusCode, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userData.data.id,
        username: userData.data.username
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error handling Twitter callback:', error)
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
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    if (!tokenResponse.ok) {
      console.error('Twitter token refresh failed:', await tokenResponse.text())
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
      .eq('platform', 'twitter')

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
    console.error('Error refreshing Twitter token:', error)
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

// Helper: Generate random string for PKCE
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let text = ''
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

// Helper: Generate PKCE code challenge
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(digest))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
