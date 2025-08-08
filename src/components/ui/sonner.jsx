import { toast as sonnerToast, Toaster as Sonner } from "sonner";

/**
 * Enhanced Toast Manager with duplicate prevention
 */
class ToastManager {
  constructor() {
    this.recentToasts = new Map();
    this.cleanupInterval = 5000; // 5 seconds
    this.maxDuplicateWindow = 3000; // 3 seconds window for duplicate detection

    // Cleanup old toast records periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.recentToasts.entries()) {
        if (now - timestamp > this.cleanupInterval) {
          this.recentToasts.delete(key);
        }
      }
    }, this.cleanupInterval);
  }

  /**
   * Generate a key for toast deduplication
   */
  generateToastKey(message, type = 'default') {
    // Normalize the message to handle slight variations
    const normalizedMessage = String(message)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      // Remove transaction hashes and addresses to group similar errors
      .replace(/0x[a-f0-9]{40,}/gi, '[address]')
      .replace(/transaction:\s*0x[a-f0-9]+/gi, '[transaction]')
      // Remove specific numbers that might vary
      .replace(/\d+(\.\d+)?\s*(eth|matic|avax|bnb)/gi, '[amount]')
      .replace(/attempt\s+\d+\/\d+/gi, '[attempt]');

    return `${type}:${normalizedMessage}`;
  }

  /**
   * Check if a toast is a duplicate within the time window
   */
  isDuplicate(message, type = 'default') {
    const key = this.generateToastKey(message, type);
    const now = Date.now();
    const lastShown = this.recentToasts.get(key);

    if (lastShown && (now - lastShown) < this.maxDuplicateWindow) {
      return true;
    }

    this.recentToasts.set(key, now);
    return false;
  }

  /**
   * Enhanced error toast with duplicate prevention
   */
  error(message, options = {}) {
    if (this.isDuplicate(message, 'error')) {
      console.log('Duplicate error toast prevented:', message);
      return;
    }

    // Enhanced error message processing
    const processedMessage = this.processErrorMessage(message);

    return sonnerToast.error(processedMessage, {
      duration: 4000,
      ...options
    });
  }

  /**
   * Enhanced success toast with duplicate prevention
   */
  success(message, options = {}) {
    if (this.isDuplicate(message, 'success')) {
      console.log('Duplicate success toast prevented:', message);
      return;
    }

    return sonnerToast.success(message, {
      duration: 3000,
      ...options
    });
  }

  /**
   * Enhanced info toast with duplicate prevention
   */
  info(message, options = {}) {
    if (this.isDuplicate(message, 'info')) {
      console.log('Duplicate info toast prevented:', message);
      return;
    }

    return sonnerToast.info(message, {
      duration: 3000,
      ...options
    });
  }

  /**
   * Enhanced warning toast with duplicate prevention
   */
  warning(message, options = {}) {
    if (this.isDuplicate(message, 'warning')) {
      console.log('Duplicate warning toast prevented:', message);
      return;
    }

    return sonnerToast.warning(message, {
      duration: 4000,
      ...options
    });
  }

  /**
   * Process error messages to make them more user-friendly
   */
  processErrorMessage(error) {
    if (!error) return 'An unknown error occurred';

    let message = typeof error === 'string' ? error : error.message || error.toString();

    // Clean up common error patterns
    message = message
      // Remove technical prefixes
      .replace(/^Error:\s*/i, '')
      .replace(/^execution reverted:\s*/i, '')
      .replace(/^call exception:\s*/i, '')
      .replace(/^missing revert data in call exception;\s*/i, '')

      // Improve common error messages
      .replace(/user rejected transaction/i, 'Transaction was cancelled')
      .replace(/insufficient funds/i, 'Insufficient funds for transaction')
      .replace(/gas required exceeds allowance/i, 'Transaction requires more gas than available')
      .replace(/nonce too low/i, 'Transaction nonce error - please try again')
      .replace(/replacement transaction underpriced/i, 'Transaction fee too low - please increase gas price')

      // Network-specific improvements
      .replace(/network error/i, 'Network connection error')
      .replace(/timeout/i, 'Request timed out')
      .replace(/rate limit/i, 'Too many requests - please wait a moment')

      // Contract-specific improvements
      .replace(/contract not deployed/i, 'Smart contract not found on this network')
      .replace(/method not found/i, 'Contract method not available')

      // Capitalize first letter
      .replace(/^./, str => str.toUpperCase());

    // Limit message length
    if (message.length > 150) {
      message = message.substring(0, 147) + '...';
    }

    return message;
  }

  /**
   * Force show a toast (bypass duplicate detection)
   */
  forceError(message, options = {}) {
    const processedMessage = this.processErrorMessage(message);
    return sonnerToast.error(processedMessage, {
      duration: 4000,
      ...options
    });
  }

  /**
   * Clear all recent toast records (useful for testing or manual reset)
   */
  clearHistory() {
    this.recentToasts.clear();
  }

  /**
   * Pass through other toast methods
   */
  loading(message, options = {}) {
    return sonnerToast.loading(message, options);
  }

  dismiss(toastId) {
    return sonnerToast.dismiss(toastId);
  }

  promise(promise, options = {}) {
    return sonnerToast.promise(promise, options);
  }
}

// Create singleton instance
const toastManager = new ToastManager();

const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      expand={true}
      richColors={false}
      closeButton={true}
      {...props} />
  );
}

// Export enhanced toast with duplicate prevention
export { Toaster, toastManager as toast }
