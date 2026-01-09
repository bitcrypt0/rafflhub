import { ethers } from 'ethers';
import { contractABIs } from '../contracts/contractABIs';
import { SUPPORTED_NETWORKS } from '../networks';
import { optimizedBatchCall } from '../utils/multicall';
import { parseContractError } from '../utils/contractErrorHandler';

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
    const isAvailable = contractAddresses?.protocolManager &&
           contractAddresses.protocolManager !== '0x...' &&
           contractAddresses?.poolDeployer &&
           contractAddresses.poolDeployer !== '0x...';

    console.log('🔍 Contract availability check:', {
      chainId,
      isAvailable,
      protocolManager: contractAddresses?.protocolManager,
      poolDeployer: contractAddresses?.poolDeployer
    });

    return isAvailable;
  }

  /**
   * Get ProtocolManager contract with fallback logic
   */
  getProtocolManagerContract() {
    const { chainId } = this.walletContext || {};

    // Check if contracts are available first
    if (!this.areContractsAvailable()) {
      return null;
    }

    // Try ContractContext first (preferred)
    if (this.contractContext?.contracts?.protocolManager) {
      return this.contractContext.contracts.protocolManager;
    }

    // Fallback: Create direct instance
    if (chainId && SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager) {
      const address = SUPPORTED_NETWORKS[chainId].contractAddresses.protocolManager;
      return this.createContractInstance(address, 'protocolManager', true);
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
        
        // Parse custom errors for better logging
        const customError = this.parseCustomError(error);
        console.warn(`${context} attempt ${attempt}/${maxRetries} failed:`, customError.message);

        // Don't retry on certain errors
        if (error.message.includes('user rejected') ||
            error.message.includes('User denied') ||
            error.code === 4001 ||
            error.message.includes('Invalid contract address') ||
            customError.type === 'user_rejection') {
          throw error;
        }

        // Don't retry on business logic errors (custom errors that indicate invalid operations)
        if (customError.type === 'business_logic') {
          console.warn(`Business logic error detected, skipping retries for ${context}:`, customError.message);
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
   * Fetch all raffle addresses from ProtocolManager
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

    const protocolManager = this.getProtocolManagerContract();
    if (!protocolManager) {
      throw new Error('CONTRACTS_NOT_AVAILABLE');
    }

    const addresses = await this.withRetry(
      () => protocolManager.getAllPools(),
      'getAllPools'
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
      const raffleContract = this.createContractInstance(raffleAddress, 'pool', true);
      if (!raffleContract) {
        console.error(`Failed to create raffle contract for ${raffleAddress}`);
        return null;
      }

      // Define batch calls for related getter methods
      const coreCalls = [
        { method: 'name', params: [] },
        { method: 'creator', params: [] },
        { method: 'startTime', params: [] },
        { method: 'duration', params: [] },
        { method: 'slotFee', params: [] },
        { method: 'slotLimit', params: [] },
        { method: 'winnersCount', params: [] },
        { method: 'maxSlotsPerAddress', params: [] },
        { method: 'state', params: [] }
      ];

      const prizeCalls = [
        { method: 'isPrized', params: [] },
        { method: 'prizeCollection', params: [] },
        { method: 'prizeTokenId', params: [] },
        { method: 'erc20PrizeToken', params: [] },
        { method: 'erc20PrizeAmount', params: [] },
        { method: 'nativePrizeAmount', params: [] },
        { method: 'standard', params: [] },
        { method: 'isEscrowedPrize', params: [] }
      ];

      const configCalls = [
        { method: 'isCollabPool', params: [] },
        { method: 'usesCustomFee', params: [] },
        { method: 'revenueRecipient', params: [] },
        { method: 'isExternalCollection', params: [] },
        { method: 'isRefundable', params: [] }
      ];

      let coreResults, prizeResults, configResults;
      const chainId = this.walletContext?.chainId;

      // Use batch calls on desktop, sequential on mobile for better reliability
      if (config.isMobile) {
        // Sequential calls on mobile
        coreResults = await this.executeSequentialCalls(raffleContract, coreCalls, config);
        prizeResults = await this.executeSequentialCalls(raffleContract, prizeCalls, config, true);
        configResults = await this.executeSequentialCalls(raffleContract, configCalls, config, true);
      } else {
        // Try batch calls first on desktop
        coreResults = await optimizedBatchCall(raffleContract, coreCalls, chainId) ||
                     await this.executeSequentialCalls(raffleContract, coreCalls, config);
        
        prizeResults = await optimizedBatchCall(raffleContract, prizeCalls, chainId) ||
                      await this.executeSequentialCalls(raffleContract, prizeCalls, config, true);
        
        configResults = await optimizedBatchCall(raffleContract, configCalls, chainId) ||
                       await this.executeSequentialCalls(raffleContract, configCalls, config, true);
      }

      // Extract results with fallbacks
      const [
        name, creator, startTime, duration, slotFee, ticketLimit, winnersCount,
        maxSlotsPerAddress, stateNum
      ] = coreResults;

      const [
        isPrizedContract, prizeCollection, prizeTokenId, erc20PrizeToken,
        erc20PrizeAmount, nativePrizeAmount, standard, isEscrowedPrize
      ] = prizeResults;

      const [
        isCollabPool, usesCustomFee, revenueRecipient, isExternalCollection, isRefundable
      ] = configResults;

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
          const val = await raffleContract.getActualPoolDuration?.();
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
        slotFee,
        ticketLimit: ticketLimit.toNumber(),
        slotLimit: ticketLimit.toNumber(), // Add slotLimit for compatibility with RaffleCard
        ticketsSold: 0, // Will be fetched separately if needed
        winnersCount: winnersCount.toNumber(),
        maxSlotsPerAddress: maxSlotsPerAddress.toNumber(),
        isPrized: !!isPrizedContract,
        prizeCollection,
        prizeTokenId: prizeTokenId ? (prizeTokenId.toNumber ? prizeTokenId.toNumber() : Number(prizeTokenId)) : 0,
        stateNum: stateNum,
        state: raffleState,
        erc20PrizeToken,
        erc20PrizeAmount,
        nativePrizeAmount,
        isCollabPool: isCollabPool,
        standard: (standard !== undefined && standard !== null) ? (standard.toNumber ? standard.toNumber() : Number(standard)) : undefined,
        usesCustomFee: usesCustomFee,
        isEscrowedPrize: isEscrowedPrize
      };

      // Debug logging for NFT prizes to investigate the issue
      if (raffleData.prizeCollection && raffleData.prizeCollection !== ethers.constants.AddressZero) {
        console.log(`[RaffleService] NFT Prize raffle data for ${raffleAddress}:`, {
          prizeCollection: raffleData.prizeCollection,
          prizeTokenId: raffleData.prizeTokenId,
          prizeTokenIdRaw: prizeTokenId,
          isCollabPool: raffleData.isCollabPool,
          isCollabPoolRaw: isCollabPool,
          usesCustomFee: raffleData.usesCustomFee,
          usesCustomFeeRaw: usesCustomFee,
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
   * Parse custom errors from contract calls
   * @param {Error} error - The error object
   * @returns {Object} Parsed error with type and message
   */
  parseCustomError(error) {
    // Use the contractErrorHandler utility to parse custom errors
    const parsedMessage = parseContractError(error);
    
    // Determine error type based on the message
    if (error.code === 4001 || parsedMessage.toLowerCase().includes('user rejected')) {
      return { type: 'user_rejection', message: 'Transaction rejected by user' };
    }
    
    // Business logic errors (custom errors from optimized contracts)
    const businessLogicErrors = [
      'ExceedsMaxSlots',
      'ExceedsSlotLimit',
      'IncorrectPayment',
      'ContractsCannotPurchase',
      'CreatorNotAllowed',
      'InvalidNonPrizedPurchase',
      'NotAWinner',
      'NoPrizesToClaim',
      'UnauthorizedMinter',
      'ExceedsMaxSupply',
      'ZeroAddress',
      'ZeroQuantity',
      'ZeroSlotFee',
      'PoolDurationElapsed',
      'ProtocolAdminNotAllowed',
      'SocialEngagementNotConfigured',
      'InvalidState',
      'OnlyOperator',
      'InvalidPrizeAmount',
      'PrizeTransferFailed',
      'InvalidPrizeCollection',
      'InvalidPoolState',
      'UnauthorizedCaller',
      'ExceedsWinnersCount',
      'MintingNotSupported',
      'SupplyNotSet'
    ];
    
    for (const errorName of businessLogicErrors) {
      if (parsedMessage.includes(errorName)) {
        return { 
          type: 'business_logic', 
          message: parsedMessage,
          errorName: errorName
        };
      }
    }
    
    // Network/provider errors
    if (error.code === 'NETWORK_ERROR' || 
        error.message.includes('Network Error') ||
        error.message.includes('CONNECTION ERROR') ||
        error.message.includes('timeout')) {
      return { type: 'network', message: 'Network error occurred' };
    }
    
    // Default to unknown error
    return { 
      type: 'unknown', 
      message: parsedMessage || 'Unknown error occurred' 
    };
  }

  /**
   * Execute sequential calls with error handling and fallbacks
   * @param {Object} contract - Contract instance
   * @param {Array} calls - Array of call objects
   * @param {Object} config - Configuration object
   * @param {boolean} useFallbacks - Whether to use fallback values for failed calls
   * @returns {Array} Results array
   */
  async executeSequentialCalls(contract, calls, config = {}, useFallbacks = false) {
    const results = [];
    
    for (const { method, params = [] } of calls) {
      try {
        // Check if method exists on contract
        if (typeof contract[method] !== 'function') {
          console.warn(`Method ${method} does not exist on contract, using fallback`);
          if (useFallbacks) {
            // Return appropriate fallback based on method
            if (method.includes('is') || method === 'isCollabPool' || method === 'usesCustomFee' || 
                method === 'isExternalCollection' || 
                method === 'isRefundable' || method === 'isPrized') {
              results.push(false);
            } else if (method === 'isEscrowedPrize') {
              // Return undefined for missing isEscrowedPrize so frontend can handle it properly
              results.push(undefined);
            } else if (method === 'standard') {
              results.push(undefined);
            } else if (method === 'revenueRecipient' || method === 'prizeCollection' || 
                method === 'erc20PrizeToken') {
              results.push(ethers.constants.AddressZero);
            } else if (method === 'prizeTokenId' || method === 'erc20PrizeAmount' || 
                method === 'nativePrizeAmount') {
              results.push(ethers.BigNumber.from(0));
            } else {
              results.push(null);
            }
            continue;
          } else {
            throw new Error(`Method ${method} does not exist on contract`);
          }
        }

        if (useFallbacks) {
          // Use fallback values for optional methods
          const result = await contract[method](...params)
            .catch(error => {
              const customError = this.parseCustomError(error);
              console.warn(`${method} failed, using fallback:`, customError.message);
              // Return appropriate fallback based on method
              if (method.includes('is') || method === 'isCollabPool' || method === 'usesCustomFee' || 
                  method === 'isExternalCollection' || 
                  method === 'isRefundable' || method === 'isPrized') {
                return false;
              } else if (method === 'isEscrowedPrize') {
                // Return undefined for missing isEscrowedPrize so frontend can handle it properly
                return undefined;
              } else if (method === 'standard') {
                return undefined;
              } else if (method === 'revenueRecipient' || method === 'prizeCollection' || 
                  method === 'erc20PrizeToken') {
                return ethers.constants.AddressZero;
              } else if (method === 'prizeTokenId' || method === 'erc20PrizeAmount' || 
                  method === 'nativePrizeAmount') {
                return ethers.BigNumber.from(0);
              }
              throw error;
            });
          results.push(result);
        } else {
          // Use withRetry for required methods
          const result = await this.withRetry(
            () => contract[method](...params),
            `${method}-${contract.address}`,
            config
          );
          results.push(result);
        }
      } catch (error) {
        const customError = this.parseCustomError(error);
        console.error(`Failed to execute call ${method}:`, customError);
        // Log error metrics with custom error type
        this.logError(customError.message, 'executeSequentialCalls', {
          method,
          isMobile: config.isMobile,
          errorType: customError.type,
          errorName: customError.errorName
        });
        // Add null for failed calls to maintain array alignment
        results.push(null);
      }
    }
    
    return results;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
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

  /**
   * Log error metrics for debugging
   * @param {string} message - Error message
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional error metadata
   */
  logError(message, context, metadata = {}) {
    const errorKey = `${context}_${message}`;
    const current = this.errorMetrics.get(errorKey) || { count: 0, lastOccurrence: null };
    this.errorMetrics.set(errorKey, {
      count: current.count + 1,
      lastOccurrence: new Date().toISOString(),
      message,
      context,
      metadata
    });
    console.error(`[${context}] ${message}`, metadata);
  }
}

// Export singleton instance
export const raffleService = new RaffleService();
export default raffleService;
