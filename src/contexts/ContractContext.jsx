import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../networks';
import { useWallet } from './WalletContext';
import { contractABIs } from '../contracts/contractABIs';
import { toast } from '../components/ui/sonner';
import { safeContractCall, getPlatformConfig } from '../utils/contractCallUtils';
import { notifyError } from '../utils/notificationService';
import { handleError, extractRevertReason } from '../utils/errorHandling';

const ContractContext = createContext();

export const useContract = () => {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
};

export const ContractProvider = ({ children }) => {
  const { signer, provider, connected, chainId, isInitialized, isReconnecting } = useWallet();
  const [contracts, setContracts] = useState({});
  const [isContractsReady, setIsContractsReady] = useState(false);

  // Initialize contracts when wallet is connected and addresses are available
  useEffect(() => {
    if (connected && signer && isInitialized && !isReconnecting) {
      // Reset contracts ready state immediately
      setIsContractsReady(false);

      // Initialize contracts with a small delay to ensure provider is stable
      const timer = setTimeout(() => {
        initializeContracts();
        // Add additional delay before marking as ready to ensure contracts are fully initialized
        setTimeout(() => {
          setIsContractsReady(true);
        }, 200);
      }, 100);

      return () => clearTimeout(timer);
    } else {
      setContracts({});
      setIsContractsReady(false);
    }
  }, [connected, signer, isInitialized, isReconnecting, chainId]); // Added chainId to dependencies

  const initializeContracts = () => {
    const newContracts = {};

    try {
      // Initialize main contracts
      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager) {
        newContracts.protocolManager = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager,
          contractABIs.protocolManager,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.poolDeployer) {
        newContracts.poolDeployer = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.poolDeployer,
          contractABIs.poolDeployer,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.revenueManager) {
        newContracts.revenueManager = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.revenueManager,
          contractABIs.revenueManager,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.nftFactory) {
        newContracts.nftFactory = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.nftFactory,
          contractABIs.nftFactory,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.socialEngagementManager) {
        newContracts.socialEngagementManager = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.socialEngagementManager,
          contractABIs.socialEngagementManager,
          signer
        );
      }

      setContracts(newContracts);
    } catch (error) {
      console.error('Error initializing contracts:', error);
    }
  };

  // Create contract instance for a specific address with better error handling
  const getContractInstance = (address, abiType) => {
    if (!address) {
      console.warn('No address provided for contract instance');
      return null;
    }

    if (!signer && !provider) {
      console.warn('No signer or provider available for contract instance');
      return null;
    }

    if (!contractABIs[abiType]) {
      console.error(`ABI not found for type: ${abiType}`);
      return null;
    }

    try {
      // Use signer if available, otherwise fall back to provider for read-only operations
      const signerOrProvider = signer || provider;
      return new ethers.Contract(address, contractABIs[abiType], signerOrProvider);
    } catch (error) {
      console.error(`Error creating contract instance for ${abiType}:`, error);
      return null;
    }
  };

  // Helper function to handle contract transactions
  // Supports transaction options (e.g., { value: ethers.BigNumber })
  const executeTransaction = async (contractMethod, params, txOptions = {}) => {
    try {
      // Handle functions with no parameters (e.g., activate(), requestRandomWords())
      let tx;
      if (params === undefined) {
        // No params - only pass txOptions if it has properties
        tx = Object.keys(txOptions).length > 0 
          ? await contractMethod(txOptions) 
          : await contractMethod();
      } else {
        // Has params - pass both params and txOptions
        tx = await contractMethod(params, txOptions);
      }
      const receipt = await tx.wait();
      return { success: true, receipt, hash: tx.hash };
    } catch (error) {
      const msg = notifyError(error, { kind: 'tx' });
      return { success: false, error: msg };
    }
  };

  // Helper function to handle contract calls (view functions) with robust error handling
  const executeCall = async (contractMethod, methodName = 'unknown', ...args) => {
    const platformConfig = getPlatformConfig();

    try {
      const result = await safeContractCall(
        () => contractMethod(...args),
        methodName,
        {
          timeout: platformConfig.timeout,
          retries: platformConfig.retries,
          required: false
        }
      );

      if (result.success) {
        return { success: true, result: result.result };
      } else {
        throw result.error || new Error(`${methodName} failed`);
      }
    } catch (error) {
      const msg = notifyError(error, { kind: 'call', methodName });
      return { success: false, error: msg };
    }
  };

  // Add event subscription system
  const eventListeners = React.useRef({});

  // Helper to register event listeners
  const onContractEvent = (event, callback) => {
    if (!eventListeners.current[event]) {
      eventListeners.current[event] = [];
    }
    eventListeners.current[event].push(callback);
    // Return unsubscribe function
    return () => {
      eventListeners.current[event] = eventListeners.current[event].filter(cb => cb !== callback);
    };
  };

  // Emit event to all listeners
  const emitEvent = (event, ...args) => {
    if (eventListeners.current[event]) {
      eventListeners.current[event].forEach(cb => cb(...args));
    }
  };

  // Set up contract event listeners
  useEffect(() => {
    if (!connected || !signer || !contracts.poolDeployer) return;

    // --- PoolCreated ---
    const handlePoolCreated = (pool, creator) => {
      emitEvent('PoolCreated', { pool, creator });
    };
    contracts.poolDeployer.on('PoolCreated', handlePoolCreated);

    // --- WinnersSelected ---
    if (contracts.pool) {
      const handleWinnersSelected = (winners) => {
        emitEvent('WinnersSelected', { winners });
      };
      contracts.pool.on('WinnersSelected', handleWinnersSelected);

      // --- PrizeClaimed ---
      const handlePrizeClaimed = (winner, tokenId) => {
        emitEvent('PrizeClaimed', { winner, tokenId });
      };
      contracts.pool.on('PrizeClaimed', handlePrizeClaimed);

      return () => {
        contracts.pool.off('WinnersSelected', handleWinnersSelected);
        contracts.pool.off('PrizeClaimed', handlePrizeClaimed);
      };
    }

    // Clean up
    return () => {
      contracts.poolDeployer.off('PoolCreated', handlePoolCreated);
    };
  }, [connected, signer, contracts.poolDeployer, contracts.pool]);

  const value = {
    contracts,
    getContractInstance,
    executeTransaction,
    executeCall,
    onContractEvent,
    isContractsReady,
  };

  return (
    <ContractContext.Provider value={value}>
      {children}
    </ContractContext.Provider>
  );
};


