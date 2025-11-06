import { supabase } from '../config/supabase';

/**
 * Real-Time Social Media Verification Service
 * Provides real-time updates for social media task completion
 */

class RealtimeVerificationService {
  constructor() {
    this.subscriptions = new Map();
    this.listeners = new Map();
  }

  /**
   * Subscribe to verification updates for a specific user and raffle
   * @param {string} userAddress - User's wallet address
   * @param {string} raffleId - Raffle/pool ID
   * @param {Object} callbacks - Callback functions for different events
   * @returns {Function} Unsubscribe function
   */
  subscribeToVerification(userAddress, raffleId, callbacks = {}) {
    const subscriptionKey = `${userAddress}-${raffleId}`;
    
    // If already subscribed, unsubscribe first
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    console.log(`[RealTime] Subscribing to verification updates for ${userAddress} on raffle ${raffleId}`);

    // Subscribe to verification_events table
    const eventsChannel = supabase
      .channel(`verification-events-${subscriptionKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'verification_events',
          filter: `user_address=eq.${userAddress.toLowerCase()},raffle_id=eq.${raffleId}`
        },
        (payload) => {
          console.log('[RealTime] Verification event received:', payload);
          this.handleVerificationEvent(payload.new, callbacks);
        }
      )
      .subscribe((status) => {
        console.log(`[RealTime] Events subscription status: ${status}`);
      });

    // Subscribe to social_media_verifications table for status changes
    const verificationsChannel = supabase
      .channel(`verifications-${subscriptionKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_media_verifications',
          filter: `user_address=eq.${userAddress.toLowerCase()},raffle_id=eq.${raffleId}`
        },
        (payload) => {
          console.log('[RealTime] Verification status changed:', payload);
          this.handleVerificationStatusChange(payload, callbacks);
        }
      )
      .subscribe((status) => {
        console.log(`[RealTime] Verifications subscription status: ${status}`);
      });

    // Store subscriptions
    this.subscriptions.set(subscriptionKey, {
      eventsChannel,
      verificationsChannel,
      userAddress,
      raffleId
    });

    // Return unsubscribe function
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Handle verification event
   */
  handleVerificationEvent(event, callbacks) {
    const { event_type, task_type, metadata } = event;

    switch (event_type) {
      case 'task_completed':
        if (callbacks.onTaskCompleted) {
          callbacks.onTaskCompleted({
            taskType: task_type,
            metadata
          });
        }
        break;

      case 'all_completed':
        if (callbacks.onAllTasksCompleted) {
          callbacks.onAllTasksCompleted({
            totalTasks: metadata.total_tasks,
            completedAt: metadata.completed_at
          });
        }
        break;

      case 'verification_ready':
        if (callbacks.onVerificationReady) {
          callbacks.onVerificationReady({
            canPurchase: metadata.can_purchase,
            readyAt: metadata.ready_at
          });
        }
        break;

      default:
        console.log('[RealTime] Unknown event type:', event_type);
    }

    // Call general update callback
    if (callbacks.onUpdate) {
      callbacks.onUpdate(event);
    }
  }

  /**
   * Handle verification status change
   */
  handleVerificationStatusChange(payload, callbacks) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'UPDATE' && oldRecord?.status !== newRecord?.status) {
      if (newRecord.status === 'completed' && callbacks.onTaskCompleted) {
        callbacks.onTaskCompleted({
          taskType: newRecord.task_type,
          platform: newRecord.platform,
          verificationId: newRecord.id
        });
      }
    }

    if (callbacks.onStatusChange) {
      callbacks.onStatusChange({
        eventType,
        newRecord,
        oldRecord
      });
    }
  }

  /**
   * Unsubscribe from verification updates
   */
  unsubscribe(subscriptionKey) {
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (subscription) {
      console.log(`[RealTime] Unsubscribing from ${subscriptionKey}`);
      
      subscription.eventsChannel.unsubscribe();
      subscription.verificationsChannel.unsubscribe();
      
      this.subscriptions.delete(subscriptionKey);
    }
  }

  /**
   * Unsubscribe all active subscriptions
   */
  unsubscribeAll() {
    console.log('[RealTime] Unsubscribing from all verification updates');
    
    this.subscriptions.forEach((_, key) => {
      this.unsubscribe(key);
    });
    
    this.subscriptions.clear();
    this.listeners.clear();
  }

  /**
   * Get current verification progress
   * @param {string} userAddress - User's wallet address
   * @param {string} raffleId - Raffle/pool ID
   * @returns {Promise<Object>} Verification progress data
   */
  async getVerificationProgress(userAddress, raffleId) {
    try {
      const { data, error } = await supabase
        .rpc('get_verification_progress', {
          p_user_address: userAddress.toLowerCase(),
          p_raffle_id: raffleId
        });

      if (error) throw error;

      return {
        success: true,
        data: data?.[0] || {
          total_tasks: 0,
          completed_tasks: 0,
          pending_tasks: 0,
          progress_percentage: 0,
          all_completed: false,
          tasks: []
        }
      };
    } catch (error) {
      console.error('[RealTime] Error fetching verification progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if all tasks are completed
   * @param {string} userAddress - User's wallet address
   * @param {string} raffleId - Raffle/pool ID
   * @returns {Promise<boolean>} True if all tasks completed
   */
  async areAllTasksCompleted(userAddress, raffleId) {
    const result = await this.getVerificationProgress(userAddress, raffleId);
    return result.success && result.data.all_completed;
  }

  /**
   * Get recent verification events
   * @param {string} userAddress - User's wallet address
   * @param {string} raffleId - Raffle/pool ID
   * @param {number} limit - Number of events to fetch
   * @returns {Promise<Array>} Recent events
   */
  async getRecentEvents(userAddress, raffleId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('verification_events')
        .select('*')
        .eq('user_address', userAddress.toLowerCase())
        .eq('raffle_id', raffleId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        events: data || []
      };
    } catch (error) {
      console.error('[RealTime] Error fetching recent events:', error);
      return {
        success: false,
        error: error.message,
        events: []
      };
    }
  }
}

// Export singleton instance
export const realtimeVerificationService = new RealtimeVerificationService();

// Export class for testing
export default RealtimeVerificationService;
