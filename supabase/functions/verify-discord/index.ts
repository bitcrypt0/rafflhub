import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiscordVerificationRequest {
  user_address: string;
  task_type: string;
  task_data: {
    server_id?: string;
    role_id?: string;
    target?: string;
  };
  chain_id: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for DB access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_address, task_type, task_data, chain_id }: DiscordVerificationRequest = await req.json()

    // Validate required parameters
    if (!user_address || !task_type || !task_data || chain_id === undefined) {
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

    // Get user's Discord credentials from database
    const { data: socialAccount, error: accountError } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_address', user_address)
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

    // Normalize task_type: frontend sends 'join' but edge function expects 'join_server'
    const normalizedTaskType = normalizeTaskType(task_type);

    // Normalize task_data: frontend sends { target: "https://discord.gg/abc" }
    // but edge function expects { server_id: "..." }
    let serverId = task_data.server_id;
    if (!serverId && task_data.target) {
      const inviteCode = extractDiscordInviteCode(task_data.target);
      if (inviteCode) {
        serverId = await resolveDiscordInviteToGuildId(inviteCode);
        if (!serverId) {
          console.error(`Could not resolve Discord invite code: ${inviteCode}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Could not resolve Discord invite link. Please ensure the invite link is valid.' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        serverId = task_data.target;
      }
    }

    if (!serverId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not determine Discord server ID from task data' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let verificationResult = false
    let verificationDetails = {}

    // Perform verification based on normalized task type
    switch (normalizedTaskType) {
      case 'join_server':
        verificationResult = await verifyDiscordServerMembership(
          discordBotToken,
          serverId,
          socialAccount.platform_user_id
        )
        verificationDetails = { server_id: serverId }
        break

      case 'verify_role':
        verificationResult = await verifyDiscordRole(
          discordBotToken,
          serverId,
          socialAccount.platform_user_id,
          task_data.role_id!
        )
        verificationDetails = { 
          server_id: serverId, 
          role_id: task_data.role_id 
        }
        break

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Invalid task type: ${task_type}` 
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

// Normalize task type from frontend format to edge function format
function normalizeTaskType(taskType: string): string {
  switch (taskType?.toLowerCase()) {
    case 'join':
    case 'join_server':
    case 'discord_join':
      return 'join_server';
    case 'role':
    case 'verify_role':
    case 'discord_role':
      return 'verify_role';
    default:
      return taskType;
  }
}

// Extract invite code from a Discord invite URL
function extractDiscordInviteCode(input: string): string | null {
  if (!input) return null;
  const match = input.match(/(?:discord\.gg|discord\.com\/invite)\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

// Resolve a Discord invite code to a guild (server) ID using the public API
async function resolveDiscordInviteToGuildId(inviteCode: string): Promise<string | null> {
  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${inviteCode}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      console.error('Failed to resolve Discord invite:', await response.text());
      return null;
    }
    const data = await response.json();
    return data.guild?.id || null;
  } catch (error) {
    console.error('Error resolving Discord invite:', error);
    return null;
  }
}

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