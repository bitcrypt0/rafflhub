import { useEffect, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { useWallet } from '../contexts/WalletContext';

/**
 * Hook for real-time pool updates via Supabase subscriptions
 *
 * Automatically subscribes to pool state changes and triggers callback
 * when the pool is updated in the database
 *
 * @param {string} poolAddress - Pool contract address
 * @param {Function} onUpdate - Callback when pool is updated
 * @param {boolean} enabled - Whether to enable real-time updates (default: true)
 *
 * @example
 * useRealtimePool(raffleAddress, (updatedPool) => {
 *   console.log('Pool updated:', updatedPool);
 *   setPoolState(updatedPool.state);
 *   setSlotsSold(updatedPool.slots_sold);
 * });
 */
export const useRealtimePool = (poolAddress, onUpdate, enabled = true) => {
  const { chainId } = useWallet();
  const channelRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep onUpdate ref current
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    // Skip if not enabled, no address, or Supabase not available
    if (!enabled || !poolAddress || !chainId || !supabaseService.isAvailable()) {
      return;
    }

    console.log('🔴 Subscribing to real-time updates for pool:', poolAddress);

    // Subscribe to pool updates
    const channel = supabaseService.subscribeToPool(
      poolAddress,
      chainId,
      (updatedPool) => {
        console.log('📡 Real-time pool update received:', updatedPool);
        if (onUpdateRef.current) {
          onUpdateRef.current(updatedPool);
        }
      }
    );

    channelRef.current = channel;

    // Cleanup: unsubscribe when component unmounts or dependencies change
    return () => {
      if (channelRef.current) {
        console.log('🔴 Unsubscribing from pool updates:', poolAddress);
        supabaseService.unsubscribe(`pool:${poolAddress}:${chainId}`);
        channelRef.current = null;
      }
    };
  }, [poolAddress, chainId, enabled]);
};

/**
 * Hook for real-time pool participants updates
 *
 * Subscribes to new participant events for a pool
 *
 * @param {string} poolAddress - Pool contract address
 * @param {Function} onNewParticipant - Callback when new participant joins
 * @param {boolean} enabled - Whether to enable real-time updates (default: true)
 */
export const useRealtimeParticipants = (poolAddress, onNewParticipant, enabled = true) => {
  const { chainId } = useWallet();
  const channelRef = useRef(null);
  const onNewParticipantRef = useRef(onNewParticipant);

  // Keep callback ref current
  useEffect(() => {
    onNewParticipantRef.current = onNewParticipant;
  }, [onNewParticipant]);

  useEffect(() => {
    if (!enabled || !poolAddress || !chainId || !supabaseService.isAvailable()) {
      return;
    }

    console.log('🔴 Subscribing to participant updates for pool:', poolAddress);

    // Subscribe to new participants
    const channel = supabaseService.client
      .channel(`participants:${poolAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_participants',
          filter: `pool_address=eq.${poolAddress.toLowerCase()},chain_id=eq.${chainId}`
        },
        (payload) => {
          console.log('📡 New participant:', payload.new);
          if (onNewParticipantRef.current) {
            onNewParticipantRef.current(payload.new);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('🔴 Unsubscribing from participant updates');
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [poolAddress, chainId, enabled]);
};

/**
 * Hook for real-time winners updates
 *
 * Subscribes to winner selection events for a pool
 *
 * @param {string} poolAddress - Pool contract address
 * @param {Function} onWinnersSelected - Callback when winners are selected
 * @param {boolean} enabled - Whether to enable real-time updates (default: true)
 */
export const useRealtimeWinners = (poolAddress, onWinnersSelected, enabled = true) => {
  const { chainId } = useWallet();
  const channelRef = useRef(null);
  const onWinnersSelectedRef = useRef(onWinnersSelected);

  // Keep callback ref current
  useEffect(() => {
    onWinnersSelectedRef.current = onWinnersSelected;
  }, [onWinnersSelected]);

  useEffect(() => {
    if (!enabled || !poolAddress || !chainId || !supabaseService.isAvailable()) {
      return;
    }

    console.log('🔴 Subscribing to winner updates for pool:', poolAddress);

    // Subscribe to new winners
    const channel = supabaseService.client
      .channel(`winners:${poolAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_winners',
          filter: `pool_address=eq.${poolAddress.toLowerCase()},chain_id=eq.${chainId}`
        },
        (payload) => {
          console.log('🏆 Winner selected:', payload.new);
          if (onWinnersSelectedRef.current) {
            onWinnersSelectedRef.current(payload.new);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('🔴 Unsubscribing from winner updates');
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [poolAddress, chainId, enabled]);
};

export default useRealtimePool;
