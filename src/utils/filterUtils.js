import { ethers } from 'ethers';

/**
 * Utility functions for raffle filtering
 */

/**
 * Get raffle state from stateNum
 * @param {number} stateNum - Raffle state number
 * @returns {string} - Raffle state string
 */
export const getRaffleState = (stateNum) => {
  const stateMap = {
    0: 'pending',
    1: 'active', 
    2: 'ended',
    3: 'drawing',
    4: 'completed',
    5: 'deleted',
    6: 'activation_failed',
    7: 'all_prizes_claimed',
    8: 'unengaged'
  };
  return stateMap[stateNum] || 'ended';
};

/**
 * Determine raffle type (prized vs non-prized)
 * @param {Object} raffle - Raffle object
 * @returns {string} - 'prized' or 'non_prized'
 */
export const getRaffleType = (raffle) => {
  return raffle.isPrized ? 'prized' : 'non_prized';
};

/**
 * Determine prize type from raffle data
 * @param {Object} raffle - Raffle object
 * @returns {string} - Prize type
 */
export const getPrizeType = (raffle) => {
  if (!raffle.isPrized) return null;
  
  // Check for external collaboration
  if (raffle.isExternallyPrized && raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
    return 'collab';
  }
  
  // Check for ETH prize
  if (raffle.ethPrizeAmount && raffle.ethPrizeAmount.gt && raffle.ethPrizeAmount.gt(0)) {
    return 'eth';
  }
  
  // Check for ERC20 prize
  if (raffle.erc20PrizeToken && 
      raffle.erc20PrizeToken !== ethers.constants.AddressZero && 
      raffle.erc20PrizeAmount && 
      raffle.erc20PrizeAmount.gt && 
      raffle.erc20PrizeAmount.gt(0)) {
    return 'erc20';
  }
  
  // Check for NFT prize
  if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
    return 'nft';
  }
  
  // Generic token giveaway
  return 'token_giveaway';
};

/**
 * Determine prize standards from raffle data
 * @param {Object} raffle - Raffle object
 * @returns {Array} - Array of applicable standards
 */
export const getPrizeStandards = (raffle) => {
  if (!raffle.isPrized) return [];
  
  const standards = [];
  
  // ETH standard
  if (raffle.ethPrizeAmount && raffle.ethPrizeAmount.gt && raffle.ethPrizeAmount.gt(0)) {
    standards.push('eth');
  }
  
  // ERC20 standard
  if (raffle.erc20PrizeToken && 
      raffle.erc20PrizeToken !== ethers.constants.AddressZero && 
      raffle.erc20PrizeAmount && 
      raffle.erc20PrizeAmount.gt && 
      raffle.erc20PrizeAmount.gt(0)) {
    standards.push('erc20');
  }
  
  // NFT standards (ERC721/ERC1155)
  if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
    if (raffle.standard === 0) {
      standards.push('erc721');
    } else if (raffle.standard === 1) {
      standards.push('erc1155');
    }
  }
  
  return standards;
};

/**
 * Apply filters to raffles array
 * @param {Array} raffles - Array of raffle objects
 * @param {Object} filters - Filter object with categories
 * @returns {Array} - Filtered raffles array
 */
export const applyFilters = (raffles, filters) => {
  if (!raffles || raffles.length === 0) return [];
  
  return raffles.filter(raffle => {
    // Filter by raffle state
    if (filters.raffleState && filters.raffleState.length > 0) {
      const raffleState = getRaffleState(raffle.stateNum);
      if (!filters.raffleState.includes(raffleState)) {
        return false;
      }
    }
    
    // Filter by raffle type
    if (filters.raffleType && filters.raffleType.length > 0) {
      const raffleType = getRaffleType(raffle);
      if (!filters.raffleType.includes(raffleType)) {
        return false;
      }
    }
    
    // Filter by prize type (only for prized raffles)
    if (filters.prizeType && filters.prizeType.length > 0) {
      if (!raffle.isPrized) {
        return false;
      }
      const prizeType = getPrizeType(raffle);
      if (!filters.prizeType.includes(prizeType)) {
        return false;
      }
    }
    
    // Filter by prize standard (only for prized raffles)
    if (filters.prizeStandard && filters.prizeStandard.length > 0) {
      if (!raffle.isPrized) {
        return false;
      }
      const prizeStandards = getPrizeStandards(raffle);
      const hasMatchingStandard = filters.prizeStandard.some(standard => 
        prizeStandards.includes(standard)
      );
      if (!hasMatchingStandard) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * Count raffles by filter categories for display
 * @param {Array} raffles - Array of raffle objects
 * @returns {Object} - Count object with categories
 */
export const countRafflesByFilters = (raffles) => {
  if (!raffles || raffles.length === 0) {
    return {
      raffleState: {},
      raffleType: {},
      prizeType: {},
      prizeStandard: {}
    };
  }
  
  const counts = {
    raffleState: {},
    raffleType: {},
    prizeType: {},
    prizeStandard: {}
  };
  
  raffles.forEach(raffle => {
    // Count by state
    const state = getRaffleState(raffle.stateNum);
    counts.raffleState[state] = (counts.raffleState[state] || 0) + 1;
    
    // Count by type
    const type = getRaffleType(raffle);
    counts.raffleType[type] = (counts.raffleType[type] || 0) + 1;
    
    // Count by prize type (only for prized)
    if (raffle.isPrized) {
      const prizeType = getPrizeType(raffle);
      if (prizeType) {
        counts.prizeType[prizeType] = (counts.prizeType[prizeType] || 0) + 1;
      }
      
      // Count by standards
      const standards = getPrizeStandards(raffle);
      standards.forEach(standard => {
        counts.prizeStandard[standard] = (counts.prizeStandard[standard] || 0) + 1;
      });
    }
  });
  
  return counts;
};

/**
 * Get default filter state
 * @returns {Object} - Default filter object
 */
export const getDefaultFilters = () => ({
  raffleState: [],
  raffleType: [],
  prizeType: [],
  prizeStandard: []
});

/**
 * Check if filters are empty
 * @param {Object} filters - Filter object
 * @returns {boolean} - True if no filters are active
 */
export const areFiltersEmpty = (filters) => {
  return Object.values(filters).every(filterArray => 
    !filterArray || filterArray.length === 0
  );
};
