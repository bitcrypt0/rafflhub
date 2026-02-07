/**
 * useFlywheelDataEnhanced - Enhanced flywheel data hook with Supabase backend
 * 
 * Uses Supabase API as primary data source for flywheel rewards data,
 * with fallback to RPC calls if Supabase is unavailable.
 * 
 * Replaces direct RPC calls in FlywheelRewardsComponent for:
 * - Points system info
 * - User points and claimable rewards
 * - Pool participant rewards
 * - Creator rewards configuration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { SUPPORTED_NETWORKS } from '../networks';
import { supabaseService } from '../services/supabaseService';

export const useFlywheelDataEnhanced = ({ poolAddress = null, autoRefresh = true } = {}) => {
  const { address, connected, provider, chainId } = useWallet();
  const { getContractInstance } = useContract();
  
  // Data state
  const [pointsSystemInfo, setPointsSystemInfo] = useState(null);
  const [pointsRewardTokenInfo, setPointsRewardTokenInfo] = useState(null);
  const [userPointsInfo, setUserPointsInfo] = useState(null);
  const [claimablePointsInfo, setClaimablePointsInfo] = useState(null);
  const [timeUntilNextPointsClaim, setTimeUntilNextPointsClaim] = useState(0);
  const [insufficientPointsRewardBalance, setInsufficientPointsRewardBalance] = useState(false);
  
  // Pool rewards state
  const [poolInfo, setPoolInfo] = useState(null);
  const [poolExists, setPoolExists] = useState(false);
  
  // Creator rewards state
  const [creatorRewardTokens, setCreatorRewardTokens] = useState([]);
  const [creatorRewardConfigs, setCreatorRewardConfigs] = useState({});
  
  // Loading and error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null); // 'supabase' or 'rpc'
  
  const refreshIntervalRef = useRef(null);

  /**
   * Fetch data from Supabase API
   */
  const fetchFromSupabase = useCallback(async () => {
    if (!chainId) return null;

    try {
      const data = await supabaseService.getCompleteFlywheelData(
        chainId,
        address,
        poolAddress
      );

      if (!data || !data.success) {
        throw new Error('Supabase API returned error');
      }

      return data;
    } catch (err) {
      console.warn('[useFlywheelDataEnhanced] Supabase fetch failed:', err);
      return null;
    }
  }, [chainId, address, poolAddress]);

  /**
   * Fetch data from RPC (fallback)
   */
  const fetchFromRPC = useCallback(async () => {
    if (!connected || !provider || !chainId) return null;

    const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
    if (!rewardsFlywheelAddress) return null;

    const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
    if (!rewardsFlywheel) return null;

    try {
      // Fetch points system info
      const [systemInfo, userPoints, claimable, secondsRemaining] = await Promise.all([
        rewardsFlywheel.getPointsSystemInfo(),
        address ? rewardsFlywheel.getUserPoints(address) : null,
        address ? rewardsFlywheel.getClaimablePointsReward(address) : null,
        address ? rewardsFlywheel.getTimeUntilNextClaim(address) : null,
      ]);

      // Fetch token info if available
      let tokenInfo = null;
      if (systemInfo.token && systemInfo.token !== ethers.constants.AddressZero) {
        try {
          const tokenContract = new ethers.Contract(
            systemInfo.token,
            ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
            provider
          );
          const [symbol, decimals] = await Promise.all([
            tokenContract.symbol(),
            tokenContract.decimals()
          ]);
          tokenInfo = { symbol, decimals };
        } catch {
          tokenInfo = null;
        }
      }

      // Fetch creator reward tokens
      let creatorTokens = [];
      let creatorConfigs = {};
      try {
        creatorTokens = await rewardsFlywheel.getCreatorRewardTokens();
        for (const token of creatorTokens) {
          try {
            const [rewardAmount, totalDeposited] = await rewardsFlywheel.getCreatorRewardConfig(token);
            const tokenContract = new ethers.Contract(
              token,
              ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
              provider
            );
            const [symbol, decimals] = await Promise.all([
              tokenContract.symbol(),
              tokenContract.decimals()
            ]);
            creatorConfigs[token] = {
              rewardAmount: ethers.utils.formatUnits(rewardAmount, decimals),
              totalDeposited: ethers.utils.formatUnits(totalDeposited, decimals),
              symbol,
              decimals
            };
          } catch (e) {
            console.warn(`Failed to fetch creator config for ${token}:`, e);
          }
        }
      } catch {
        // Creator rewards not available
      }

      return {
        pointsSystem: {
          active: systemInfo.active,
          claimsActive: systemInfo.claimsActive,
          token: systemInfo.token,
          tokenSymbol: tokenInfo?.symbol,
          tokenDecimals: tokenInfo?.decimals || 18,
          rate: systemInfo.rate.toString(),
          totalDeposited: systemInfo.totalDeposited.toString(),
        },
        userPoints: userPoints ? {
          totalPoints: userPoints.totalPoints.toString(),
          claimedPoints: userPoints.claimedPoints.toString(),
          lastClaimTime: userPoints.lastClaimTime.toNumber() > 0 
            ? new Date(userPoints.lastClaimTime.toNumber() * 1000).toISOString() 
            : null,
        } : null,
        claimable: claimable ? {
          claimablePoints: claimable.claimablePoints.toString(),
          tokenAmount: claimable.tokenAmount.toString(),
        } : null,
        timeUntilNextClaim: secondsRemaining ? secondsRemaining.toNumber() : 0,
        creatorRewards: Object.entries(creatorConfigs).map(([token, config]) => ({
          token,
          tokenSymbol: config.symbol,
          tokenDecimals: config.decimals,
          rewardAmountPerCreator: config.rewardAmount,
          totalDeposited: config.totalDeposited,
        })),
      };
    } catch (err) {
      console.error('[useFlywheelDataEnhanced] RPC fetch failed:', err);
      return null;
    }
  }, [connected, provider, chainId, address, getContractInstance]);

  /**
   * Process and set data from either source
   */
  const processData = useCallback((data, source) => {
    if (!data) return;

    setDataSource(source);

    // Points system info
    if (data.pointsSystem) {
      setPointsSystemInfo({
        active: data.pointsSystem.active,
        claimsActive: data.pointsSystem.claimsActive,
        token: data.pointsSystem.token,
        rate: ethers.BigNumber.from(data.pointsSystem.rate || '0'),
        totalDeposited: ethers.BigNumber.from(data.pointsSystem.totalDeposited || '0'),
      });
      setPointsRewardTokenInfo({
        symbol: data.pointsSystem.tokenSymbol,
        decimals: data.pointsSystem.tokenDecimals || 18,
      });
    }

    // User points
    if (data.userPoints) {
      setUserPointsInfo({
        totalPoints: ethers.BigNumber.from(data.userPoints.totalPoints || '0'),
        claimedPoints: ethers.BigNumber.from(data.userPoints.claimedPoints || '0'),
        lastClaimTime: data.userPoints.lastClaimTime,
      });
    }

    // Claimable points (from Supabase we need to calculate, from RPC it's direct)
    if (data.claimable) {
      setClaimablePointsInfo({
        claimablePoints: ethers.BigNumber.from(data.claimable.claimablePoints || '0'),
        tokenAmount: ethers.BigNumber.from(data.claimable.tokenAmount || '0'),
      });
    } else if (data.userPoints && data.pointsSystem) {
      // Calculate claimable from user points
      const total = ethers.BigNumber.from(data.userPoints.totalPoints || '0');
      const claimed = ethers.BigNumber.from(data.userPoints.claimedPoints || '0');
      const claimable = total.sub(claimed);
      const rate = ethers.BigNumber.from(data.pointsSystem.rate || '0');
      const tokenAmount = rate.gt(0) 
        ? claimable.mul(ethers.constants.WeiPerEther).div(rate)
        : ethers.BigNumber.from(0);
      
      setClaimablePointsInfo({
        claimablePoints: claimable,
        tokenAmount: tokenAmount,
      });
    }

    // Time until next claim
    if (data.timeUntilNextClaim !== undefined) {
      setTimeUntilNextPointsClaim(data.timeUntilNextClaim);
    }

    // Check insufficient balance
    if (data.pointsSystem && data.claimable) {
      const claimablePoints = ethers.BigNumber.from(data.claimable?.claimablePoints || '0');
      const rate = ethers.BigNumber.from(data.pointsSystem.rate || '0');
      const totalDeposited = ethers.BigNumber.from(data.pointsSystem.totalDeposited || '0');
      
      if (claimablePoints.gt(0) && rate.gt(0)) {
        const computedTokenAmount = claimablePoints.mul(ethers.constants.WeiPerEther).div(rate);
        setInsufficientPointsRewardBalance(computedTokenAmount.gt(totalDeposited));
      } else {
        setInsufficientPointsRewardBalance(false);
      }
    }

    // Pool rewards
    if (data.poolRewards) {
      setPoolInfo({
        totalDeposited: data.poolRewards.totalDeposited,
        rewardPerSlot: data.poolRewards.rewardPerSlot,
        totalEligibleSlots: data.poolRewards.totalEligibleSlots?.toString(),
        claimedSlots: data.poolRewards.claimedSlots?.toString(),
        token: data.poolRewards.token,
        tokenSymbol: data.poolRewards.tokenSymbol,
        depositor: data.poolRewards.depositor,
        rewardPerSlotCalculated: data.poolRewards.rewardPerSlotCalculated,
      });
      setPoolExists(true);
    }

    // Creator rewards
    if (data.creatorRewards && data.creatorRewards.length > 0) {
      setCreatorRewardTokens(data.creatorRewards.map(r => r.token));
      const configs = {};
      for (const reward of data.creatorRewards) {
        configs[reward.token] = {
          rewardAmount: reward.rewardAmountPerCreator,
          totalDeposited: reward.totalDeposited,
          symbol: reward.tokenSymbol,
          decimals: reward.tokenDecimals,
        };
      }
      setCreatorRewardConfigs(configs);
    }
  }, []);

  /**
   * Main fetch function with Supabase-first strategy
   */
  const fetchData = useCallback(async () => {
    if (!connected || !chainId) {
      setPointsSystemInfo(null);
      setUserPointsInfo(null);
      setClaimablePointsInfo(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try Supabase first
      if (supabaseService.isAvailable()) {
        const supabaseData = await fetchFromSupabase();
        if (supabaseData) {
          processData(supabaseData, 'supabase');
          setLoading(false);
          return;
        }
      }

      // Fallback to RPC
      const rpcData = await fetchFromRPC();
      if (rpcData) {
        processData(rpcData, 'rpc');
      } else {
        setError('Failed to fetch flywheel data');
      }
    } catch (err) {
      console.error('[useFlywheelDataEnhanced] Fetch error:', err);
      setError(err.message || 'Failed to fetch flywheel data');
    } finally {
      setLoading(false);
    }
  }, [connected, chainId, fetchFromSupabase, fetchFromRPC, processData]);

  /**
   * Refresh data
   */
  const refresh = useCallback(() => {
    // Clear cache for this data
    if (chainId && address) {
      supabaseService.clearCache(`flywheel:${chainId}:${address}:${poolAddress || 'none'}:${!!poolAddress}:true`);
    }
    fetchData();
  }, [chainId, address, poolAddress, fetchData]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchData, 30000); // Refresh every 30s
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchData, autoRefresh]);

  // Refetch when pool address changes
  useEffect(() => {
    if (poolAddress) {
      fetchData();
    }
  }, [poolAddress]);

  return {
    // Points system
    pointsSystemInfo,
    pointsRewardTokenInfo,
    userPointsInfo,
    claimablePointsInfo,
    timeUntilNextPointsClaim,
    insufficientPointsRewardBalance,
    
    // Pool rewards
    poolInfo,
    poolExists,
    
    // Creator rewards
    creatorRewardTokens,
    creatorRewardConfigs,
    
    // State
    loading,
    error,
    dataSource,
    
    // Actions
    refresh,
    fetchData,
  };
};

export default useFlywheelDataEnhanced;
