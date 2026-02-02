/**
 * Real-Time Helper Functions
 * Shared utilities for triggering real-time updates
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Update verification status and trigger real-time events
 * This function updates the social_media_verifications table,
 * which automatically triggers the broadcast_verification_event() function
 */
export async function updateVerificationStatus(
  supabase: SupabaseClient,
  params: {
    userAddress: string;
    raffleId: string;
    taskType: string;
    platform: string;
    status: 'pending' | 'completed' | 'failed';
    verificationDetails?: any;
  }
) {
  const { userAddress, raffleId, taskType, platform, status, verificationDetails } = params;

  try {
    // Check if verification record exists
    const { data: existing, error: fetchError } = await supabase
      .from('social_media_verifications')
      .select('id, status')
      .eq('user_address', userAddress.toLowerCase())
      .eq('raffle_id', raffleId)
      .eq('task_type', taskType)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw fetchError;
    }

    let result;

    if (existing) {
      // Update existing record
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      if (verificationDetails) {
        updateData.verification_details = verificationDetails;
      }

      result = await supabase
        .from('social_media_verifications')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new record
      const insertData: any = {
        user_address: userAddress.toLowerCase(),
        raffle_id: raffleId,
        task_type: taskType,
        platform,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        insertData.completed_at = new Date().toISOString();
      }

      if (verificationDetails) {
        insertData.verification_details = verificationDetails;
      }

      result = await supabase
        .from('social_media_verifications')
        .insert(insertData)
        .select()
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    console.log(`[RealTime] Verification status updated: ${taskType} -> ${status}`);

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[RealTime] Error updating verification status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Manually trigger a verification event
 * Use this when you need to send custom events
 */
export async function triggerVerificationEvent(
  supabase: SupabaseClient,
  params: {
    userAddress: string;
    raffleId: string;
    eventType: 'task_completed' | 'all_completed' | 'verification_ready' | 'custom';
    taskType?: string;
    metadata?: any;
  }
) {
  const { userAddress, raffleId, eventType, taskType, metadata } = params;

  try {
    const { data, error } = await supabase
      .from('verification_events')
      .insert({
        user_address: userAddress.toLowerCase(),
        raffle_id: raffleId,
        event_type: eventType,
        task_type: taskType,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[RealTime] Event triggered: ${eventType}`);

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('[RealTime] Error triggering event:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if all tasks are completed for a user-raffle pair
 */
export async function checkAllTasksCompleted(
  supabase: SupabaseClient,
  userAddress: string,
  raffleId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('social_media_verifications')
      .select('status')
      .eq('user_address', userAddress.toLowerCase())
      .eq('raffle_id', raffleId);

    if (error) throw error;

    if (!data || data.length === 0) return false;

    // Check if all tasks are completed
    const allCompleted = data.every(task => task.status === 'completed');

    return allCompleted;
  } catch (error) {
    console.error('[RealTime] Error checking task completion:', error);
    return false;
  }
}
