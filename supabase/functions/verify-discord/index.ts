import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiscordVerificationRequest {
  user_id: string;
  task_type: 'join_server' | 'verify_role';
  task_data: {
    server_id: string;
    role_id?: string;
  };
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

    const { user_id, task_type, task_data }: DiscordVerificationRequest = await req.json()

    // Get user's Discord credentials from database
    const { data: socialAccount, error: accountError } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'discord')
      .single()

    if (accountError || !socialAccount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Discord account not connected' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Discord Bot Token
    const discordBotToken = Deno.env.get('DISCORD_BOT_TOKEN')

    if (!discordBotToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Discord bot token not configured' 
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
      case 'join_server':
        verificationResult = await verifyDiscordServerMembership(
          discordBotToken,
          task_data.server_id,
          socialAccount.platform_user_id
        )
        verificationDetails = { server_id: task_data.server_id }
        break

      case 'verify_role':
        verificationResult = await verifyDiscordRole(
          discordBotToken,
          task_data.server_id,
          socialAccount.platform_user_id,
          task_data.role_id!
        )
        verificationDetails = { 
          server_id: task_data.server_id, 
          role_id: task_data.role_id 
        }
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
        platform: 'discord',
        task_type,
        verification_details: verificationDetails,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Discord verification error:', error)
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

// Helper functions for Discord API verification
async function verifyDiscordServerMembership(botToken: string, serverId: string, userId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}/members/${userId}`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    })

    // If the user is a member, the API returns 200
    // If not a member, it returns 404
    return response.ok
  } catch (error) {
    console.error('Error verifying Discord server membership:', error)
    return false
  }
}

async function verifyDiscordRole(botToken: string, serverId: string, userId: string, roleId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}/members/${userId}`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Discord API error:', await response.text())
      return false
    }

    const memberData = await response.json()
    const userRoles = memberData.roles || []
    
    return userRoles.includes(roleId)
  } catch (error) {
    console.error('Error verifying Discord role:', error)
    return false
  }
}

// Additional helper function to get server information (useful for debugging)
async function getDiscordServerInfo(botToken: string, serverId: string) {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${serverId}`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Discord API error getting server info:', await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error getting Discord server info:', error)
    return null
  }
}