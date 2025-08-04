import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useMobileBreakpoints } from './useMobileBreakpoints';
import raffleService from '../services/RaffleService';

/**
 * Hook for managing raffle state updates without page reloads
 */
export const useRaffleStateManager = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return { refreshTrigger, triggerRefresh };
};

/**
 * React hook for using the RaffleService with proper lifecycle management
 */
export const useRaffleService = (options = {}) => {
  const {
    autoFetch = true,
    enablePolling = false,
    pollingInterval = 120000, // 2 minutes
    maxRaffles = null,
    useCache = true
  } = options;

  const walletContext = useWallet();
  const contractContext = useContract();
  const { isMobile } = useMobileBreakpoints();
  
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  
  const pollingRef = useRef(null);
  const mountedRef = useRef(true);

  // Initialize service when contexts are available
  useEffect(() => {
    if (walletContext && contractContext) {
      raffleService.initialize(walletContext, contractContext);
    }
  }, [walletContext, contractContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  /**
   * Fetch raffles with proper error handling and loading states
   */
  const fetchRaffles = useCallback(async (isBackground = false) => {
    console.log('🔍 fetchRaffles called:', {
      connected: walletContext?.connected,
      chainId: walletContext?.chainId,
      isBackground,
      environment: process.env.NODE_ENV,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      isMobile,
      maxRaffles
    });

    if (!walletContext?.connected) {
      console.log('❌ Wallet not connected');
      setRaffles([]);
      setError('Please connect your wallet to view raffles');
      return;
    }

    if (!mountedRef.current) {
      console.log('❌ Component unmounted');
      return;
    }

    try {
      if (isBackground) {
        setBackgroundLoading(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const fetchOptions = {
        isMobile,
        useCache,
        maxRaffles
      };

      console.log('🚀 Calling raffleService.fetchAllRaffles with options:', fetchOptions);
      const fetchedRaffles = await raffleService.fetchAllRaffles(fetchOptions);

      console.log('✅ fetchAllRaffles completed:', {
        count: fetchedRaffles?.length || 0,
        firstRaffle: fetchedRaffles?.[0]?.name || 'N/A'
      });

      if (!mountedRef.current) return;

      setRaffles(fetchedRaffles);
      setLastFetch(new Date());

      if (fetchedRaffles.length === 0) {
        console.log('⚠️ No raffles found');
        setError('No raffles found on the blockchain');
      } else {
        console.log('✅ Raffles set successfully');
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('❌ Error fetching raffles:', {
        error: err.message,
        stack: err.stack,
        environment: process.env.NODE_ENV,
        chainId: walletContext?.chainId
      });
      
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to fetch raffles from blockchain';
      
      if (err.message?.includes('Too Many Requests')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (err.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (err.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (err.message?.includes('not available')) {
        errorMessage = 'Smart contracts not available on this network.';
      }
      
      setError(errorMessage);
      
      // Don't clear raffles on background fetch errors
      if (!isBackground) {
        setRaffles([]);
      }
    } finally {
      if (!mountedRef.current) return;

      console.log('🏁 fetchRaffles completed, setting loading states');

      if (isBackground) {
        setBackgroundLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [walletContext?.connected, isMobile, useCache, maxRaffles]);

  /**
   * Search raffles
   */
  const searchRaffles = useCallback(async (searchTerm) => {
    if (!searchTerm?.trim()) {
      return [];
    }

    try {
      const searchOptions = {
        isMobile,
        useCache: true, // Always use cache for search
        maxRaffles: isMobile ? 50 : 100 // More results for search
      };

      return await raffleService.searchRaffles(searchTerm, searchOptions);
    } catch (err) {
      console.error('Error searching raffles:', err);
      return [];
    }
  }, [isMobile]);

  /**
   * Force refresh (clears cache)
   */
  const refreshRaffles = useCallback(async () => {
    raffleService.clearCache();
    await fetchRaffles(false);
  }, [fetchRaffles]);

  /**
   * Get specific raffle details
   */
  const getRaffleDetails = useCallback(async (raffleAddress) => {
    try {
      return await raffleService.fetchRaffleDetails(raffleAddress);
    } catch (err) {
      console.error(`Error fetching raffle details for ${raffleAddress}:`, err);
      return null;
    }
  }, []);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    console.log('🔄 Auto-fetch effect triggered:', {
      autoFetch,
      connected: walletContext?.connected,
      chainId: walletContext?.chainId,
      environment: process.env.NODE_ENV
    });

    if (autoFetch && walletContext?.connected) {
      console.log('🚀 Triggering auto-fetch');
      fetchRaffles();
    } else {
      console.log('⏸️ Auto-fetch conditions not met');
    }
  }, [autoFetch, walletContext?.connected, walletContext?.chainId, fetchRaffles]);

  // Setup polling
  useEffect(() => {
    if (enablePolling && walletContext?.connected && pollingInterval > 0) {
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
  }, [enablePolling, walletContext?.connected, pollingInterval, fetchRaffles]);

  /**
   * Categorize raffles by state
   */
  const categorizedRaffles = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    
    return raffles.reduce((acc, raffle) => {
      const startTime = raffle.startTime;
      const endTime = startTime + raffle.duration;
      
      if (raffle.stateNum === 0 || now < startTime) {
        acc.pending.push(raffle);
      } else if (raffle.stateNum === 1 && now >= startTime && now < endTime) {
        acc.active.push(raffle);
      } else if (raffle.stateNum === 2) {
        acc.drawing.push(raffle);
      } else if (raffle.stateNum === 3 || raffle.stateNum === 4) {
        acc.completed.push(raffle);
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

  /**
   * Get cache statistics for debugging
   */
  const getCacheStats = useCallback(() => {
    return raffleService.getCacheStats();
  }, []);

  return {
    // Data
    raffles,
    categorizedRaffles: categorizedRaffles(),
    
    // Loading states
    loading,
    backgroundLoading,
    error,
    lastFetch,
    
    // Actions
    fetchRaffles,
    refreshRaffles,
    searchRaffles,
    getRaffleDetails,
    
    // Utilities
    getCacheStats,
    
    // Service instance (for advanced usage)
    service: raffleService
  };
};

/**
 * Hook specifically for search functionality
 */
export const useRaffleSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  const { isMobile } = useMobileBreakpoints();
  const walletContext = useWallet();
  const contractContext = useContract();

  // Initialize service
  useEffect(() => {
    if (walletContext && contractContext) {
      raffleService.initialize(walletContext, contractContext);
    }
  }, [walletContext, contractContext]);

  const search = useCallback(async (searchTerm) => {
    if (!searchTerm?.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const results = await raffleService.searchRaffles(searchTerm, {
        isMobile,
        useCache: true,
        maxRaffles: isMobile ? 20 : 50
      });
      
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Failed to search raffles');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [isMobile]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchResults,
    searchLoading,
    searchError,
    search,
    clearSearch
  };
};

export default useRaffleService;
