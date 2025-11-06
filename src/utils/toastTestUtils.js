/**
 * Test utilities for verifying toast deduplication functionality
 * This file can be used for manual testing and debugging
 */

import { toast } from '../components/ui/sonner';

/**
 * Test duplicate error prevention
 */
export const testDuplicateErrorPrevention = () => {
  console.log('🧪 Testing duplicate error prevention...');
  
  // Test 1: Identical error messages
  console.log('Test 1: Identical error messages');
  toast.error('Transaction failed: insufficient funds');
  setTimeout(() => toast.error('Transaction failed: insufficient funds'), 100);
  setTimeout(() => toast.error('Transaction failed: insufficient funds'), 200);
  
  // Test 2: Similar error messages with variations
  setTimeout(() => {
    console.log('Test 2: Similar error messages with variations');
    toast.error('Network error: timeout occurred');
    toast.error('Network Error: Timeout Occurred');
    toast.error('network error: timeout occurred');
  }, 1000);
  
  // Test 3: Different error types
  setTimeout(() => {
    console.log('Test 3: Different error types');
    toast.error('Contract call failed');
    toast.warning('Contract call failed');
    toast.info('Contract call failed');
  }, 2000);
  
  // Test 4: Errors with transaction hashes (should be normalized)
  setTimeout(() => {
    console.log('Test 4: Errors with transaction hashes');
    toast.error('Transaction failed: 0x1234567890abcdef1234567890abcdef12345678');
    toast.error('Transaction failed: 0xabcdef1234567890abcdef1234567890abcdef12');
  }, 3000);
  
  // Test 5: Time window expiration
  setTimeout(() => {
    console.log('Test 5: Time window expiration (should show after 3+ seconds)');
    toast.error('Transaction failed: insufficient funds');
  }, 4000);
};

/**
 * Test error message processing
 */
export const testErrorMessageProcessing = () => {
  console.log('🧪 Testing error message processing...');
  
  const testErrors = [
    'Error: execution reverted: insufficient funds',
    'call exception: missing revert data',
    'user rejected transaction',
    'INSUFFICIENT_FUNDS',
    'gas required exceeds allowance',
    'nonce too low',
    'replacement transaction underpriced',
    'network error: timeout',
    'contract not deployed',
    'method not found'
  ];
  
  testErrors.forEach((error, index) => {
    setTimeout(() => {
      console.log(`Processing error ${index + 1}:`, error);
      toast.error(error);
    }, index * 500);
  });
};

/**
 * Test success message deduplication
 */
export const testSuccessDeduplication = () => {
  console.log('🧪 Testing success message deduplication...');
  
  toast.success('Transaction completed successfully!');
  setTimeout(() => toast.success('Transaction completed successfully!'), 100);
  setTimeout(() => toast.success('Transaction Completed Successfully!'), 200);
  
  setTimeout(() => {
    toast.success('Pool created successfully!');
  toast.success('Pool created successfully!');
  }, 1000);
};

/**
 * Test mixed message types
 */
export const testMixedMessageTypes = () => {
  console.log('🧪 Testing mixed message types...');
  
  // Same message, different types - should all show
  toast.error('Operation failed');
  toast.warning('Operation failed');
  toast.info('Operation failed');
  toast.success('Operation failed');
  
  setTimeout(() => {
    // Same type, same message - should deduplicate
    toast.error('Duplicate error test');
    toast.error('Duplicate error test');
    toast.error('Duplicate error test');
  }, 1000);
};

/**
 * Test force error (bypass deduplication)
 */
export const testForceError = () => {
  console.log('🧪 Testing force error (bypass deduplication)...');
  
  toast.error('Normal error message');
  toast.error('Normal error message'); // Should be blocked
  
  setTimeout(() => {
    toast.forceError('Forced error message');
    toast.forceError('Forced error message'); // Should show both
  }, 500);
};

/**
 * Test clear history functionality
 */
export const testClearHistory = () => {
  console.log('🧪 Testing clear history functionality...');
  
  toast.error('Error before clear');
  toast.error('Error before clear'); // Should be blocked
  
  setTimeout(() => {
    toast.clearHistory();
    toast.error('Error after clear'); // Should show
  }, 500);
};

/**
 * Run all tests
 */
export const runAllToastTests = () => {
  console.log('🚀 Running all toast deduplication tests...');
  
  testDuplicateErrorPrevention();
  
  setTimeout(() => testErrorMessageProcessing(), 6000);
  setTimeout(() => testSuccessDeduplication(), 12000);
  setTimeout(() => testMixedMessageTypes(), 15000);
  setTimeout(() => testForceError(), 18000);
  setTimeout(() => testClearHistory(), 21000);
  
  setTimeout(() => {
    console.log('✅ All toast tests completed!');
  }, 24000);
};

/**
 * Simulate common error scenarios
 */
export const simulateCommonErrors = () => {
  console.log('🎭 Simulating common error scenarios...');
  
  // Scenario 1: Network switching errors
  setTimeout(() => {
    console.log('Scenario 1: Network switching');
    toast.error('Failed to switch network: User rejected the request');
    toast.error('Failed to add network: User rejected the request');
    toast.error('Failed to switch network: user rejected the request'); // Should be blocked
  }, 1000);
  
  // Scenario 2: Contract call failures
  setTimeout(() => {
    console.log('Scenario 2: Contract call failures');
    toast.error('Contract call failed: execution reverted');
    toast.error('Contract call failed: execution reverted'); // Should be blocked
    toast.error('Contract call failed: missing revert data'); // Different, should show
  }, 3000);
  
  // Scenario 3: Transaction errors
  setTimeout(() => {
    console.log('Scenario 3: Transaction errors');
    toast.error('Transaction failed: insufficient funds for gas');
    toast.error('Transaction failed: insufficient funds for gas'); // Should be blocked
    toast.error('Transaction failed: nonce too low'); // Different, should show
  }, 5000);
  
  // Scenario 4: Loading errors
  setTimeout(() => {
    console.log('Scenario 4: Loading errors');
    toast.error('Failed to load pool data');
  toast.error('Failed to load pool data'); // Should be blocked
    toast.error('Failed to load activity data'); // Different, should show
  }, 7000);
};

// Export for console testing
if (typeof window !== 'undefined') {
  window.toastTests = {
    runAll: runAllToastTests,
    duplicateErrors: testDuplicateErrorPrevention,
    messageProcessing: testErrorMessageProcessing,
    successDedup: testSuccessDeduplication,
    mixedTypes: testMixedMessageTypes,
    forceError: testForceError,
    clearHistory: testClearHistory,
    commonErrors: simulateCommonErrors
  };
  
  console.log('🧪 Toast test utilities loaded! Use window.toastTests.runAll() to test all functionality.');
}
