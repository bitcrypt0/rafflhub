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
  };
  access_token: string;
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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Get the request body
    const requestBody = await req.json()
    console.log('Request body:', requestBody)
    
    const { user_address, task_type, task_data, access_token }: TwitterVerificationRequest = requestBody

    // Validate required parameters
    if (!user_address || !task_type || !task_data) {
      console.log('Validation failed: missing parameters', { user_address, task_type, task_data })
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: user_address, task_type, task_data' 
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

    // Twitter API configuration
    const twitterApiKey = Deno.env.get('TWITTER_API_KEY')
    const twitterApiSecret = Deno.env.get('TWITTER_API_SECRET')
    const twitterBearerToken = Deno.env.get('TWITTER_BEARER_TOKEN')

    if (!twitterApiKey || !twitterApiSecret || !twitterBearerToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twitter API credentials not configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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
          likeUserId = await getUserIdFromAccessToken(access_token);
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
          access_token,  // Use user's OAuth token instead of app token
          likeUserId,
          task_data.tweet_id!
        )
        verificationDetails = { tweet_id: task_data.tweet_id }
        break

      case 'retweet':
        // Handle pending accounts by fetching user ID from access token
        let retweetUserId = socialAccount.platform_user_id;
        if (retweetUserId === 'pending') {
          console.log('Account has pending user_id, fetching from access token');
          retweetUserId = await getUserIdFromAccessToken(access_token);
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
          access_token,  // Use user's OAuth token instead of app token
          retweetUserId,
          task_data.tweet_id!
        )
        verificationDetails = { tweet_id: task_data.tweet_id }
        break

      case 'follow':
        // Handle pending accounts by fetching user ID from access token
        let userId = socialAccount.platform_user_id;
        if (userId === 'pending') {
          console.log('Account has pending user_id, fetching from access token');
          userId = await getUserIdFromAccessToken(access_token);
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
          access_token,  // Use user's OAuth token instead of app token
          userId,
          task_data.username!
        )
        verificationDetails = { username: task_data.username }
        break

      case 'comment':
        // Handle pending accounts by fetching user ID from access token
        let commentUserId = socialAccount.platform_user_id;
        if (commentUserId === 'pending') {
          console.log('Account has pending user_id, fetching from access token');
          commentUserId = await getUserIdFromAccessToken(access_token);
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
          access_token,  // Use user's OAuth token instead of app token
          commentUserId,
          task_data.tweet_id!
        )
        verificationDetails = { tweet_id: task_data.tweet_id }
        break

      case 'mention':
        verificationResult = await verifyTwitterMention(
          twitterBearerToken,
          socialAccount.platform_username,
          task_data.hashtag!
        )
        verificationDetails = { hashtag: task_data.hashtag }
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

async function verifyTwitterFollow(bearerToken: string, userId: string, targetUsername: string): Promise<boolean> {
  try {
    // First get the target user's ID
    const userResponse = await fetch(`https://api.twitter.com/2/users/by/username/${targetUsername}`, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!userResponse.ok) {
      console.error('Twitter API error getting user:', await userResponse.text())
      return false
    }

    const userData = await userResponse.json()
    const targetUserId = userData.data?.id

    if (!targetUserId) {
      return false
    }

    // Check if user is following the target
    const followResponse = await fetch(`https://api.twitter.com/2/users/${userId}/following/${targetUserId}`, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    })

    return followResponse.ok
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