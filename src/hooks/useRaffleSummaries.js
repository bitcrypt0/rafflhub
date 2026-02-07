import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { SUPPORTED_NETWORKS, DEFAULT_CHAIN_ID } from '../networks';
import { contractABIs } from '../contracts/contractABIs';

/**
 * useRaffleSummaries
 * Fast, on-chain-only summary fetcher for newest raffles with client-side cache.
 * - Minimal fields only to render a lightweight card
 * - Multicall3 batching when available (fallback to light parallel calls)
 * - LocalStorage cache per chainId with TTL
 */
export const useRaffleSummaries = ({
  initialCount = 12,
  cacheTTLms = 2 * 60 * 1000, // 2 minutes
  useCache = true,
} = {}) => {
  const { chainId: walletChainId, provider } = useWallet();
  // Use wallet chainId if available, otherwise fall back to default
  const chainId = walletChainId || DEFAULT_CHAIN_ID;
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalAvailable, setTotalAvailable] = useState(null);
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

  const getProtocolManagerAddress = useCallback(() => {
    return chainId && SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager;
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

  /**
   * Fetch all pool addresses using pagination
   * @deprecated getAllPools has been removed from ProtocolManager contract
   * Use useRaffleSummariesEnhanced hook with backend API instead
   */
  const fetchAllAddressesNewestFirst = useCallback(async () => {
    console.warn('⚠️ useRaffleSummaries.fetchAllAddressesNewestFirst is deprecated - getAllPools removed from ProtocolManager. Use useRaffleSummariesEnhanced instead.');
    throw new Error('DEPRECATED_FUNCTION');
  }, []);

  const callWithTimeout = (p, ms) => {
    let t;
    return Promise.race([
      p.finally(() => clearTimeout(t)),
      new Promise((_, rej) => (t = setTimeout(() => rej(new Error('timeout')), ms)))
    ]);
  };

  const buildSummary = useCallback((raffleAddress,
    { name, startTime, duration, slotFee, ticketLimit, winnersCount, stateNum }
  ) => ({
    id: raffleAddress,
    address: raffleAddress,
    chainId,
    name,
    startTime: startTime?.toNumber ? startTime.toNumber() : Number(startTime || 0),
    duration: duration?.toNumber ? duration.toNumber() : Number(duration || 0),
    slotFee,
    ticketLimit: ticketLimit?.toNumber ? ticketLimit.toNumber() : Number(ticketLimit || 0),
    winnersCount: winnersCount?.toNumber ? winnersCount.toNumber() : Number(winnersCount || 0),
    stateNum: (() => {
      if (stateNum?.toNumber) return stateNum.toNumber();
      if (stateNum === 0) return 0; // preserve Pending (0)
      if (typeof stateNum === 'number') return stateNum;
      if (stateNum == null) return 5; // default only when null/undefined
      const n = Number(stateNum);
      return Number.isFinite(n) ? n : 5;
    })(),
    isSummary: true,
  }), [chainId]);

  // Multicall3 support (best-effort)
  const MULTICALL3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11';
  const multicall3Abi = [
    {
      inputs: [
        {
          components: [
            { internalType: 'address', name: 'target', type: 'address' },
            { internalType: 'bool', name: 'allowFailure', type: 'bool' },
            { internalType: 'bytes', name: 'callData', type: 'bytes' }
          ],
          name: 'calls',
          type: 'tuple[]'
        }
      ],
      name: 'aggregate3',
      outputs: [
        {
          components: [
            { internalType: 'bool', name: 'success', type: 'bool' },
            { internalType: 'bytes', name: 'returnData', type: 'bytes' }
          ],
          name: 'returnData',
          type: 'tuple[]'
        }
      ],
      stateMutability: 'payable',
      type: 'function'
    }
  ];

  const isMulticallAvailable = useCallback(async () => {
    if (!readProvider) return false;
    try {
      const code = await readProvider.getCode(MULTICALL3_ADDRESS);
      return code && code !== '0x';
    } catch (_) {
      return false;
    }
  }, [readProvider]);

  const tryMulticallSummaries = useCallback(async (addresses) => {
    const iface = new ethers.utils.Interface(contractABIs.pool);
    const calls = [];
    for (const addr of addresses) {
      calls.push(
        { target: addr, allowFailure: true, callData: iface.encodeFunctionData('name', []) },
        { target: addr, allowFailure: true, callData: iface.encodeFunctionData('startTime', []) },
        { target: addr, allowFailure: true, callData: iface.encodeFunctionData('duration', []) },
        { target: addr, allowFailure: true, callData: iface.encodeFunctionData('slotFee', []) },
        { target: addr, allowFailure: true, callData: iface.encodeFunctionData('ticketLimit', []) },
        { target: addr, allowFailure: true, callData: iface.encodeFunctionData('winnersCount', []) },
        { target: addr, allowFailure: true, callData: iface.encodeFunctionData('state', []) },
      );
    }
    const mc = new ethers.Contract(MULTICALL3_ADDRESS, multicall3Abi, readProvider);
    const res = await mc.callStatic.aggregate3(calls, { value: 0 });
    const per = 7;
    const out = [];
    for (let i = 0; i < addresses.length; i++) {
      const base = i * per;
      const dec = (index, fn) => {
        const r = res[base + index];
        if (!r || !r.success) return null;
        try { return iface.decodeFunctionResult(fn, r.returnData)[0]; } catch (_) { return null; }
      };
      const nameVal = dec(0, 'name') || 'Raffle';
      const startTimeVal = dec(1, 'startTime') || ethers.BigNumber.from(0);
      const durationVal = dec(2, 'duration') || ethers.BigNumber.from(0);
      const slotFeeVal = dec(3, 'slotFee') || ethers.BigNumber.from(0);
      const ticketLimitVal = dec(4, 'ticketLimit') || ethers.BigNumber.from(0);
      const winnersCountVal = dec(5, 'winnersCount') || ethers.BigNumber.from(0);
      let stateNumVal = dec(6, 'state');
      if (stateNumVal === null || stateNumVal === undefined) {
        // No estimation: if state is unavailable, default to 5 (Deleted) for now
        stateNumVal = ethers.BigNumber.from(5);
      }
      const summary = buildSummary(addresses[i], {
        name: nameVal,
        startTime: startTimeVal,
        duration: durationVal,
        slotFee: slotFeeVal,
        ticketLimit: ticketLimitVal,
        winnersCount: winnersCountVal,
        stateNum: stateNumVal,
      });
      out.push(summary);
    }
    return out;
  }, [readProvider, buildSummary]);

  const fetchRaffleSummary = useCallback(async (raffleAddress, timeoutMs = 8000) => {
    const c = new ethers.Contract(raffleAddress, contractABIs.pool, readProvider);
    // Minimal getters only
    const [name, startTime, duration, slotFee, ticketLimit, winnersCount, stateNum] = await Promise.all([
      callWithTimeout(c.name(), timeoutMs).catch(() => 'Raffle'),
      callWithTimeout(c.startTime(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.duration(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.slotFee(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.ticketLimit(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.winnersCount(), timeoutMs).catch(() => ethers.BigNumber.from(0)),
      callWithTimeout(c.state(), timeoutMs).catch(() => ethers.BigNumber.from(5)), // default when unavailable
    ]);

    return buildSummary(raffleAddress, { name, startTime, duration, slotFee, ticketLimit, winnersCount, stateNum });
  }, [readProvider, buildSummary]);

  const fetchSummaries = useCallback(async () => {
    if (!chainId || !readProvider) return;
    setLoading(true);
    setError(null);
    try {
      const addresses = await fetchAllAddressesNewestFirst();
      const slice = addresses.slice(0, Math.max(1, initialCount));

      // Try multicall3 first
      let results = [];
      try {
        if (await isMulticallAvailable()) {
          results = await tryMulticallSummaries(slice);
        }
      } catch (_) {
        // fall back below
      }

      if (!results || results.length === 0) {
        // Fallback: light parallel per-raffle calls
        const tmp = [];
        const concurrency = 3;
        let i = 0;
        async function runNext() {
          if (i >= slice.length) return;
          const idx = i++;
          try {
            const summary = await fetchRaffleSummary(slice[idx]);
            if (summary) tmp.push(summary);
          } catch (_) { /* skip */ }
          await runNext();
        }
        const workers = Array.from({ length: Math.min(concurrency, slice.length) }, () => runNext());
        await Promise.all(workers);
        results = tmp;
      }

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
  }, [chainId, readProvider, initialCount, fetchAllAddressesNewestFirst, isMulticallAvailable, tryMulticallSummaries, fetchRaffleSummary, saveToCache]);

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

  return { summaries, loading, error, refresh, totalAvailable };
};

export default useRaffleSummaries;

