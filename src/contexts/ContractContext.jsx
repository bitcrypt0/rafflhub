import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SUPPORTED_NETWORKS } from '../networks';
import { useWallet } from './WalletContext';
import { contractABIs } from '../contracts/contractABIs';
import { toast } from '../components/ui/sonner';
import { safeContractCall, getPlatformConfig } from '../utils/contractCallUtils';

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
      initializeContracts();
      setIsContractsReady(true);
    } else {
      setContracts({});
      setIsContractsReady(false);
    }
  }, [connected, signer, isInitialized, isReconnecting]);

  const initializeContracts = () => {
    const newContracts = {};

    try {
      // Initialize main contracts
      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleManager) {
        newContracts.raffleManager = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleManager,
          contractABIs.raffleManager,
          signer
        );
      }

      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleDeployer) {
        newContracts.raffleDeployer = new ethers.Contract(
          SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleDeployer,
          contractABIs.raffleDeployer,
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
  const executeTransaction = async (contractMethod, ...args) => {
    try {
      const tx = await contractMethod(...args);
      const receipt = await tx.wait();
      return { success: true, receipt, hash: tx.hash };
    } catch (error) {
      let message = 'Transaction failed';
      if (error?.reason) {
        message = error.reason;
      } else if (error?.data?.message) {
        message = error.data.message;
      } else if (error?.message) {
        message = error.message;
      }

      // Only show toast error if this is a user-facing transaction
      // Let individual components handle their own error display for better UX
      console.error('Contract transaction failed:', message);
      return { success: false, error: message };
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
        throw new Error(result.error);
      }
    } catch (error) {
      let message = 'Contract call failed';

      // Handle "missing revert data" errors specifically
      if (error.message.includes('missing revert data') ||
          error.message.includes('call exception') ||
          error.code === 'CALL_EXCEPTION') {
        message = 'Network connectivity issue - please try again';
      } else if (error?.reason) {
        message = error.reason;
      } else if (error?.data?.message) {
        message = error.data.message;
      } else if (error?.message) {
        message = error.message;
      }

      console.warn(`Contract call failed for ${methodName}:`, message);

      // Only show toast for critical errors that users need to know about
      // Suppress common read-only call failures that are expected
      const isExpectedFailure =
        message.toLowerCase().includes('no tickets purchased') ||
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('does not exist') ||
        message.toLowerCase().includes('unavailable') ||
        message.toLowerCase().includes('network connectivity issue') ||
        methodName?.toLowerCase().includes('get') ||
        methodName?.toLowerCase().includes('fetch') ||
        methodName?.toLowerCase().includes('check');

      if (!isExpectedFailure) {
        toast.error(message);
      }

      return { success: false, error: message };
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
    if (!connected || !signer || !contracts.raffleDeployer) return;

    // --- RaffleCreated ---
    const handleRaffleCreated = (raffle, creator) => {
      emitEvent('RaffleCreated', { raffle, creator });
    };
    contracts.raffleDeployer.on('RaffleCreated', handleRaffleCreated);

    // --- WinnersSelected ---
    if (contracts.raffle) {
      const handleWinnersSelected = (winners) => {
        emitEvent('WinnersSelected', { winners });
      };
      contracts.raffle.on('WinnersSelected', handleWinnersSelected);

      // --- PrizeClaimed ---
      const handlePrizeClaimed = (winner, tokenId) => {
        emitEvent('PrizeClaimed', { winner, tokenId });
      };
      contracts.raffle.on('PrizeClaimed', handlePrizeClaimed);

      return () => {
        contracts.raffle.off('WinnersSelected', handleWinnersSelected);
        contracts.raffle.off('PrizeClaimed', handlePrizeClaimed);
      };
    }

    // Clean up
    return () => {
      contracts.raffleDeployer.off('RaffleCreated', handleRaffleCreated);
    };
  }, [connected, signer, contracts.raffleDeployer, contracts.raffle]);

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


