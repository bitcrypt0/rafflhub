import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { supabaseService } from '../services/supabaseService';

/**
 * Hook to fetch user's collections (both protocol-native and external)
 * Uses backend API as primary source with RPC fallback
 * @returns {Object} Collections data and loading state
 */
export const useCollections = () => {
  const { connected, address, chainId } = useWallet();
  const { getContractInstance } = useContract();
  
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null); // 'backend' or 'rpc'
  const [hasFetched, setHasFetched] = useState(false);
  const mountedRef = useRef(true);

  /**
   * Fetch collections from backend API
   */
  const fetchFromBackend = useCallback(async () => {
    if (!address || !chainId) return null;

    try {
      // Initialize Supabase if needed
      if (!supabaseService.isAvailable()) {
        supabaseService.initialize();
      }

      if (!supabaseService.isAvailable()) {
        return null;
      }

      // Fetch collections created by this user (both protocol-native and external)
      const response = await supabaseService.getCollections({
        chainId,
        creator: address,
        limit: 100,
      });

      if (!response || !response.success || !response.collections) {
        return null;
      }

      // Transform backend response to match expected format
      return response.collections.map(coll => ({
        address: coll.address,
        name: coll.name || 'Unknown',
        symbol: coll.symbol || 'N/A',
        totalSupply: coll.current_supply?.toString() || '0',
        type: coll.is_external ? 'External' : (coll.standard === 0 ? 'ERC721' : 'ERC1155'),
        isInternal: !coll.is_external,
        isExternal: coll.is_external || false,
        chainId: coll.chain_id,
        // Include URI data for artwork resolution
        dropUri: coll.drop_uri,
        unrevealedUri: coll.unrevealed_uri,
        baseUri: coll.base_uri,
        isRevealed: coll.is_revealed,
      }));
    } catch (err) {
      console.error('Failed to fetch collections from backend:', err);
      return null;
    }
  }, [address, chainId]);

  /**
   * RPC fallback is no longer available - deprecated ProtocolManager functions removed
   * (getAllPools, getAllInternalCollections have been deprecated)
   * Collections must be fetched from backend API
   */
  const fetchFromRPC = useCallback(async () => {
    console.warn('⚠️ RPC fallback for collections is not available - deprecated ProtocolManager functions removed');
    return [];
  }, []);

  /**
   * Query on-chain totalSupply for each collection
   */
  const fetchOnChainSupply = useCallback(async (colls) => {
    if (!getContractInstance || colls.length === 0) return colls;

    const updated = await Promise.all(
      colls.map(async (coll) => {
        try {
          const abiType = coll.type === 'ERC1155' ? 'erc1155Prize' : 'erc721Prize';
          const contract = getContractInstance(coll.address, abiType);
          if (!contract || typeof contract.totalSupply !== 'function') return coll;
          const supply = await contract.totalSupply();
          return { ...coll, totalSupply: (supply.toNumber ? supply.toNumber() : Number(supply)).toString() };
        } catch {
          return coll;
        }
      })
    );
    return updated;
  }, [getContractInstance]);

  /**
   * Main fetch function - tries backend first, falls back to RPC
   */
  const fetchCollections = useCallback(async () => {
    if (!connected || !address) {
      setCollections([]);
      if (mountedRef.current) setHasFetched(true);
      return;
    }

    setError(null);

    try {
      // Try backend first
      const backendCollections = await fetchFromBackend();
      
      if (backendCollections && backendCollections.length > 0) {
        if (mountedRef.current) {
          // Set backend data immediately, then enrich with on-chain supply
          setCollections(backendCollections);
          setDataSource('backend');

          // Fetch accurate totalSupply from contracts
          const enriched = await fetchOnChainSupply(backendCollections);
          if (mountedRef.current) {
            setCollections(enriched);
          }
        }
        return;
      }

      // Fallback to RPC
      const rpcCollections = await fetchFromRPC();
      
      if (mountedRef.current) {
        setCollections(rpcCollections || []);
        setDataSource('rpc');
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch collections');
        setCollections([]);
      }
    } finally {
      if (mountedRef.current) setHasFetched(true);
    }
  }, [connected, address, fetchFromBackend, fetchFromRPC, fetchOnChainSupply]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch on dependencies change
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Real-time subscription for collections table updates (supply changes, etc.)
  useEffect(() => {
    if (!connected || !address || !supabaseService.isAvailable()) return;

    const addr = address.toLowerCase();
    const channel = supabaseService.client
      .channel(`collections:${addr}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'collections',
          filter: `creator=eq.${addr}`
        },
        (payload) => {
          const updated = payload.new;
          if (!updated) return;
          setCollections(prev => prev.map(c =>
            c.address.toLowerCase() === updated.address?.toLowerCase()
              ? { ...c, totalSupply: updated.current_supply?.toString() || c.totalSupply }
              : c
          ));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [connected, address]);

  return {
    collections,
    loading,
    hasFetched,
    error,
    dataSource,
    refetch: fetchCollections
  };
};
