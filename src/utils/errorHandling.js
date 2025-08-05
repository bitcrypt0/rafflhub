/**
 * Enhanced error handling utilities for the raffle protocol frontend
 * Provides consistent error processing and toast notification management
 */

import { toast } from '../components/ui/sonner';

/**
 * Extract and clean error messages from various error types
 */
export const extractRevertReason = (error) => {
  if (!error) return 'Unknown error occurred';
  
  let message = '';
  
  // Handle different error structures
  if (typeof error === 'string') {
    message = error;
  } else if (error.reason) {
    message = error.reason;
  } else if (error.data?.message) {
    message = error.data.message;
  } else if (error.message) {
    message = error.message;
  } else {
    message = error.toString();
  }
  
  // Clean up common error patterns
  message = message
    .replace(/^Error:\s*/i, '')
    .replace(/^execution reverted:\s*/i, '')
    .replace(/^call exception:\s*/i, '')
    .replace(/^missing revert data in call exception;\s*/i, '')
    .replace(/Transaction reverted without a reason string/i, 'Transaction failed')
    .trim();
  
  return message || 'Unknown error occurred';
};

/**
 * Determine if an error should be shown to the user via toast
 */
export const shouldShowErrorToast = (error, context = {}) => {
  const message = extractRevertReason(error).toLowerCase();
  
  // Never show toast for user rejections
  if (message.includes('user rejected') || 
      message.includes('user denied') || 
      error?.code === 4001) {
    return false;
  }
  
  // Don't show toast for expected read-only failures
  if (context.isReadOnly && (
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('no tickets') ||
    message.includes('unavailable')
  )) {
    return false;
  }
  
  // Don't show toast for network issues that are temporary
  if (message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('rate limit')) {
    return false;
  }
  
  return true;
};

/**
 * Handle errors consistently across the application
 */
export const handleError = (error, options = {}) => {
  const {
    context = {},
    showToast = true,
    logError = true,
    fallbackMessage = 'An error occurred'
  } = options;
  
  if (logError) {
    console.error('Error handled:', error, context);
  }
  
  const message = extractRevertReason(error);
  
  if (showToast && shouldShowErrorToast(error, context)) {
    toast.error(message || fallbackMessage);
  }
  
  return message;
};

/**
 * Handle contract transaction errors specifically
 */
export const handleTransactionError = (error, options = {}) => {
  const {
    operation = 'transaction',
    showToast = true
  } = options;
  
  const message = extractRevertReason(error);
  
  // Log transaction errors for debugging
  console.error(`Transaction error in ${operation}:`, error);
  
  if (showToast && shouldShowErrorToast(error, { isTransaction: true })) {
    toast.error(message);
  }
  
  return message;
};

/**
 * Handle contract call errors specifically
 */
export const handleContractCallError = (error, methodName, options = {}) => {
  const {
    showToast = false, // Default to false for contract calls
    isRequired = false
  } = options;
  
  const message = extractRevertReason(error);
  
  // Log contract call errors
  console.warn(`Contract call failed for ${methodName}:`, message);
  
  // Only show toast for required calls or critical errors
  if (showToast && (isRequired || shouldShowErrorToast(error, { isReadOnly: true }))) {
    toast.error(`${methodName} failed: ${message}`);
  }
  
  return message;
};

/**
 * Create a safe async function wrapper that handles errors
 */
export const createSafeAsyncFunction = (asyncFn, errorOptions = {}) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      handleError(error, errorOptions);
      throw error; // Re-throw so calling code can handle it
    }
  };
};

/**
 * Debounced error handler to prevent spam
 */
class DebouncedErrorHandler {
  constructor(delay = 1000) {
    this.delay = delay;
    this.timeouts = new Map();
  }
  
  handle(error, key = 'default', options = {}) {
    // Clear existing timeout for this key
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }
    
    // Set new timeout
    const timeoutId = setTimeout(() => {
      handleError(error, options);
      this.timeouts.delete(key);
    }, this.delay);
    
    this.timeouts.set(key, timeoutId);
  }
  
  clear(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
  }
  
  clearAll() {
    for (const timeoutId of this.timeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
  }
}

// Export singleton instance
export const debouncedErrorHandler = new DebouncedErrorHandler();

/**
 * Hook for handling errors in React components
 */
export const useErrorHandler = () => {
  const handleAsyncError = (error, options = {}) => {
    return handleError(error, options);
  };
  
  const handleTransactionErr = (error, options = {}) => {
    return handleTransactionError(error, options);
  };
  
  const handleContractCallErr = (error, methodName, options = {}) => {
    return handleContractCallError(error, methodName, options);
  };
  
  return {
    handleError: handleAsyncError,
    handleTransactionError: handleTransactionErr,
    handleContractCallError: handleContractCallErr,
    extractRevertReason,
    shouldShowErrorToast
  };
};
