/**
 * Robust contract call utilities for cross-browser compatibility
 * Handles "missing revert data" errors and browser-specific issues
 */

import { ethers } from 'ethers';

/**
 * Browser detection utilities
 */
export const getBrowserInfo = () => {
  if (typeof window === 'undefined') return { name: 'unknown', version: 'unknown' };
  
  const userAgent = navigator.userAgent;
  const browsers = {
    chrome: /Chrome\/(\d+)/.test(userAgent),
    firefox: /Firefox\/(\d+)/.test(userAgent),
    safari: /Safari\/(\d+)/.test(userAgent) && !/Chrome/.test(userAgent),
    edge: /Edg\/(\d+)/.test(userAgent),
    opera: /OPR\/(\d+)/.test(userAgent),
    brave: navigator.brave && navigator.brave.isBrave,
  };
  
  const browserName = Object.keys(browsers).find(key => browsers[key]) || 'unknown';
  const versionMatch = userAgent.match(new RegExp(`${browserName === 'edge' ? 'Edg' : browserName}\\/(\\d+)`, 'i'));
  const version = versionMatch ? versionMatch[1] : 'unknown';
  
  return {
    name: browserName,
    version,
    userAgent,
    isMetaMaskBrowser: userAgent.includes('MetaMask'),
    isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
  };
};

/**
 * Platform-specific configuration for contract calls
 */
export const getPlatformConfig = () => {
  const browserInfo = getBrowserInfo();
  const isMobile = browserInfo.isMobile || window.innerWidth < 768;
  
  // Browser-specific configurations
  const configs = {
    firefox: {
      timeout: 15000,
      retries: 3,
      batchSize: 3,
      useSequential: true,
      delayBetweenCalls: 200
    },
    safari: {
      timeout: 20000,
      retries: 4,
      batchSize: 2,
      useSequential: true,
      delayBetweenCalls: 300
    },
    edge: {
      timeout: 12000,
      retries: 3,
      batchSize: 4,
      useSequential: false,
      delayBetweenCalls: 100
    },
    chrome: {
      timeout: 10000,
      retries: 3,
      batchSize: 6,
      useSequential: false,
      delayBetweenCalls: 50
    },
    default: {
      timeout: 12000,
      retries: 3,
      batchSize: 4,
      useSequential: isMobile,
      delayBetweenCalls: 100
    }
  };
  
  const config = configs[browserInfo.name] || configs.default;
  
  // Mobile adjustments
  if (isMobile) {
    config.timeout *= 1.5;
    config.retries = Math.min(config.retries + 1, 5);
    config.batchSize = Math.min(config.batchSize, 3);
    config.useSequential = true;
    config.delayBetweenCalls *= 2;
  }
  
  return {
    ...config,
    browserInfo,
    isMobile
  };
};

/**
 * Safe contract method call with timeout and error handling
 */
export const safeContractCall = async (contractMethod, methodName, options = {}) => {
  const {
    timeout = 10000,
    retries = 3,
    fallbackValue = null,
    required = false
  } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout calling ${methodName}`)), timeout)
      );
      
      // Race between contract call and timeout
      const result = await Promise.race([
        contractMethod(),
        timeoutPromise
      ]);
      
      return { success: true, result, error: null };
    } catch (error) {
      console.warn(`Attempt ${attempt}/${retries} failed for ${methodName}:`, error.message);
      
      // Check if it's a "missing revert data" error
      const isMissingRevertData = error.message.includes('missing revert data') ||
                                 error.message.includes('call exception') ||
                                 error.code === 'CALL_EXCEPTION';
      
      // For missing revert data errors, try with different approach
      if (isMissingRevertData && attempt < retries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      // If this is the last attempt or a critical error
      if (attempt === retries) {
        if (required) {
          throw new Error(`Failed to call ${methodName} after ${retries} attempts: ${error.message}`);
        }
        return { success: false, result: fallbackValue, error: error.message };
      }
    }
  }
};

/**
 * Batch contract calls with browser-specific optimization
 */
export const batchContractCalls = async (calls, options = {}) => {
  const config = getPlatformConfig();
  const {
    useSequential = config.useSequential,
    batchSize = config.batchSize,
    delayBetweenCalls = config.delayBetweenCalls,
    timeout = config.timeout
  } = options;

  console.log(`🔧 Batch contract calls - Browser: ${config.browserInfo.name}, Sequential: ${useSequential}, Batch size: ${batchSize}`);

  if (useSequential) {
    // Sequential execution for problematic browsers
    const results = [];
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      try {
        if (delayBetweenCalls > 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenCalls));
        }

        const result = await safeContractCall(
          call.method,
          call.name,
          { timeout, fallbackValue: call.fallback, required: call.required }
        );

        results.push(result.success ? result.result : call.fallback);
      } catch (error) {
        console.error(`Sequential call failed for ${call.name}:`, error);
        if (call.required) {
          throw error;
        }
        results.push(call.fallback);
      }
    }
    return results;
  } else {
    // Parallel execution in batches
    const results = [];
    for (let i = 0; i < calls.length; i += batchSize) {
      const batch = calls.slice(i, i + batchSize);

      try {
        const batchPromises = batch.map(call =>
          safeContractCall(
            call.method,
            call.name,
            { timeout, fallbackValue: call.fallback, required: call.required }
          ).then(result => result.success ? result.result : call.fallback)
          .catch(error => {
            console.error(`Batch call failed for ${call.name}:`, error);
            if (call.required) throw error;
            return call.fallback;
          })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Delay between batches
        if (i + batchSize < calls.length && delayBetweenCalls > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenCalls));
        }
      } catch (error) {
        console.error(`Batch execution failed:`, error);
        // Add fallback values for failed batch
        batch.forEach(call => {
          if (call.required) throw error;
          results.push(call.fallback);
        });
      }
    }
    return results;
  }
};

/**
 * Check if a contract method exists before calling it
 */
export const hasContractMethod = (contract, methodName) => {
  try {
    return typeof contract[methodName] === 'function';
  } catch {
    return false;
  }
};

/**
 * Create a safe contract method wrapper
 */
export const createSafeMethod = (contract, methodName, fallbackValue = null) => {
  if (!hasContractMethod(contract, methodName)) {
    console.warn(`Method ${methodName} not found on contract`);
    return () => Promise.resolve(fallbackValue);
  }

  return (...args) => contract[methodName](...args);
};
