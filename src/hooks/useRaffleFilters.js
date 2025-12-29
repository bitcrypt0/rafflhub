import { useState, useMemo, useCallback } from 'react';
import {
  applyFilters,
  getDefaultFilters,
  areFiltersEmpty
} from '../utils/filterUtils';
import { useCollabDetection } from '../contexts/CollabDetectionContext';

/**
 * Custom hook for managing raffle filters
 * @param {Array} raffles - Array of raffle objects
 * @param {string} searchQuery - Search query string
 * @returns {Object} - Filter state and methods
 */
export const useRaffleFilters = (raffles = [], searchQuery = '') => {
  const { filterByEnhancedType } = useCollabDetection();

  // Filter state
  const [filters, setFilters] = useState(getDefaultFilters());
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Apply filters to raffles using enhanced detection for raffle types
  const filteredRaffles = useMemo(() => {
    let filtered = raffles;

    // Apply search filter first
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(raffle => {
        // Search by pool name
        if (raffle.name && raffle.name.toLowerCase().includes(query)) {
          return true;
        }
        // Search by contract address
        if (raffle.address && raffle.address.toLowerCase().includes(query)) {
          return true;
        }
        return false;
      });
    }

    // If no filters and no search, return all raffles
    if (areFiltersEmpty(filters) && !searchQuery) {
      return filtered;
    }

    // Apply enhanced raffle type filtering
    if (filters.raffleType && filters.raffleType.length > 0) {
      filtered = filterByEnhancedType(filtered, filters.raffleType);
    }

    // Apply other filters using standard logic
    const otherFilters = {
      ...filters,
      raffleType: [] // Remove raffle type since we handled it above
    };

    if (!areFiltersEmpty(otherFilters)) {
      filtered = applyFilters(filtered, otherFilters);
    }

    return filtered;
  }, [raffles, filters, searchQuery, filterByEnhancedType]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !areFiltersEmpty(filters) || (searchQuery && searchQuery.trim() !== '');
  }, [filters, searchQuery]);

  // Filter methods
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(getDefaultFilters());
  }, []);

  const toggleFilter = useCallback(() => {
    setIsFilterOpen(prev => !prev);
  }, []);

  const openFilter = useCallback(() => {
    setIsFilterOpen(true);
  }, []);

  const closeFilter = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  // Filter by specific category (helper methods)
  const filterByState = useCallback((states) => {
    setFilters(prev => ({
      ...prev,
      raffleState: Array.isArray(states) ? states : [states]
    }));
  }, []);

  const filterByType = useCallback((type) => {
    setFilters(prev => ({
      ...prev,
      raffleType: [type]
    }));
  }, []);

  const filterByPrizeType = useCallback((prizeTypes) => {
    setFilters(prev => ({
      ...prev,
      prizeType: Array.isArray(prizeTypes) ? prizeTypes : [prizeTypes]
    }));
  }, []);

  const filterByPrizeStandard = useCallback((standards) => {
    setFilters(prev => ({
      ...prev,
      prizeStandard: Array.isArray(standards) ? standards : [standards]
    }));
  }, []);

  return {
    // State
    filters,
    filteredRaffles,
    isFilterOpen,
    hasActiveFilters,
    
    // Methods
    updateFilters,
    clearFilters,
    toggleFilter,
    openFilter,
    closeFilter,
    
    // Helper methods
    filterByState,
    filterByType,
    filterByPrizeType,
    filterByPrizeStandard,
    
    // Computed values
    totalRaffles: raffles.length,
    filteredCount: filteredRaffles.length
  };
};
