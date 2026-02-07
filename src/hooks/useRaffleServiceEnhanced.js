import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useMobileBreakpoints } from './useMobileBreakpoints';
import { supabaseService } from '../services/supabaseService';
import raffleService from '../services/RaffleService';
import { ethers } from 'ethers';
import { DEFAULT_CHAIN_ID } from '../networks';

/**
 * Enhanced Raffle Service Hook
 * Implements Supabase-first data fetching with RPC fallback
 * Designed for LandingPage to reduce RPC calls and improve performance
 */
export const useRaffleServiceEnhanced = (options = {}) => {
  const {
    autoFetch = true,
    enablePolling = false,
    pollingInterval = 120000, // 2 minutes
    maxRaffles = null,
    useBackend = true, // Enable backend-first fetching
    includeFilterCounts = true, // Include filter counts for FilterSidebar
  } = options;

  const walletContext = useWallet();
  const { connected, chainId: walletChainId, signer, provider } = walletContext;
  const contractContext = useContract();
  const { isMobile } = useMobileBreakpoints();

  // Use wallet chainId if connected, otherwise fall back to default
  const chainId = walletChainId || DEFAULT_CHAIN_ID;

  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [dataSource, setDataSource] = useState(null); // 'backend' or 'rpc'
  const [filterCounts, setFilterCounts] = useState(null);

  const pollingRef = useRef(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Clear state when network changes
  useEffect(() => {
    if (chainId) {
      console.log('🔄 Network changed, clearing raffle state');
      setRaffles([]);
      setError(null);
      setLastFetch(null);
      setFilterCounts(null);
      setDataSource(null);
    }
  }, [chainId]);

  /**
   * Transform backend pool data to match RPC raffle format
   * This ensures compatibility with existing RaffleCard component
   */
  const transformBackendPool = useCallback((pool) => {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    
    return {
      // Core identifiers
      address: pool.address,
      chainId: pool.chain_id,
      
      // Basic info
      name: pool.name || 'Unnamed Pool',
      creator: pool.creator,
      
      // State
      state: getStateLabel(pool.state),
      stateNum: pool.state,
      
      // Timing
      startTime: pool.start_time,
      duration: pool.duration,
      actualDuration: pool.actual_duration,
      
      // Slots
      slotFee: pool.slot_fee ? ethers.BigNumber.from(pool.slot_fee) : ethers.BigNumber.from(0),
      slotLimit: pool.slot_limit,
      totalSlotsPurchased: pool.slots_sold || 0,
      
      // Winners
      winnersCount: pool.winners_count,
      
      // Prize flags
      isPrized: pool.is_prized,
      isCollabPool: pool.is_collab_pool,
      isEscrowedPrize: pool.is_escrowed_prize,
      usesCustomFee: pool.uses_custom_fee,
      
      // NFT Prize
      prizeCollection: pool.prize_collection || ZERO_ADDRESS,
      prizeTokenId: pool.prize_token_id,
      standard: pool.standard,
      
      // ERC20 Prize
      erc20PrizeToken: pool.erc20_prize_token || ZERO_ADDRESS,
      erc20PrizeAmount: pool.erc20_prize_amount 
        ? ethers.BigNumber.from(pool.erc20_prize_amount) 
        : ethers.BigNumber.from(0),
      
      // Native Prize
      nativePrizeAmount: pool.native_prize_amount 
        ? ethers.BigNumber.from(pool.native_prize_amount) 
        : ethers.BigNumber.from(0),
      
      // Holder token (for whitelist collab detection)
      holderTokenAddress: pool.holder_token_address || ZERO_ADDRESS,
      
      // Metadata
      createdAtTimestamp: pool.created_at_timestamp,
      createdAtBlock: pool.created_at_block,
      
      // Backend-specific flags
      _fromBackend: true,
      _backendSlotsSold: pool.slots_sold, // Pre-fetched, no RPC needed
      _backendArtworkUrl: pool.artwork_url, // Pre-fetched artwork URL, no RPC needed
      _backendCollectionArtwork: pool.collection_artwork || null, // Collection artwork URIs for mintable pools
      collection_artwork: pool.collection_artwork || null,
    };
  }, []);

  /**
   * Get state label from state number
   */
  const getStateLabel = (stateNum) => {
    const labels = ['Pending', 'Active', 'Ended', 'Drawing', 'Completed', 'Deleted', 'AllPrizesClaimed', 'Unengaged'];
    return labels[stateNum] || 'Unknown';
  };

  /**
   * Fetch raffles from backend (Supabase)
   */
  const fetchFromBackend = useCallback(async (effectiveChainId) => {
    const targetChainId = effectiveChainId || chainId;
    if (!targetChainId) return null;

    try {
      console.log('🌐 Fetching raffles from backend...');
      
      // Fetch ALL pools from backend (including hidden states)
      // This allows filters and search to access all pools
      // Default filtering will be applied in LandingPage component
      const result = await supabaseService.getPoolsEnhanced({
        chainId: targetChainId,
        state: undefined, // Fetch all states to enable filtering/searching hidden pools
        limit: maxRaffles,
        offset: 0,
        sortBy: 'created_at_timestamp',
        sortOrder: 'desc',
        includeFilterCounts: true,
      });

      console.log('📊 Backend response:', {
        poolsCount: result.pools?.length || 0,
        pagination: result.pagination,
        filterCounts: result.filterCounts,
        pools: result.pools?.map(p => ({ address: p.address, name: p.name, state: p.state }))
      });

      if (result.pools && result.pools.length > 0) {
        const transformedRaffles = result.pools.map(transformBackendPool);
        
        // Return all pools without filtering
        // Filtering will be applied in LandingPage component based on user filters/search
        console.log(`✅ Backend returned ${transformedRaffles.length} raffles (all states)`);
        
        return {
          raffles: transformedRaffles,
          filterCounts: result.filterCounts,
          pagination: result.pagination,
        };
      }

      console.warn('⚠️ No pools returned from backend');
      return null;
    } catch (error) {
      console.warn('⚠️ Backend fetch failed:', error.message);
      return null;
    }
  }, [chainId, maxRaffles, includeFilterCounts, transformBackendPool]);

  /**
   * Fetch raffles from RPC (fallback) - requires wallet connection
   */
  const fetchFromRPC = useCallback(async () => {
    if (!connected || !contractContext?.isContractsReady) {
      return null;
    }

    try {
      console.log('🔗 Fetching raffles from RPC (fallback)...');
      
      // Initialize raffle service with full wallet context (including signer/provider)
      raffleService.initialize(walletContext, contractContext);

      if (!raffleService.areContractsAvailable()) {
        console.warn('⚠️ Contracts not available for RPC fetch');
        return null;
      }

      const fetchedRaffles = await raffleService.fetchAllRaffles({
        isMobile,
        useCache: true,
        maxRaffles,
      });

      if (fetchedRaffles && fetchedRaffles.length > 0) {
        console.log(`✅ RPC returned ${fetchedRaffles.length} raffles`);
        return { raffles: fetchedRaffles, filterCounts: null };
      }

      return null;
    } catch (error) {
      console.error('❌ RPC fetch failed:', error.message);
      return null;
    }
  }, [connected, walletContext, contractContext, isMobile, maxRaffles]);

  /**
   * Main fetch function - tries backend first, falls back to RPC
   */
  const fetchRaffles = useCallback(async (isBackground = false) => {
    if (!chainId) {
      console.log('⏸️ ChainId not yet available, skipping fetch');
      return;
    }

    if (!mountedRef.current) return;

    try {
      if (isBackground) {
        setBackgroundLoading(true);
      } else {
        setLoading(true);
        setError(null);
      }

      let result = null;

      // Try backend first if enabled
      if (useBackend) {
        result = await fetchFromBackend();
        if (result) {
          setDataSource('backend');
        }
      }

      // Fallback to RPC if backend failed or disabled
      if (!result) {
        result = await fetchFromRPC();
        if (result) {
          setDataSource('rpc');
        }
      }

      if (!mountedRef.current) return;

      if (result && result.raffles) {
        setRaffles(result.raffles);
        setFilterCounts(result.filterCounts);
        setLastFetch(new Date());
        setError(null);
      } else {
        setError('NO_RAFFLES_FOUND');
        if (!isBackground) {
          setRaffles([]);
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('❌ Error fetching raffles:', err.message);
      setError('NETWORK_ERROR');
      
      if (!isBackground) {
        setRaffles([]);
      }
    } finally {
      if (!mountedRef.current) return;

      if (isBackground) {
        setBackgroundLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [chainId, useBackend, connected, fetchFromBackend, fetchFromRPC]);

  /**
   * Force refresh (clears cache and refetches)
   */
  const refreshRaffles = useCallback(async () => {
    // Clear supabase cache for pools
    supabaseService.clearCache();
    // Clear RPC cache
    raffleService.clearCache();
    await fetchRaffles(false);
  }, [fetchRaffles]);

  /**
   * Search raffles - uses backend search if available
   */
  const searchRaffles = useCallback(async (searchTerm) => {
    if (!searchTerm?.trim() || !chainId) {
      return [];
    }

    try {
      if (useBackend) {
        const results = await supabaseService.searchPools(chainId, searchTerm, 20);
        return results.map(transformBackendPool);
      } else {
        return await raffleService.searchRaffles(searchTerm, {
          isMobile,
          useCache: true,
          maxRaffles: 20,
        });
      }
    } catch (err) {
      console.error('Error searching raffles:', err);
      return [];
    }
  }, [chainId, useBackend, isMobile, transformBackendPool]);

  /**
   * Get specific raffle details
   */
  const getRaffleDetails = useCallback(async (raffleAddress) => {
    if (!chainId) return null;

    try {
      if (useBackend) {
        const pool = await supabaseService.getPool(chainId, raffleAddress);
        return pool ? transformBackendPool(pool) : null;
      } else {
        return await raffleService.fetchRaffleDetails(raffleAddress);
      }
    } catch (err) {
      console.error(`Error fetching raffle details for ${raffleAddress}:`, err);
      return null;
    }
  }, [chainId, useBackend, transformBackendPool]);

  // Auto-fetch on mount and when dependencies change
  // No longer requires wallet connection — backend fetch works without it
  useEffect(() => {
    if (autoFetch && chainId) {
      const timer = setTimeout(() => {
        fetchRaffles();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [autoFetch, chainId, fetchRaffles]);

  // Setup polling — works without wallet for backend-first strategy
  useEffect(() => {
    if (enablePolling && chainId && pollingInterval > 0) {
      pollingRef.current = setInterval(() => {
        fetchRaffles(true); // Background fetch
      }, pollingInterval);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [enablePolling, chainId, pollingInterval, fetchRaffles]);

  // Real-time subscription for pool updates (state changes, slot purchases)
  const realtimeChannelRef = useRef(null);
  useEffect(() => {
    if (!chainId || !supabaseService.isAvailable()) {
      return;
    }

    // Subscribe to all pool updates for this chain (state changes, slot counts, etc.)
    const channel = supabaseService.client
      .channel(`landing-pools:${chainId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pools',
          filter: `chain_id=eq.${chainId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New pool created — add to list
            const newPool = transformBackendPool(payload.new);
            setRaffles(prev => [newPool, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            // Pool updated — update in place
            setRaffles(prev =>
              prev.map(r =>
                r.address.toLowerCase() === payload.new.address?.toLowerCase()
                  ? {
                      ...r,
                      stateNum: payload.new.state !== undefined ? payload.new.state : r.stateNum,
                      state: payload.new.state !== undefined ? getStateLabel(payload.new.state) : r.state,
                      totalSlotsPurchased: payload.new.slots_sold !== undefined ? payload.new.slots_sold : r.totalSlotsPurchased,
                      winnersCount: payload.new.winners_count !== undefined ? payload.new.winners_count : r.winnersCount,
                      actualDuration: payload.new.actual_duration !== undefined ? payload.new.actual_duration : r.actualDuration,
                    }
                  : r
              )
            );
          }
        }
      )
      // Also listen for new participants — arrives before pools.slots_sold UPDATE
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_participants',
          filter: `chain_id=eq.${chainId}`
        },
        (payload) => {
          const participant = payload.new;
          if (!participant?.pool_address) return;
          const slotCount = participant.slots_purchased || 1;
          setRaffles(prev =>
            prev.map(r =>
              r.address.toLowerCase() === participant.pool_address.toLowerCase()
                ? { ...r, totalSlotsPurchased: (r.totalSlotsPurchased || 0) + slotCount }
                : r
            )
          );
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe();
        realtimeChannelRef.current = null;
      }
    };
  }, [chainId, transformBackendPool]);

  /**
   * Categorize raffles by state
   */
  const categorizedRaffles = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    
    return raffles.reduce((acc, raffle) => {
      const startTime = raffle.startTime;
      const endTime = startTime + raffle.duration;
      
      if (raffle.stateNum === 0 || now < startTime) {
        acc.pending.push(raffle);
      } else if (raffle.stateNum === 1 && now >= startTime && now < endTime) {
        acc.active.push(raffle);
      } else if (raffle.stateNum === 2) {
        acc.ended.push(raffle);
      } else if (raffle.stateNum === 3) {
        acc.drawing.push(raffle);
      } else if (raffle.stateNum === 4) {
        acc.completed.push(raffle);
      } else if (raffle.stateNum === 5) {
        acc.ended.push(raffle);
      } else if (raffle.stateNum === 6) {
        acc.completed.push(raffle);
      } else if (raffle.stateNum === 7) {
        acc.ended.push(raffle);
      } else {
        acc.ended.push(raffle);
      }
      
      return acc;
    }, {
      pending: [],
      active: [],
      drawing: [],
      completed: [],
      ended: []
    });
  }, [raffles]);

  return {
    // Data
    raffles,
    categorizedRaffles,
    filterCounts,
    
    // Loading states
    loading,
    backgroundLoading,
    error,
    lastFetch,
    dataSource,
    
    // Actions
    fetchRaffles,
    refreshRaffles,
    searchRaffles,
    getRaffleDetails,
    
    // Utilities
    isBackendData: dataSource === 'backend',
  };
};

export default useRaffleServiceEnhanced;
