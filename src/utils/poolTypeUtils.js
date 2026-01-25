/**
 * Pool Type Detection Utilities
 *
 * Provides utilities for detecting and classifying different pool types
 * used for conditional rendering on RaffleDetailPage.
 */

import { ethers } from 'ethers';

/**
 * Pool Type Constants
 */
export const PoolTypes = {
  // NFT Prize Pools (use NFT Showcase Layout)
  NFT_DROP_721: 'nft-drop-721',       // Mintable ERC721 NFT
  NFT_DROP_1155: 'nft-drop-1155',     // Mintable ERC1155 NFT
  NFT_LUCKY_SALE: 'nft-lucky-sale',   // Escrowed NFT (LuckySale/Giveaway)

  // Non-NFT Prize Pools (use Standard Layout)
  WHITELIST: 'whitelist',             // No prize, whitelist spots
  NATIVE_GIVEAWAY: 'native-giveaway', // Native coin prize (ETH, etc.)
  ERC20_GIVEAWAY: 'erc20-giveaway',   // ERC20 token prize
};

/**
 * NFT Standard Constants (matching smart contract enum)
 */
export const NFTStandard = {
  ERC721: 0,
  ERC1155: 1,
};

/**
 * Check if a pool has an NFT prize
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {boolean} - True if the pool has an NFT prize
 */
export const isNFTPrizedPool = (raffle) => {
  if (!raffle) return false;

  // Must be marked as prized
  if (raffle.isPrized !== true) return false;

  // Must have a valid prize collection address
  const hasValidCollection =
    raffle.prizeCollection &&
    raffle.prizeCollection !== ethers.constants.AddressZero;

  if (!hasValidCollection) return false;

  // Must have a valid NFT standard (0 = ERC721, 1 = ERC1155)
  const hasValidStandard =
    raffle.standard === NFTStandard.ERC721 ||
    raffle.standard === NFTStandard.ERC1155;

  return hasValidStandard;
};

/**
 * Check if a pool is a mintable NFT pool (not escrowed)
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {boolean} - True if mintable NFT pool
 */
export const isMintableNFTPool = (raffle) => {
  if (!isNFTPrizedPool(raffle)) return false;
  return raffle.isEscrowedPrize === false;
};

/**
 * Check if a pool is an escrowed NFT pool (LuckySale/Giveaway)
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {boolean} - True if escrowed NFT pool
 */
export const isEscrowedNFTPool = (raffle) => {
  if (!isNFTPrizedPool(raffle)) return false;
  return raffle.isEscrowedPrize === true;
};

/**
 * Check if a pool has a native coin prize
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {boolean} - True if pool has native coin prize
 */
export const hasNativePrize = (raffle) => {
  if (!raffle) return false;
  return (
    raffle.nativePrizeAmount &&
    raffle.nativePrizeAmount.gt &&
    raffle.nativePrizeAmount.gt(0)
  );
};

/**
 * Check if a pool has an ERC20 token prize
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {boolean} - True if pool has ERC20 token prize
 */
export const hasERC20Prize = (raffle) => {
  if (!raffle) return false;

  const hasValidToken =
    raffle.erc20PrizeToken &&
    raffle.erc20PrizeToken !== ethers.constants.AddressZero;

  const hasValidAmount =
    raffle.erc20PrizeAmount &&
    raffle.erc20PrizeAmount.gt &&
    raffle.erc20PrizeAmount.gt(0);

  return hasValidToken && hasValidAmount;
};

/**
 * Check if a pool is a whitelist pool (no prize)
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {boolean} - True if whitelist pool
 */
export const isWhitelistPool = (raffle) => {
  if (!raffle) return false;

  // Not a prized pool
  if (raffle.isPrized === true) return false;

  // No native prize
  if (hasNativePrize(raffle)) return false;

  // No ERC20 prize
  if (hasERC20Prize(raffle)) return false;

  // No NFT prize
  if (isNFTPrizedPool(raffle)) return false;

  return true;
};

/**
 * Get the pool type for a given raffle
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {string|null} - Pool type constant or null if unknown
 */
export const getPoolType = (raffle) => {
  if (!raffle) return null;

  // Check for NFT pools first (highest priority)
  if (isNFTPrizedPool(raffle)) {
    // Escrowed NFT (LuckySale/Giveaway)
    if (raffle.isEscrowedPrize === true) {
      return PoolTypes.NFT_LUCKY_SALE;
    }

    // Mintable NFT Drop
    if (raffle.standard === NFTStandard.ERC721) {
      return PoolTypes.NFT_DROP_721;
    }
    if (raffle.standard === NFTStandard.ERC1155) {
      return PoolTypes.NFT_DROP_1155;
    }
  }

  // Native coin prize
  if (hasNativePrize(raffle)) {
    return PoolTypes.NATIVE_GIVEAWAY;
  }

  // ERC20 token prize
  if (hasERC20Prize(raffle)) {
    return PoolTypes.ERC20_GIVEAWAY;
  }

  // Default to whitelist
  return PoolTypes.WHITELIST;
};

/**
 * Get pool type display information
 *
 * @param {string} poolType - Pool type constant
 * @returns {Object} - Display info with label and icon name
 */
export const getPoolTypeDisplay = (poolType) => {
  const displayMap = {
    [PoolTypes.NFT_DROP_721]: {
      label: 'NFT Drop',
      sublabel: 'ERC721',
      iconName: 'Sparkles',
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-500/10',
    },
    [PoolTypes.NFT_DROP_1155]: {
      label: 'NFT Drop',
      sublabel: 'ERC1155',
      iconName: 'Sparkles',
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-500/10',
    },
    [PoolTypes.NFT_LUCKY_SALE]: {
      label: 'NFT Giveaway',
      sublabel: 'Escrowed',
      iconName: 'Gift',
      colorClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10',
    },
    [PoolTypes.WHITELIST]: {
      label: 'Whitelist',
      sublabel: 'Spot Raffle',
      iconName: 'Trophy',
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-500/10',
    },
    [PoolTypes.NATIVE_GIVEAWAY]: {
      label: 'Giveaway',
      sublabel: 'Native Token',
      iconName: 'Coins',
      colorClass: 'text-green-500',
      bgClass: 'bg-green-500/10',
    },
    [PoolTypes.ERC20_GIVEAWAY]: {
      label: 'Giveaway',
      sublabel: 'ERC20 Token',
      iconName: 'Coins',
      colorClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/10',
    },
  };

  return displayMap[poolType] || {
    label: 'Pool',
    sublabel: 'Unknown Type',
    iconName: 'HelpCircle',
    colorClass: 'text-gray-500',
    bgClass: 'bg-gray-500/10',
  };
};

/**
 * Determine which layout should be used for a pool
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {'nft' | 'standard'} - Layout type to use
 */
export const getLayoutType = (raffle) => {
  return isNFTPrizedPool(raffle) ? 'nft' : 'standard';
};

/**
 * Check if layout should use NFT showcase format
 *
 * @param {Object} raffle - The raffle/pool data object
 * @returns {boolean} - True if NFT showcase layout should be used
 */
export const shouldUseNFTLayout = (raffle) => {
  return getLayoutType(raffle) === 'nft';
};

export default {
  PoolTypes,
  NFTStandard,
  isNFTPrizedPool,
  isMintableNFTPool,
  isEscrowedNFTPool,
  hasNativePrize,
  hasERC20Prize,
  isWhitelistPool,
  getPoolType,
  getPoolTypeDisplay,
  getLayoutType,
  shouldUseNFTLayout,
};
