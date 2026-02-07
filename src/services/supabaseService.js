/**
 * Supabase Service
 * Provides cached blockchain data through REST API endpoints
 * Replaces direct RPC calls with fast database queries
 */

import { createClient } from '@supabase/supabase-js';

class SupabaseService {
  constructor() {
    this.client = null;
    this.cache = new Map();
    this.cacheTimeout = 30 * 1000; // 30 seconds for API results
    this.subscriptions = new Map();
    this.SUPABASE_URL = null;
    this.SUPABASE_ANON_KEY = null;
  }

  /**
   * Initialize Supabase client
   */
  initialize() {
    // Load environment variables
    this.SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    this.SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

    console.log('🔍 Environment check:', {
      hasUrl: !!this.SUPABASE_URL,
      hasKey: !!this.SUPABASE_ANON_KEY,
      url: this.SUPABASE_URL ? `${this.SUPABASE_URL.slice(0, 30)}...` : 'undefined',
      keyPrefix: this.SUPABASE_ANON_KEY ? `${this.SUPABASE_ANON_KEY.slice(0, 20)}...` : 'undefined'
    });

    if (!this.SUPABASE_URL || !this.SUPABASE_ANON_KEY) {
      console.warn('⚠️ Supabase credentials not configured');
      console.warn('Expected: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
      return false;
    }

    try {
      this.client = createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false, // Don't need session for public data
        },
        realtime: {
          params: {
            eventsPerSecond: 10, // Rate limiting for realtime
          },
        },
      });
      console.log('✅ Supabase client initialized successfully');
      console.log('📡 API Base URL:', `${this.SUPABASE_URL}/functions/v1`);
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
    const available = this.client !== null && this.SUPABASE_URL !== null && this.SUPABASE_ANON_KEY !== null;
    if (!available) {
      console.warn('⚠️ Supabase not available:', {
        hasClient: this.client !== null,
        hasUrl: this.SUPABASE_URL !== null,
        hasKey: this.SUPABASE_ANON_KEY !== null
      });
    }
    return available;
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

