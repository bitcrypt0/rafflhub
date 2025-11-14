/**
 * Pool Metadata Service
 * 
 * Handles querying and caching of pool metadata from PoolMetadataSet events.
 * Works independently of Supabase - queries events directly from blockchain.
 * 
 * Search Strategy:
 * 1. First checks in-memory cache (5 min expiry)
 * 2. Queries recent blocks (last 10,000) for metadata events
 * 3. If not found, locates pool creation block via PoolCreated event
 * 4. Searches from creation block (metadata emitted at pool creation)
 * 5. Uses chunked backward search with 5k block chunks for older pools
 * 6. Safety limit: searches up to 100k blocks back
 * 
 * This approach balances RPC provider limits with comprehensive coverage.
 */

import { ethers } from 'ethers';

// In-memory cache for metadata
const metadataCache = new Map();

// Cache expiry time (5 minutes)
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Get pool creation block number from PoolCreated event
 * @param {string} poolAddress - Address of the pool
 * @param {ethers.Contract} poolDeployerContract - PoolDeployer contract instance
 * @param {number} currentBlock - Current block number
 * @returns {Promise<number|null>} Block number where pool was created, or null if not found
 */
async function getPoolCreationBlock(poolAddress, poolDeployerContract, currentBlock) {
  try {
    // First try recent blocks (last 10000)
    const recentFromBlock = Math.max(0, currentBlock - 10000);
    const createdFilter = poolDeployerContract.filters.PoolCreated(poolAddress);
    let createdEvents = await poolDeployerContract.queryFilter(createdFilter, recentFromBlock, currentBlock);
    
    if (createdEvents.length > 0) {
      return createdEvents[0].blockNumber;
    }
    
    // If not found in recent blocks, do binary search for older pools
    // This is more efficient than querying all blocks
    let left = 0;
    let right = recentFromBlock;
    const chunkSize = 5000; // Safe chunk size for most RPC providers
    
    while (left <= right) {
      const searchFrom = Math.max(0, right - chunkSize);
      const searchTo = right;
      
      try {
        createdEvents = await poolDeployerContract.queryFilter(createdFilter, searchFrom, searchTo);
        
        if (createdEvents.length > 0) {
          return createdEvents[0].blockNumber;
        }
        
        // Move to earlier blocks
        right = searchFrom - 1;
      } catch (error) {
        console.warn(`Error searching blocks ${searchFrom}-${searchTo}:`, error.message);
        // If chunk fails, try smaller chunk
        right = searchFrom - 1;
      }
      
      // Safety limit: don't search more than 100k blocks back
      if (currentBlock - right > 100000) {
        break;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding pool creation block:', error);
    return null;
  }
}

/**
 * Get pool metadata from PoolMetadataSet event
 * @param {string} poolAddress - Address of the pool
 * @param {ethers.Contract} poolDeployerContract - PoolDeployer contract instance
 * @returns {Promise<Object|null>} Metadata object or null if not found
 */
export async function getPoolMetadata(poolAddress, poolDeployerContract) {
  if (!poolAddress || !poolDeployerContract) {
    return null;
  }

  // Check cache first
  const cacheKey = poolAddress.toLowerCase();
  const cached = metadataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
    return cached.data;
  }

  try {
    const provider = poolDeployerContract.provider;
    const currentBlock = await provider.getBlockNumber();
    
    // Query PoolMetadataSet event for this pool
    const filter = poolDeployerContract.filters.PoolMetadataSet(poolAddress);
    
    // First try recent blocks (last 10000)
    const recentFromBlock = Math.max(0, currentBlock - 10000);
    let events = await poolDeployerContract.queryFilter(filter, recentFromBlock, currentBlock);

    // If not found in recent blocks, try to find pool creation block and search from there
    if (events.length === 0) {
      const creationBlock = await getPoolCreationBlock(poolAddress, poolDeployerContract, currentBlock);
      
      if (creationBlock !== null) {
        // Search from creation block with a reasonable range (metadata is emitted right after creation)
        const searchFrom = creationBlock;
        const searchTo = Math.min(creationBlock + 100, currentBlock); // Metadata should be within 100 blocks of creation
        
        try {
          events = await poolDeployerContract.queryFilter(filter, searchFrom, searchTo);
        } catch (error) {
          console.warn('Error querying metadata from creation block:', error.message);
        }
      }
    }

    if (events.length === 0) {
      // No metadata set for this pool
      const emptyMetadata = {
        description: '',
        twitterLink: '',
        discordLink: '',
        telegramLink: '',
        hasMetadata: false
      };
      
      // Cache the empty result
      metadataCache.set(cacheKey, {
        data: emptyMetadata,
        timestamp: Date.now()
      });
      
      return emptyMetadata;
    }

    // Get the most recent event (should only be one)
    const event = events[events.length - 1];
    const metadata = {
      description: event.args.description || '',
      twitterLink: event.args.twitterLink || '',
      discordLink: event.args.discordLink || '',
      telegramLink: event.args.telegramLink || '',
      hasMetadata: true,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    };

    // Cache the result
    metadataCache.set(cacheKey, {
      data: metadata,
      timestamp: Date.now()
    });

    return metadata;
  } catch (error) {
    console.error('Error fetching pool metadata:', error);
    return null;
  }
}

/**
 * Batch fetch metadata for multiple pools
 * @param {string[]} poolAddresses - Array of pool addresses
 * @param {ethers.Contract} poolDeployerContract - PoolDeployer contract instance
 * @returns {Promise<Map<string, Object>>} Map of pool address to metadata
 */
export async function batchGetPoolMetadata(poolAddresses, poolDeployerContract) {
  if (!poolAddresses || poolAddresses.length === 0 || !poolDeployerContract) {
    return new Map();
  }

  const results = new Map();

  try {
    // Query all PoolMetadataSet events from recent blocks
    const filter = poolDeployerContract.filters.PoolMetadataSet();
    
    // Get current block and query last 10000 blocks to avoid RPC limits
    const provider = poolDeployerContract.provider;
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    const events = await poolDeployerContract.queryFilter(filter, fromBlock, currentBlock);

    // Create a map of pool address to metadata
    const metadataMap = new Map();
    events.forEach(event => {
      const poolAddr = event.args.pool.toLowerCase();
      metadataMap.set(poolAddr, {
        description: event.args.description || '',
        twitterLink: event.args.twitterLink || '',
        discordLink: event.args.discordLink || '',
        telegramLink: event.args.telegramLink || '',
        hasMetadata: true,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      });
    });

    // Track pools not found in recent blocks
    const poolsNotFound = [];

    // Process requested pools
    poolAddresses.forEach(addr => {
      const cacheKey = addr.toLowerCase();
      const metadata = metadataMap.get(cacheKey);
      
      if (metadata) {
        results.set(addr, metadata);
        // Cache the result
        metadataCache.set(cacheKey, {
          data: metadata,
          timestamp: Date.now()
        });
      } else {
        poolsNotFound.push(addr);
      }
    });

    // For pools not found in recent blocks, fall back to individual queries
    // This handles older pools beyond the 10k block range
    if (poolsNotFound.length > 0) {
      console.log(`Fetching metadata for ${poolsNotFound.length} older pools individually...`);
      
      for (const addr of poolsNotFound) {
        try {
          const metadata = await getPoolMetadata(addr, poolDeployerContract);
          if (metadata) {
            results.set(addr, metadata);
          }
        } catch (error) {
          console.warn(`Failed to fetch metadata for pool ${addr}:`, error.message);
          // Set empty metadata for failed pools
          results.set(addr, {
            description: '',
            twitterLink: '',
            discordLink: '',
            telegramLink: '',
            hasMetadata: false
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Error batch fetching pool metadata:', error);
    return results;
  }
}

/**
 * Clear metadata cache for a specific pool or all pools
 * @param {string|null} poolAddress - Pool address to clear, or null to clear all
 */
export function clearMetadataCache(poolAddress = null) {
  if (poolAddress) {
    metadataCache.delete(poolAddress.toLowerCase());
  } else {
    metadataCache.clear();
  }
}

/**
 * Check if pool has any metadata set
 * @param {Object} metadata - Metadata object
 * @returns {boolean} True if pool has any metadata
 */
export function hasAnyMetadata(metadata) {
  if (!metadata) return false;
  
  return !!(
    metadata.description ||
    metadata.twitterLink ||
    metadata.discordLink ||
    metadata.telegramLink
  );
}

/**
 * Validate social media link format
 * @param {string} link - Social media link
 * @param {string} platform - Platform name ('twitter', 'discord', 'telegram')
 * @returns {boolean} True if link is valid
 */
export function validateSocialLink(link, platform) {
  if (!link) return true; // Empty is valid

  const patterns = {
    twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?$/,
    discord: /^https?:\/\/(www\.)?discord\.(gg|com)\/.+$/,
    telegram: /^https?:\/\/(www\.)?t\.me\/.+$/
  };

  const pattern = patterns[platform];
  return pattern ? pattern.test(link) : true;
}

/**
 * Format social media link for display
 * @param {string} link - Social media link
 * @param {string} platform - Platform name
 * @returns {string} Formatted link text
 */
export function formatSocialLink(link, platform) {
  if (!link) return '';

  try {
    const url = new URL(link);
    const pathname = url.pathname;

    switch (platform) {
      case 'twitter':
        // Extract username from twitter.com/@username or x.com/@username
        const twitterMatch = pathname.match(/\/@?([a-zA-Z0-9_]+)/);
        return twitterMatch ? `@${twitterMatch[1]}` : link;
      
      case 'discord':
        // Show the invite code
        const discordMatch = pathname.match(/\/([a-zA-Z0-9]+)$/);
        return discordMatch ? `discord.gg/${discordMatch[1]}` : link;
      
      case 'telegram':
        // Extract channel/group name
        const telegramMatch = pathname.match(/\/([a-zA-Z0-9_]+)/);
        return telegramMatch ? `t.me/${telegramMatch[1]}` : link;
      
      default:
        return link;
    }
  } catch (error) {
    return link;
  }
}

export default {
  getPoolMetadata,
  batchGetPoolMetadata,
  clearMetadataCache,
  hasAnyMetadata,
  validateSocialLink,
  formatSocialLink
};
