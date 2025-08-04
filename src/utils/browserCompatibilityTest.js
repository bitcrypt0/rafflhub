/**
 * Browser compatibility testing utilities for Web3 dApp
 * Tests for "missing revert data" and other browser-specific issues
 */

import { ethers } from 'ethers';
import { getBrowserInfo, safeContractCall } from './contractCallUtils';

/**
 * Test basic Web3 provider functionality
 */
export const testWeb3Provider = async () => {
  const tests = [];
  const browserInfo = getBrowserInfo();
  
  // Test 1: MetaMask availability
  tests.push({
    name: 'MetaMask Availability',
    passed: !!window.ethereum,
    message: window.ethereum ? 'MetaMask detected' : 'MetaMask not found',
    critical: true
  });
  
  if (!window.ethereum) {
    return { browserInfo, tests, overall: 'FAILED' };
  }
  
  try {
    // Test 2: Provider creation
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    tests.push({
      name: 'Provider Creation',
      passed: !!provider,
      message: 'Web3Provider created successfully',
      critical: true
    });
    
    // Test 3: Network detection
    try {
      const network = await provider.getNetwork();
      tests.push({
        name: 'Network Detection',
        passed: !!network.chainId,
        message: `Connected to chain ${network.chainId}`,
        critical: false
      });
    } catch (error) {
      tests.push({
        name: 'Network Detection',
        passed: false,
        message: `Network detection failed: ${error.message}`,
        critical: false
      });
    }
    
    // Test 4: Account access (if connected)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      tests.push({
        name: 'Account Access',
        passed: true,
        message: accounts.length > 0 ? `${accounts.length} account(s) connected` : 'No accounts connected',
        critical: false
      });
    } catch (error) {
      tests.push({
        name: 'Account Access',
        passed: false,
        message: `Account access failed: ${error.message}`,
        critical: false
      });
    }
    
  } catch (error) {
    tests.push({
      name: 'Provider Creation',
      passed: false,
      message: `Provider creation failed: ${error.message}`,
      critical: true
    });
  }
  
  const criticalFailures = tests.filter(t => !t.passed && t.critical).length;
  const overall = criticalFailures > 0 ? 'FAILED' : 'PASSED';
  
  return { browserInfo, tests, overall };
};

/**
 * Test contract call compatibility
 */
export const testContractCalls = async (contractAddress, contractABI) => {
  const tests = [];
  const browserInfo = getBrowserInfo();
  
  if (!contractAddress || !contractABI) {
    return {
      browserInfo,
      tests: [{ name: 'Contract Test', passed: false, message: 'No contract provided', critical: true }],
      overall: 'SKIPPED'
    };
  }
  
  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    // Test 1: Contract instance creation
    tests.push({
      name: 'Contract Instance',
      passed: !!contract,
      message: 'Contract instance created',
      critical: true
    });
    
    // Test 2: Find a view function to test
    const viewFunctions = contractABI.filter(item => 
      item.type === 'function' && 
      (item.stateMutability === 'view' || item.stateMutability === 'pure') &&
      item.inputs.length === 0
    );
    
    if (viewFunctions.length === 0) {
      tests.push({
        name: 'View Function Test',
        passed: false,
        message: 'No parameterless view functions found',
        critical: false
      });
    } else {
      // Test the first available view function
      const testFunction = viewFunctions[0];
      const result = await safeContractCall(
        () => contract[testFunction.name](),
        testFunction.name,
        { timeout: 10000, retries: 2, required: false }
      );
      
      tests.push({
        name: `View Function (${testFunction.name})`,
        passed: result.success,
        message: result.success ? 'Contract call successful' : `Call failed: ${result.error}`,
        critical: false
      });
    }
    
  } catch (error) {
    tests.push({
      name: 'Contract Test',
      passed: false,
      message: `Contract test failed: ${error.message}`,
      critical: true
    });
  }
  
  const criticalFailures = tests.filter(t => !t.passed && t.critical).length;
  const overall = criticalFailures > 0 ? 'FAILED' : 'PASSED';
  
  return { browserInfo, tests, overall };
};

/**
 * Run comprehensive browser compatibility test
 */
export const runCompatibilityTest = async (contractAddress = null, contractABI = null) => {
  console.group('🧪 Browser Compatibility Test');
  
  const web3Test = await testWeb3Provider();
  console.log('Web3 Provider Test:', web3Test);
  
  let contractTest = null;
  if (contractAddress && contractABI) {
    contractTest = await testContractCalls(contractAddress, contractABI);
    console.log('Contract Calls Test:', contractTest);
  }
  
  const results = {
    browser: web3Test.browserInfo,
    web3: web3Test,
    contract: contractTest,
    timestamp: new Date().toISOString(),
    recommendations: generateRecommendations(web3Test, contractTest)
  };
  
  console.log('Full Results:', results);
  console.groupEnd();
  
  return results;
};

/**
 * Generate recommendations based on test results
 */
const generateRecommendations = (web3Test, contractTest) => {
  const recommendations = [];
  const browser = web3Test.browserInfo;
  
  // Browser-specific recommendations
  if (browser.name === 'firefox') {
    recommendations.push('Firefox detected: Using sequential contract calls for better reliability');
  } else if (browser.name === 'safari') {
    recommendations.push('Safari detected: Using extended timeouts and sequential processing');
  } else if (browser.name === 'edge') {
    recommendations.push('Edge detected: Using optimized batch processing');
  }
  
  // Mobile recommendations
  if (browser.isMobile) {
    recommendations.push('Mobile browser detected: Using mobile-optimized settings');
  }
  
  // Web3 issues
  if (!web3Test.tests.find(t => t.name === 'MetaMask Availability')?.passed) {
    recommendations.push('Install MetaMask browser extension');
  }
  
  // Contract call issues
  if (contractTest && !contractTest.tests.find(t => t.name.includes('View Function'))?.passed) {
    recommendations.push('Contract calls may be unreliable - check network connection');
  }
  
  return recommendations;
};
