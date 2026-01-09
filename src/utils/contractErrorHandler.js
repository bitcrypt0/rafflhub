/**
 * Contract Error Handler Utility
 * Provides user-friendly error messages for custom contract errors
 * from gas-optimized Pool.sol, DroprERC721A.sol, and DroprERC1155.sol
 */

// Custom error selector mappings (keccak256 hash of error signature)
// These are the 4-byte function selectors for Solidity custom errors
// Generated using: ethers.utils.id('ErrorName()').slice(0, 10)
const ERROR_SELECTORS = {
  // Pool.sol Purchase Errors
  '0xd92e233d': 'ZeroAddress',
  '0xf4f5b733': 'ZeroQuantity',
  '0xd2100d73': 'ZeroSlotFee',
  '0xfd2a413d': 'PoolDurationElapsed',
  '0x7145fa7b': 'ExceedsMaxSlots',
  '0x569e8c11': 'IncorrectPayment',
  '0x176f75b8': 'ExceedsSlotLimit',
  '0x1889eae0': 'ContractsCannotPurchase',
  '0xbe54005a': 'ProtocolAdminNotAllowed',
  '0x194d5060': 'CreatorNotAllowed',
  '0x93a7d4e8': 'InvalidNonPrizedPurchase',
  '0x43361aaf': 'SocialEngagementNotConfigured',
  '0xbaf3f0f7': 'InvalidState',
  '0x27e1f1e5': 'OnlyOperator',
  
  // Pool.sol Prize Claiming Errors
  '0xb19a9f82': 'NotAWinner',
  '0xccaf35d0': 'NoPrizesToClaim',
  '0x327ee3e0': 'InvalidPrizeAmount',
  '0x880a1491': 'PrizeTransferFailed',
  '0x424ca239': 'InvalidPrizeCollection',
  '0x1a1889b7': 'InvalidPoolState',
  '0x5c427cd9': 'UnauthorizedCaller',
  '0x170554d5': 'ExceedsWinnersCount',
  '0xfd34e505': 'MintingNotSupported',
  
  // DroprERC721A.sol & DroprERC1155.sol Errors
  '0x955c501b': 'UnauthorizedMinter',
  '0xc30436e9': 'ExceedsMaxSupply',
  '0x0fee82b1': 'SupplyNotSet',
};

/**
 * Parse contract error and return user-friendly message
 * @param {Error} error - The error from contract transaction
 * @param {string} context - Context of the error (e.g., 'claim prize', 'mint to winner')
 * @returns {string} User-friendly error message
 */
