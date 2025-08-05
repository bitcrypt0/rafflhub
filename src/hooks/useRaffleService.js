import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useMobileBreakpoints } from './useMobileBreakpoints';
import raffleService from '../services/RaffleService';
import { ethers } from 'ethers';

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

/**
 * Custom hook for listening to raffle contract events
 * Provides real-time updates for winner selection and state changes
 */
export const useRaffleEventListener = (raffleAddress, options = {}) => {
  const {
    onWinnersSelected,
    onStateChange,
    onPrizeClaimed,
    onTicketsPurchased,
    enablePolling = true,
    pollingInterval = 10000, // 10 seconds
    autoStart = true
  } = options;

  const { getContractInstance, provider } = useContract();
  const { connected } = useWallet();

  const [isListening, setIsListening] = useState(false);
  const [lastBlockNumber, setLastBlockNumber] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);

  const contractRef = useRef(null);
  const listenersRef = useRef([]);
  const pollingRef = useRef(null);
  const mountedRef = useRef(true);

  // Initialize contract instance
  useEffect(() => {
    if (raffleAddress && getContractInstance) {
      contractRef.current = getContractInstance(raffleAddress, 'raffle');
    } else {
      contractRef.current = null;
    }
  }, [raffleAddress, getContractInstance]);

  // Event handler wrapper with error handling
  const createEventHandler = useCallback((eventName, callback) => {
    return (...args) => {
      try {
        if (mountedRef.current && callback) {
          console.log(`🎯 Raffle Event [${eventName}]:`, args);

          // Add to event history
          const eventData = {
            eventName,
            args,
            timestamp: Date.now(),
            blockNumber: args[args.length - 1]?.blockNumber || null
          };

          setEventHistory(prev => [...prev.slice(-9), eventData]); // Keep last 10 events

          callback(...args);
        }
      } catch (error) {
        console.error(`Error handling ${eventName} event:`, error);
      }
    };
  }, []);

  // Set up event listeners
  const setupEventListeners = useCallback(() => {
    if (!contractRef.current || !connected) {
      return;
    }

    try {
      console.log(`🎧 Setting up event listeners for raffle: ${raffleAddress}`);

      // Clear existing listeners
      listenersRef.current.forEach(({ contract, event, handler }) => {
        contract.off(event, handler);
      });
      listenersRef.current = [];

      const contract = contractRef.current;

      // WinnersSelected event
      if (onWinnersSelected) {
        const winnersHandler = createEventHandler('WinnersSelected', (winners, event) => {
          onWinnersSelected(winners, event);
        });
        contract.on('WinnersSelected', winnersHandler);
        listenersRef.current.push({ contract, event: 'WinnersSelected', handler: winnersHandler });
      }

      // PrizeClaimed event
      if (onPrizeClaimed) {
        const prizeHandler = createEventHandler('PrizeClaimed', (winner, tokenId, event) => {
          onPrizeClaimed(winner, tokenId, event);
        });
        contract.on('PrizeClaimed', prizeHandler);
        listenersRef.current.push({ contract, event: 'PrizeClaimed', handler: prizeHandler });
      }

      // TicketsPurchased event
      if (onTicketsPurchased) {
        const ticketsHandler = createEventHandler('TicketsPurchased', (participant, quantity, event) => {
          onTicketsPurchased(participant, quantity, event);
        });
        contract.on('TicketsPurchased', ticketsHandler);
        listenersRef.current.push({ contract, event: 'TicketsPurchased', handler: ticketsHandler });
      }

      setIsListening(true);
      console.log(`✅ Event listeners active for ${listenersRef.current.length} events`);

    } catch (error) {
      console.error('Error setting up event listeners:', error);
      setIsListening(false);
    }
  }, [raffleAddress, connected, onWinnersSelected, onPrizeClaimed, onTicketsPurchased, createEventHandler]);

  // Cleanup event listeners
  const cleanupEventListeners = useCallback(() => {
    console.log(`🧹 Cleaning up event listeners for raffle: ${raffleAddress}`);

    listenersRef.current.forEach(({ contract, event, handler }) => {
      try {
        contract.off(event, handler);
      } catch (error) {
        console.warn(`Error removing ${event} listener:`, error);
      }
    });

    listenersRef.current = [];
    setIsListening(false);
  }, [raffleAddress]);

  // Polling for state changes (fallback mechanism)
  const setupPolling = useCallback(() => {
    if (!enablePolling || !contractRef.current || !onStateChange) {
      return;
    }

    const pollForStateChanges = async () => {
      try {
        if (!mountedRef.current || !contractRef.current) return;

        const currentBlock = await provider?.getBlockNumber();
        if (currentBlock && currentBlock !== lastBlockNumber) {
          setLastBlockNumber(currentBlock);

          // Check for state changes by polling contract state
          const stateNum = await contractRef.current.state();
          const stateValue = stateNum.toNumber ? stateNum.toNumber() : Number(stateNum);

          // Trigger state change callback
          if (onStateChange) {
            onStateChange(stateValue, currentBlock);
          }
        }
      } catch (error) {
        console.warn('Error during state polling:', error);
      }
    };

    // Initial poll
    pollForStateChanges();

    // Set up interval
    pollingRef.current = setInterval(pollForStateChanges, pollingInterval);
    console.log(`📊 State polling enabled (${pollingInterval}ms interval)`);
  }, [enablePolling, onStateChange, provider, lastBlockNumber, pollingInterval]);

  // Cleanup polling
  const cleanupPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      console.log('📊 State polling disabled');
    }
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    if (!raffleAddress || !contractRef.current) {
      console.warn('Cannot start listening: missing raffle address or contract');
      return;
    }

    setupEventListeners();
    setupPolling();
  }, [raffleAddress, setupEventListeners, setupPolling]);

  // Stop listening
  const stopListening = useCallback(() => {
    cleanupEventListeners();
    cleanupPolling();
  }, [cleanupEventListeners, cleanupPolling]);

  // Auto-start listening when dependencies are ready
  useEffect(() => {
    if (autoStart && raffleAddress && contractRef.current && connected) {
      startListening();
    }

    return () => {
      stopListening();
    };
  }, [autoStart, raffleAddress, connected, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    eventHistory,
    lastBlockNumber,
    startListening,
    stopListening,
    clearEventHistory: () => setEventHistory([])
  };
};

export default useRaffleService;
