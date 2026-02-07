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

  // Clear cache and reset state when network changes
  useEffect(() => {
    if (walletContext?.chainId) {
      console.log('🔄 Network changed, clearing cache and resetting state');
      raffleService.clearCache();
      setRaffles([]);
      setError(null);
      setLastFetch(null);
    }
  }, [walletContext?.chainId]);

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

    if (!walletContext?.chainId) {
      console.log('⏸️ ChainId not yet available, skipping fetch');
      return;
    }

    // Check if we're in the middle of reconnecting/network switching
    if (walletContext?.isReconnecting) {
      console.log('⏸️ Wallet is reconnecting, skipping fetch');
      return;
    }

    // Check if contracts are ready before proceeding
    if (!contractContext?.isContractsReady) {
      console.log('⏸️ Contracts not ready yet, skipping fetch');
      return;
    }

    // Verify contracts are available for the current network
    if (!raffleService.areContractsAvailable()) {
      console.log('⏸️ Contracts not available for current network, skipping fetch');
      if (!isBackground) {
        setError('CONTRACTS_NOT_AVAILABLE');
        setRaffles([]);
      }
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
        setError('NO_RAFFLES_FOUND');
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
      
      // Enhanced error handling with specific error codes
      let errorCode = 'NETWORK_ERROR';

      if (err.message?.includes('CONTRACTS_NOT_AVAILABLE')) {
        errorCode = 'CONTRACTS_NOT_AVAILABLE';
      } else if (err.message?.includes('Too Many Requests')) {
        errorCode = 'RATE_LIMIT';
      } else if (err.message?.includes('timeout')) {
        errorCode = 'TIMEOUT';
      } else if (err.message?.includes('network')) {
        errorCode = 'NETWORK_ERROR';
      } else if (err.message?.includes('not available') || err.message?.includes('ProtocolManager contract not available')) {
        // Handle cases where contracts are not available but error message is different
        errorCode = 'CONTRACTS_NOT_AVAILABLE';
      }

      setError(errorCode);
      
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
  }, [walletContext?.connected, walletContext?.chainId, walletContext?.isReconnecting, contractContext?.isContractsReady, isMobile, useCache, maxRaffles]);

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
        maxRaffles: null // No limits for search - search all available raffles
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
      isReconnecting: walletContext?.isReconnecting,
      isContractsReady: contractContext?.isContractsReady,
      environment: process.env.NODE_ENV
    });

    if (autoFetch &&
        walletContext?.connected &&
        walletContext?.chainId &&
        !walletContext?.isReconnecting &&
        contractContext?.isContractsReady) {

      // Add a progressive delay to ensure all contexts are fully synchronized
      const timer = setTimeout(() => {
        console.log('🚀 Triggering auto-fetch with full context ready');
        fetchRaffles();
      }, 500); // Increased delay for better synchronization

      return () => clearTimeout(timer);
    } else {
      console.log('⏸️ Auto-fetch conditions not met:', {
        autoFetch,
        connected: walletContext?.connected,
        chainId: walletContext?.chainId,
        isReconnecting: walletContext?.isReconnecting,
        isContractsReady: contractContext?.isContractsReady
      });
    }
  }, [autoFetch, walletContext?.connected, walletContext?.chainId, walletContext?.isReconnecting, contractContext?.isContractsReady, fetchRaffles]);

  // Setup polling
  useEffect(() => {
    if (enablePolling && walletContext?.connected && pollingInterval > 0) {
      pollingRef.current = setInterval(() => {
        // For background refreshes, bypass cache to surface end-state changes (actualDuration) promptly
          raffleService.fetchAllRaffles({ isMobile, useCache: false, maxRaffles })
            .then(fetched => {
              if (mountedRef.current) {
                setRaffles(fetched);
                setLastFetch(new Date());
              }
            })
            .catch(() => {/* ignore background errors */});
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
        acc.ended.push(raffle);
      } else if (raffle.stateNum === 3) {
        acc.drawing.push(raffle);
      } else if (raffle.stateNum === 4) {
        acc.completed.push(raffle);
      } else if (raffle.stateNum === 5) {
        acc.ended.push(raffle); // deleted pools go to ended
      } else if (raffle.stateNum === 6) {
        acc.completed.push(raffle); // all prizes claimed (was 7, now 6)
      } else if (raffle.stateNum === 7) {
        acc.ended.push(raffle); // unengaged pools go to ended (was 8, now 7)
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
 * Enhanced with state-conditional listening for better performance
 */
export const useRaffleEventListener = (raffleAddress, options = {}) => {
  const {
    onWinnersSelected,
    onStateChange,
    onPrizeClaimed,
    onTicketsPurchased,
    onRpcError, // New callback for RPC error detection
    enablePolling = true,
    pollingInterval = 10000, // 10 seconds
    autoStart = true,
    raffleState = null, // Current raffle state for conditional listening
    enableStateConditionalListening = true, // Enable optimized listening based on state
    stopOnCompletion = false // Stop listening for winner selection events after completion
  } = options;

  const { getContractInstance, provider } = useContract();
  const { connected } = useWallet();

  const [isListening, setIsListening] = useState(false);
  const [lastBlockNumber, setLastBlockNumber] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);
  const [currentRaffleState, setCurrentRaffleState] = useState(raffleState);

  const contractRef = useRef(null);
  const listenersRef = useRef([]);
  const pollingRef = useRef(null);
  const mountedRef = useRef(true);
  const lastStateRef = useRef(raffleState);

  // Initialize contract instance
  useEffect(() => {
    if (raffleAddress && getContractInstance) {
      contractRef.current = getContractInstance(raffleAddress, 'pool');
    } else {
      contractRef.current = null;
    }
  }, [raffleAddress, getContractInstance]);

  // Update current raffle state when it changes
  useEffect(() => {
    if (raffleState !== lastStateRef.current) {
      console.log(`🔄 Raffle state updated: ${lastStateRef.current} → ${raffleState}`);
      setCurrentRaffleState(raffleState);
      lastStateRef.current = raffleState;
    }
  }, [raffleState]);

  // Determine if we should listen based on raffle state
  const shouldListen = useCallback(() => {
    if (!enableStateConditionalListening) {
      return true; // Always listen if conditional listening is disabled
    }

    // Terminal states where no more contract events are expected
    // 5 = Deleted, 6 = AllPrizesClaimed, 7 = Unengaged
    if ([5, 6, 7].includes(currentRaffleState)) {
      return false;
    }

    // If stopOnCompletion is enabled, stop at Completed (4) since winners are already selected
    if (stopOnCompletion && currentRaffleState === 4) {
      return false;
    }

    // Listen when raffle is in states where events are likely:
    // 1 = Active (for SlotsPurchased events)
    // 2 = Ended (transition to Drawing)
    // 3 = Drawing (for WinnersSelected events)
    // 4 = Completed (for state polling)
    const activeStates = [1, 2, 3, 4];
    return currentRaffleState === null || activeStates.includes(currentRaffleState);
  }, [currentRaffleState, enableStateConditionalListening, stopOnCompletion]);

  // Enhanced event handler with better error handling and WinnersSelected priority
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

          // Special handling for WinnersSelected event - ensure immediate processing with RPC resilience
          if (eventName === 'WinnersSelected') {
            console.log('🏆 WinnersSelected event - triggering immediate callback with RPC resilience');
            // Use setTimeout to ensure callback runs in next tick for better reliability
            setTimeout(() => {
              try {
                callback(...args);
                // Trigger additional state polling after WinnersSelected to ensure state sync
                setTimeout(() => {
                  if (mountedRef.current && contractRef.current) {
                    console.log('🔄 Additional state poll after WinnersSelected event');
                    // Force a state poll to ensure UI updates even if RPC had issues
                    const pollForStateChanges = async () => {
                      try {
                        const stateNum = await contractRef.current.state();
                        const stateValue = stateNum.toNumber ? stateNum.toNumber() : Number(stateNum);
                        if (onStateChange) {
                          onStateChange(stateValue, null);
                        }
                      } catch (error) {
                        console.warn('Error in additional state poll:', error);
                      }
                    };
                    pollForStateChanges();
                  }
                }, 3000); // 3 second delay for RPC stabilization
              } catch (error) {
                console.error('Error in WinnersSelected callback:', error);
              }
            }, 1000); // 1 second delay for immediate processing
          } else {
            callback(...args);
          }
        }
      } catch (error) {
        console.error(`Error handling ${eventName} event:`, error);
      }
    };
  }, []);

  // Set up event listeners with conditional listening based on raffle state
  const setupEventListeners = useCallback(() => {
    if (!contractRef.current || !connected) {
      return;
    }

    // Check if we should listen based on raffle state
    if (!shouldListen()) {
      console.log(`🎧 Skipping event listeners setup - raffle state ${currentRaffleState} doesn't require listening`);
      return;
    }

    try {
      console.log(`🎧 Setting up event listeners for raffle: ${raffleAddress} (state: ${currentRaffleState})`);

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

      // PrizeClaimed event — Pool.sol emits PrizeClaimed(address indexed winner, uint256 amount)
      if (onPrizeClaimed) {
        const prizeHandler = createEventHandler('PrizeClaimed', (winner, amount, event) => {
          onPrizeClaimed(winner, amount, event);
        });
        contract.on('PrizeClaimed', prizeHandler);
        listenersRef.current.push({ contract, event: 'PrizeClaimed', handler: prizeHandler });
      }

      // SlotsPurchased event
      if (onTicketsPurchased) {
        const ticketsHandler = createEventHandler('SlotsPurchased', (participant, quantity, event) => {
          onTicketsPurchased(participant, quantity, event);
        });
        contract.on('SlotsPurchased', ticketsHandler);
        listenersRef.current.push({ contract, event: 'SlotsPurchased', handler: ticketsHandler });
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

    // Check if we should stop polling based on terminal/completion status
    if ([5, 6, 7].includes(currentRaffleState) || (stopOnCompletion && currentRaffleState === 4)) {
      return;
    }

    const pollForStateChanges = async () => {
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds

      const attemptPoll = async () => {
        try {
          if (!mountedRef.current || !contractRef.current) return;

          // Enhanced RPC resilience: retry on 500 errors
          const currentBlock = await provider?.getBlockNumber().catch(async (error) => {
            if (error.message?.includes('500') && retryCount < maxRetries) {
              console.warn(`RPC 500 error on getBlockNumber, retrying (${retryCount + 1}/${maxRetries})...`);

              // Notify about RPC error on first attempt
              if (retryCount === 0 && onRpcError) {
                onRpcError(error);
              }

              retryCount++;
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              return provider?.getBlockNumber();
            }
            throw error;
          });

          if (currentBlock && currentBlock !== lastBlockNumber) {
            setLastBlockNumber(currentBlock);

            // Check for state changes by polling contract state with retry logic
            const stateNum = await contractRef.current.state().catch(async (error) => {
              if (error.message?.includes('500') && retryCount < maxRetries) {
                console.warn(`RPC 500 error on state(), retrying (${retryCount + 1}/${maxRetries})...`);

                // Notify about RPC error on first attempt
                if (retryCount === 0 && onRpcError) {
                  onRpcError(error);
                }

                retryCount++;
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return contractRef.current.state();
              }
              throw error;
            });

            const stateValue = stateNum.toNumber ? stateNum.toNumber() : Number(stateNum);

            // Trigger state change callback
            if (onStateChange) {
              onStateChange(stateValue, currentBlock);
            }
          }
        } catch (error) {
          const errorMessage = error.message || error.toString();

          // Enhanced error handling for RPC issues with callback notification
          if (errorMessage.includes('500') || errorMessage.includes('Non-200 status code')) {
            console.warn('RPC server error during state polling, will retry on next cycle:', errorMessage);

            // Notify about RPC error for auto-refresh logic
            if (onRpcError) {
              onRpcError(error);
            }

            // Don't throw error, just log and continue - next polling cycle will retry
          } else {
            console.warn('Error during state polling:', error);
          }
        }
      };

      await attemptPoll();
    };

    // Initial poll
    pollForStateChanges();

    // Set up interval
    pollingRef.current = setInterval(pollForStateChanges, pollingInterval);
    console.log(`📊 State polling enabled (${pollingInterval}ms interval)`);
  }, [enablePolling, onStateChange, provider, lastBlockNumber, pollingInterval, stopOnCompletion, currentRaffleState]);

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

  // Auto-start listening when dependencies are ready or raffle state changes
  useEffect(() => {
    if (autoStart && raffleAddress && contractRef.current && connected) {
      console.log(`🔄 Auto-starting listeners due to dependency change (state: ${currentRaffleState})`);
      startListening();
    }

    return () => {
      stopListening();
    };
  }, [autoStart, raffleAddress, connected, currentRaffleState, startListening, stopListening]);

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
