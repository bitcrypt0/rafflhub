import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CleanupStats {
  signatures_deleted: number;
  old_nonces_deleted: number;
  old_verifications_deleted: number;
  total_deleted: number;
  execution_time_ms: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Verify this is a scheduled/authorized request
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    // Allow requests from Supabase cron or with valid secret
    const isAuthorized = authHeader === `Bearer ${cronSecret}` || 
                        req.headers.get('x-supabase-cron') === 'true'
    
    if (!isAuthorized && cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const stats: CleanupStats = {
      signatures_deleted: 0,
      old_nonces_deleted: 0,
      old_verifications_deleted: 0,
      total_deleted: 0,
      execution_time_ms: 0
    }

    // 1. Clean up expired purchase signatures (older than expires_at)
    console.log('Cleaning up expired purchase signatures...')
    const { data: expiredSignatures, error: sigError } = await supabase
      .from('purchase_signatures')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (sigError) {
      console.error('Error cleaning signatures:', sigError)
    } else {
      stats.signatures_deleted = expiredSignatures?.length || 0
      console.log(`Deleted ${stats.signatures_deleted} expired signatures`)
    }

    // 2. Clean up old user nonces (inactive for 90+ days)
    // Keep recent nonces for active users, remove stale ones
    console.log('Cleaning up stale user nonces...')
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    const { data: oldNonces, error: nonceError } = await supabase
      .from('user_nonces')
      .delete()
      .lt('updated_at', ninetyDaysAgo.toISOString())
      .select('id')

    if (nonceError) {
      console.error('Error cleaning nonces:', nonceError)
    } else {
      stats.old_nonces_deleted = oldNonces?.length || 0
      console.log(`Deleted ${stats.old_nonces_deleted} stale nonces`)
    }

    // 3. Clean up old social media verifications (older than 180 days)
    // Keep verification history but remove very old records
    console.log('Cleaning up old social media verifications...')
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)
    
    const { data: oldVerifications, error: verifyError } = await supabase
      .from('social_media_verifications')
      .delete()
      .lt('created_at', sixMonthsAgo.toISOString())
      .eq('status', 'completed') // Only delete completed verifications
      .select('id')

    if (verifyError) {
      console.error('Error cleaning verifications:', verifyError)
    } else {
      stats.old_verifications_deleted = oldVerifications?.length || 0
      console.log(`Deleted ${stats.old_verifications_deleted} old verifications`)
    }

    // 4. Calculate totals
    stats.total_deleted = stats.signatures_deleted + 
                         stats.old_nonces_deleted + 
                         stats.old_verifications_deleted
    stats.execution_time_ms = Date.now() - startTime

    // 5. Log cleanup stats to a monitoring table (optional)
    await supabase
      .from('cleanup_logs')
      .insert({
        cleanup_type: 'scheduled',
        stats: stats,
        executed_at: new Date().toISOString()
      })
      .select()

    console.log('Cleanup completed:', stats)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database cleanup completed successfully',
        stats: stats
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Cleanup error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        execution_time_ms: Date.now() - startTime
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