export const parseContractError = (error, context = 'complete transaction') => {
  // Log full error structure for debugging
  console.group('🔍 Parsing Contract Error');
  console.log('Full error object:', error);
  console.log('error.reason:', error?.reason);
  console.log('error.code:', error?.code);
  console.log('error.data:', error?.data);
  console.log('error.error:', error?.error);
  console.log('error.message:', error?.message);
  console.groupEnd();
  
  // Extract error message from various error formats
  let errorMessage = '';
  
  // Check for error.reason (ethers.js v5)
  if (error?.reason) {
    errorMessage = error.reason;
  }
  // Check for error.data.message (some providers)
  else if (error?.data?.message) {
    errorMessage = error.data.message;
  }
  // Check for error.error.message (nested errors)
  else if (error?.error?.message) {
    errorMessage = error.error.message;
  }
  // Check for error.error.data.message
  else if (error?.error?.data?.message) {
    errorMessage = error.error.data.message;
  }
  // Fallback to error.message
  else {
    errorMessage = error.message || error.toString();
  }
  
  console.log('📝 Extracted error message:', errorMessage);
  
  // Try to decode custom error from error data selector
  // Check error.error.data.data (nested in gas estimation errors)
  let errorSelector = null;
  if (error?.error?.data?.data && typeof error.error.data.data === 'string') {
    errorSelector = error.error.data.data.slice(0, 10); // Get first 10 chars (0x + 8 hex chars)
    console.log('🔢 Found error selector in error.error.data.data:', errorSelector);
  }
  // Check error.data (direct error data)
  else if (error?.data && typeof error.data === 'string' && error.data.startsWith('0x')) {
    errorSelector = error.data.slice(0, 10);
    console.log('🔢 Found error selector in error.data:', errorSelector);
  }
  
  // Decode error selector to error name
  if (errorSelector && ERROR_SELECTORS[errorSelector]) {
    const decodedError = ERROR_SELECTORS[errorSelector];
    console.log('✅ Decoded custom error from selector:', decodedError);
    errorMessage = decodedError;
  }
  
  // Try to extract custom error name from various text formats
  // Format 1: "execution reverted: CustomErrorName"
  const customErrorMatch1 = errorMessage.match(/execution reverted:?\s*([A-Z][a-zA-Z0-9]*)/);
  if (customErrorMatch1 && customErrorMatch1[1]) {
    console.log('✅ Matched custom error (format 1):', customErrorMatch1[1]);
    errorMessage = customErrorMatch1[1];
  }
  
  // Format 2: "Error: VM Exception while processing transaction: reverted with custom error 'CustomErrorName()'"
  const customErrorMatch2 = errorMessage.match(/custom error '([A-Z][a-zA-Z0-9]*)\(/);
  if (customErrorMatch2 && customErrorMatch2[1]) {
    console.log('✅ Matched custom error (format 2):', customErrorMatch2[1]);
    errorMessage = customErrorMatch2[1];
  }
  
  console.log('🎯 Final error message to parse:', errorMessage);
  
  // ============================================
  // Pool.sol Prize Claiming Errors
  // ============================================
  
  if (errorMessage.includes('NotAWinner')) {
    return 'You are not a winner of this raffle. Only winners can claim prizes.';
  }
  
  if (errorMessage.includes('NoPrizesToClaim')) {
    return 'You have already claimed all your prizes. No prizes remaining to claim.';
  }
  
  if (errorMessage.includes('InvalidPrizeAmount')) {
    return 'Invalid prize amount calculated. Please contact support for assistance.';
  }
  
  if (errorMessage.includes('PrizeTransferFailed')) {
    return 'Prize transfer failed. Please ensure your wallet can receive the prize and try again.';
  }
  
  if (errorMessage.includes('InvalidPrizeCollection')) {
    return 'Invalid prize collection address. Please contact the raffle creator.';
  }
  
  if (errorMessage.includes('InvalidPoolState')) {
    return 'Raffle is not in the correct state for this action. Please wait for winner selection to complete.';
  }
  
  if (errorMessage.includes('UnauthorizedCaller')) {
    return 'You are not authorized to perform this action. Only the creator, operators, or prize contract owner can mint prizes.';
  }
  
  if (errorMessage.includes('ExceedsWinnersCount')) {
    return 'Cannot mint more prizes than the total number of winners.';
  }
  
  if (errorMessage.includes('MintingNotSupported')) {
    return 'Minting is not supported for this prize type. This prize may be escrowed.';
  }
  
  // ============================================
  // DroprERC721A.sol & DroprERC1155.sol Errors
  // ============================================
  
  if (errorMessage.includes('UnauthorizedMinter')) {
    return 'You are not authorized to mint NFTs from this collection. Only the designated minter can mint.';
  }
  
  if (errorMessage.includes('ZeroQuantity')) {
    return 'Mint quantity must be greater than 0. Please specify a valid quantity.';
  }
  
  if (errorMessage.includes('ExceedsMaxSupply')) {
    return 'Minting would exceed the maximum supply for this collection. No more NFTs can be minted.';
  }
  
  if (errorMessage.includes('SupplyNotSet')) {
    return 'Maximum supply has not been set for this token ID. Please contact the collection owner.';
  }
  
  // ============================================
  // Existing Pool.sol Errors (from previous optimization)
  // ============================================
  
  if (errorMessage.includes('ZeroAddress')) {
    return 'Invalid address provided. Address cannot be zero.';
  }
  
  if (errorMessage.includes('ZeroQuantity')) {
    return 'Quantity must be greater than 0.';
  }
  
  if (errorMessage.includes('ZeroSlotFee')) {
    return 'Slot fee cannot be zero.';
  }
  
  if (errorMessage.includes('PoolDurationElapsed')) {
    return 'Raffle duration has elapsed. No more tickets can be purchased.';
  }
  
  if (errorMessage.includes('ExceedsMaxSlots')) {
    return 'Purchase exceeds the maximum number of available slots.';
  }
  
  if (errorMessage.includes('IncorrectPayment')) {
    return 'Incorrect payment amount. Please ensure you send the exact amount required.';
  }
  
  if (errorMessage.includes('ExceedsSlotLimit')) {
    return 'Purchase exceeds your personal slot limit for this raffle.';
  }
  
  if (errorMessage.includes('ContractsCannotPurchase')) {
    return 'Smart contracts cannot purchase raffle tickets. Please use a regular wallet.';
  }
  
  if (errorMessage.includes('ProtocolAdminNotAllowed')) {
    return 'Protocol administrators cannot participate in raffles.';
  }
  
  if (errorMessage.includes('CreatorNotAllowed')) {
    return 'Raffle creators cannot purchase tickets in their own raffles.';
  }
  
  if (errorMessage.includes('InvalidNonPrizedPurchase')) {
    return 'Cannot purchase tickets in a non-prized raffle.';
  }
  
  if (errorMessage.includes('SocialEngagementNotConfigured')) {
    return 'Social engagement is required but not properly configured. Please contact support.';
  }
  
  if (errorMessage.includes('InvalidState')) {
    return 'Raffle is not in a valid state for this action.';
  }
  
  if (errorMessage.includes('OnlyOperator')) {
    return 'Only protocol operators can perform this action.';
  }
  
  // ============================================
  // Common Web3 Errors
  // ============================================
  
  if (errorMessage.includes('user rejected') || 
      errorMessage.includes('User denied') || 
      errorMessage.includes('user cancelled')) {
    return 'Transaction was cancelled. You rejected the transaction in your wallet.';
  }
  
  if (errorMessage.includes('insufficient funds')) {
    return 'Insufficient funds in your wallet to complete this transaction.';
  }
  
  if (errorMessage.includes('gas required exceeds allowance') || 
      errorMessage.includes('out of gas')) {
    return 'Transaction requires more gas than available. Please try again with a higher gas limit.';
  }
  
  if (errorMessage.includes('nonce too low')) {
    return 'Transaction nonce is too low. Please reset your wallet or wait for pending transactions to complete.';
  }
  
  if (errorMessage.includes('replacement transaction underpriced')) {
    return 'Replacement transaction has too low gas price. Please increase the gas price.';
  }
  
  if (errorMessage.includes('network changed') || 
      errorMessage.includes('wrong network')) {
    return 'Wrong network selected. Please switch to the correct network in your wallet.';
  }
  
  if (errorMessage.includes('execution reverted')) {
    return 'Transaction failed during execution. Please check the transaction details and try again.';
  }
  
  // ============================================
  // Generic Fallback
  // ============================================
  
  return `Failed to ${context}. Please try again or contact support if the issue persists.`;
};

/**
 * Check if error is a custom contract error
 * @param {Error} error - The error to check
 * @returns {boolean} True if it's a custom contract error
 */
export const isCustomContractError = (error) => {
  const errorMessage = error.message || error.toString();
  
  const customErrors = [
    // Prize claiming errors
    'NotAWinner',
    'NoPrizesToClaim',
    'InvalidPrizeAmount',
    'PrizeTransferFailed',
    'InvalidPrizeCollection',
    'InvalidPoolState',
    'UnauthorizedCaller',
    'ExceedsWinnersCount',
    'MintingNotSupported',
    
    // NFT minting errors
    'UnauthorizedMinter',
    'ZeroQuantity',
    'ExceedsMaxSupply',
    'SupplyNotSet',
    
    // Purchase errors
    'ZeroAddress',
    'ZeroSlotFee',
    'PoolDurationElapsed',
    'ExceedsMaxSlots',
    'IncorrectPayment',
    'ExceedsSlotLimit',
    'ContractsCannotPurchase',
    'ProtocolAdminNotAllowed',
    'CreatorNotAllowed',
    'InvalidNonPrizedPurchase',
    'SocialEngagementNotConfigured',
    'InvalidState',
    'OnlyOperator'
  ];
  
  return customErrors.some(err => errorMessage.includes(err));
};

/**
 * Get error severity level
 * @param {Error} error - The error to check
 * @returns {string} Severity level: 'error', 'warning', 'info'
 */
export const getErrorSeverity = (error) => {
  const errorMessage = error.message || error.toString();
  
  // Info level - user actions
  if (errorMessage.includes('user rejected') || 
      errorMessage.includes('User denied') || 
      errorMessage.includes('user cancelled')) {
    return 'info';
  }
  
  // Warning level - recoverable errors
  if (errorMessage.includes('NoPrizesToClaim') ||
      errorMessage.includes('NotAWinner') ||
      errorMessage.includes('ExceedsSlotLimit') ||
      errorMessage.includes('PoolDurationElapsed')) {
    return 'warning';
  }
  
  // Error level - critical errors
  return 'error';
};

/**
 * Get suggested action for error
 * @param {Error} error - The error to check
 * @returns {string|null} Suggested action or null
 */
export const getSuggestedAction = (error) => {
  const errorMessage = error.message || error.toString();
  
  if (errorMessage.includes('NotAWinner')) {
    return 'Check the winners list to see if you won.';
  }
  
  if (errorMessage.includes('NoPrizesToClaim')) {
    return 'You have already claimed your prizes. Check your wallet for the received prizes.';
  }
  
  if (errorMessage.includes('InvalidPoolState')) {
    return 'Wait for the raffle to complete winner selection, then try again.';
  }
  
  if (errorMessage.includes('UnauthorizedCaller')) {
    return 'Contact the raffle creator or a protocol operator to mint your prize.';
  }
  
  if (errorMessage.includes('insufficient funds')) {
    return 'Add more funds to your wallet and try again.';
  }
  
  if (errorMessage.includes('wrong network')) {
    return 'Switch to the correct network in your wallet settings.';
  }
  
  if (errorMessage.includes('ExceedsMaxSupply')) {
    return 'This collection has reached its maximum supply. No more NFTs can be minted.';
  }
  
  if (errorMessage.includes('PoolDurationElapsed')) {
    return 'This raffle has ended. You can no longer purchase tickets.';
  }
  
  if (errorMessage.includes('ExceedsSlotLimit')) {
    return 'You have reached your maximum ticket limit for this raffle.';
  }
  
  return null;
};

/**
 * Format error for display with all details
 * @param {Error} error - The error to format
 * @param {string} context - Context of the error
 * @returns {Object} Formatted error object
 */
export const formatErrorForDisplay = (error, context = 'complete transaction') => {
  const message = parseContractError(error, context);
  const severity = getErrorSeverity(error);
  const suggestedAction = getSuggestedAction(error);
  const isCustomError = isCustomContractError(error);
  
  return {
    message,
    severity,
    suggestedAction,
    isCustomError,
    originalError: error.message || error.toString()
  };
};

/**
 * Log error with context for debugging
 * @param {Error} error - The error to log
 * @param {string} context - Context of the error
 * @param {Object} additionalData - Additional data to log
 */
export const logContractError = (error, context, additionalData = {}) => {
  const formattedError = formatErrorForDisplay(error, context);
  
  console.group(`🚨 Contract Error: ${context}`);
  console.error('User Message:', formattedError.message);
  console.error('Severity:', formattedError.severity);
  if (formattedError.suggestedAction) {
    console.info('Suggested Action:', formattedError.suggestedAction);
  }
  console.error('Original Error:', formattedError.originalError);
  console.error('Is Custom Error:', formattedError.isCustomError);
  if (Object.keys(additionalData).length > 0) {
    console.error('Additional Data:', additionalData);
  }
  console.groupEnd();
  
  return formattedError;
};

export default {
  parseContractError,
  isCustomContractError,
  getErrorSeverity,
  getSuggestedAction,
  formatErrorForDisplay,
  logContractError
};
