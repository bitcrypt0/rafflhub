import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwitterVerificationRequest {
  user_address: string;
  task_type: 'like' | 'retweet' | 'follow' | 'mention' | 'comment';
  task_data: {
    tweet_id?: string;
    username?: string;
    hashtag?: string;
    target?: string;
  };
  chain_id: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== Twitter Verification Started ===')
  console.log('Request method:', req.method)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))

  try {
    // Create Supabase client with service role for DB access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get the request body
    const requestBody = await req.json()
    
    const { user_address, task_type, task_data, chain_id }: TwitterVerificationRequest = requestBody

    // Validate required parameters
    if (!user_address || !task_type || !task_data || chain_id === undefined) {
      console.log('Validation failed: missing parameters', { user_address, task_type, task_data, chain_id })
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: user_address, task_type, task_data, and chain_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Validation passed, proceeding with verification')

    // Get user's Twitter credentials from database
    const { data: socialAccount, error: accountError } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_address', user_address)
      .eq('platform', 'twitter')
      .single()

    if (accountError || !socialAccount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twitter account not connected' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Twitter API configuration (bearer token only needed for mention tasks)
    const twitterBearerToken = Deno.env.get('TWITTER_BEARER_TOKEN')

    if (task_type === 'mention' && !twitterBearerToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twitter Bearer Token not configured (required for mention verification)' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Normalize task_data: frontend sends { target: "value" } but edge function
    // expects task-specific fields (username, tweet_id, hashtag).
    // Map 'target' to the correct field based on task_type.
    const normalizedTaskData = { ...task_data };
    if (task_data.target && !task_data.username && !task_data.tweet_id && !task_data.hashtag) {
      switch (task_type) {
        case 'follow':
          normalizedTaskData.username = task_data.target.replace('@', '');
          break;
        case 'like':
        case 'retweet':
        case 'comment':
          normalizedTaskData.tweet_id = extractTweetIdFromUrl(task_data.target);
          break;
        case 'mention':
          normalizedTaskData.hashtag = task_data.target;
          break;
      }
    }

    let verificationResult = false
    let verificationDetails = {}

    // Perform verification based on task type
    switch (task_type) {
      case 'like':
        // Handle pending accounts by fetching user ID from access token
        let likeUserId = socialAccount.platform_user_id;
        if (likeUserId === 'pending') {
          console.log('Account has pending user_id, fetching from access token');
          likeUserId = await getUserIdFromAccessToken(socialAccount.access_token);
          if (!likeUserId) {
            console.log('Unable to fetch user ID due to rate limiting, returning rate limit error');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Twitter API rate limit exceeded. Please wait a few minutes and try verifying again.',
                retry_after: 300
              }),
              { 
                status: 429, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
        
        verificationResult = await verifyTwitterLike(
          socialAccount.access_token,  // Use user's OAuth token instead of app token
          likeUserId,
          normalizedTaskData.tweet_id!
        )
        verificationDetails = { tweet_id: normalizedTaskData.tweet_id }
        break

      case 'retweet':
        // Handle pending accounts by fetching user ID from access token
        let retweetUserId = socialAccount.platform_user_id;
        if (retweetUserId === 'pending') {
          console.log('Account has pending user_id, fetching from access token');
          retweetUserId = await getUserIdFromAccessToken(socialAccount.access_token);
          if (!retweetUserId) {
            console.log('Unable to fetch user ID due to rate limiting, returning rate limit error');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Twitter API rate limit exceeded. Please wait a few minutes and try verifying again.',
                retry_after: 300
              }),
              { 
                status: 429, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
        
        verificationResult = await verifyTwitterRetweet(
          socialAccount.access_token,  // Use user's OAuth token instead of app token
          retweetUserId,
          normalizedTaskData.tweet_id!
        )
        verificationDetails = { tweet_id: normalizedTaskData.tweet_id }
        break

      case 'follow':
        // Handle pending accounts by fetching user ID from access token
        let userId = socialAccount.platform_user_id;
        if (userId === 'pending') {
          console.log('Account has pending user_id, fetching from access token');
          userId = await getUserIdFromAccessToken(socialAccount.access_token);
          if (!userId) {
            console.log('Unable to fetch user ID due to rate limiting, returning rate limit error');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Twitter API rate limit exceeded. Please wait a few minutes and try verifying again.',
                retry_after: 300 // Suggest retry after 5 minutes
              }),
              { 
                status: 429, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
        
        verificationResult = await verifyTwitterFollow(
          socialAccount.access_token,  // Use user's OAuth token instead of app token
          userId,
          normalizedTaskData.username!
        )
        verificationDetails = { username: normalizedTaskData.username }
        break

      case 'comment':
        // Handle pending accounts by fetching user ID from access token
        let commentUserId = socialAccount.platform_user_id;
        if (commentUserId === 'pending') {
          console.log('Account has pending user_id, fetching from access token');
          commentUserId = await getUserIdFromAccessToken(socialAccount.access_token);
          if (!commentUserId) {
            console.log('Unable to fetch user ID due to rate limiting, returning rate limit error');
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Twitter API rate limit exceeded. Please wait a few minutes and try verifying again.',
                retry_after: 300
              }),
              { 
                status: 429, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
        
        verificationResult = await verifyTwitterComment(
          socialAccount.access_token,  // Use user's OAuth token instead of app token
          commentUserId,
          normalizedTaskData.tweet_id!
        )
        verificationDetails = { tweet_id: normalizedTaskData.tweet_id }
        break

      case 'mention':
        verificationResult = await verifyTwitterMention(
          twitterBearerToken!,
          socialAccount.platform_username,
          normalizedTaskData.hashtag!
        )
        verificationDetails = { hashtag: normalizedTaskData.hashtag }
        break

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid task type' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    return new Response(
      JSON.stringify({
        success: verificationResult,
        platform: 'twitter',
        task_type,
        verification_details: verificationDetails,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Twitter verification error:', error)
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

// Extract tweet ID from a Twitter/X URL or return raw value if already an ID
function extractTweetIdFromUrl(input: string): string {
  if (!input) return input;
  // If it's already a numeric ID, return as-is
  if (/^\d+$/.test(input)) return input;
  // Try to extract from URL: https://twitter.com/user/status/123456 or https://x.com/user/status/123456
  const match = input.match(/(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/);
  return match ? match[1] : input;
}

// Helper functions for Twitter API verification
async function verifyTwitterLike(bearerToken: string, userId: string, tweetId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}/liking_users`, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Twitter API error:', await response.text())
      return false
    }

    const data = await response.json()
    return data.data?.some((user: any) => user.id === userId) || false
  } catch (error) {
    console.error('Error verifying Twitter like:', error)
    return false
  }
}

async function verifyTwitterRetweet(bearerToken: string, userId: string, tweetId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}/retweeted_by`, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Twitter API error:', await response.text())
      return false
    }

    const data = await response.json()
    return data.data?.some((user: any) => user.id === userId) || false
  } catch (error) {
    console.error('Error verifying Twitter retweet:', error)
    return false
  }
}

async function getUserIdFromAccessToken(accessToken: string): Promise<string | null> {
  const maxRetries = 3;
  const baseDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetching user ID from access token, attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Successfully fetched user ID from access token');
        return data.data?.id || null
      } else if (response.status === 429) {
        // Rate limited - wait and retry
        if (attempt === maxRetries) {
          console.error('Rate limited on final attempt, giving up');
          return null;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Rate limited, retry ${attempt}/${maxRetries} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        console.error('Error fetching user ID from access token:', await response.text());
        return null;
      }
    } catch (error) {
      console.error('Error getting user ID from access token:', error);
      if (attempt === maxRetries) {
        return null;
      }
      // Wait before retrying on network errors
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

async function verifyTwitterFollow(accessToken: string, userId: string, targetUsername: string): Promise<boolean> {
  try {
    console.log(`Verifying follow: user ${userId} -> @${targetUsername}`);

    // Step 1: Resolve target username to user ID
    const userResponse = await fetch(`https://api.twitter.com/2/users/by/username/${targetUsername}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error(`Twitter API error resolving username @${targetUsername}:`, userResponse.status, errorText);
      return false
    }

    const userData = await userResponse.json()
    const targetUserId = userData.data?.id

    if (!targetUserId) {
      console.error(`Could not resolve user ID for @${targetUsername}`);
      return false
    }

    console.log(`Resolved @${targetUsername} to user ID ${targetUserId}`);

    // Step 2: Check following list using GET /2/users/{id}/following with pagination
    // The endpoint GET /2/users/{id}/following/{target_id} does NOT exist in Twitter API v2.
    // We must paginate through the following list.
    let paginationToken: string | undefined = undefined;
    const maxPages = 5; // Safety limit: check up to 5000 followings

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        'max_results': '1000',
        'user.fields': 'id'
      });
      if (paginationToken) {
        params.set('pagination_token', paginationToken);
      }

      const followingResponse = await fetch(
        `https://api.twitter.com/2/users/${userId}/following?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!followingResponse.ok) {
        const errorText = await followingResponse.text();
        console.error(`Twitter API error checking following list (page ${page + 1}):`, followingResponse.status, errorText);
        return false;
      }

      const followingData = await followingResponse.json();

      // Check if target user is in this page
      if (followingData.data?.some((user: any) => user.id === targetUserId)) {
        console.log(`Follow verified: user ${userId} follows @${targetUsername}`);
        return true;
      }

      // Check for more pages
      paginationToken = followingData.meta?.next_token;
      if (!paginationToken) {
        break; // No more pages
      }
    }

    console.log(`Follow NOT verified: user ${userId} does not follow @${targetUsername}`);
    return false;
  } catch (error) {
    console.error('Error verifying Twitter follow:', error)
    return false
  }
}

async function verifyTwitterComment(bearerToken: string, userId: string, tweetId: string): Promise<boolean> {
  try {
    // Search for replies from the user to the specific tweet
    // Twitter API v2: Get conversation replies
    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${tweetId} from_user_id:${userId}&tweet.fields=conversation_id,in_reply_to_user_id&max_results=10`,
      {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error('Twitter API error:', await response.text())
      return false
    }

    const data = await response.json()
    
    // Check if there are any replies from the user to this tweet
    if (data.data && data.data.length > 0) {
      // Verify that at least one reply is actually to the target tweet
      return data.data.some((tweet: any) => tweet.conversation_id === tweetId)
    }
    
    return false
  } catch (error) {
    console.error('Error verifying Twitter comment:', error)
    return false
  }
}

async function verifyTwitterMention(bearerToken: string, username: string, hashtag: string): Promise<boolean> {
  try {
    const query = `from:${username} ${hashtag}`
    const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10`, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Twitter API error:', await response.text())
      return false
    }

    const data = await response.json()
    return (data.meta?.result_count || 0) > 0
  } catch (error) {
    console.error('Error verifying Twitter mention:', error)
    return false
  }
}