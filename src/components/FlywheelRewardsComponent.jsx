import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { SUPPORTED_NETWORKS } from '../networks';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { toast } from './ui/sonner';
import { extractRevertReason } from '../utils/errorHandling';
import { notifyError } from '../utils/notificationService';
import {
  Plus,
  Gift,
  Coins,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  ArrowDown,
  ArrowUp
} from 'lucide-react';

const FlywheelRewardsComponent = ({ onBack }) => {
  const { address, connected, provider, chainId } = useWallet();
  const { getContractInstance } = useContract();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('deposit'); // 'deposit', 'claim', or 'withdraw'
  
  // Pool state
  const [poolAddress, setPoolAddress] = useState('');
  const [poolInfo, setPoolInfo] = useState(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolExists, setPoolExists] = useState(false);
  
  // Deposit state
  const [tokenAddress, setTokenAddress] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [needsApproval, setNeedsApproval] = useState(false);
  
  // Claim state
  const [claimTokenAddress, setClaimTokenAddress] = useState('');
  const [participantReward, setParticipantReward] = useState('0');
  const [creatorRewardToken, setCreatorRewardToken] = useState('');
  const [creatorRewardTokens, setCreatorRewardTokens] = useState([]);
  const [creatorRewardConfigs, setCreatorRewardConfigs] = useState({});
  const [availableRewards, setAvailableRewards] = useState('0');
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [userHasSlots, setUserHasSlots] = useState(false);
  
  // Withdraw state
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [remainingAmount, setRemainingAmount] = useState('0');
  
  // Common state
  const [error, setError] = useState('');

  // Reset states when switching tabs
  useEffect(() => {
    setError('');
  }, [activeTab]);

  // Fetch pool info when pool address changes
  useEffect(() => {
    if (poolAddress && ethers.utils.isAddress(poolAddress)) {
      fetchPoolInfo();
    } else {
      setPoolInfo(null);
      setPoolExists(false);
      setTokenInfo(null);
      setTokenBalance('0');
      setAllowance('0');
      setNeedsApproval(false);
    }
  }, [poolAddress]);

  // Fetch token info when token address changes
  useEffect(() => {
    if (tokenAddress && ethers.utils.isAddress(tokenAddress)) {
      fetchTokenInfo();
    } else {
      setTokenInfo(null);
      setTokenBalance('0');
      setAllowance('0');
      setNeedsApproval(false);
    }
  }, [tokenAddress, connected]); // Added connected dependency

  // Fetch creator reward tokens when claim tab is opened
  useEffect(() => {
    if (activeTab === 'claim' && connected) {
      fetchCreatorRewardTokens();
      checkIfUserIsCreator();
    }
  }, [activeTab, connected, poolAddress, address]);

  // Check participant claim eligibility when pool info is available
  useEffect(() => {
    if (poolInfo && activeTab === 'claim') {
      checkParticipantClaimEligibility();
    }
  }, [poolInfo, activeTab, address]);

  // Check if user is creator when pool address changes
  useEffect(() => {
    if (poolAddress && activeTab === 'claim' && connected) {
      checkIfUserIsCreator();
    }
  }, [poolAddress, activeTab, connected, address]);

  // Check creator claim eligibility when creator reward token is selected
  useEffect(() => {
    if (creatorRewardToken && ethers.utils.isAddress(creatorRewardToken) && poolExists && activeTab === 'claim') {
      checkCreatorClaimEligibility();
    }
  }, [creatorRewardToken, poolExists, activeTab, address]);

  const fetchPoolInfo = async () => {
    if (!connected || !provider) return;

    setPoolLoading(true);
    setError('');

    try {
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) return;
      
      const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
      if (!rewardsFlywheel) return;

      // Verify pool exists via ProtocolManager
      const protocolManagerAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager;
      if (protocolManagerAddress) {
        const protocolManager = getContractInstance(protocolManagerAddress, 'protocolManager');
        if (protocolManager) {
          const isValidPool = await protocolManager.isPoolContract(poolAddress);
          setPoolExists(isValidPool);
          
          if (!isValidPool) {
            setError('Invalid pool address');
            setPoolInfo(null);
            setCanWithdraw(false);
            setRemainingAmount('0');
            setPoolLoading(false);
            return;
          }
        }
      }

      // Get pool reward info using the public mapping getter
      const info = await rewardsFlywheel.poolRewards(poolAddress);
      
      if (info.totalDeposited.gt(0)) {
        // Pool has participant rewards deposited
        const poolData = {
          totalDeposited: ethers.utils.formatEther(info.totalDeposited),
          rewardPerSlot: ethers.utils.formatEther(info.rewardPerSlot),
          totalEligibleSlots: info.totalEligibleSlots.toString(),
          claimedSlots: info.claimedSlots.toString(),
          token: info.token,
          depositor: info.depositor,
          rewardPerSlotCalculated: info.rewardPerSlotCalculated
        };

        setPoolInfo(poolData);

        // Set token address if pool has deposits
        if (info.token !== ethers.constants.AddressZero) {
          setTokenAddress(info.token);
        }

        // Check if current user is depositor
        setCanWithdraw(info.depositor.toLowerCase() === address.toLowerCase());

        // Calculate remaining amount
        const remaining = info.totalDeposited.sub(info.totalClaimedAmount);
        setRemainingAmount(ethers.utils.formatEther(remaining));
      } else {
        // Pool exists but has no participant rewards
        setPoolInfo(null);
        setCanWithdraw(false);
        setRemainingAmount('0');
      }
    } catch (err) {
      console.error('Error fetching pool info:', err);
      setError('Failed to fetch pool information');
      setPoolExists(false);
    } finally {
      setPoolLoading(false);
    }
  };

  const fetchTokenInfo = async () => {
    if (!connected || !provider) {
      // Reset token info if not connected
      setTokenInfo(null);
      setTokenBalance('0');
      setAllowance('0');
      setNeedsApproval(false);
      return;
    }

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)', 'function allowance(address owner, address spender) view returns (uint256)'],
        provider
      );

      const [name, symbol, decimals, balance] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.balanceOf(address)
      ]);

      setTokenInfo({ name, symbol, decimals });
      setTokenBalance(ethers.utils.formatUnits(balance, decimals));

      // Check allowance if we have the RewardsFlywheel address
      if (SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel) {
        const allowanceAmount = await tokenContract.allowance(
          address,
          SUPPORTED_NETWORKS[chainId].contractAddresses.rewardsFlywheel
        );
        const formattedAllowance = ethers.utils.formatUnits(allowanceAmount, decimals);
        setAllowance(formattedAllowance);
        
        // Check if we need approval using the newly fetched allowance
        if (depositAmount && parseFloat(depositAmount) > parseFloat(formattedAllowance)) {
          setNeedsApproval(true);
        } else {
          setNeedsApproval(false);
        }
      }
    } catch (err) {
      console.error('Error fetching token info:', err);
      setError('Failed to fetch token information');
    }
  };

  const checkIfUserIsCreator = async () => {
    if (!connected || !provider || !poolAddress) return;

    try {
      const protocolManagerAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager;
      if (!protocolManagerAddress) return;

      const protocolManager = new ethers.Contract(
        protocolManagerAddress,
        ['function getPoolCreator(address pool) view returns (address)'],
        provider
      );

      // Check if user is the pool creator
      const creator = await protocolManager.getPoolCreator(poolAddress);
      const userIsCreator = creator.toLowerCase() === address.toLowerCase();
      setIsCreator(userIsCreator);
    } catch (err) {
      console.error('Error checking if user is creator:', err);
      setIsCreator(false);
    }
  };

  const fetchCreatorRewardTokens = async () => {
    if (!connected || !provider) return;

    try {
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) return;
      
      const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
      if (!rewardsFlywheel) return;

      // Fetch all creator reward tokens
      const tokens = await rewardsFlywheel.getCreatorRewardTokens();
      setCreatorRewardTokens(tokens);

      // Fetch config for each token
      const configs = {};
      for (const token of tokens) {
        try {
          const [rewardAmount, totalDeposited, tokenAddress] = await rewardsFlywheel.getCreatorRewardConfig(token);
          
          // Fetch token symbol and decimals
          const tokenContract = new ethers.Contract(
            token,
            ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
            provider
          );
          const [symbol, decimals] = await Promise.all([
            tokenContract.symbol(),
            tokenContract.decimals()
          ]);

          configs[token] = {
            rewardAmount: ethers.utils.formatUnits(rewardAmount, decimals),
            totalDeposited: ethers.utils.formatUnits(totalDeposited, decimals),
            tokenAddress,
            symbol,
            decimals
          };
        } catch (err) {
          console.error(`Error fetching config for token ${token}:`, err);
        }
      }
      setCreatorRewardConfigs(configs);
    } catch (err) {
      console.error('Error fetching creator reward tokens:', err);
    }
  };

  const checkParticipantClaimEligibility = async () => {
    if (!connected || !provider || !poolInfo) return;

    try {
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) return;
      
      const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
      if (!rewardsFlywheel) return;

      // Check if user has already claimed participant rewards
      const participantClaimed = await rewardsFlywheel.hasClaimed(poolAddress, address);
      
      // Check if user has purchased slots from the pool
      const poolContract = new ethers.Contract(
        poolAddress,
        ['function slotsPurchased(address) view returns (uint256)', 'function winsPerAddress(address) view returns (uint256)'],
        provider
      );
      const userSlots = await poolContract.slotsPurchased(address);
      
      // Update state to track if user has slots
      setUserHasSlots(userSlots.gt(0));
      
      // If user has no slots, they're not eligible
      if (userSlots.eq(0)) {
        setParticipantReward('0');
        return;
      }
      
      // Get claimable participant reward
      const claimableAmount = await rewardsFlywheel.getClaimableReward(poolAddress, address);
      
      // Format the amount based on pool token decimals
      let formattedAmount = '0';
      if (claimableAmount.gt(0) && poolInfo.token) {
        try {
          const tokenContract = new ethers.Contract(
            poolInfo.token,
            ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
            provider
          );
          const [decimals, symbol] = await Promise.all([
            tokenContract.decimals(),
            tokenContract.symbol()
          ]);
          formattedAmount = `${ethers.utils.formatUnits(claimableAmount, decimals)} ${symbol}`;
        } catch {
          formattedAmount = ethers.utils.formatEther(claimableAmount);
        }
      } else if (userSlots.gt(0) && !participantClaimed) {
        // User has slots but claimable amount is 0 (rewards not yet calculated)
        // Check if user is a winner to determine eligibility
        const userWins = await poolContract.winsPerAddress(address);
        if (userSlots.gt(userWins)) {
          // User has non-winning slots, so they're eligible once rewards are calculated
          formattedAmount = 'pending';
        }
      }
      
      setParticipantReward(formattedAmount);
    } catch (err) {
      console.error('Error checking participant claim eligibility:', err);
    }
  };

  const checkCreatorClaimEligibility = async () => {
    if (!connected || !provider || !poolAddress || !creatorRewardToken) return;

    try {
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) return;
      
      const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
      if (!rewardsFlywheel) return;

      // Get protocol manager to check creator
      const protocolManagerAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager;
      if (!protocolManagerAddress) return;

      const protocolManager = new ethers.Contract(
        protocolManagerAddress,
        ['function getPoolCreator(address pool) view returns (address)'],
        provider
      );

      // Check if user is the pool creator
      const creator = await protocolManager.getPoolCreator(poolAddress);
      const userIsCreator = creator.toLowerCase() === address.toLowerCase();
      setIsCreator(userIsCreator);

      // Check if creator has already claimed for this pool
      const claimed = await rewardsFlywheel.creatorHasClaimed(poolAddress, address);
      setHasClaimed(claimed);

      // Get claimable creator reward amount from the GLOBAL creator reward pool
      const claimableAmount = await rewardsFlywheel.getCreatorClaimableAmount(poolAddress, creatorRewardToken);
      
      // Format the amount based on creator reward token decimals
      let formattedAmount = '0';
      if (claimableAmount.gt(0)) {
        try {
          const tokenContract = new ethers.Contract(
            creatorRewardToken,
            ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
            provider
          );
          const [decimals, symbol] = await Promise.all([
            tokenContract.decimals(),
            tokenContract.symbol()
          ]);
          formattedAmount = `${ethers.utils.formatUnits(claimableAmount, decimals)} ${symbol}`;
          setClaimTokenAddress(creatorRewardToken); // Store for the claim transaction
        } catch {
          formattedAmount = ethers.utils.formatEther(claimableAmount);
          setClaimTokenAddress(creatorRewardToken);
        }
      } else {
        setClaimTokenAddress(creatorRewardToken);
      }
      
      setAvailableRewards(formattedAmount);
    } catch (err) {
      console.error('Error checking creator claim eligibility:', err);
      setError('Failed to check creator claim eligibility');
    }
  };

  const handleApprove = async () => {
    if (!connected || !tokenAddress || !depositAmount) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        provider.getSigner()
      );

      const amount = ethers.utils.parseUnits(depositAmount, tokenInfo.decimals);
      const tx = await tokenContract.approve(
        SUPPORTED_NETWORKS[chainId].contractAddresses.rewardsFlywheel,
        amount
      );

      toast.info('Approval transaction sent...');
      await tx.wait();
      
      toast.success('Token approved successfully!');
      setNeedsApproval(false);
      
      // Refresh allowance
      await fetchTokenInfo();
    } catch (err) {
      const reason = await extractRevertReason(err, provider);
      setError(reason || 'Approval failed');
      notifyError(reason || 'Token approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!connected || !poolAddress || !tokenAddress || !depositAmount) {
      setError('Please fill all fields');
      return;
    }

    if (!ethers.utils.isAddress(poolAddress)) {
      setError('Invalid pool address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) {
        setError('RewardsFlywheel contract not available on this network');
        return;
      }
      
      const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
      if (!rewardsFlywheel) {
        setError('RewardsFlywheel contract not available on this network');
        return;
      }

      const amount = ethers.utils.parseUnits(depositAmount, tokenInfo.decimals);
      
      const tx = await rewardsFlywheel.depositERC20Rewards(
        poolAddress,
        tokenAddress,
        amount
      );

      toast.info('Deposit transaction sent...');
      await tx.wait();
      
      toast.success('Rewards deposited successfully!');
      
      // Refresh pool info and related data
      await fetchPoolInfo();
      await fetchTokenInfo();
      
      // Reset form
      setDepositAmount('');
    } catch (err) {
      const reason = await extractRevertReason(err, provider);
      setError(reason || 'Deposit failed');
      notifyError(reason || 'Failed to deposit rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!connected) {
      setError('Please connect your wallet');
      return;
    }

    const hasParticipantReward = participantReward === 'pending' || parseFloat(participantReward) > 0;
    const hasCreatorReward = parseFloat(availableRewards) > 0;

    if (!hasParticipantReward && !hasCreatorReward) {
      setError('No rewards available to claim');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) {
        setError('RewardsFlywheel contract not available on this network');
        return;
      }
      
      const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
      if (!rewardsFlywheel) {
        setError('RewardsFlywheel contract not available on this network');
        return;
      }

      // Claim participant rewards if available
      if (hasParticipantReward) {
        const participantTx = await rewardsFlywheel.claimRewards(poolAddress);
        toast.info('Participant reward claim transaction sent...');
        await participantTx.wait();
        toast.success('Participant rewards claimed successfully!');
      }

      // Claim creator rewards if available
      if (hasCreatorReward && claimTokenAddress) {
        const creatorTx = await rewardsFlywheel.claimCreatorRewards(
          poolAddress,
          claimTokenAddress
        );
        toast.info('Creator reward claim transaction sent...');
        await creatorTx.wait();
        toast.success('Creator rewards claimed successfully!');
      }
      
      // Refresh pool info to update claimed slots and other pool data
      await fetchPoolInfo();
      
      // Refresh all claim-related data
      await checkParticipantClaimEligibility();
      if (creatorRewardToken && ethers.utils.isAddress(creatorRewardToken)) {
        await checkCreatorClaimEligibility();
      }
    } catch (err) {
      const reason = await extractRevertReason(err, provider);
      setError(reason || 'Claim failed');
      notifyError(reason || 'Failed to claim rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!connected || !poolAddress) {
      setError('Invalid pool address');
      return;
    }

    if (!canWithdraw) {
      setError('Only the depositor can withdraw rewards');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) {
        setError('RewardsFlywheel contract not available on this network');
        return;
      }
      
      const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
      if (!rewardsFlywheel) {
        setError('RewardsFlywheel contract not available on this network');
        return;
      }

      const tx = await rewardsFlywheel.withdrawDepositedRewards(poolAddress);

      toast.info('Withdraw transaction sent...');
      await tx.wait();
      
      toast.success('Rewards withdrawn successfully!');
      
      // Refresh pool info and withdraw data
      await fetchPoolInfo();
      
      // Reset withdraw state since rewards are withdrawn
      setCanWithdraw(false);
      setRemainingAmount('0');
    } catch (err) {
      const reason = await extractRevertReason(err, provider);
      setError(reason || 'Withdraw failed');
      notifyError(reason || 'Failed to withdraw rewards');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 overflow-x-hidden">
      {/* Pool Address Input */}
      <Card className="w-full">
        <CardContent className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Enter the pool contract address to view and manage its rewards
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Pool Contract Address</label>
            <Input
              id="poolAddress"
              placeholder="0x..."
              value={poolAddress}
              onChange={(e) => setPoolAddress(e.target.value)}
              disabled={loading}
              className="w-full text-xs sm:text-sm"
            />
          </div>

          {poolLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {poolInfo && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Total Deposited</span>
                  <span className="text-xs sm:text-sm text-right break-all">{poolInfo.totalDeposited} {poolInfo.token === ethers.constants.AddressZero ? 'ETH' : 'Tokens'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Depositor</span>
                  <span className="text-xs sm:text-sm font-mono text-right break-all">{poolInfo.depositor.slice(0, 6)}...{poolInfo.depositor.slice(-4)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Claimed Slots</span>
                  <span className="text-xs sm:text-sm text-right">{poolInfo.claimedSlots} / {poolInfo.totalEligibleSlots || 'Not calculated'}</span>
                </div>
              </div>
              {canWithdraw && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Remaining Amount</span>
                    <span className="text-xs sm:text-sm text-right break-all">{remainingAmount} {poolInfo.token === ethers.constants.AddressZero ? 'ETH' : 'Tokens'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!poolInfo && poolAddress && !poolLoading && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No participant rewards found for this pool.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Error Messages */}
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs sm:text-sm break-words">{error}</AlertDescription>
        </Alert>
      )}

      {/* Tab Navigation - Show when pool address is entered */}
      {poolAddress && (
        <div className="flex flex-wrap gap-2 p-1 bg-muted rounded-lg w-full">
          <Button
            variant={activeTab === 'deposit' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('deposit')}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 min-w-[80px]"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="truncate">Deposit</span>
          </Button>
          {poolExists && (
            <>
              <Button
                variant={activeTab === 'claim' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('claim')}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 min-w-[80px]"
              >
                <Coins className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Claim</span>
              </Button>
              {canWithdraw && (
                <Button
                  variant={activeTab === 'withdraw' ? 'default' : 'ghost'}
                  onClick={() => setActiveTab('withdraw')}
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 min-w-[80px]"
                >
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate">Withdraw</span>
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Deposit Tab */}
      {activeTab === 'deposit' && poolAddress && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="text-base font-medium flex items-center gap-2 mb-1">
              {poolInfo ? 'Increase Participant Reward Pool' : 'Deposit ERC20 Rewards'}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {poolInfo 
                ? `Add more ${poolInfo.token === ethers.constants.AddressZero ? 'ETH' : 'tokens'} to the existing reward pool`
                : 'Deposit ERC20 tokens as rewards for non-winning pool participants'
              }
            </p>
            {poolInfo && !poolInfo.rewardPerSlotCalculated && (
              <div className="p-3 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  This pool already has {poolInfo.totalDeposited} {poolInfo.token === ethers.constants.AddressZero ? 'ETH' : 'tokens'} deposited. 
                  You can add more rewards to increase the amount per participant.
                </span>
              </div>
            )}
            
            {poolInfo && poolInfo.rewardPerSlotCalculated && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                  Claiming has already started for this pool. Additional deposits are not allowed once participants begin claiming rewards.
                </AlertDescription>
              </Alert>
            )}
            
            {!poolInfo && (
              <div>
                <label className="block text-sm font-medium mb-1">Token Address</label>
                <Input
                  id="tokenAddress"
                  placeholder="0x..."
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            {tokenInfo && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Token:</span> {tokenInfo.symbol}
                  </div>
                  <div>
                    <span className="font-medium">Decimals:</span> {tokenInfo.decimals}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Balance:</span> {tokenBalance} {tokenInfo.symbol}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Deposit Amount</label>
              <Input
                id="depositAmount"
                type="number"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => {
                  setDepositAmount(e.target.value);
                  // Check if approval is needed
                  if (tokenInfo && e.target.value) {
                    setNeedsApproval(parseFloat(e.target.value) > parseFloat(allowance.toString()));
                  }
                }}
                disabled={loading || (!tokenInfo && !poolInfo)}
              />
              <p className="text-xs text-muted-foreground">
                {poolInfo ? 'Additional amount to deposit' : 'Amount of tokens to deposit'}
              </p>
            </div>

            {tokenInfo && parseFloat(depositAmount) > parseFloat(tokenBalance) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Insufficient balance. You have {tokenBalance} {tokenInfo.symbol}
                </AlertDescription>
              </Alert>
            )}

            {needsApproval && (
              <Button
                onClick={handleApprove}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Approve {tokenInfo?.symbol}
              </Button>
            )}

            <Button
              onClick={handleDeposit}
              disabled={
                loading ||
                !poolAddress ||
                (!poolInfo && !tokenAddress) ||
                !depositAmount ||
                needsApproval ||
                (tokenInfo && parseFloat(depositAmount) > parseFloat(tokenBalance)) ||
                (poolInfo && poolInfo.rewardPerSlotCalculated)
              }
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {poolInfo ? 'Add More Rewards' : 'Deposit Rewards'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Claim Tab */}
      {activeTab === 'claim' && poolExists && (
        <Card className="w-full">
          <CardContent className="space-y-4 p-4">
            <div className="text-base font-medium flex items-center gap-2 mb-1">
              Claim Rewards
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Claim participant rewards or creator rewards
            </p>
            
            {/* Check if any rewards exist */}
            {!poolInfo && creatorRewardTokens.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No rewards found for this pool
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Participant Rewards Section - Only show if poolInfo exists AND user has purchased slots */}
                {poolInfo && userHasSlots && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-blue-600" />
                      <span className="text-xs sm:text-sm font-semibold">Pool Participant Rewards</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rewards for your non-winning slots in this pool
                    </p>
                    {participantReward === 'pending' ? (
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-600" />
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            You have purchased slots in this pool. Claim to calculate and receive your rewards.
                          </p>
                        </div>
                      </div>
                    ) : parseFloat(participantReward) > 0 ? (
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs sm:text-sm font-medium">Claimable:</span>
                          <span className="text-xs sm:text-sm font-semibold text-green-600 text-right break-all">
                            {participantReward}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No participant rewards available
                      </p>
                    )}
                  </div>
                )}

                {/* Creator Rewards Section - Only show if creator reward tokens exist AND user is creator */}
                {creatorRewardTokens.length > 0 && isCreator && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <span className="text-xs sm:text-sm font-semibold">Creator Rewards</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Rewards from global creator pool based on pool performance
              </p>
              
              <div className="border border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">Reward Tiers Based on Pool Fill Rate</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">50-74% Pool Filled</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400">50%</span>
                      <span className="text-xs text-gray-500">of reward</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">75-94% Pool Filled</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">75%</span>
                      <span className="text-xs text-gray-500">of reward</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">95%+ Pool Filled</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">100%</span>
                      <span className="text-xs text-gray-500">of reward</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-2 italic">
                  Higher pool participation = Higher creator rewards
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Select Creator Reward Token</label>
                {creatorRewardTokens.length > 0 ? (
                  <select
                    id="creatorRewardToken"
                    value={creatorRewardToken}
                    onChange={(e) => setCreatorRewardToken(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Select a reward token --</option>
                    {creatorRewardTokens.map((token) => {
                      const config = creatorRewardConfigs[token];
                      return (
                        <option key={token} value={token}>
                          {config?.symbol || 'Unknown'} - {config?.rewardAmount || '0'} per creator
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground italic">
                      No creator reward tokens available yet
                    </p>
                  </div>
                )}
                {creatorRewardToken && creatorRewardConfigs[creatorRewardToken] && (
                  <div className="p-3 bg-muted/50 rounded-lg border mt-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Token:</span> {creatorRewardConfigs[creatorRewardToken].symbol}
                      </div>
                      <div>
                        <span className="font-medium">Per Creator:</span> {creatorRewardConfigs[creatorRewardToken].rewardAmount}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Total Deposited:</span> {creatorRewardConfigs[creatorRewardToken].totalDeposited} {creatorRewardConfigs[creatorRewardToken].symbol}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {creatorRewardToken && ethers.utils.isAddress(creatorRewardToken) && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-start gap-2">
                    {isCreator ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="text-xs break-words">
                      {isCreator ? 'You are the creator' : 'You are not the creator'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    {hasClaimed ? (
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="text-xs break-words">
                      {hasClaimed ? 'Already claimed' : 'Available to claim'}
                    </span>
                  </div>
                  {parseFloat(availableRewards) > 0 && (
                    <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs sm:text-sm font-medium">Claimable:</span>
                        <span className="text-xs sm:text-sm font-semibold text-green-600 text-right break-all">
                          {availableRewards}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleClaim}
              disabled={
                loading ||
                (participantReward !== 'pending' && parseFloat(participantReward) === 0 && parseFloat(availableRewards) === 0)
              }
              className="w-full text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {(() => {
                const hasParticipantReward = participantReward === 'pending' || parseFloat(participantReward) > 0;
                const hasCreatorReward = parseFloat(availableRewards) > 0;
                
                if (hasParticipantReward && hasCreatorReward) {
                  return 'Claim Rewards';
                } else if (hasParticipantReward) {
                  return 'Claim Participant Reward';
                } else if (hasCreatorReward) {
                  return 'Claim Creator Reward';
                }
                return 'Claim Rewards';
              })()}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Withdraw Tab */}
      {activeTab === 'withdraw' && poolInfo && canWithdraw && (
        <Card className="w-full">
          <CardContent className="space-y-4 p-4">
            <div className="text-base font-medium flex items-center gap-2 mb-1">
              Withdraw Deposited Rewards
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Withdraw remaining rewards after all eligible slots have claimed
            </p>
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex flex-col gap-1 mb-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Total Deposited</span>
                  <span className="text-xs sm:text-sm text-right break-all">{poolInfo.totalDeposited} {poolInfo.token === ethers.constants.AddressZero ? 'ETH' : 'Tokens'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 mb-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Total Claimed</span>
                  <span className="text-xs sm:text-sm text-right break-all">{(parseFloat(poolInfo.totalDeposited) - parseFloat(remainingAmount)).toFixed(6)} {poolInfo.token === ethers.constants.AddressZero ? 'ETH' : 'Tokens'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Remaining to Withdraw</span>
                  <span className="text-xs sm:text-sm font-semibold text-right break-all">{remainingAmount} {poolInfo.token === ethers.constants.AddressZero ? 'ETH' : 'Tokens'}</span>
                </div>
              </div>
            </div>

            <Alert className="w-full">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                You can only withdraw rewards after all eligible slots have claimed or if the pool is in a terminal state (Deleted/Unengaged).
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleWithdraw}
              disabled={loading || parseFloat(remainingAmount) === 0}
              className="w-full text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Withdraw Remaining Rewards
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FlywheelRewardsComponent;
