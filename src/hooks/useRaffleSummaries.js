import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { SUPPORTED_NETWORKS } from '../networks';
import { contractABIs } from '../contracts/contractABIs';

/**
 * useRaffleSummaries
 * Fast, on-chain-only summary fetcher for newest raffles with client-side cache.
 * - Minimal fields only to render a lightweight card
 * - Small concurrency, short timeout, no retries (skip stragglers)
 * - LocalStorage cache per chainId with TTL
 */
export const useRaffleSummaries = ({
  initialCount = 12,
  cacheTTLms = 2 * 60 * 1000, // 2 minutes
  useCache = true,
} = {}) => {
  const { chainId, provider } = useWallet();
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const cacheKey = useMemo(() => (chainId ? `raffle_summaries_${chainId}` : null), [chainId]);

  const readProvider = useMemo(() => {
    if (provider) return provider;
    if (chainId && SUPPORTED_NETWORKS[chainId]?.rpcUrl) {
      try {
        return new ethers.providers.JsonRpcProvider(SUPPORTED_NETWORKS[chainId].rpcUrl);
      } catch (_) {}
    }
    return null;
  }, [provider, chainId]);

  const getRaffleManagerAddress = useCallback(() => {
    return chainId && SUPPORTED_NETWORKS[chainId]?.contractAddresses?.raffleManager;
  }, [chainId]);

  const loadFromCache = useCallback(() => {
    if (!useCache || !cacheKey) return null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.timestamp || !Array.isArray(parsed?.summaries)) return null;
      if (Date.now() - parsed.timestamp > cacheTTLms) return null;
      return parsed.summaries;
    } catch (_) {
      return null;
    }
  }, [cacheKey, cacheTTLms, useCache]);

  const saveToCache = useCallback((data) => {
    if (!useCache || !cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), summaries: data }));
    } catch (_) {}
  }, [cacheKey, useCache]);

  const fetchAllAddressesNewestFirst = useCallback(async () => {
    const addr = getRaffleManagerAddress();
    if (!addr || !readProvider) throw new Error('RaffleManager not available');
    const manager = new ethers.Contract(addr, contractABIs.raffleManager, readProvider);
    const addresses = await manager.getAllRaffles();
    // newest first
    return (addresses || []).slice().reverse();
  }, [getRaffleManagerAddress, readProvider]);

  const callWithTimeout = (p, ms) => {
    let t;
    return Promise.race([
      p.finally(() => clearTimeout(t)),
      new Promise((_, rej) => (t = setTimeout(() => rej(new Error('timeout')), ms)))
    ]);
  };

  const fetchRaffleSummary = useCallback(async (raffleAddress, timeoutMs = 8000) => {
    const c = new ethers.Contract(raffleAddress, contractABIs.raffle, readProvider);
    // Minimal getters only
    const [name, startTime, duration, ticketPrice, ticketLimit, winnersCount, stateNum] = await Promise.all([
      callWithTimeout(c.name(), timeoutMs).catch(() => 'Raffle'),
      callWithTimeout(c.startTime(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.duration(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.ticketPrice(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.ticketLimit(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.winnersCount(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.state(), timeoutMs).catch(() => ethers.BigNumber.from(5)), // ended as safe default
    ]);

    return {
      id: raffleAddress,
      address: raffleAddress,
      chainId,
      name,
      startTime: startTime.toNumber ? startTime.toNumber() : Number(startTime),
      duration: duration.toNumber ? duration.toNumber() : Number(duration),
      ticketPrice,
      ticketLimit: ticketLimit.toNumber ? ticketLimit.toNumber() : Number(ticketLimit),
      winnersCount: winnersCount.toNumber ? winnersCount.toNumber() : Number(winnersCount),
      stateNum: stateNum.toNumber ? stateNum.toNumber() : Number(stateNum),
    };
  }, [chainId, readProvider]);

  const fetchSummaries = useCallback(async () => {
    if (!chainId || !readProvider) return;
    setLoading(true);
    setError(null);
    try {
      const addresses = await fetchAllAddressesNewestFirst();
      const slice = addresses.slice(0, Math.max(1, initialCount));
      const results = [];
      const concurrency = 3;
      let i = 0;
      async function runNext() {
        if (i >= slice.length) return;
        const idx = i++;
        try {
          const summary = await fetchRaffleSummary(slice[idx]);
          if (summary) results.push(summary);
        } catch (_) {
          // skip
        }
        await runNext();
      }
      const workers = Array.from({ length: Math.min(concurrency, slice.length) }, () => runNext());
      await Promise.all(workers);
      // keep original newest-first order
      results.sort((a, b) => slice.indexOf(a.address) - slice.indexOf(b.address));
      if (mountedRef.current) {
        setSummaries(results);
        saveToCache(results);
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message || 'Failed to load summaries');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [chainId, readProvider, initialCount, fetchAllAddressesNewestFirst, fetchRaffleSummary, saveToCache]);

  const refresh = useCallback(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  // Load cache first for instant paint
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!chainId) return;
    const cached = loadFromCache();
    if (cached && cached.length) {
      setSummaries(cached);
      // revalidate in background without toggling loading spinner
      fetchSummaries();
    } else {
      fetchSummaries();
    }
  }, [chainId, loadFromCache, fetchSummaries]);

  return { summaries, loading, error, refresh };
};

export default useRaffleSummaries;

