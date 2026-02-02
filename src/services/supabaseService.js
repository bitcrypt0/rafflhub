/**
 * Supabase Service
 * Provides cached blockchain data through REST API endpoints
 * Replaces direct RPC calls with fast database queries
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

class SupabaseService {
  constructor() {
    this.client = null;
    this.cache = new Map();
    this.cacheTimeout = 30 * 1000; // 30 seconds for API results
    this.subscriptions = new Map();
  }

  /**
   * Initialize Supabase client
   */
  initialize() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('⚠️ Supabase credentials not configured');
      return false;
    }

    try {
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false, // Don't need session for public data
        },
        realtime: {
          params: {
            eventsPerSecond: 10, // Rate limiting for realtime
          },
        },
      });
      console.log('✅ Supabase client initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      return false;
    }
  }

  /**
   * Check if Supabase is available
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Get from cache or fetch
   */
  async getCached(key, fetcher, ttl = this.cacheTimeout) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Clear cache for a specific key or all
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  // ==================== POOLS API ====================

  /**
   * Get all pools with filters
   * @param {Object} options - Query options
   * @param {number} options.chainId - Chain ID filter
   * @param {string} options.creator - Creator address filter
   * @param {number|number[]} options.state - Pool state(s) (0=pending, 1=active, 2=ended, 3=drawing, 4=completed)
   * @param {boolean} options.isPrized - Filter prized pools
   * @param {number} options.limit - Results per page
   * @param {number} options.offset - Pagination offset
   * @param {string} options.sortBy - Sort field
   * @param {string} options.sortOrder - Sort order (asc/desc)
   */
  async getPools(options = {}) {
    if (!this.isAvailable()) return null;

    const params = new URLSearchParams();
    if (options.chainId) params.set('chainId', options.chainId);
    if (options.creator) params.set('creator', options.creator.toLowerCase());
    if (options.state !== undefined) {
      params.set('state', Array.isArray(options.state) ? options.state.join(',') : options.state);
    }
    if (options.isPrized !== undefined) params.set('isPrized', options.isPrized);
    if (options.limit) params.set('limit', options.limit);
    if (options.offset) params.set('offset', options.offset);
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortOrder) params.set('sortOrder', options.sortOrder);

    const cacheKey = `pools:${params.toString()}`;

    return this.getCached(cacheKey, async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api-pools?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching pools:', error);
        return null;
      }
    });
  }

  /**
   * Get specific pool with participants and winners
   */
  async getPool(address, chainId) {
    if (!this.isAvailable() || !address) return null;

    const params = new URLSearchParams({
      address: address.toLowerCase(),
      chainId: chainId.toString()
    });

    const cacheKey = `pool:${address}:${chainId}`;

    return this.getCached(cacheKey, async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api-pools?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.pool || null;
      } catch (error) {
        console.error('Error fetching pool:', error);
        return null;
      }
    });
  }

  // ==================== USER API ====================

  /**
   * Get user profile with stats and activity
   * @param {string} address - User wallet address
   * @param {number} chainId - Chain ID filter (optional)
   * @param {Object} options - Additional options
   */
  async getUserProfile(address, chainId = null, options = {}) {
    if (!this.isAvailable() || !address) return null;

    const params = new URLSearchParams({
      address: address.toLowerCase(),
    });

    if (chainId) params.set('chainId', chainId);
    if (options.includeActivity === false) params.set('includeActivity', 'false');
    if (options.includeStats === false) params.set('includeStats', 'false');
    if (options.activityLimit) params.set('activityLimit', options.activityLimit);
    if (options.activityOffset) params.set('activityOffset', options.activityOffset);

    const cacheKey = `user:${address}:${chainId || 'all'}:${options.activityOffset || 0}`;

    return this.getCached(cacheKey, async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api-user?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
    });
  }

  // ==================== COLLECTIONS API ====================

  /**
   * Get NFT collections
   */
  async getCollections(options = {}) {
    if (!this.isAvailable()) return null;

    const params = new URLSearchParams();
    if (options.chainId) params.set('chainId', options.chainId);
    if (options.creator) params.set('creator', options.creator.toLowerCase());
    if (options.isRevealed !== undefined) params.set('isRevealed', options.isRevealed);
    if (options.limit) params.set('limit', options.limit);
    if (options.offset) params.set('offset', options.offset);

    const cacheKey = `collections:${params.toString()}`;

    return this.getCached(cacheKey, async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api-collections?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching collections:', error);
        return null;
      }
    });
  }

  /**
   * Get specific collection with metadata
   */
  async getCollection(address, chainId, includeMetadata = false) {
    if (!this.isAvailable() || !address) return null;

    const params = new URLSearchParams({
      address: address.toLowerCase(),
      chainId: chainId.toString(),
      includeMetadata: includeMetadata.toString()
    });

    const cacheKey = `collection:${address}:${chainId}:${includeMetadata}`;

    return this.getCached(cacheKey, async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api-collections?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.collection || null;
      } catch (error) {
        console.error('Error fetching collection:', error);
        return null;
      }
    });
  }

  /**
   * Get NFT metadata
   */
  async getNFTMetadata(collectionAddress, tokenId, chainId) {
    if (!this.isAvailable() || !collectionAddress || tokenId === undefined) return null;

    const params = new URLSearchParams({
      address: collectionAddress.toLowerCase(),
      tokenId: tokenId.toString(),
      chainId: chainId.toString()
    });

    const cacheKey = `nft:${collectionAddress}:${tokenId}:${chainId}`;

    return this.getCached(cacheKey, async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api-collections?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.metadata || null;
      } catch (error) {
        console.error('Error fetching NFT metadata:', error);
        return null;
      }
    }, 60 * 60 * 1000); // Cache metadata for 1 hour
  }

  // ==================== STATS API ====================

  /**
   * Get platform statistics
   * @param {number} chainId - Chain ID filter (optional)
   * @param {string} period - Time period: 'all', '24h', '7d', '30d'
   */
  async getStats(chainId = null, period = 'all') {
    if (!this.isAvailable()) return null;

    const params = new URLSearchParams({ period });
    if (chainId) params.set('chainId', chainId);

    const cacheKey = `stats:${chainId || 'all'}:${period}`;

    return this.getCached(cacheKey, async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/api-stats?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching stats:', error);
        return null;
      }
    }, 60 * 1000); // Cache stats for 1 minute
  }

  // ==================== REAL-TIME SUBSCRIPTIONS ====================

  /**
   * Subscribe to pool updates
   * @param {string} poolAddress - Pool address to watch
   * @param {number} chainId - Chain ID
   * @param {Function} callback - Callback function for updates
   */
  subscribeToPool(poolAddress, chainId, callback) {
    if (!this.isAvailable() || !poolAddress) return null;

    const key = `pool:${poolAddress}:${chainId}`;

    // Unsubscribe if already subscribed
    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key).unsubscribe();
    }

    const channel = this.client
      .channel(`pool:${poolAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pools',
          filter: `address=eq.${poolAddress.toLowerCase()},chain_id=eq.${chainId}`
        },
        (payload) => {
          console.log('Pool updated:', payload);
          this.clearCache(key);
          callback(payload.new);
        }
      )
      .subscribe();

    this.subscriptions.set(key, channel);
    return channel;
  }

  /**
   * Subscribe to user activity
   * @param {string} userAddress - User address to watch
   * @param {Function} callback - Callback function for updates
   */
  subscribeToUserActivity(userAddress, callback) {
    if (!this.isAvailable() || !userAddress) return null;

    const key = `user:${userAddress}`;

    // Unsubscribe if already subscribed
    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key).unsubscribe();
    }

    const channel = this.client
      .channel(`user:${userAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity',
          filter: `user_address=eq.${userAddress.toLowerCase()}`
        },
        (payload) => {
          console.log('User activity:', payload);
          this.clearCache(key);
          callback(payload.new);
        }
      )
      .subscribe();

    this.subscriptions.set(key, channel);
    return channel;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(key) {
    const channel = this.subscriptions.get(key);
    if (channel) {
      channel.unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.subscriptions.forEach((channel) => channel.unsubscribe());
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();
export default supabaseService;
