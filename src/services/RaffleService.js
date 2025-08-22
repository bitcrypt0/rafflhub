import { ethers } from 'ethers';
import { contractABIs } from '../contracts/contractABIs';
import { SUPPORTED_NETWORKS } from '../networks';

/**
 * Unified Raffle Service
 * Handles all raffle fetching logic with consistent behavior across mobile and desktop
 */
class RaffleService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    this.performanceMetrics = new Map();
    this.errorMetrics = new Map();
  }

  /**
   * Initialize the service with wallet context
   */
  initialize(walletContext, contractContext) {
    this.walletContext = walletContext;
    this.contractContext = contractContext;
  }

  /**
   * Get platform-specific configuration
   */
  getPlatformConfig(isMobile = false) {
    // Detect mobile browser characteristics
    const isMobileBrowser = typeof window !== 'undefined' && (
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768
    );

    const isActuallyMobile = isMobile || isMobileBrowser;

    return {
      maxRafflesToFetch: isActuallyMobile ? 25 : 30, // Increased mobile limit to match desktop
      timeout: isActuallyMobile ? 20000 : 12000, // Longer timeout on mobile
      concurrency: isActuallyMobile ? 2 : 4, // Fewer concurrent requests on mobile
      batchDelay: isActuallyMobile ? 200 : 100, // Longer delay between batches
      retryDelay: isActuallyMobile ? 2000 : 1000, // Longer retry delay
      maxRetries: isActuallyMobile ? 2 : 3, // Fewer retries on mobile
      useCache: true,
      retryOnFailure: true,
      progressiveLoading: isActuallyMobile, // Enable progressive loading on mobile
      prioritizeRecent: isActuallyMobile // Prioritize recent raffles on mobile
    };
  }

  /**
   * Create a contract instance with proper error handling
   */
  createContractInstance(address, abiType, useProvider = false) {
    try {
      if (!address || address === ethers.constants.AddressZero) {
        throw new Error(`Invalid contract address for ${abiType}`);
      }

      const abi = contractABIs[abiType];
      if (!abi) {
        throw new Error(`ABI not found for ${abiType}`);
      }

      // Use signer from ContractContext if available, otherwise use provider
      const signerOrProvider = useProvider 
        ? this.walletContext?.provider 
        : this.walletContext?.signer || this.walletContext?.provider;

      if (!signerOrProvider) {
        throw new Error('No signer or provider available');
      }

      return new ethers.Contract(address, abi, signerOrProvider);
    } catch (error) {
      console.error(`Error creating contract instance for ${abiType}:`, error);
      return null;
    }
  }

  /**
   * Check if contracts are available on the current network
   */
  areContractsAvailable() {
    const { chainId } = this.walletContext || {};

    if (!chainId || !SUPPORTED_NETWORKS[chainId]) {
      console.log('❌ Chain not supported or chainId missing:', { chainId });
      return false;
    }

    const contractAddresses = SUPPORTED_NETWORKS[chainId].contractAddresses;

    // Check if essential contracts are available (not just placeholder '0x...')
    const isAvailable = contractAddresses?.raffleManager &&
           contractAddresses.raffleManager !== '0x...' &&
           contractAddresses?.raffleDeployer &&
           contractAddresses.raffleDeployer !== '0x...';

    console.log('🔍 Contract availability check:', {
      chainId,
      isAvailable,
      raffleManager: contractAddresses?.raffleManager,
      raffleDeployer: contractAddresses?.raffleDeployer
    });

    return isAvailable;
  }

  /**
   * Get RaffleManager contract with fallback logic
   */
  getRaffleManagerContract() {
    const { chainId } = this.walletContext || {};

    // Check if contracts are available first
    if (!this.areContractsAvailable()) {
      return null;
    }

    // Try ContractContext first (preferred)
    if (this.contractContext?.contracts?.raffleManager) {
      return this.contractContext.contracts.raffleManager;
    }

    // Fallback: Create direct instance
    if (chainId && SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleManager) {
      const address = SUPPORTED_NETWORKS[chainId].contractAddresses.raffleManager;
      return this.createContractInstance(address, 'raffleManager', true);
    }

    return null;
  }

  /**
   * Retry wrapper for contract calls with mobile-specific optimizations and network change detection
   */
  async withRetry(operation, context = '', config = {}) {
    const platformConfig = this.getPlatformConfig(config.isMobile);
    const maxRetries = config.maxRetries || platformConfig.maxRetries;
    const retryDelay = config.retryDelay || platformConfig.retryDelay;
    const timeout = config.timeout || platformConfig.timeout;

    let lastError;
    const initialChainId = this.walletContext?.chainId;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          )
        ]);
      } catch (error) {
        lastError = error;
        console.warn(`${context} attempt ${attempt}/${maxRetries} failed:`, error.message);

        // Don't retry on certain errors
        if (error.message.includes('user rejected') ||
            error.message.includes('User denied') ||
            error.code === 4001 ||
            error.message.includes('Invalid contract address')) {
          throw error;
        }

        // Mobile-specific: Don't retry on network errors that are likely persistent
        if (config.isMobile && (
          error.message.includes('Network Error') ||
          error.message.includes('CONNECTION ERROR') ||
          error.code === 'NETWORK_ERROR'
        )) {
          console.warn(`Mobile network error detected, skipping retries for ${context}`);
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = retryDelay * attempt;
          console.log(`Retrying ${context} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Fetch all raffle addresses from RaffleManager
   */
  async getAllRaffleAddresses() {
    const cacheKey = `raffleAddresses_${this.walletContext?.chainId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Check if contracts are available on this network
    if (!this.areContractsAvailable()) {
      throw new Error('CONTRACTS_NOT_AVAILABLE');
    }

    const raffleManager = this.getRaffleManagerContract();
    if (!raffleManager) {
      throw new Error('CONTRACTS_NOT_AVAILABLE');
    }

    const addresses = await this.withRetry(
      () => raffleManager.getAllRaffles(),
      'getAllRaffles'
    );

    // Reverse the order to get newest raffles first (newest deployed contracts have higher indices)
    const sortedAddresses = (addresses || []).slice().reverse();

    // Cache the result
    this.cache.set(cacheKey, {
      data: sortedAddresses,
      timestamp: Date.now()
    });

    return sortedAddresses;
  }

  /**
   * Fetch detailed raffle data for a single raffle
   */
  async fetchRaffleDetails(raffleAddress, config = {}) {
    try {
      const raffleContract = this.createContractInstance(raffleAddress, 'raffle', true);
      if (!raffleContract) {
        console.error(`Failed to create raffle contract for ${raffleAddress}`);
        return null;
      }

      // Fetch basic raffle data - use sequential calls on mobile for better reliability
      let name, creator, startTime, duration, ticketPrice, ticketLimit, winnersCount,
          maxTicketsPerParticipant, stateNum, isPrizedContract, prizeCollection, prizeTokenId,
          erc20PrizeToken, erc20PrizeAmount, nativePrizeAmount, isExternallyPrized, standard, usesCustomPrice, isEscrowedPrize;

      if (config.isMobile) {
        // Sequential calls on mobile for better reliability
        name = await this.withRetry(() => raffleContract.name(), `name-${raffleAddress}`, config);
        creator = await this.withRetry(() => raffleContract.creator(), `creator-${raffleAddress}`, config);
        startTime = await this.withRetry(() => raffleContract.startTime(), `startTime-${raffleAddress}`, config);
        duration = await this.withRetry(() => raffleContract.duration(), `duration-${raffleAddress}`, config);
        ticketPrice = await this.withRetry(() => raffleContract.ticketPrice(), `ticketPrice-${raffleAddress}`, config);
        ticketLimit = await this.withRetry(() => raffleContract.ticketLimit(), `ticketLimit-${raffleAddress}`, config);
        winnersCount = await this.withRetry(() => raffleContract.winnersCount(), `winnersCount-${raffleAddress}`, config);
        maxTicketsPerParticipant = await this.withRetry(() => raffleContract.maxTicketsPerParticipant(), `maxTickets-${raffleAddress}`, config);
        stateNum = await this.withRetry(() => raffleContract.state(), `state-${raffleAddress}`, config);

        // Optional fields with fallbacks
        isPrizedContract = await raffleContract.isPrized?.().catch(() => false);
        prizeCollection = await raffleContract.prizeCollection?.().catch(() => ethers.constants.AddressZero);
        prizeTokenId = await raffleContract.prizeTokenId?.().catch(() => ethers.BigNumber.from(0));
        erc20PrizeToken = await raffleContract.erc20PrizeToken?.().catch(() => ethers.constants.AddressZero);
        erc20PrizeAmount = await raffleContract.erc20PrizeAmount?.().catch(() => ethers.BigNumber.from(0));
        nativePrizeAmount = await raffleContract.nativePrizeAmount?.().catch(() => ethers.BigNumber.from(0));
        isExternallyPrized = await raffleContract.isExternallyPrized?.().catch((err) => {
          console.warn(`isExternallyPrized failed for ${raffleAddress}:`, err.message);
          return false;
        });
        standard = await raffleContract.standard?.().catch((error) => {
          console.warn(`[RaffleService] standard failed for ${raffleAddress}:`, error.message);
          return undefined;
        });
        usesCustomPrice = await raffleContract.usesCustomPrice?.().catch((error) => {
          console.warn(`[RaffleService] usesCustomPrice failed for ${raffleAddress}:`, error.message);
          return false;
        });
        isEscrowedPrize = await raffleContract.isEscrowedPrize?.().catch((error) => {
          console.warn(`[RaffleService] isEscrowedPrize failed for ${raffleAddress}:`, error.message);
          return false;
        });
      } else {
        // Parallel calls on desktop
        [
          name, creator, startTime, duration, ticketPrice, ticketLimit, winnersCount,
          maxTicketsPerParticipant, stateNum, isPrizedContract, prizeCollection, prizeTokenId,
          erc20PrizeToken, erc20PrizeAmount, nativePrizeAmount, isExternallyPrized, standard, usesCustomPrice, isEscrowedPrize
        ] = await Promise.all([
          this.withRetry(() => raffleContract.name(), `name-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.creator(), `creator-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.startTime(), `startTime-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.duration(), `duration-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.ticketPrice(), `ticketPrice-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.ticketLimit(), `ticketLimit-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.winnersCount(), `winnersCount-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.maxTicketsPerParticipant(), `maxTickets-${raffleAddress}`, config),
          this.withRetry(() => raffleContract.state(), `state-${raffleAddress}`, config),
          raffleContract.isPrized?.().catch(() => false),
          raffleContract.prizeCollection?.().catch(() => ethers.constants.AddressZero),
          raffleContract.prizeTokenId?.().catch(() => ethers.BigNumber.from(0)),
          raffleContract.erc20PrizeToken?.().catch(() => ethers.constants.AddressZero),
          raffleContract.erc20PrizeAmount?.().catch(() => ethers.BigNumber.from(0)),
          raffleContract.nativePrizeAmount?.().catch(() => ethers.BigNumber.from(0)),
          raffleContract.isExternallyPrized?.().catch((error) => {
            console.warn(`[RaffleService] isExternallyPrized failed for ${raffleAddress}:`, error.message);
            return false;
          }),
          raffleContract.standard?.().catch((error) => {
            console.warn(`[RaffleService] standard failed for ${raffleAddress}:`, error.message);
            return undefined;
          }),
          raffleContract.usesCustomPrice?.().catch((error) => {
            console.warn(`[RaffleService] usesCustomPrice failed for ${raffleAddress}:`, error.message);
            return false;
          }),
          raffleContract.isEscrowedPrize?.().catch((error) => {
            console.warn(`[RaffleService] isEscrowedPrize failed for ${raffleAddress}:`, error.message);
            return false;
          })
        ]);
      }

      // Map state number to string
      let raffleState;
      switch (stateNum) {
        case 0: raffleState = 'pending'; break;
        case 1: raffleState = 'active'; break;
        case 2: raffleState = 'drawing'; break;
        case 3: raffleState = 'completed'; break;
        case 4: raffleState = 'completed'; break;
        case 5: raffleState = 'ended'; break;
        default: raffleState = 'ended';
      }

      let actualDuration;
      // Only fetch actual duration for ended/terminal states
      if ([2,3,4,5,6,7,8].includes(stateNum)) {
        try {
          const val = await raffleContract.getActualRaffleDuration?.();
          if (val) actualDuration = val.toNumber ? val.toNumber() : Number(val);
        } catch (_) {}
      }

      return {
        id: raffleAddress,
        name,
        address: raffleAddress,
        chainId: this.walletContext?.chainId,
        creator,
        startTime: startTime.toNumber(),
        duration: duration.toNumber(),
        actualDuration,
        ticketPrice,
        ticketLimit: ticketLimit.toNumber(),
        ticketsSold: 0, // Will be fetched separately if needed
        winnersCount: winnersCount.toNumber(),
        maxTicketsPerParticipant: maxTicketsPerParticipant.toNumber(),
        isPrized: !!isPrizedContract,
        prizeCollection,
        prizeTokenId: prizeTokenId ? (prizeTokenId.toNumber ? prizeTokenId.toNumber() : Number(prizeTokenId)) : 0,
        stateNum: stateNum,
        state: raffleState,
        erc20PrizeToken,
        erc20PrizeAmount,
        nativePrizeAmount,
        isExternallyPrized: isExternallyPrized,
        standard: (standard !== undefined && standard !== null) ? (standard.toNumber ? standard.toNumber() : Number(standard)) : undefined,
        usesCustomPrice: usesCustomPrice,
        isEscrowedPrize: isEscrowedPrize
      };

      // Debug logging for NFT prizes to investigate the issue
      if (raffleData.prizeCollection && raffleData.prizeCollection !== ethers.constants.AddressZero) {
        console.log(`[RaffleService] NFT Prize raffle data for ${raffleAddress}:`, {
          prizeCollection: raffleData.prizeCollection,
          prizeTokenId: raffleData.prizeTokenId,
          prizeTokenIdRaw: prizeTokenId,
          isExternallyPrized: raffleData.isExternallyPrized,
          isExternallyPrizedRaw: isExternallyPrized,
          usesCustomPrice: raffleData.usesCustomPrice,
          usesCustomPriceRaw: usesCustomPrice,
          isEscrowedPrize: raffleData.isEscrowedPrize,
          isEscrowedPrizeRaw: isEscrowedPrize,
          standard: raffleData.standard
        });
      }

      return raffleData;
    } catch (error) {
      console.error(`Error fetching raffle details for ${raffleAddress}:`, error);
      return null;
    }
  }

  /**
   * Process raffles in batches with mobile-specific optimizations
   */
  async processBatch(addresses, config = {}) {
    const platformConfig = this.getPlatformConfig(config.isMobile);
    const batchSize = config.batchSize || platformConfig.concurrency;
    const batchDelay = config.batchDelay || platformConfig.batchDelay;
    const progressCallback = config.onProgress;

    const results = [];
    const totalBatches = Math.ceil(addresses.length / batchSize);

    console.log(`Processing ${addresses.length} raffles in ${totalBatches} batches (${batchSize} per batch)`);

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batch = addresses.slice(i, i + batchSize);

      console.log(`Processing batch ${batchIndex}/${totalBatches} (${batch.length} raffles)`);

      try {
        // For mobile, process sequentially to reduce load
        if (config.isMobile && platformConfig.progressiveLoading) {
          for (const address of batch) {
            try {
              const result = await this.fetchRaffleDetails(address, { isMobile: true });
              if (result) {
                results.push(result);
                // Report progress for progressive loading
                if (progressCallback) {
                  progressCallback(results.length, addresses.length);
                }
              }
              // Small delay between individual requests on mobile
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.warn(`Failed to fetch raffle ${address}:`, error.message);
            }
          }
        } else {
          // Desktop: parallel processing
          const batchPromises = batch.map(address =>
            this.fetchRaffleDetails(address, { isMobile: config.isMobile })
          );

          const batchResults = await Promise.allSettled(batchPromises);
          const successfulResults = batchResults
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value);

          results.push(...successfulResults);

          if (progressCallback) {
            progressCallback(results.length, addresses.length);
          }
        }

        // Delay between batches
        if (i + batchSize < addresses.length) {
          console.log(`Waiting ${batchDelay}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      } catch (error) {
        console.error(`Error processing batch ${batchIndex}:`, error);
        // Continue with next batch
      }
    }

    console.log(`Successfully processed ${results.length}/${addresses.length} raffles`);
    return results;
  }

  /**
   * Main method to fetch all raffles with platform-specific optimizations
   */
  async fetchAllRaffles(options = {}) {
    const {
      isMobile = false,
      useCache = true,
      maxRaffles = null
    } = options;

    const config = this.getPlatformConfig(isMobile);
    const cacheKey = `allRaffles_${this.walletContext?.chainId}_${isMobile}`;
    const timerKey = this.startTimer('fetchAllRaffles', { isMobile, chainId: this.walletContext?.chainId });

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        this.endTimer(timerKey, { fromCache: true, rafflCount: cached.data.length });
        return cached.data;
      }
    }

    try {
      // Get all raffle addresses
      const addressTimer = this.startTimer('getAllRaffleAddresses', { isMobile });
      const allAddresses = await this.getAllRaffleAddresses();
      this.endTimer(addressTimer, { addressCount: allAddresses?.length || 0 });

      if (!allAddresses || allAddresses.length === 0) {
        this.endTimer(timerKey, { rafflCount: 0, fromCache: false });
        return [];
      }

      // Limit addresses based on platform and options
      const maxToFetch = maxRaffles || config.maxRafflesToFetch;
      const addressesToFetch = allAddresses.slice(0, maxToFetch);

      // Process in batches
      const batchTimer = this.startTimer('processBatch', {
        isMobile,
        totalAddresses: addressesToFetch.length,
        batchSize: config.concurrency
      });

      const raffles = await this.processBatch(addressesToFetch, {
        ...config,
        isMobile,
        onProgress: (completed, total) => {
          console.log(`[RaffleService] Progress: ${completed}/${total} raffles processed (${((completed/total)*100).toFixed(1)}%)`);
        }
      });

      this.endTimer(batchTimer, {
        successfulRaffles: raffles.length,
        failedRaffles: addressesToFetch.length - raffles.length
      });

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, {
          data: raffles,
          timestamp: Date.now()
        });
      }

      this.endTimer(timerKey, {
        rafflCount: raffles.length,
        fromCache: false,
        totalAddresses: allAddresses.length,
        processedAddresses: addressesToFetch.length
      });

      return raffles;
    } catch (error) {
      this.trackError('fetchAllRaffles', error, { isMobile, chainId: this.walletContext?.chainId });
      this.endTimer(timerKey, { error: true, errorMessage: error.message });
      throw error;
    }
  }

  /**
   * Search raffles by name or address
   */
  async searchRaffles(searchTerm, options = {}) {
    const raffles = await this.fetchAllRaffles(options);
    const term = searchTerm.trim().toLowerCase();
    
    return raffles.filter(raffle =>
      (raffle.name || '').toLowerCase().includes(term) ||
      (raffle.address || '').toLowerCase().includes(term) ||
      (raffle.address || '').toLowerCase() === term
    );
  }

  /**
   * Clear cache (useful for force refresh)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Performance monitoring methods
   */
  startTimer(operation, context = {}) {
    const key = `${operation}_${Date.now()}_${Math.random()}`;
    this.performanceMetrics.set(key, {
      operation,
      context,
      startTime: performance.now(),
      platform: context.isMobile ? 'mobile' : 'desktop'
    });
    return key;
  }

  endTimer(key, additionalData = {}) {
    const metric = this.performanceMetrics.get(key);
    if (!metric) return;

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    const finalMetric = {
      ...metric,
      endTime,
      duration,
      ...additionalData
    };

    // Log performance data
    console.log(`[RaffleService] ${metric.operation} completed in ${duration.toFixed(2)}ms`, {
      platform: metric.platform,
      context: metric.context,
      ...additionalData
    });

    // Store for analytics
    this.performanceMetrics.set(key, finalMetric);

    // Clean up old metrics (keep last 100)
    if (this.performanceMetrics.size > 100) {
      const oldestKey = this.performanceMetrics.keys().next().value;
      this.performanceMetrics.delete(oldestKey);
    }

    return finalMetric;
  }

  /**
   * Error tracking
   */
  trackError(operation, error, context = {}) {
    const errorKey = `${operation}_${context.isMobile ? 'mobile' : 'desktop'}`;
    const existing = this.errorMetrics.get(errorKey) || { count: 0, errors: [] };

    existing.count++;
    existing.errors.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context
    });

    // Keep only last 10 errors per operation/platform
    if (existing.errors.length > 10) {
      existing.errors = existing.errors.slice(-10);
    }

    this.errorMetrics.set(errorKey, existing);

    console.error(`[RaffleService] Error in ${operation} (${context.isMobile ? 'mobile' : 'desktop'}):`, error);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {
      mobile: { operations: {}, totalOperations: 0, avgDuration: 0 },
      desktop: { operations: {}, totalOperations: 0, avgDuration: 0 }
    };

    let totalMobileDuration = 0;
    let totalDesktopDuration = 0;

    for (const metric of this.performanceMetrics.values()) {
      if (!metric.duration) continue;

      const platform = metric.platform;
      const operation = metric.operation;

      if (!stats[platform].operations[operation]) {
        stats[platform].operations[operation] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        };
      }

      const opStats = stats[platform].operations[operation];
      opStats.count++;
      opStats.totalDuration += metric.duration;
      opStats.avgDuration = opStats.totalDuration / opStats.count;
      opStats.minDuration = Math.min(opStats.minDuration, metric.duration);
      opStats.maxDuration = Math.max(opStats.maxDuration, metric.duration);

      stats[platform].totalOperations++;
      if (platform === 'mobile') {
        totalMobileDuration += metric.duration;
      } else {
        totalDesktopDuration += metric.duration;
      }
    }

    stats.mobile.avgDuration = stats.mobile.totalOperations > 0
      ? totalMobileDuration / stats.mobile.totalOperations
      : 0;
    stats.desktop.avgDuration = stats.desktop.totalOperations > 0
      ? totalDesktopDuration / stats.desktop.totalOperations
      : 0;

    return stats;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {};
    for (const [key, data] of this.errorMetrics.entries()) {
      stats[key] = {
        count: data.count,
        lastError: data.errors[data.errors.length - 1],
        recentErrors: data.errors.slice(-3)
      };
    }
    return stats;
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      performance: this.getPerformanceStats(),
      errors: this.getErrorStats()
    };
  }
}

// Export singleton instance
export const raffleService = new RaffleService();
export default raffleService;
