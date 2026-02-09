import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramVerificationRequest {
  user_address: string;
  task_type: string;
  task_data: {
    chat_id?: string;
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

    const { user_address, task_type, task_data, chain_id }: TelegramVerificationRequest = await req.json()

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

    // Get user's Telegram credentials from database
    const { data: socialAccount, error: accountError } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_address', user_address)
      .eq('platform', 'telegram')
      .single()

    if (accountError || !socialAccount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Telegram account not connected' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Telegram Bot Token
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    if (!telegramBotToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Telegram bot token not configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Normalize task_type: frontend sends 'join' but edge function expects 'join_group'
    const normalizedTaskType = normalizeTelegramTaskType(task_type);

    // Normalize task_data: frontend sends { target: "https://t.me/groupname" }
    // but edge function expects { chat_id: "@groupname" or numeric ID }
    let chatId = task_data.chat_id;
    if (!chatId && task_data.target) {
      chatId = extractTelegramChatId(task_data.target);
    }

    if (!chatId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not determine Telegram chat ID from task data' 
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
      case 'join_group':
        verificationResult = await verifyTelegramGroupMembership(
          telegramBotToken,
          chatId,
          socialAccount.platform_user_id
        )
        verificationDetails = { chat_id: chatId }
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
        platform: 'telegram',
        task_type,
        verification_details: verificationDetails,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Telegram verification error:', error)
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
function normalizeTelegramTaskType(taskType: string): string {
  switch (taskType?.toLowerCase()) {
    case 'join':
    case 'join_group':
    case 'telegram_join':
      return 'join_group';
    default:
      return taskType;
  }
}

// Extract Telegram chat ID from a t.me URL or raw input
function extractTelegramChatId(input: string): string {
  if (!input) return input;
  // Match https://t.me/groupname or t.me/groupname
  const match = input.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]+)/);
  if (match) {
    // Telegram Bot API accepts @username as chat_id for public groups/channels
    return `@${match[1]}`;
  }
  // If it starts with @, use as-is
  if (input.startsWith('@')) return input;
  // Otherwise return as-is (might be a numeric chat_id)
  return input;
}

// Helper functions for Telegram Bot API verification
async function verifyTelegramGroupMembership(botToken: string, chatId: string, userId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: parseInt(userId)
      })
    })

    if (!response.ok) {
      console.error('Telegram API error:', await response.text())
      return false
    }

    const data = await response.json()
    
    if (!data.ok) {
      console.error('Telegram API returned error:', data.description)
      return false
    }

    const memberStatus = data.result?.status
    
    // Valid member statuses that indicate the user is in the group
    const validStatuses = ['creator', 'administrator', 'member', 'restricted']
    
    return validStatuses.includes(memberStatus)
  } catch (error) {
    console.error('Error verifying Telegram group membership:', error)
    return false
  }
}

// Additional helper function to get chat information (useful for debugging)
async function getTelegramChatInfo(botToken: string, chatId: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId
      })
    })

    if (!response.ok) {
      console.error('Telegram API error getting chat info:', await response.text())
      return null
    }

    const data = await response.json()
    
    if (!data.ok) {
      console.error('Telegram API returned error:', data.description)
      return null
    }

    return data.result
  } catch (error) {
    console.error('Error getting Telegram chat info:', error)
    return null
  }
}

// Helper function to validate chat ID format
function isValidTelegramChatId(chatId: string): boolean {
  // Telegram chat IDs can be:
  // - Positive integers for private chats
  // - Negative integers for groups and supergroups
  // - Strings starting with @ for public channels/groups
  
  if (chatId.startsWith('@')) {
    return chatId.length > 1 && /^@[a-zA-Z0-9_]+$/.test(chatId)
  }
  
  const numericId = parseInt(chatId)
  return !isNaN(numericId) && numericId !== 0
}