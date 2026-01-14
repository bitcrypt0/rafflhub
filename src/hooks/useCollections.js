import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';

/**
 * Hook to fetch user's collections (both protocol-native and external)
 * @returns {Object} Collections data and loading state
 */
export const useCollections = () => {
  const { connected, address, provider, chainId } = useWallet();
  const { contracts, getContractInstance } = useContract();
  
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCollections = useCallback(async () => {
    if (!connected || !address || !provider) {
      setCollections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use contracts object from ContractContext
      const protocolManager = contracts.protocolManager;
      if (!protocolManager) {
        console.warn('ProtocolManager contract not available yet');
        setCollections([]);
        setLoading(false);
        return;
      }

      const allCollections = [];
      const seenAddresses = new Set();

      // Step 1: Fetch protocol-native collections (query ProtocolManager directly, NO pools involved)
      try {
        // Get all internal collections from ProtocolManager
        const internalCollectionAddresses = await protocolManager.getAllInternalCollections();
        
        if (Array.isArray(internalCollectionAddresses)) {
          // Filter by collections owned by the connected address
          for (const collectionAddress of internalCollectionAddresses) {
            try {
              // Skip if we've already seen this collection
              if (seenAddresses.has(collectionAddress.toLowerCase())) {
                continue;
              }

              // Create collection contract instance to check ownership
              const collectionContract = new ethers.Contract(
                collectionAddress,
                [
                  'function owner() view returns (address)',
                  'function name() view returns (string)',
                  'function symbol() view returns (string)',
                  'function totalSupply() view returns (uint256)'
                ],
                provider
              );

              // Check if the connected address owns this collection
              const owner = await collectionContract.owner().catch(() => null);
              
              if (owner && owner.toLowerCase() === address.toLowerCase()) {
                seenAddresses.add(collectionAddress.toLowerCase());

                // Fetch collection details
                const [name, symbol, totalSupply] = await Promise.all([
                  collectionContract.name().catch(() => 'Unknown'),
                  collectionContract.symbol().catch(() => 'N/A'),
                  collectionContract.totalSupply().catch(() => ethers.BigNumber.from(0))
                ]);

                allCollections.push({
                  address: collectionAddress,
                  name,
                  symbol,
                  totalSupply: totalSupply.toString(),
                  type: 'Protocol-Native',
                  isInternal: true
                });
              }
            } catch (err) {
              console.error(`Error processing internal collection ${collectionAddress}:`, err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching protocol-native collections:', err);
      }

      // Step 2: Fetch external collections (query through user's pools)
      try {
        // Get all pools from ProtocolManager
        let allPools = [];
        try {
          allPools = await protocolManager.getAllPools();
          if (!Array.isArray(allPools)) allPools = [];
        } catch (err) {
          console.error('Error fetching all pools:', err);
        }

        // Filter pools created by the user
        const userPools = [];
        for (const poolAddress of allPools) {
          try {
            const creator = await protocolManager.getPoolCreator(poolAddress);
            if (creator && creator.toLowerCase() === address.toLowerCase()) {
              userPools.push(poolAddress);
            }
          } catch (err) {
            continue;
          }
        }

        // Check each user pool for external collections
        for (const poolAddress of userPools) {
          try {
            const pool = getContractInstance(poolAddress, 'pool');
            if (!pool) continue;

            // Skip collaboration pools - they allow creators to use collections they don't own
            const isCollab = await pool.isCollabPool();
            if (isCollab) {
              continue;
            }

            // Check if this pool uses an external collection
            const isExternal = await pool.isExternalCollection();
            
            if (isExternal) {
              const prizeCollection = await pool.prizeCollection();
              
              // Skip if no prize collection
              if (!prizeCollection || prizeCollection === ethers.constants.AddressZero) {
                continue;
              }

              // Skip if we've already seen this collection
              if (seenAddresses.has(prizeCollection.toLowerCase())) {
                continue;
              }

              seenAddresses.add(prizeCollection.toLowerCase());

              // Fetch collection details
              try {
                const collectionContract = new ethers.Contract(
                  prizeCollection,
                  [
                    'function name() view returns (string)',
                    'function symbol() view returns (string)',
                    'function totalSupply() view returns (uint256)'
                  ],
                  provider
                );

                const [name, symbol, totalSupply] = await Promise.all([
                  collectionContract.name().catch(() => 'Unknown'),
                  collectionContract.symbol().catch(() => 'N/A'),
                  collectionContract.totalSupply().catch(() => ethers.BigNumber.from(0))
                ]);

                allCollections.push({
                  address: prizeCollection,
                  name,
                  symbol,
                  totalSupply: totalSupply.toString(),
                  type: 'External',
                  isInternal: false,
                  poolAddress
                });
              } catch (err) {
                console.error(`Error fetching details for external collection ${prizeCollection}:`, err);
              }
            }
          } catch (err) {
            console.error(`Error processing pool for external collections ${poolAddress}:`, err);
          }
        }
      } catch (err) {
        console.error('Error fetching external collections:', err);
      }

      setCollections(allCollections);
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(err.message || 'Failed to fetch collections');
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [connected, address, provider, contracts, getContractInstance]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return {
    collections,
    loading,
    error,
    refetch: fetchCollections
  };
};
