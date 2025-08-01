import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Context for tracking collab detection results from RaffleCard components
 * This allows FilterSidebar to use the accurate async detection results
 */
const CollabDetectionContext = createContext();

export const useCollabDetection = () => {
  const context = useContext(CollabDetectionContext);
  if (!context) {
    throw new Error('useCollabDetection must be used within a CollabDetectionProvider');
  }
  return context;
};

export const CollabDetectionProvider = ({ children }) => {
  // Store collab detection results: { raffleAddress: 'nft_collab' | 'whitelist_collab' | 'not_collab' }
  const [collabResults, setCollabResults] = useState({});

  // Store loading states: { raffleAddress: boolean }
  const [loadingStates, setLoadingStates] = useState({});

  // Update collab status for a specific raffle
  const updateCollabStatus = useCallback((raffleAddress, collabType) => {
    setCollabResults(prev => ({
      ...prev,
      [raffleAddress]: collabType
    }));

    // Remove from loading states
    setLoadingStates(prev => {
      const newState = { ...prev };
      delete newState[raffleAddress];
      return newState;
    });
  }, []);

  // Set loading state for a raffle
  const setCollabLoading = useCallback((raffleAddress, isLoading) => {
    setLoadingStates(prev => ({
      ...prev,
      [raffleAddress]: isLoading
    }));
  }, []);

  // Get collab status for a raffle
  const getCollabStatus = useCallback((raffleAddress) => {
    return collabResults[raffleAddress];
  }, [collabResults]);

  // Check if a raffle is still loading
  const isCollabLoading = useCallback((raffleAddress) => {
    return loadingStates[raffleAddress] || false;
  }, [loadingStates]);

  // Get enhanced raffle type (includes async collab detection)
  const getEnhancedRaffleType = useCallback((raffle) => {
    const collabStatus = collabResults[raffle.address];

    // If we have async collab detection result, use it
    if (collabStatus === 'nft_collab' || collabStatus === 'whitelist_collab') {
      return collabStatus;
    }

    // If still loading or no result, fall back to synchronous detection
    if (collabStatus === undefined && loadingStates[raffle.address]) {
      // Still checking, use fallback logic (prioritize NFT Collab)
      if (raffle.isExternallyPrized) {
        return 'nft_collab';
      }
    }

    // If definitely not collab or no async result available
    if (collabStatus === 'not_collab' || collabStatus === undefined) {
      return raffle.isPrized ? 'prized' : 'non_prized';
    }

    return raffle.isPrized ? 'prized' : 'non_prized';
  }, [collabResults, loadingStates]);

  // Count raffles by enhanced types
  const countEnhancedRaffleTypes = useCallback((raffles) => {
    const counts = {
      non_prized: 0,
      prized: 0,
      nft_collab: 0,
      whitelist_collab: 0
    };

    raffles.forEach(raffle => {
      const type = getEnhancedRaffleType(raffle);
      counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
  }, [getEnhancedRaffleType]);

  // Filter raffles by enhanced type
  const filterByEnhancedType = useCallback((raffles, selectedTypes) => {
    if (!selectedTypes || selectedTypes.length === 0) {
      return raffles;
    }

    return raffles.filter(raffle => {
      const type = getEnhancedRaffleType(raffle);
      return selectedTypes.includes(type);
    });
  }, [getEnhancedRaffleType]);

  const value = {
    // State
    collabResults,
    loadingStates,
    
    // Actions
    updateCollabStatus,
    setCollabLoading,
    
    // Getters
    getCollabStatus,
    isCollabLoading,
    getEnhancedRaffleType,
    
    // Enhanced filtering
    countEnhancedRaffleTypes,
    filterByEnhancedType
  };

  return (
    <CollabDetectionContext.Provider value={value}>
      {children}
    </CollabDetectionContext.Provider>
  );
};
