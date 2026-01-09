/**
 * Multicall Utility for Batch Contract Calls
 * Optimizes RPC requests by batching multiple contract calls into a single request
 */

import { ethers } from 'ethers';

// Minimal multicall ABI
const MULTICALL_ABI = [
  {
    "inputs": [
      {
        "components": [
          {"internalType": "address", "name": "target", "type": "address"},
          {"internalType": "bytes", "name": "callData", "type": "bytes"}
        ],
        "internalType": "struct Multicall.Call[]",
        "name": "calls",
        "type": "tuple[]"
      }
    ],
    "name": "aggregate",
    "outputs": [
      {"internalType": "uint256", "name": "blockNumber", "type": "uint256"},
      {"internalType": "bytes[]", "name": "returnData", "type": "bytes[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Multicall contract addresses on different networks
const MULTICALL_ADDRESSES = {
  1: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // Ethereum Mainnet
  3: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // Ropsten
  4: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // Rinkeby
  5: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // Goerli
  11155111: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // Sepolia
  137: '0xcA11bde05977b3631167028862bE2a173976CA11', // Polygon
  80001: '0xcA11bde05977b3631167028862bE2a173976CA11', // Mumbai
  56: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // BSC
  97: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // BSC Testnet
  42161: '0xcA11bde05977b3631167028862bE2a173976CA11', // Arbitrum
  421613: '0xcA11bde05977b3631167028862bE2a173976CA11', // Arbitrum Rinkeby
  10: '0xcA11bde05977b3631167028862bE2a173976CA11', // Optimism
  69: '0xcA11bde05977b3631167028862bE2a173976CA11', // Optimism Kovan
  43114: '0xcA11bde05977b3631167028862bE2a173976CA11', // Avalanche
  43113: '0xcA11bde05977b3631167028862bE2a173976CA11', // Avalanche Fuji
  421614: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE44', // Optimism Sepolia
  8453: '0xcA11bde05977b3631167028862bE2a173976CA11', // Base Mainnet
  84532: '0xcA11bde05977b3631167028862bE2a173976CA11', // Base Sepolia
  2020: '0xcA11bde05977b3631167028862bE2a173976CA11', // Ronin
  7700: '0xcA11bde05977b3631167028862bE2a173976CA11', // Ronin Saigon
  1946: '0xcA11bde05977b3631167028862bE2a173976CA11', // Soneium
  16379: '0xcA11bde05977b3631167028862bE2a173976CA11' // Minato
};

/**
 * Create batch calls for contract methods
 * @param {Object} contract - Ethers contract instance
 * @param {Array} calls - Array of call objects: { method: string, params: array }
 * @returns {Object} Object with batchCalls array and validCalls array with original indices
 */
export const createBatchCalls = (contract, calls) => {
  const batchCalls = [];
  const validCalls = [];
  
  calls.forEach(({ method, params = [] }, originalIndex) => {
    try {
      const callData = contract.interface.encodeFunctionData(method, params);
      batchCalls.push({
        target: contract.address,
        callData
      });
      validCalls.push({ method, originalIndex });
    } catch (error) {
      // Silently handle encoding errors - these are expected for some methods
      // console.error(`Failed to encode call data for ${method}:`, error);
    }
  });
  
  return { batchCalls, validCalls };
};

/**
 * Execute batch calls using multicall
 * @param {Object} provider - Ethers provider
 * @param {Array} calls - Array of call objects from createBatchCalls
 * @param {number} chainId - Chain ID for multicall address
 * @returns {Array} Decoded results
 */
export const executeBatchCalls = async (provider, calls, chainId) => {
  if (!calls || calls.length === 0) {
    return [];
  }

  // Get multicall address for chain
  const multicallAddress = MULTICALL_ADDRESSES[chainId];
  if (!multicallAddress) {
    console.warn(`Multicall not supported on chain ${chainId}, falling back to individual calls`);
    return null;
  }

  try {
    // Create multicall contract
    const multicall = new ethers.Contract(multicallAddress, MULTICALL_ABI, provider);

    // Execute batch call
    const [, returnData] = await multicall.aggregate(calls);

    return returnData;
  } catch (error) {
    console.error('Multicall failed:', error);
    return null;
  }
};

/**
 * Decode batch call results
 * @param {Object} contract - Ethers contract instance
 * @param {Array} calls - Original call definitions
 * @param {Array} returnData - Raw return data from multicall
 * @param {Array} validCalls - Array of valid calls with their original indices
 * @returns {Array} Decoded results with proper index mapping
 */
export const decodeBatchResults = (contract, calls, returnData, validCalls) => {
  // Initialize results array with null for all calls
  const results = new Array(calls.length).fill(null);
  
  // Map valid results back to their original positions
  validCalls.forEach(({ method, originalIndex }, validIndex) => {
    try {
      if (!returnData[validIndex]) {
        throw new Error('No return data for call');
      }
      results[originalIndex] = contract.interface.decodeFunctionResult(method, returnData[validIndex])[0];
    } catch (error) {
      // Silently handle decoding errors
      // console.error(`Failed to decode result for ${method}:`, error);
      results[originalIndex] = null;
    }
  });
  
  // Fill missing results with appropriate fallbacks
  calls.forEach(({ method }, index) => {
    if (results[index] === null) {
      console.warn(`Method ${method} failed, using fallback`);
      if (method.includes('is') || method === 'isCollabPool' || method === 'usesCustomFee' || 
          method === 'isExternalPrizeCollection' || 
          method === 'isRefundable' || method === 'isPrized') {
        results[index] = false;
      } else if (method === 'isEscrowedPrize') {
        // Return undefined for missing isEscrowedPrize so frontend can handle it properly
        results[index] = undefined;
      } else if (method === 'standard') {
        results[index] = undefined;
      } else if (method === 'revenueRecipient' || method === 'prizeCollection' || 
          method === 'erc20PrizeToken') {
        results[index] = ethers.constants.AddressZero;
      } else if (method === 'prizeTokenId' || method === 'erc20PrizeAmount' || 
          method === 'nativePrizeAmount' || method === 'maxSlotsPerAddress' || 
          method === 'slotLimit' || method === 'winnersCount') {
        results[index] = ethers.BigNumber.from(0);
      }
    }
  });
  
  return results;
};

/**
 * Batch call helper that combines all steps
 * @param {Object} contract - Ethers contract instance
 * @param {Array} calls - Array of call objects: { method: string, params: array }
 * @param {number} chainId - Chain ID
 * @returns {Promise<Array>} Decoded results or null if multicall fails
 */
export const batchContractCalls = async (contract, calls, chainId) => {
  // Create batch calls
  const { batchCalls, validCalls } = createBatchCalls(contract, calls);
  
  // If no valid calls, return all fallbacks
  if (batchCalls.length === 0) {
    return decodeBatchResults(contract, calls, [], validCalls);
  }
  
  // Execute batch calls
  const returnData = await executeBatchCalls(contract.provider, batchCalls, chainId);
  
  // If multicall failed, return null to fallback to individual calls
  if (!returnData) {
    return null;
  }

  // Decode results
  return decodeBatchResults(contract, calls, returnData, validCalls);
};

/**
 * Fallback to individual calls if multicall fails
 * @param {Object} contract - Ethers contract instance
 * @param {Array} calls - Array of call objects
 * @returns {Promise<Array>} Results from individual calls
 */
export const fallbackToIndividualCalls = async (contract, calls) => {
  const results = [];
  
  for (const { method, params = [] } of calls) {
    try {
      // Check if method exists on contract
      if (typeof contract[method] !== 'function') {
        console.warn(`Method ${method} does not exist on contract, using fallback`);
        // Return appropriate fallback based on method name
        if (method.includes('is') || method === 'isCollabPool' || method === 'usesCustomFee' || 
            method === 'isExternalPrizeCollection' || 
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
      }
      
      const result = await contract[method](...params);
      results.push(result);
    } catch (error) {
      console.error(`Individual call failed for ${method}:`, error);
      results.push(null);
    }
  }
  
  return results;
};

/**
 * Optimized batch call with automatic fallback
 * @param {Object} contract - Ethers contract instance
 * @param {Array} calls - Array of call objects: { method: string, params: array }
 * @param {number} chainId - Chain ID
 * @returns {Promise<Array>} Results from batch or individual calls
 */
export const optimizedBatchCall = async (contract, calls, chainId) => {
  // Try batch call first
  const batchResults = await batchContractCalls(contract, calls, chainId);
  
  // Fallback to individual calls if batch failed
  if (batchResults === null) {
    return await fallbackToIndividualCalls(contract, calls);
  }
  
  return batchResults;
};
