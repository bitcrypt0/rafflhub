/**
 * Utility for testing wallet connection robustness
 * This helps verify that the wallet context improvements work correctly
 */

export const testWalletConnection = async (walletContext, contractContext) => {
  const tests = [];
  
  // Test 1: Check if wallet is properly initialized
  tests.push({
    name: 'Wallet Initialization',
    passed: walletContext.isInitialized,
    message: walletContext.isInitialized ? 'Wallet context is initialized' : 'Wallet context not initialized'
  });
  
  // Test 2: Check if reconnection state is handled
  tests.push({
    name: 'Reconnection State',
    passed: !walletContext.isReconnecting,
    message: walletContext.isReconnecting ? 'Wallet is reconnecting' : 'Wallet not in reconnecting state'
  });
  
  // Test 3: Check contract context readiness
  tests.push({
    name: 'Contract Context',
    passed: contractContext.isContractsReady || !walletContext.connected,
    message: contractContext.isContractsReady ? 'Contracts are ready' : 'Contracts not ready (expected if wallet not connected)'
  });
  
  // Test 4: Check getContractInstance function
  tests.push({
    name: 'Contract Instance Function',
    passed: typeof contractContext.getContractInstance === 'function',
    message: 'getContractInstance function is available'
  });
  
  return tests;
};

export const logWalletState = (walletContext, contractContext) => {
  console.group('🔍 Wallet Connection State');
  console.log('Connected:', walletContext.connected);
  console.log('Initialized:', walletContext.isInitialized);
  console.log('Reconnecting:', walletContext.isReconnecting);
  console.log('Chain ID:', walletContext.chainId);
  console.log('Address:', walletContext.address);
  console.log('Contracts Ready:', contractContext.isContractsReady);
  console.log('Has Signer:', !!walletContext.signer);
  console.log('Has Provider:', !!walletContext.provider);
  console.groupEnd();
};
