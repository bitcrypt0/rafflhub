import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramVerificationRequest {
  user_id: string;
  task_type: 'join_group';
  task_data: {
    chat_id: string;
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

    const { user_id, task_type, task_data }: TelegramVerificationRequest = await req.json()

    // Get user's Telegram credentials from database
    const { data: socialAccount, error: accountError } = await supabaseClient
      .from('user_social_accounts')
      .select('*')
      .eq('user_id', user_id)
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

    let verificationResult = false
    let verificationDetails = {}

    // Perform verification based on task type
    switch (task_type) {
      case 'join_group':
        verificationResult = await verifyTelegramGroupMembership(
          telegramBotToken,
          task_data.chat_id,
          socialAccount.platform_user_id
        )
        verificationDetails = { chat_id: task_data.chat_id }
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