  /**
   * Get from cache by key
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache with key, data, and TTL
   */
  setCache(key, data, ttl = this.cacheTimeout) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
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
        const url = `${this.SUPABASE_URL}/functions/v1/api-pools?${params}`;
        console.log('🔄 Fetching pools:', {
          url,
          hasUrl: !!this.SUPABASE_URL,
          hasKey: !!this.SUPABASE_ANON_KEY,
          urlValue: this.SUPABASE_URL?.slice(0, 30)
        });

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('📥 Pools API response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API error response:', errorText);
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Pools data received:', {
          success: data.success,
          poolsCount: data.pools?.length || 0,
          hasPoolsArray: Array.isArray(data.pools)
        });
        return data;
      } catch (error) {
        console.error('❌ Error fetching pools:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
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
        const url = `${this.SUPABASE_URL}/functions/v1/api-pools?${params}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.pool || null;
      } catch (error) {
        console.error('Error fetching pool:', error.message);
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
          `${this.SUPABASE_URL}/functions/v1/api-user?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
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
          `${this.SUPABASE_URL}/functions/v1/api-collections?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
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
          `${this.SUPABASE_URL}/functions/v1/api-collections?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
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
          `${this.SUPABASE_URL}/functions/v1/api-collections?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
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
          `${this.SUPABASE_URL}/functions/v1/api-stats?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
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

  // ============================================
  // FLYWHEEL REWARDS API
  // ============================================

  /**
   * Get flywheel data (points system, pool rewards, creator rewards)
   * @param {Object} options - Query options
   * @param {number} options.chainId - Chain ID
   * @param {string} [options.userAddress] - User address for user-specific data
   * @param {string} [options.poolAddress] - Pool address for pool-specific rewards
   * @param {boolean} [options.includePoolRewards] - Include pool rewards data
   * @param {boolean} [options.includeCreatorRewards] - Include creator rewards data
   * @param {boolean} [options.includeUserPoints] - Include user points data
   */
  async getFlywheelData(options = {}) {
    const {
      chainId,
      userAddress,
      poolAddress,
      includePoolRewards = false,
      includeCreatorRewards = false,
      includeUserPoints = true,
    } = options;

    if (!chainId) {
      console.warn('[SupabaseService] getFlywheelData: chainId required');
      return null;
    }

    const cacheKey = `flywheel:${chainId}:${userAddress || 'anon'}:${poolAddress || 'none'}:${includePoolRewards}:${includeCreatorRewards}`;

    try {
      return await this.getCached(cacheKey, async () => {
        const params = new URLSearchParams({
          chainId: chainId.toString(),
        });

        if (userAddress) params.append('userAddress', userAddress);
        if (poolAddress) params.append('poolAddress', poolAddress);
        if (includePoolRewards) params.append('includePoolRewards', 'true');
        if (includeCreatorRewards) params.append('includeCreatorRewards', 'true');
        if (includeUserPoints) params.append('includeUserPoints', 'true');

        const response = await fetch(
          `${this.SUPABASE_URL}/functions/v1/api-flywheel?${params.toString()}`,
          {
            headers: {
              'apikey': this.SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        return await response.json();
      }, 15000); // 15 second cache for flywheel data
    } catch (error) {
      console.error('[SupabaseService] getFlywheelData error:', error);
      return null;
    }
  }

  /**
   * Get points system info
   */
  async getPointsSystemInfo(chainId) {
    const data = await this.getFlywheelData({ chainId });
    return data?.pointsSystem || null;
  }

  /**
   * Get user points
   */
  async getUserPoints(chainId, userAddress) {
    const data = await this.getFlywheelData({ chainId, userAddress, includeUserPoints: true });
    return data?.userPoints || null;
  }

  /**
   * Get pool rewards info
   */
  async getPoolRewards(chainId, poolAddress, userAddress = null) {
    const data = await this.getFlywheelData({
      chainId,
      poolAddress,
      userAddress,
      includePoolRewards: true,
    });
    return {
      poolRewards: data?.poolRewards || null,
      userPoolClaim: data?.userPoolClaim || null,
    };
  }

  /**
   * Get creator rewards config
   */
  async getCreatorRewards(chainId, poolAddress = null, userAddress = null) {
    const data = await this.getFlywheelData({
      chainId,
      poolAddress,
      userAddress,
      includeCreatorRewards: true,
    });
    return {
      creatorRewards: data?.creatorRewards || [],
      userCreatorClaimsForPool: data?.userCreatorClaimsForPool || [],
    };
  }

  /**
   * Get complete flywheel data for a user and pool
   */
  async getCompleteFlywheelData(chainId, userAddress, poolAddress = null) {
    return await this.getFlywheelData({
      chainId,
      userAddress,
      poolAddress,
      includePoolRewards: !!poolAddress,
      includeCreatorRewards: true,
      includeUserPoints: true,
    });
  }

  // ============================================
  // Pools API Methods (for LandingPage)
  // ============================================

  /**
   * Fetch pools from backend with filters (Enhanced version for LandingPage)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - { pools, pagination, filterCounts }
   */
  async getPoolsEnhanced(options = {}) {
    if (!this.isAvailable()) {
      return { pools: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false }, filterCounts: null };
    }

    const {
      chainId,
      creator,
      state,
      isPrized,
      isCollabPool,
      hasHolderToken,
      prizeType,
      prizeStandard,
      search,
      limit = 50,
      offset = 0,
      sortBy = 'created_at_timestamp',
      sortOrder = 'desc',
      includeFilterCounts = false,
    } = options;

    const cacheKey = `pools_enhanced_${chainId}_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams();
      if (chainId) params.append('chainId', chainId.toString());
      if (creator) params.append('creator', creator);
      if (state !== undefined) {
        params.append('state', Array.isArray(state) ? state.join(',') : state.toString());
      }
      if (isPrized !== undefined) params.append('isPrized', isPrized.toString());
      if (isCollabPool !== undefined) params.append('isCollabPool', isCollabPool.toString());
      if (hasHolderToken !== undefined) params.append('hasHolderToken', hasHolderToken.toString());
      if (prizeType) params.append('prizeType', prizeType);
      if (prizeStandard !== undefined) params.append('prizeStandard', prizeStandard.toString());
      if (search) params.append('search', search);
      if (limit !== null && limit !== undefined) params.append('limit', limit.toString());
      if (offset !== null && offset !== undefined) params.append('offset', offset.toString());
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      if (includeFilterCounts) params.append('includeFilterCounts', 'true');

      const url = `${this.SUPABASE_URL}/functions/v1/api-pools?${params}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data?.success) {
        const result = {
          pools: data.pools || [],
          pagination: data.pagination || { total: 0, limit, offset, hasMore: false },
          filterCounts: data.filterCounts || null,
        };
        this.setCache(cacheKey, result, 60000); // 1 minute cache
        return result;
      }

      return { pools: [], pagination: { total: 0, limit, offset, hasMore: false }, filterCounts: null };
    } catch (error) {
      console.error('Error fetching pools from backend:', error);
      return { pools: [], pagination: { total: 0, limit, offset, hasMore: false }, filterCounts: null };
    }
  }

  /**
   * Fetch a single pool by address (Enhanced version)
   * @param {number} chainId
   * @param {string} address
   * @returns {Promise<Object|null>}
   */
  async getPoolEnhanced(chainId, address) {
    if (!this.isAvailable()) return null;

    const cacheKey = `pool_enhanced_${chainId}_${address}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams();
      params.append('chainId', chainId.toString());
      params.append('address', address.toLowerCase());

      const url = `${this.SUPABASE_URL}/functions/v1/api-pools?${params}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data?.success && data.pool) {
        this.setCache(cacheKey, data.pool, 30000); // 30 second cache
        return data.pool;
      }

      return null;
    } catch (error) {
      console.error('Error fetching pool from backend:', error);
      return null;
    }
  }

  /**
   * Get filter counts for FilterSidebar
   * @param {number} chainId
   * @returns {Promise<Object|null>}
   */
  async getPoolFilterCountsEnhanced(chainId) {
    if (!this.isAvailable()) return null;

    const cacheKey = `pool_filter_counts_enhanced_${chainId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const params = new URLSearchParams();
      params.append('chainId', chainId.toString());
      params.append('limit', '1'); // Minimal data, we just want counts
      params.append('includeFilterCounts', 'true');

      const url = `${this.SUPABASE_URL}/functions/v1/api-pools?${params}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data?.success && data.filterCounts) {
        this.setCache(cacheKey, data.filterCounts, 120000); // 2 minute cache
        return data.filterCounts;
      }

      return null;
    } catch (error) {
      console.error('Error fetching filter counts:', error);
      return null;
    }
  }

  /**
   * Search pools by name or address
   * @param {number} chainId
   * @param {string} searchTerm
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async searchPools(chainId, searchTerm, limit = 20) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    try {
      const result = await this.getPoolsEnhanced({
        chainId,
        search: searchTerm.trim(),
        limit,
        sortBy: 'created_at_timestamp',
        sortOrder: 'desc',
      });

      return result.pools || [];
    } catch (error) {
      console.error('Error searching pools:', error);
      return [];
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();
export default supabaseService;
