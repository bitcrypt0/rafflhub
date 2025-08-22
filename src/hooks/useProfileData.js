import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from '../components/ui/sonner';
import { getTicketsSoldCount } from '../utils/contractCallUtils';
import { handleError } from '../utils/errorHandling';
import { APP_CONFIG } from '../constants';

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
      case 6: return 'activationFailed';
      case 7: return 'allPrizesClaimed';
      case 8: return 'unengaged';
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

  const getAllRafflesCached = useCallback(async () => {
    if (!stableContracts.raffleManager) return [];
    const cacheKey = `raffles:all:${CACHE_VERSION}:${chainId}`;
    const cached = getCachedJson(cacheKey);
    if (cached) return cached;
    try {
      const res = await executeCall(stableContracts.raffleManager.getAllRaffles, 'getAllRaffles');
      const list = res.success && Array.isArray(res.result) ? res.result : [];
      if (Array.isArray(list) && list.length > 0) {
        setCachedJson(cacheKey, list, FIFTEEN_MIN_MS);
      }
      return list;
    } catch {
      return [];
    }
  }, [stableContracts.raffleManager, chainId, executeCall, getCachedJson, setCachedJson]);

  // Safe retry helper: refetch all raffles shortly after contracts become ready
  const getAllRafflesWithRetry = useCallback(async () => {
    const first = await getAllRafflesCached();
    if (first && first.length > 0) return first;
    // Only retry if contracts are present (to avoid unnecessary timers)
    if (!stableContracts.raffleManager) return first;
    await new Promise((r) => setTimeout(r, 1200));
    const second = await getAllRafflesCached();
    return second;
  }, [getAllRafflesCached, stableContracts.raffleManager]);


  const getRafflesByCreatorCached = useCallback(async (creator) => {
    if (!stableContracts.raffleManager || !creator) return [];
    const cacheKey = `raffles:byCreator:${CACHE_VERSION}:${chainId}:${creator.toLowerCase()}`;
    const cached = getCachedJson(cacheKey);
    if (cached) return cached;
    try {
      const res = await executeCall(stableContracts.raffleManager.getRafflesByCreator, 'getRafflesByCreator', creator);
      const list = res.success && Array.isArray(res.result) ? res.result : [];
      setCachedJson(cacheKey, list, FIFTEEN_MIN_MS);
      return list;
    } catch {
      return [];
    }
  }, [stableContracts.raffleManager, chainId, executeCall, getCachedJson, setCachedJson]);

  // Fetch created raffles using RaffleManager.getRafflesByCreator()
  const fetchCreatedRaffles = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Missing requirements for fetchCreatedRaffles:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const raffles = [];
      const activitiesFromGetters = [];
      let withdrawableRevenueTotal = ethers.BigNumber.from(0);
      const creatorRaffles = await getRafflesByCreatorCached(stableAddress);
      console.log('Profile: Found', creatorRaffles.length, 'created raffles for', stableAddress);

      for (const raffleAddress of creatorRaffles) {
        try {
          const raffleContract = getContractInstance(raffleAddress, 'raffle');
          if (!raffleContract) continue;

          const [nameResult, ticketPriceResult, ticketLimitResult, startTimeResult, durationResult, stateResult, winnersCountResult, usesCustomPriceResult, totalCreatorRevenueResult, creationTsRes] = await Promise.all([
            executeCall(raffleContract.name, 'name'),
            executeCall(raffleContract.ticketPrice, 'ticketPrice'),
            executeCall(raffleContract.ticketLimit, 'ticketLimit'),
            executeCall(raffleContract.startTime, 'startTime'),
            executeCall(raffleContract.duration, 'duration'),
            executeCall(raffleContract.state, 'state'),
            executeCall(raffleContract.winnersCount, 'winnersCount'),
            executeCall(raffleContract.usesCustomPrice, 'usesCustomPrice'),
            executeCall(raffleContract.totalCreatorRevenue, 'totalCreatorRevenue'),
            stableContracts.raffleManager ? executeCall(stableContracts.raffleManager.raffleCreationTimestamps, 'raffleCreationTimestamps', raffleAddress) : Promise.resolve({ success: false })
          ]);

          const name = nameResult.success ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
          const ticketPrice = ticketPriceResult.success ? ticketPriceResult.result : ethers.BigNumber.from(0);
          const ticketLimit = ticketLimitResult.success ? ticketLimitResult.result : ethers.BigNumber.from(0);
          const startTime = startTimeResult.success ? startTimeResult.result : ethers.BigNumber.from(0);
          const duration = durationResult.success ? durationResult.result : ethers.BigNumber.from(0);
          const state = stateResult.success ? stateResult.result : 0;
          const winnersCountBn = winnersCountResult.success ? winnersCountResult.result : ethers.BigNumber.from(0);
          const usesCustomPrice = usesCustomPriceResult.success ? !!usesCustomPriceResult.result : false;
          const totalCreatorRevenueWei = totalCreatorRevenueResult.success ? totalCreatorRevenueResult.result : ethers.BigNumber.from(0);

          const ticketsSoldCount = await getTicketsSoldCount(raffleContract);
          const ticketsSold = ethers.BigNumber.from(ticketsSoldCount);

          // Calculate end time and revenue (use totalCreatorRevenue when usesCustomPrice is true)
          const endTime = new Date((startTime.add(duration)).toNumber() * 1000);
          let revenueWei = ethers.BigNumber.from(0);

          // Accumulate withdrawable revenue as the sum of totalCreatorRevenue across raffles
          withdrawableRevenueTotal = withdrawableRevenueTotal.add ? withdrawableRevenueTotal.add(totalCreatorRevenueWei) : ethers.BigNumber.from(withdrawableRevenueTotal).add(totalCreatorRevenueWei);

          if (usesCustomPrice) {
            revenueWei = totalCreatorRevenueWei;
          } else {
            revenueWei = ethers.BigNumber.from(0);
          }

          const creationTsSec = (creationTsRes && creationTsRes.success && creationTsRes.result) ? (creationTsRes.result.toNumber ? creationTsRes.result.toNumber() : Number(creationTsRes.result)) : (startTime.toNumber ? startTime.toNumber() : Math.floor(Date.now()/1000));

          raffles.push({
            address: raffleAddress,
            chainId,
            name,
            ticketPrice: ethers.utils.formatEther(ticketPrice),
            maxTickets: ticketLimit.toString(),
            ticketsSold: ticketsSold.toString(),
            endTime: endTime,
            createdAt: creationTsSec * 1000,
            state: mapRaffleState(state),
            stateNum: state,
            revenue: ethers.utils.formatEther(revenueWei),
            usesCustomPrice,
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
  }, [stableConnected, stableAddress, provider, stableContracts.raffleDeployer, executeCall, getContractInstance, mapRaffleState]);

  // Fetch purchased tickets using direct getters
  const fetchPurchasedTickets = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Missing requirements for fetchPurchasedTickets:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const tickets = [];
      const activitiesFromGetters = [];

      if (stableContracts.raffleManager) {
        const allRaffles = await getAllRafflesWithRetry();
        console.log('Profile: Checking', allRaffles.length, 'raffles for purchased tickets via getTicketsPurchased');

        for (const raffleAddress of allRaffles) {
          try {
            const raffleContract = getContractInstance(raffleAddress, 'raffle');
            if (!raffleContract) continue;

            const [userTicketsRes, nameRes, priceRes, stateRes, startRes, durationRes, lastPurchaseBlockRes] = await Promise.all([
              executeCall(raffleContract.getTicketsPurchased, 'getTicketsPurchased', stableAddress),
              executeCall(raffleContract.name, 'name'),
              executeCall(raffleContract.ticketPrice, 'ticketPrice'),
              executeCall(raffleContract.state, 'state'),
              executeCall(raffleContract.startTime, 'startTime'),
              executeCall(raffleContract.duration, 'duration'),
              executeCall(raffleContract.lastPurchaseBlock, 'lastPurchaseBlock', stableAddress)
            ]);

            const userTicketsBn = userTicketsRes.success ? userTicketsRes.result : ethers.BigNumber.from(0);
            const userTickets = userTicketsBn.toNumber ? userTicketsBn.toNumber() : Number(userTicketsBn);
            if (userTickets <= 0) continue;

            const raffleName = nameRes.success ? nameRes.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
            const ticketPriceBn = priceRes.success ? priceRes.result : ethers.BigNumber.from(0);
            const totalSpentBn = ticketPriceBn.mul ? ticketPriceBn.mul(userTicketsBn) : ethers.BigNumber.from(0);
            const state = stateRes.success ? stateRes.result : 0;
            const startTime = startRes.success ? startRes.result : ethers.BigNumber.from(0);
            const duration = durationRes.success ? durationRes.result : ethers.BigNumber.from(0);
            const endTime = new Date((startTime.add(duration)).toNumber() * 1000);

            // Determine a purchase timestamp. Prefer purchaseTimestamps for each ticket if available; otherwise fall back to lastPurchaseBlock or startTime.
            let purchaseTimestampSec = startTime.toNumber ? startTime.toNumber() : Math.floor(Date.now()/1000);
            try {
              // Try to fetch the most recent purchase timestamp for this user
              const idx = userTickets > 0 ? userTickets - 1 : 0;
              const tsRes = await executeCall(raffleContract.purchaseTimestamps, 'purchaseTimestamps', stableAddress, idx);
              if (tsRes.success && tsRes.result) {
                purchaseTimestampSec = tsRes.result.toNumber ? tsRes.result.toNumber() : Number(tsRes.result);
              } else if (lastPurchaseBlockRes.success && lastPurchaseBlockRes.result && provider?.getBlock) {
                const bn = lastPurchaseBlockRes.result.toNumber ? lastPurchaseBlockRes.result.toNumber() : Number(lastPurchaseBlockRes.result);
                if (bn > 0) {
                  const block = await provider.getBlock(bn);
                  if (block?.timestamp) purchaseTimestampSec = block.timestamp;
                }
              }
            } catch (_) {}

            const ticketData = {
              id: raffleAddress,
              address: raffleAddress,
              raffleName,
              name: raffleName,
              ticketCount: userTickets,
              ticketPrice: ethers.utils.formatEther(ticketPriceBn),
              totalSpent: ethers.utils.formatEther(totalSpentBn),
              state: mapRaffleState(state),
              endTime,
              purchaseTime: purchaseTimestampSec,
              canClaimPrize: false,
              canClaimRefund: false,
              tickets: Array.from({ length: userTickets }, (_, i) => i.toString())
            };

            tickets.push(ticketData);

            // Build Activity item from getters (no events dependency)
            activitiesFromGetters.push({
              id: `getter-ticket-${raffleAddress}-${purchaseTimestampSec}`,
              type: 'ticket_purchase',
              raffleAddress,
              raffleName,
              quantity: userTickets,
              amount: ethers.utils.formatEther(totalSpentBn),
              timestamp: purchaseTimestampSec * 1000,
            });
          } catch (error) {
            console.error(`Error processing getTicketsPurchased for raffle ${raffleAddress}:`, error);
          }
        }
      } else {
        console.log('raffleManager contract not available');
      }

      console.log('Setting purchased tickets:', tickets.length, 'raffles with tickets using getters');
      setPurchasedTickets(tickets);

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
        // Do not alter totalTicketsPurchased here to avoid flicker with fetchDirectTotals
      }
    } catch (error) {
      handleError(error, {
        context: { operation: 'fetchPurchasedTickets', isReadOnly: true },
        fallbackMessage: 'Failed to load purchased tickets'
      });
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleManager, executeCall, getContractInstance, mapRaffleState, getAllRafflesCached]);
  // Compute totals directly across raffles: tickets, wins, claimable refunds
  const fetchDirectTotals = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider || !stableContracts.raffleManager) return;
    try {
      const allRaffles = await getAllRafflesWithRetry();
      let totalTickets = 0;
      let totalWins = 0;
      let totalRefunds = ethers.BigNumber.from(0);

      for (const raffleAddress of allRaffles) {
        try {
          const raffleContract = getContractInstance(raffleAddress, 'raffle');
          if (!raffleContract) continue;

          const [ticketsRes, winsRes, refundsRes] = await Promise.all([
            executeCall(raffleContract.getTicketsPurchased, 'getTicketsPurchased', stableAddress),
            executeCall(raffleContract.winsPerAddress, 'winsPerAddress', stableAddress),
            executeCall(raffleContract.getRefundableAmount, 'getRefundableAmount', stableAddress)
          ]);

          const tBn = ticketsRes.success ? ticketsRes.result : ethers.BigNumber.from(0);
          const wBn = winsRes.success ? winsRes.result : ethers.BigNumber.from(0);
          const rBn = refundsRes.success ? refundsRes.result : ethers.BigNumber.from(0);

          totalTickets += tBn.toNumber ? tBn.toNumber() : Number(tBn);
          totalWins += wBn.toNumber ? wBn.toNumber() : Number(wBn);
          totalRefunds = totalRefunds.add ? totalRefunds.add(rBn) : ethers.BigNumber.from(totalRefunds).add(rBn);
        } catch (err) {
          console.warn('Skipping raffle for totals due to error:', raffleAddress, err?.message || err);
        }
      }

      setActivityStats(prev => ({
        ...prev,
        totalTicketsPurchased: totalTickets,
        totalPrizesWon: totalWins,
        totalClaimableRefunds: totalRefunds
      }));
    } catch (error) {
      handleError(error, { context: { operation: 'fetchDirectTotals', isReadOnly: true }, fallbackMessage: 'Failed to compute profile totals' });
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleManager, getAllRafflesCached, getContractInstance, executeCall]);

  // Load data when wallet connects, reset when disconnects
  useEffect(() => {
    if (stableConnected && stableAddress && stableContracts.raffleManager) {
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
  }, [stableConnected, stableAddress, stableContracts.raffleManager, fetchCreatedRaffles, fetchPurchasedTickets, fetchDirectTotals]);

  // Revenue withdrawal function
  const withdrawRevenue = useCallback(async (raffleAddress) => {
    if (!raffleAddress || !stableConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const raffleContract = getContractInstance(raffleAddress, 'raffle');
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
      const raffleContract = getContractInstance(raffleAddress, 'raffle');
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
