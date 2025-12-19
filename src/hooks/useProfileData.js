import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from '../components/ui/sonner';
import { getTicketsSoldCount } from '../utils/contractCallUtils';
import { handleError } from '../utils/errorHandling';
import { APP_CONFIG } from '../constants';

// Pool state mapping function - matches IPool.sol enum (states 0-7 only)
function mapPoolState(stateNum) {
  switch (stateNum) {
    case 0: return 'pending';
    case 1: return 'active';
    case 2: return 'ended';
    case 3: return 'drawing';
    case 4: return 'completed';
    case 5: return 'deleted';
    case 6: return 'allPrizesClaimed';
    case 7: return 'unengaged';
    default: return 'unknown';
  }
}

/**
 * Shared data hook for ProfilePage (both desktop and mobile)
 * Extracts all data fetching logic to be reused across implementations
 */
export const useProfileData = () => {
  const { connected, address, provider, chainId } = useWallet();
  const { contracts, getContractInstance, executeTransaction, executeCall } = useContract();

  // Memoize stable values to prevent unnecessary re-renders
  const stableConnected = useMemo(() => connected, [connected]);
  const stableAddress = useMemo(() => address, [address]);
  const stableContracts = useMemo(() => contracts, [contracts]);

  // State management
  const [loading, setLoading] = useState(true);
  const [userActivity, setUserActivity] = useState([]);
  const [createdRaffles, setCreatedRaffles] = useState([]);
  const [purchasedTickets, setPurchasedTickets] = useState([]);
  const [purchasedSlots, setPurchasedSlots] = useState([]);
  const [activityStats, setActivityStats] = useState({
    totalTicketsPurchased: 0,
    totalRafflesCreated: 0,
    totalPrizesWon: 0,
    totalClaimableRefunds: 0,
    withdrawableRevenue: '0'
  });

  // Revenue modal state (shared between implementations)
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState(null);

  // Helper function to extract revert reason
  const extractRevertReason = useCallback((error) => {
    if (error?.reason) return error.reason;
    if (error?.data?.message) return error.data.message;
    if (error?.message) {
      const match = error.message.match(/revert (.+)/);
      if (match) return match[1];
      return error.message;
    }
    return 'Transaction failed';
  }, []);

  // Map raffle state numbers (BN | string | number) to readable strings (lowercase keys used in UI)
  // Matches IPool.sol enum (states 0-7 only)
  const mapRaffleState = useCallback((stateNum) => {
    const n = (stateNum && typeof stateNum === 'object' && typeof stateNum.toNumber === 'function')
      ? stateNum.toNumber()
      : Number(stateNum);
    switch (n) {
      case 0: return 'pending';
      case 1: return 'active';
      case 2: return 'ended';
      case 3: return 'drawing';
      case 4: return 'completed';
      case 5: return 'deleted';
      case 6: return 'allPrizesClaimed';
      case 7: return 'unengaged';
      default: return 'unknown';
    }
  }, []);

  // Adaptive querying helpers to support strict RPCs
  const isRangeOrLimitError = (error) => {
    const msg = ((error?.message || '') + ' ' + (error?.data?.message || '')).toLowerCase();
    return (
      msg.includes('block range') ||
      msg.includes('range too large') ||
      msg.includes('range exceeded') ||
      msg.includes('too many blocks') ||
      msg.includes('exceed') ||
      msg.includes('limit') ||
      msg.includes('overflow') ||
      msg.includes('50000') || msg.includes('10000') || msg.includes('5000')
    );
  };

  // Removed event/log-based helpers; profile now relies on getter calls only

  // Simple block timestamp cache to avoid repeated getBlock calls
  const blockTimestampCacheRef = useRef(new Map());
  const getBlockTimestampMs = async (blockNumber) => {
    const cache = blockTimestampCacheRef.current;
    if (cache.has(blockNumber)) return cache.get(blockNumber);
    const block = await provider.getBlock(blockNumber);
    const tsMs = (block?.timestamp || 0) * 1000;
    cache.set(blockNumber, tsMs);
    return tsMs;
  };

  // Removed event-based activity; Activity will be synthesized from getter-based flows in fetchPurchasedTickets and fetchCreatedRaffles.

  // Simple localStorage cache with TTL (ms)
  const getCachedJson = useCallback((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || !parsed.ts || !parsed.ttl) return null;
      if (Date.now() - parsed.ts > parsed.ttl) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }, []);

  const setCachedJson = useCallback((key, data, ttlMs) => {
    try {
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now(), ttl: ttlMs }));
    } catch {}
  }, []);

  const FIFTEEN_MIN_MS = 15 * 60 * 1000;
  const CACHE_VERSION = 'v2';

  const getAllPoolsCached = useCallback(async () => {
    if (!stableContracts.protocolManager) return [];
    const cacheKey = `raffles:all:${CACHE_VERSION}:${chainId}`;
    const cached = getCachedJson(cacheKey);
    if (cached) return cached;
    try {
      const res = await executeCall(stableContracts.protocolManager.getAllPools, 'getAllPools');
      const list = res.success && Array.isArray(res.result) ? res.result : [];
      if (Array.isArray(list) && list.length > 0) {
        setCachedJson(cacheKey, list, FIFTEEN_MIN_MS);
      }
      return list;
    } catch {
      return [];
    }
  }, [stableContracts.protocolManager, chainId, executeCall, getCachedJson, setCachedJson]);

  // Safe retry helper: refetch all raffles shortly after contracts become ready
  const getAllPoolsWithRetry = useCallback(async () => {
    const first = await getAllPoolsCached();
    if (first && first.length > 0) return first;
    // Only retry if contracts are present (to avoid unnecessary timers)
    if (!stableContracts.protocolManager) return first;
    await new Promise((r) => setTimeout(r, 1200));
    const second = await getAllPoolsCached();
      return second;
    }, [getAllPoolsCached, stableContracts.protocolManager]);


  const getRafflesByCreatorCached = useCallback(async (creator) => {
    if (!stableContracts.protocolManager || !creator) return [];
    const cacheKey = `raffles:byCreator:${CACHE_VERSION}:${chainId}:${creator.toLowerCase()}`;
    const cached = getCachedJson(cacheKey);
    if (cached) return cached;
    try {
      // Get all pools and filter by creator
      const allPoolsRes = await executeCall(stableContracts.protocolManager.getAllPools, 'getAllPools');
      const allPools = allPoolsRes.success && Array.isArray(allPoolsRes.result) ? allPoolsRes.result : [];
      
      // Filter pools by checking poolCreators mapping for each pool
      const creatorPools = [];
      for (const poolAddress of allPools) {
        try {
          const creatorRes = await executeCall(stableContracts.protocolManager.getPoolCreator, 'getPoolCreator', poolAddress);
          if (creatorRes.success && creatorRes.result.toLowerCase() === creator.toLowerCase()) {
            creatorPools.push(poolAddress);
          }
        } catch (error) {
          console.warn(`Failed to get creator for pool ${poolAddress}:`, error);
        }
      }
      
      if (Array.isArray(creatorPools) && creatorPools.length > 0) {
        setCachedJson(cacheKey, creatorPools, FIFTEEN_MIN_MS);
      }
      return creatorPools;
    } catch {
      return [];
    }
  }, [stableContracts.protocolManager, chainId, executeCall, getCachedJson, setCachedJson]);
  // Retry helper for creator raffles: retry once after a short delay, bypassing cache on retry
  const getRafflesByCreatorWithRetry = useCallback(async (creator) => {
    const first = await getRafflesByCreatorCached(creator);
    if (first && first.length > 0) return first;
    if (!stableContracts.protocolManager) return first;
    // Wait briefly to allow contracts/data to become ready
    await new Promise((r) => setTimeout(r, 1200));
    try {
      // Bypass cache on retry to avoid persisting/transient empty results
      const res = await executeCall(stableContracts.protocolManager.getPoolsByCreator, 'getPoolsByCreator', creator);
      const list = res.success && Array.isArray(res.result) ? res.result : [];
      // Optionally refresh cache only if non-empty (avoid caching empty)
      if (Array.isArray(list) && list.length > 0) {
        const cacheKey = `raffles:byCreator:${CACHE_VERSION}:${chainId}:${creator?.toLowerCase?.()}`;
        setCachedJson(cacheKey, list, FIFTEEN_MIN_MS);
      }
      return list;
    } catch {
      return first || [];
    }
  }, [getRafflesByCreatorCached, stableContracts.protocolManager, executeCall, setCachedJson, chainId]);


  // Fetch created raffles using ProtocolManager.getRafflesByCreator()
  const fetchCreatedRaffles = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Missing requirements for fetchCreatedRaffles:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const raffles = [];
      const activitiesFromGetters = [];
      let withdrawableRevenueTotal = ethers.BigNumber.from(0);
      const creatorRaffles = await getRafflesByCreatorWithRetry(stableAddress);
      console.log('Profile: Found', creatorRaffles.length, 'created raffles for', stableAddress);

      for (const raffleAddress of creatorRaffles) {
        try {
          const raffleContract = getContractInstance(raffleAddress, 'pool');
          if (!raffleContract) continue;

          const [nameResult, slotFeeResult, slotLimitResult, startTimeResult, durationResult, stateResult, winnersCountResult, usesCustomFeeResult, totalCreatorRevenueResult, creationTsRes] = await Promise.all([
            executeCall(raffleContract.name, 'name'),
            executeCall(raffleContract.slotFee, 'slotFee'),
            executeCall(raffleContract.slotLimit, 'slotLimit'),
            executeCall(raffleContract.startTime, 'startTime'),
            executeCall(raffleContract.duration, 'duration'),
            executeCall(raffleContract.state, 'state'),
            executeCall(raffleContract.winnersCount, 'winnersCount'),
            executeCall(raffleContract.usesCustomFee, 'usesCustomFee'),
            executeCall(raffleContract.totalCreatorRevenue, 'totalCreatorRevenue'),
            stableContracts.protocolManager ? executeCall(stableContracts.protocolManager.poolCreationTimestamps, 'poolCreationTimestamps', raffleAddress) : Promise.resolve({ success: false })
          ]);

          const name = nameResult.success ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
          const slotFee = slotFeeResult.success ? slotFeeResult.result : ethers.BigNumber.from(0);
          const slotLimit = slotLimitResult.success ? slotLimitResult.result : ethers.BigNumber.from(0);
          const startTime = startTimeResult.success ? startTimeResult.result : ethers.BigNumber.from(0);
          const duration = durationResult.success ? durationResult.result : ethers.BigNumber.from(0);
          const state = stateResult.success ? stateResult.result : 0;
          const winnersCountBn = winnersCountResult.success ? winnersCountResult.result : ethers.BigNumber.from(0);
          const usesCustomFee = usesCustomFeeResult.success ? !!usesCustomFeeResult.result : false;
          const totalCreatorRevenueWei = totalCreatorRevenueResult.success ? totalCreatorRevenueResult.result : ethers.BigNumber.from(0);

          const ticketsSoldCount = await getTicketsSoldCount(raffleContract);
          const ticketsSold = ethers.BigNumber.from(ticketsSoldCount);

          // Calculate end time and revenue (use totalCreatorRevenue when usesCustomFee is true)
          const endTime = new Date((startTime.add(duration)).toNumber() * 1000);
          let revenueWei = ethers.BigNumber.from(0);

          // Accumulate withdrawable revenue as the sum of totalCreatorRevenue across raffles
          withdrawableRevenueTotal = withdrawableRevenueTotal.add ? withdrawableRevenueTotal.add(totalCreatorRevenueWei) : ethers.BigNumber.from(withdrawableRevenueTotal).add(totalCreatorRevenueWei);

          if (usesCustomFee) {
            revenueWei = totalCreatorRevenueWei;
          } else {
            revenueWei = ethers.BigNumber.from(0);
          }

          const creationTsSec = (creationTsRes && creationTsRes.success && creationTsRes.result) ? (creationTsRes.result.toNumber ? creationTsRes.result.toNumber() : Number(creationTsRes.result)) : (startTime.toNumber ? startTime.toNumber() : Math.floor(Date.now()/1000));

          raffles.push({
            address: raffleAddress,
            chainId,
            name,
            slotFee: ethers.utils.formatEther(slotFee),
            maxTickets: slotLimit.toString(),
            ticketsSold: ticketsSold.toString(),
            endTime: endTime,
            createdAt: creationTsSec * 1000,
            state: mapRaffleState(state),
            stateNum: state,
            revenue: ethers.utils.formatEther(revenueWei),
            usesCustomFee,
            // Remove duration information from My Raffles cards by not including duration-specific fields beyond endTime
          });

          // Synthesize raffle_created activity via getters
          activitiesFromGetters.push({
            id: `getter-created-${raffleAddress}`,
            type: 'raffle_created',
            raffleAddress: raffleAddress,
            raffleName: name,
            timestamp: creationTsSec * 1000
          });
        } catch (error) {
          console.error(`Error processing created raffle ${raffleAddress}:`, error);
        }
      }

      setCreatedRaffles(raffles);

      // After processing all raffles: set withdrawable revenue and merge activities
      setActivityStats(prev => ({ ...prev, withdrawableRevenue: ethers.utils.formatEther(withdrawableRevenueTotal) }));
      if (activitiesFromGetters.length > 0) {
        setUserActivity(prev => {
          const existing = new Set(prev.map(a => a.id));
          const merged = [...prev];
          for (const a of activitiesFromGetters) if (!existing.has(a.id)) merged.push(a);
          merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          return merged;
        });
      }
      setActivityStats(prev => ({ ...prev, totalRafflesCreated: raffles.length }));
    } catch (error) {
      // Enhanced block range error detection for fetchCreatedRaffles
      const errorMessage = (error.message || error.toString() || '').toLowerCase();
      const errorData = error.data ? (error.data.message || error.data.toString() || '').toLowerCase() : '';
      const fullErrorText = `${errorMessage} ${errorData}`;

      const isBlockRangeError = fullErrorText.includes('block range') ||
                               fullErrorText.includes('too large') ||
                               fullErrorText.includes('exceed') ||
                               fullErrorText.includes('limit') ||
                               fullErrorText.includes('range too large') ||
                               fullErrorText.includes('maximum') ||


                               fullErrorText.includes('query returned more than') ||
                               fullErrorText.includes('block range limit') ||
                               fullErrorText.includes('too many blocks') ||
                               fullErrorText.includes('range exceeded') ||
                               errorMessage.includes('10000') ||
                               errorMessage.includes('5000') ||
                               errorMessage.includes('50000');

      if (isBlockRangeError) {
        console.warn('Mobile: Block range error in fetchCreatedRaffles (enhanced detection), suppressing toast:', errorMessage);
        // Don't show toast for block range errors, just log them
        return;
      }

      handleError(error, {
        context: { operation: 'fetchCreatedRaffles', isReadOnly: true },
        fallbackMessage: 'Failed to load created raffles'
      });
    }
  }, [stableConnected, stableAddress, provider, stableContracts.poolDeployer, executeCall, getContractInstance, mapRaffleState]);

  // Fetch purchased tickets using direct getters
  const fetchPurchasedTickets = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Missing requirements for fetchPurchasedTickets:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const tickets = [];
      const slots = [];
      const activitiesFromGetters = [];

      if (stableContracts.protocolManager) {
        const allPools = await getAllPoolsWithRetry();
        console.log('Profile: Checking', allPools.length, 'pools for purchased slots via getSlotsPurchased');

        for (const poolAddress of allPools) {
          try {
            const poolContract = getContractInstance(poolAddress, 'pool');
            if (!poolContract) continue;

            const [userSlotsRes, nameRes, priceRes, stateRes, startRes, durationRes] = await Promise.all([
              executeCall(poolContract.getSlotsPurchased, 'getSlotsPurchased', stableAddress),
              executeCall(poolContract.name, 'name'),
              executeCall(poolContract.slotFee, 'slotFee'),
              executeCall(poolContract.state, 'state'),
              executeCall(poolContract.startTime, 'startTime'),
              executeCall(poolContract.duration, 'duration')
            ]);

            const userSlotsBn = userSlotsRes.success ? userSlotsRes.result : ethers.BigNumber.from(0);
            const userSlots = userSlotsBn.toNumber ? userSlotsBn.toNumber() : Number(userSlotsBn);
            if (userSlots <= 0) continue;

            const poolName = nameRes.success ? nameRes.result : `Pool ${poolAddress.slice(0, 8)}...`;
            const slotFeeBn = priceRes.success ? priceRes.result : ethers.BigNumber.from(0);
            const totalSpentBn = slotFeeBn.mul ? slotFeeBn.mul(userSlotsBn) : ethers.BigNumber.from(0);
            const state = stateRes.success ? stateRes.result : 0;
            const startTime = startRes.success ? startRes.result : ethers.BigNumber.from(0);
            const duration = durationRes.success ? durationRes.result : ethers.BigNumber.from(0);
            const endTime = new Date((startTime.add(duration)).toNumber() * 1000);

            // Use pool start time as purchase timestamp fallback
            // Note: purchaseTimestamps and lastPurchaseBlock were removed in gas optimization
            const purchaseTimestampSec = startTime.toNumber ? startTime.toNumber() : Math.floor(Date.now()/1000);

            const slotData = {
              id: poolAddress,
              address: poolAddress,
              poolName,
              name: poolName,
              slotCount: userSlots,
              slotFee: ethers.utils.formatEther(slotFeeBn),
              totalSpent: ethers.utils.formatEther(totalSpentBn),
              state: mapPoolState(state),
              endTime,
              purchaseTime: purchaseTimestampSec,
              canClaimPrize: false,
              canClaimRefund: false,
              slots: Array.from({ length: userSlots }, (_, i) => i.toString())
            };

            slots.push(slotData);

            // Build Activity item from getters (no events dependency)
            activitiesFromGetters.push({
              id: `getter-slot-${poolAddress}-${purchaseTimestampSec}`,
              type: 'ticket_purchase',
              poolAddress,
              poolName,
              raffleName: poolName,
              quantity: userSlots,
              ticketCount: userSlots,
              amount: ethers.utils.formatEther(totalSpentBn),
              timestamp: purchaseTimestampSec * 1000,
              raffleAddress: poolAddress
            });
          } catch (error) {
            console.error(`Error processing getSlotsPurchased for pool ${poolAddress}:`, error);
          }
        }
      } else {
        console.log('protocolManager contract not available');
      }

      console.log('Setting purchased slots:', slots.length, 'pools with slots using getters');
      setPurchasedSlots(slots);
      setPurchasedTickets(slots); // Also set purchasedTickets for compatibility

      // Also push into userActivity so Activity tab reflects purchases immediately
      if (activitiesFromGetters.length > 0) {
        setUserActivity(prev => {
          // Deduplicate by id
          const existing = new Set(prev.map(a => a.id));
          const merged = [...prev];
          for (const a of activitiesFromGetters) if (!existing.has(a.id)) merged.push(a);
          merged.sort((a,b) => (b.timestamp||0) - (a.timestamp||0));
          return merged;
        });
        // Do not alter totalSlotsPurchased here to avoid flicker with fetchDirectTotals
      }
    } catch (error) {
      handleError(error, {
        context: { operation: 'fetchPurchasedSlots', isReadOnly: true },
        fallbackMessage: 'Failed to load purchased slots'
      });
    }
  }, [stableConnected, stableAddress, provider, stableContracts.protocolManager, executeCall, getContractInstance, mapPoolState, getAllPoolsCached]);
  // Compute totals directly across pools: slots, wins, claimable refunds
  const fetchDirectTotals = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider || !stableContracts.protocolManager) return;
    try {
      const allPools = await getAllPoolsWithRetry();
      let totalSlots = 0;
      let totalWins = 0;
      let totalRefunds = ethers.BigNumber.from(0);

      for (const poolAddress of allPools) {
        try {
          const poolContract = getContractInstance(poolAddress, 'pool');
          if (!poolContract) continue;

          const [slotsRes, winsRes, refundsRes] = await Promise.all([
            executeCall(poolContract.getSlotsPurchased, 'getSlotsPurchased', stableAddress),
            executeCall(poolContract.winsPerAddress, 'winsPerAddress', stableAddress),
            executeCall(poolContract.getRefundableAmount, 'getRefundableAmount', stableAddress)
          ]);

          const tBn = slotsRes.success ? slotsRes.result : ethers.BigNumber.from(0);
          const wBn = winsRes.success ? winsRes.result : ethers.BigNumber.from(0);
          const rBn = refundsRes.success ? refundsRes.result : ethers.BigNumber.from(0);

          totalSlots += tBn.toNumber ? tBn.toNumber() : Number(tBn);
          totalWins += wBn.toNumber ? wBn.toNumber() : Number(wBn);
          totalRefunds = totalRefunds.add ? totalRefunds.add(rBn) : ethers.BigNumber.from(totalRefunds).add(rBn);
        } catch (err) {
          console.warn('Skipping pool for totals due to error:', poolAddress, err?.message || err);
        }
      }

      setActivityStats(prev => ({
        ...prev,
        totalSlotsPurchased: totalSlots,
        totalPrizesWon: totalWins,
        totalClaimableRefunds: totalRefunds
      }));
    } catch (error) {
      handleError(error, { context: { operation: 'fetchDirectTotals', isReadOnly: true }, fallbackMessage: 'Failed to compute profile totals' });
    }
  }, [stableConnected, stableAddress, provider, stableContracts.protocolManager, getAllPoolsCached, getContractInstance, executeCall]);

  // Load data when wallet connects, reset when disconnects
  useEffect(() => {
    if (stableConnected && stableAddress && stableContracts.protocolManager) {
      // Reset state synchronously to avoid mixing when switching accounts,
      // but do not clear cached localStorage results.
      setUserActivity([]);
      setCreatedRaffles([]);
      setPurchasedTickets([]);
      setActivityStats(prev => ({
        ...prev,
        totalTicketsPurchased: 0,
        totalRafflesCreated: 0,
        totalPrizesWon: 0,
        totalClaimableRefunds: 0,
        withdrawableRevenue: '0'
      }));

      const loadAllData = async () => {
        setLoading(true);
        try {
          await Promise.all([
            // Getters-only data loads
            fetchCreatedRaffles(),
            fetchPurchasedTickets(),
            fetchDirectTotals()
          ]);
        } catch (error) {
          console.error('Error loading profile data:', error);
        } finally {
          setLoading(false);
        }
      };
      loadAllData();
    } else if (!stableConnected || !stableAddress) {
      // Reset state when wallet disconnects
      setUserActivity([]);
      setCreatedRaffles([]);
      setPurchasedTickets([]);
      setLoading(false);
      setShowRevenueModal(false);
      setSelectedRaffle(null);
      setActivityStats({
        totalTicketsPurchased: 0,
        totalRafflesCreated: 0,
        totalPrizesWon: 0,
        totalClaimableRefunds: 0,
        withdrawableRevenue: '0'
      });
    }
  }, [stableConnected, stableAddress, stableContracts.protocolManager, fetchCreatedRaffles, fetchPurchasedTickets, fetchDirectTotals]);

  // Revenue withdrawal function
  const withdrawRevenue = useCallback(async (raffleAddress) => {
    if (!raffleAddress || !stableConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const raffleContract = getContractInstance(raffleAddress, 'pool');
      if (!raffleContract) {
        toast.error('Invalid raffle contract');
        return;
      }

      await executeTransaction(raffleContract, 'withdrawRevenue', []);
      toast.success('Revenue withdrawn successfully!');

      // Refresh data
      fetchCreatedRaffles();
      setShowRevenueModal(false);
      setSelectedRaffle(null);
    } catch (error) {
      console.error('Error withdrawing revenue:', error);
      toast.error(extractRevertReason(error));
    }
  }, [stableConnected, getContractInstance, executeTransaction, fetchCreatedRaffles, extractRevertReason]);

  // Claim refund function
  const claimRefund = useCallback(async (raffleAddress) => {
    if (!raffleAddress || !stableConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const raffleContract = getContractInstance(raffleAddress, 'pool');
      if (!raffleContract) {
        toast.error('Invalid raffle contract');
        return;
      }

      await executeTransaction(raffleContract, 'claimRefund', []);
      toast.success('Refund claimed successfully!');

      // Refresh data
      fetchPurchasedTickets();
      fetchDirectTotals();
    } catch (error) {
      console.error('Error claiming refund:', error);
      toast.error(extractRevertReason(error));
    }
  }, [stableConnected, getContractInstance, executeTransaction, fetchPurchasedTickets, fetchDirectTotals, extractRevertReason]);

  return {
    // Data
    userActivity,
    createdRaffles,
    purchasedTickets,
    purchasedSlots,
    activityStats,
    loading,

    // Revenue modal state
    showRevenueModal,
    setShowRevenueModal,
    selectedRaffle,
    setSelectedRaffle,

    // Functions
    fetchCreatedRaffles,
    fetchPurchasedTickets,
    withdrawRevenue,
    claimRefund,
    extractRevertReason,
    mapRaffleState,

    // Computed values
    creatorStats: {
      totalRaffles: createdRaffles.length,
      activeRaffles: createdRaffles.filter(r => r.state === 'active').length,
      withdrawableRevenue: activityStats.withdrawableRevenue || '0.0000',
      totalParticipants: createdRaffles.reduce((sum, r) => sum + parseInt(r.ticketsSold || 0), 0),
      uniqueParticipants: createdRaffles.reduce((sum, r) => sum + parseInt(r.ticketsSold || 0), 0), // Simplified
      successRate: createdRaffles.length > 0 ?
        Math.round((createdRaffles.filter(r => r.state === 'completed' || r.state === 'allPrizesClaimed').length / createdRaffles.length) * 100) : 0
    }
  };
};
