import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveChainIdFromSlug } from '../utils/urlNetworks';
import { getAppRootUrl } from '../utils/subdomainUtils';
import { Ticket, Clock, Trophy, Users, ArrowLeft, AlertCircle, CheckCircle, DollarSign, Trash2, Info, ChevronDown, Twitter, MessageCircle, Send, Coins, Gift, Sparkles, Star } from 'lucide-react';
import { getPoolMetadata, hasAnyMetadata, formatSocialLink } from '../utils/poolMetadataService';
import { SUPPORTED_NETWORKS, DEFAULT_CHAIN_ID } from '../networks';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { PageContainer } from '../components/Layout';
import { toast } from '../components/ui/sonner';
import { notifyError } from '../utils/notificationService';
import { PageLoading, ContentLoading, BlockchainLoading, TransactionStatus } from '../components/ui/loading';
import { Badge } from '../components/ui/badge';
import { Progress, EnhancedProgress } from '../components/ui/progress';
import { RaffleErrorDisplay } from '../components/ui/raffle-error-display';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { useRaffleStateManager, useRaffleEventListener } from '../hooks/useRaffleService';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import SocialMediaVerification from '../components/SocialMediaVerification';
import PoolMetadataDisplay from '../components/PoolMetadataDisplay';
import signatureService from '../services/signatureService';
import verificationService from '../services/verificationService';
import purchaseAuthService from '../services/purchaseAuthService';
import supabaseService from '../services/supabaseService';
import { useRealtimePool } from '../hooks/useRealtimePool';
import { parseContractError, logContractError, formatErrorForDisplay } from '../utils/contractErrorHandler';
import {
  batchContractCalls,
  safeContractCall,
  getPlatformConfig,
  getBrowserInfo,
  hasContractMethod,
  createSafeMethod
} from '../utils/contractCallUtils';
import { useErrorHandler } from '../utils/errorHandling';
// Pool type detection and layout components
import { isNFTPrizedPool, getPoolType } from '../utils/poolTypeUtils';
import {
  PrizeImageCard as PrizeImageCardNew,
  RaffleDetailsCard,
  NFTPoolLayout,
  StandardPoolLayout,
  PoolActivity,
  WinnersSection
} from '../components/raffle';

const POOL_STATE_LABELS = [
  'Pending',
  'Active',
  'Ended',
  'Drawing',
  'Completed',
  'Deleted',
  'AllPrizesClaimed',
  'Unengaged'
];

// Note: Using parseContractError from contractErrorHandler for better custom error handling

// Helper function to safely convert slotFee to BigNumber
function safeSlotFeeToBigNumber(slotFee) {
  if (ethers.BigNumber.isBigNumber(slotFee)) {
    return slotFee;
  } else if (slotFee !== null && slotFee !== undefined) {
    return ethers.BigNumber.from(slotFee);
  } else {
    return ethers.BigNumber.from(0);
  }
}

// Utility function to check if ERC721 token selector should be shown
const shouldShowTokenSelector = (raffle) => {
  // Check if holder token address is set and not zero address
  if (!raffle.holderTokenAddress || raffle.holderTokenAddress === ethers.constants.AddressZero) {
    return false;
  }
  
  // Check if holder token standard is defined
  if (raffle.holderTokenStandard === undefined || raffle.holderTokenStandard === null) {
    return false;
  }
  
  const standard = raffle.holderTokenStandard.toNumber ? raffle.holderTokenStandard.toNumber() : Number(raffle.holderTokenStandard);
  return standard === 0; // ERC721 = 0 in contract enum
};

// Utility function to check if any token gating is required (ERC721, ERC1155, ERC20, etc.)
const hasTokenGating = (raffle) => {
  return raffle.holderTokenAddress && raffle.holderTokenAddress !== ethers.constants.AddressZero;
};

// Token Selector Component - Moved outside to prevent recreation
const TokenSelector = React.memo(({ raffle, selectedTokenIds, setSelectedTokenIds, loadingTokens, tokenError, userTokenIds }) => {

  // Safe conversion for display - handle BigNumber overflow and decimals
  let requiredTokensNumber = 1;
  try {
    const requiredTokens = raffle.minHolderTokenBalance;
    if (requiredTokens && requiredTokens.toString) {
      // Check if it's a large decimal number (like 1e18) and format it
      const tokenStr = requiredTokens.toString();
      if (tokenStr.length > 10) {
        // Likely a decimal value, format it to get the actual token count
        requiredTokensNumber = parseFloat(ethers.utils.formatUnits(requiredTokens, 18));
      } else if (requiredTokens.toNumber) {
        requiredTokensNumber = requiredTokens.toNumber();
      } else {
        requiredTokensNumber = Number(requiredTokens);
      }
    } else if (requiredTokens) {
      requiredTokensNumber = Number(requiredTokens);
    }
  } catch (error) {
    console.warn('Could not convert minHolderTokenBalance to number, using default 1:', error);
    requiredTokensNumber = 1;
  }
  
  const isMultiple = requiredTokensNumber > 1;
  
  // Manual token input state
  const [manualTokenInput, setManualTokenInput] = useState('');
  
  // Sync manual input when component mounts or tokenError changes
  useEffect(() => {
    if (tokenError && selectedTokenIds.length > 0) {
      setManualTokenInput(selectedTokenIds.join(', '));
    }
  }, [tokenError, selectedTokenIds]);
  
  if (loadingTokens) {
    return (
      <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Loading your tokens...</span>
        </div>
      </div>
    );
  }
  
  if (tokenError) {
    const isEnumerationError = tokenError.toLowerCase().includes('enumeration');
    
    return (
      <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
        {/* Show manual token input only for enumeration errors */}
        {isEnumerationError && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Token ID{requiredTokensNumber > 1 ? 's' : ''} manually:
            </label>
            <input
              type="text"
              value={manualTokenInput}
              onChange={(e) => {
                const newInput = e.target.value;
                setManualTokenInput(newInput);
                
                // Update selectedTokenIds immediately for real-time validation
                const tokenIds = newInput
                  .split(',')
                  .map(id => id.trim())
                  .filter(id => id && !isNaN(id))
                  .map(id => id.toString());
                console.log('Manual token input updated (real-time):', tokenIds);
                setSelectedTokenIds(tokenIds);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Prevent form submission
                }
              }}
              placeholder={requiredTokensNumber > 1 ? `Enter ${requiredTokensNumber} token IDs, separated by commas` : 'Enter token ID'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the token ID{requiredTokensNumber > 1 ? 's' : ''} you own from this collection. The Purchase button will enable automatically when valid token IDs are entered.
            </p>
          </div>
        )}
      </div>
    );
  }
  
  // Handle three distinct states: zero tokens, insufficient tokens, sufficient tokens
  if (userTokenIds.length === 0) {
    return (
      <div className="mb-4 p-4 border border-yellow-200 rounded-lg bg-yellow-50">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-600">
            You do not own any tokens from the required collection
          </span>
        </div>
      </div>
    );
  }
  
  if (userTokenIds.length < requiredTokensNumber) {
    return (
      <div className="mb-4 p-4 border border-yellow-200 rounded-lg bg-yellow-50">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-yellow-600">
            Your token balance of the required collection is insufficient
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="mb-3">
        <h4 className="text-sm font-medium text-gray-900">
          Select {requiredTokensNumber} token{requiredTokensNumber > 1 ? 's' : ''} to participate
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          {isMultiple 
            ? `Choose ${requiredTokensNumber} tokens from your collection`
            : 'Choose one token from your collection'
          }
        </p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {userTokenIds.map((tokenId) => {
          const isSelected = selectedTokenIds.includes(tokenId);
          const canSelect = !isMultiple || selectedTokenIds.length < requiredTokensNumber || isSelected;
          
          return (
            <button
              key={tokenId}
              onClick={() => {
                if (isMultiple) {
                  if (isSelected) {
                    setSelectedTokenIds(selectedTokenIds.filter(id => id !== tokenId));
                  } else if (selectedTokenIds.length < requiredTokensNumber) {
                    setSelectedTokenIds([...selectedTokenIds, tokenId]);
                  }
                } else {
                  setSelectedTokenIds([tokenId]);
                }
              }}
              disabled={!canSelect}
              className={`
                p-3 border rounded-lg text-center transition-all
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : canSelect
                    ? 'border-gray-300 hover:border-gray-400 bg-white text-gray-700'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <div className="text-xs font-mono">#{tokenId}</div>
              {isSelected && (
                <div className="text-xs mt-1">✓ Selected</div>
              )}
            </button>
          );
        })}
      </div>
      
      {isMultiple && (
        <div className="mt-3 text-xs text-gray-600">
          Selected: {selectedTokenIds.length} / {requiredTokensNumber} tokens
        </div>
      )}
    </div>
  );
});

TokenSelector.displayName = 'TokenSelector';

const TicketPurchaseSection = React.memo(({ raffle, onPurchase, timeRemaining, winners, shouldShowClaimPrize, prizeAlreadyClaimed, claimingPrize, handleClaimPrize, shouldShowClaimRefund, claimingRefund, handleClaimRefund, refundableAmount, isMintableERC721, isEscrowedPrize, isCollabPool, isPrized, isMobile, onStateChange, socialEngagementRequired, hasCompletedSocialEngagement }) => {
  const { connected, address, provider } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const { formatSlotFee, getCurrencySymbol } = useNativeCurrency();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userSlots, setUserSlots] = useState(0);
  const [winningChance, setWinningChance] = useState(null);
  
  // ERC721 Token ID Selection State
  const [selectedTokenIds, setSelectedTokenIds] = useState([]);
  const [userTokenIds, setUserTokenIds] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const [closingPool, setClosingPool] = useState(false);
  const [requestingRandomness, setRequestingRandomness] = useState(false);

  useEffect(() => {
    fetchUserSlots();
  }, [raffle.address, address, raffle.slotsSold]);

  // Auto-clamp quantity when available slots change (e.g., from real-time updates)
  useEffect(() => {
    const maxAllowed = Math.max(0, raffle.maxSlotsPerAddress - userSlots);
    const effectiveMax = Math.min(raffle.slotLimit - raffle.slotsSold, maxAllowed);
    if (effectiveMax > 0 && quantity > effectiveMax) {
      setQuantity(effectiveMax);
    }
  }, [raffle.slotsSold, userSlots, raffle.slotLimit, raffle.maxSlotsPerAddress]);

  // Fetch user's ERC721 tokens when needed
  useEffect(() => {
    if (shouldShowTokenSelector(raffle) && address && raffle.holderTokenAddress) {
      fetchUserTokens();
    }
  }, [raffle.address, address, raffle.holderTokenAddress, raffle.holderTokenStandard]);

  // Fetch user's ERC721 token IDs
  const fetchUserTokens = async () => {
    if (!address || !raffle.holderTokenAddress || !shouldShowTokenSelector(raffle)) {
      setUserTokenIds([]);
      return;
    }

    setLoadingTokens(true);
    setTokenError(null);
    
    try {
      const erc721Contract = new ethers.Contract(
        raffle.holderTokenAddress,
        ['function balanceOf(address) view returns (uint256)', 'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)'],
        provider
      );

      const balance = await erc721Contract.balanceOf(address);
      
      if (balance.toNumber() === 0) {
        setUserTokenIds([]);
        setTokenError('You do not own any tokens from the required collection');
        return;
      }

      // Try to fetch token IDs using ERC721Enumerable
      const tokenIds = [];
      try {
        for (let i = 0; i < balance.toNumber(); i++) {
          const tokenId = await erc721Contract.tokenOfOwnerByIndex(address, i);
          tokenIds.push(tokenId.toString());
        }
        setUserTokenIds(tokenIds);
      } catch (enumError) {
        // Contract doesn't support ERC721Enumerable
        setTokenError('Token collection does not support token enumeration. Please contact the raffle creator.');
        setUserTokenIds([]);
      }
    } catch (error) {
      console.error('Error fetching user tokens:', error);
      setTokenError('Failed to fetch your tokens. Please try again.');
      setUserTokenIds([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Handle token selection for single token requirement
  const handleSingleTokenSelection = (tokenId) => {
    setSelectedTokenIds([tokenId]);
  };

  // Handle token selection for multiple token requirement
  const handleMultipleTokenSelection = (tokenId) => {
    const maxTokens = raffle.minHolderTokenBalance;
    const maxTokensNumber = maxTokens ? (maxTokens.toNumber ? maxTokens.toNumber() : Number(maxTokens)) : 1;
    
    if (selectedTokenIds.includes(tokenId)) {
      // Remove token if already selected
      setSelectedTokenIds(selectedTokenIds.filter(id => id !== tokenId));
    } else if (selectedTokenIds.length < maxTokensNumber) {
      // Add token if under limit
      setSelectedTokenIds([...selectedTokenIds, tokenId]);
    }
  };

  // Validate token selection
  const isTokenSelectionValid = () => {
    console.log('Token Selection Validation Debug:', {
      shouldShowSelector: shouldShowTokenSelector(raffle),
      selectedTokenIds,
      selectedTokenIdsLength: selectedTokenIds.length,
      requiredTokens: raffle.minHolderTokenBalance,
      requiredTokensType: typeof raffle.minHolderTokenBalance
    });
    
    if (!shouldShowTokenSelector(raffle)) return true;
    
    const requiredTokens = raffle.minHolderTokenBalance;
    if (!requiredTokens) return false;
    
    // Convert requiredTokens to number for comparison
    let requiredTokensNumber = 1;
    try {
      if (requiredTokens.toString) {
        const tokenStr = requiredTokens.toString();
        if (tokenStr.length > 10) {
          // Likely a decimal value, format it to get the actual token count
          requiredTokensNumber = parseFloat(ethers.utils.formatUnits(requiredTokens, 18));
        } else if (requiredTokens.toNumber) {
          requiredTokensNumber = requiredTokens.toNumber();
        } else {
          requiredTokensNumber = Number(requiredTokens);
        }
      } else {
        requiredTokensNumber = Number(requiredTokens);
      }
    } catch (error) {
      console.warn('Error converting requiredTokens:', error);
      requiredTokensNumber = 1;
    }
    
    console.log('Validation Result:', {
      requiredTokensNumber,
      selectedLength: selectedTokenIds.length,
      isValid: selectedTokenIds.length >= requiredTokensNumber
    });
    
    return selectedTokenIds.length >= requiredTokensNumber;
  };
  
  // Get the actual required token count for contract comparison
  const getRequiredTokenCount = () => {
    const requiredTokens = raffle.minHolderTokenBalance;
    if (!requiredTokens) return 1;
    
    try {
      if (requiredTokens.toString) {
        const tokenStr = requiredTokens.toString();
        if (tokenStr.length > 10) {
          // Contract expects simple counts, but frontend stored as decimal
          return parseFloat(ethers.utils.formatUnits(requiredTokens, 18));
        } else if (requiredTokens.toNumber) {
          return requiredTokens.toNumber();
        } else {
          return Number(requiredTokens);
        }
      } else {
        return Number(requiredTokens);
      }
    } catch (error) {
      console.warn('Error converting requiredTokens:', error);
      return 1;
    }
  };



  const fetchUserSlots = async () => {
    if (!raffle.address || !address) {
      setUserSlots(0);
      setWinningChance(null);
      return;
    }
    try {
      const poolContract = getContractInstance(raffle.address, 'pool');
      if (!poolContract) return;
      const slots = await poolContract.slotsPurchased(address);
      setUserSlots(slots.toNumber ? slots.toNumber() : Number(slots));
      let totalSlots = 0;
      try {
        const participantsCount = await poolContract.getParticipantsCount();
        totalSlots = participantsCount.toNumber();
      } catch (error) {
        let index = 0;
        while (true) {
          try {
            await poolContract.participants(index);
            totalSlots++;
            index++;
          } catch {
            break;
          }
        }
      }
      if (totalSlots > 0 && slots > 0) {
        setWinningChance(((slots / totalSlots) * 100).toFixed(2));
      } else {
        setWinningChance(null);
      }
    } catch (e) {
      setUserSlots(0);
      setWinningChance(null);
    }
  };


  const handlePurchase = async (quantity, selectedTokenIds) => {
    if (!connected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    // Validate token selection for ERC721 pools
    console.log('Early Purchase Debug:', {
      selectedTokenIds,
      selectedTokenIdsLength: selectedTokenIds.length,
      minHolderTokenBalance: raffle.minHolderTokenBalance?.toString(),
      minHolderTokenBalanceType: typeof raffle.minHolderTokenBalance,
      minHolderTokenBalanceFormatted: raffle.minHolderTokenBalance ? ethers.utils.formatUnits(raffle.minHolderTokenBalance, 18) : 'N/A',
      holderTokenAddress: raffle.holderTokenAddress,
      holderTokenStandard: raffle.holderTokenStandard
    });
    
    if (!isTokenSelectionValid()) {
      const requiredTokens = raffle.minHolderTokenBalance;
      const requiredTokensNumber = requiredTokens ? (requiredTokens.toNumber ? requiredTokens.toNumber() : Number(requiredTokens)) : 1;
      toast.error(`Please select ${requiredTokensNumber} token${requiredTokensNumber > 1 ? 's' : ''} to participate`);
      return;
    }
    
    setLoading(true);
    try {
      await onPurchase(quantity, selectedTokenIds);
      // Optimistic update: immediately reflect purchased slots in UI
      setUserSlots(prev => prev + quantity);
      setQuantity(1);
      // Also re-fetch from contract for accuracy
      fetchUserSlots();
    } catch (error) {
      const errorDetails = formatErrorForDisplay(error, 'purchase tickets');
      logContractError(error, 'Purchase Tickets', { quantity, selectedTokenIds });
      notifyError(error, { action: 'purchaseSlots' });
    } finally {
      setLoading(false);
    }
  };

  const canPurchaseTickets = () => {
    // Allow purchases when pool is Active OR Live (startTime passed, pending state)
    const now = Math.floor(Date.now() / 1000);
    const raffleEndTime = raffle.startTime + raffle.duration;
    const isLive = raffle.state?.toLowerCase() === 'pending' && 
                   raffle.startTime && 
                   now >= raffle.startTime && 
                   now < raffleEndTime;
    
    // Disable purchases for the pool creator
    const isCreator = address?.toLowerCase() === raffle.creator?.toLowerCase();
    
    return !isCreator && ((raffle.state?.toLowerCase() === 'active' && now < raffleEndTime) || isLive);
  };

  const isRaffleActive = () => {
    return raffle.state?.toLowerCase() === 'active';
  };

  const isRaffleLive = () => {
    const now = Math.floor(Date.now() / 1000);
    return raffle.state?.toLowerCase() === 'pending' && 
           raffle.startTime && 
           now >= raffle.startTime && 
           raffle.slotsSold === 0;
  };

  const isRaffleEnded = () => {
    const now = Math.floor(Date.now() / 1000);
    const raffleEndTime = raffle.startTime + raffle.duration;
    return (raffle.state === 'Active' && now >= raffleEndTime) ||
           timeRemaining === 'Ended';
  };

  const canClosePool = () => {
    const now = Math.floor(Date.now() / 1000);
    const raffleEndTime = raffle.startTime + raffle.duration;
    const participantsCount = raffle.slotsSold;
    const isTokenGated = hasTokenGating(raffle);
    
    // For token-gated pools, calculate minimum required participants (50% of winnersCount)
    const minimumRequired = isTokenGated ? Math.ceil((raffle.winnersCount * 50) / 100) : raffle.winnersCount;
    
    // For token-gated pools, only show Close Pool if participants < 50% threshold
    // For non-token-gated pools, show Close Pool if participants < winnersCount
    return now >= raffleEndTime && 
           participantsCount < minimumRequired &&
           (raffle.state?.toLowerCase() === 'active' || raffle.state?.toLowerCase() === 'pending');
  };

  const canRequestRandomness = () => {
    const now = Math.floor(Date.now() / 1000);
    const raffleEndTime = raffle.startTime + raffle.duration;
    const participantsCount = raffle.slotsSold;
    const isTokenGated = hasTokenGating(raffle);
    
    // For token-gated pools, calculate minimum required participants (50% of winnersCount)
    const minimumRequired = isTokenGated ? Math.ceil((raffle.winnersCount * 50) / 100) : raffle.winnersCount;
    
    // For Ended pools (stateNum === 2), the state itself confirms time has passed
    if (raffle.stateNum === 2) {
      return participantsCount >= minimumRequired;
    } 
    // For Drawing pools (stateNum === 3), show button if more winners are needed (multi-batch selection)
    else if (raffle.stateNum === 3) {
      return raffle.winnersSelected < raffle.winnersCount;
    }
    // For Active pools that have passed endTime with sufficient participants
    else if (raffle.state?.toLowerCase() === 'active' && now >= raffleEndTime) {
      return participantsCount >= minimumRequired;
    }
    
    return false;
  };


  const handleClosePool = async () => {
    setClosingPool(true);
    try {
      const poolContract = getContractInstance(raffle.address, 'pool');
      if (!poolContract) throw new Error('Failed to get pool contract');
      
      // Preflight simulate to surface revert reason
      try {
        await poolContract.callStatic.closePool();
      } catch (simErr) {
        notifyError(simErr, { action: 'closePool', phase: 'preflight' });
        throw simErr;
      }
      
      const result = await executeTransaction(poolContract.closePool);
      if (result.success) {
        toast.success('Pool closed successfully!');
        // Trigger state refresh
        if (onStateChange) {
          onStateChange();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      const errorDetails = formatErrorForDisplay(err, 'close pool');
      logContractError(err, 'Close Pool');
      notifyError(err, { action: 'closePool' });
    } finally {
      setClosingPool(false);
    }
  };

  const handleRequestRandomness = async () => {
    setRequestingRandomness(true);
    try {
      const poolContract = getContractInstance(raffle.address, 'pool');
      if (!poolContract) throw new Error('Failed to get pool contract');
      // Preflight simulate to surface revert reason
      try {
        await poolContract.callStatic.requestRandomness();
      } catch (simErr) {
        notifyError(simErr, { action: 'requestRandomness', phase: 'preflight' });
        throw simErr;
      }
      const result = await executeTransaction(poolContract.requestRandomness);
      if (result.success) {
        toast.success('Randomness requested successfully!');
        // Trigger state refresh instead of page reload
        if (onStateChange) {
          onStateChange();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorDetails = formatErrorForDisplay(error, 'request randomness');
      logContractError(error, 'Request Randomness');
      notifyError(error, { action: 'requestRandomness' });
    } finally {
      setRequestingRandomness(false);
    }
  };

  // Prize claiming logic is now handled by parent component
  const canClaimPrize = () => shouldShowClaimPrize && !prizeAlreadyClaimed;

  const canClaimRefund = () => {
    // Global fee pools: Any pool that doesn't use custom fee (prized or non-prized)
    // Custom fee pools: Only prized pools with refundable flag
    const isGlobalFeePool = !raffle.usesCustomFee;
    const isCustomFeeRefundable = (isPrized === true) || (isCollabPool === true) || raffle.isPrized || raffle.isCollabPool;
    const refundableState = [4, 5, 6, 7].includes(raffle.stateNum); // Completed, Deleted, AllPrizesClaimed, Unengaged (value 7)
    
    return (
      (isGlobalFeePool || isCustomFeeRefundable) &&
      refundableState &&
      refundableAmount && refundableAmount.gt && refundableAmount.gt(0)
    );
  };

  const now = Math.floor(Date.now() / 1000);
  const canActivate = raffle && raffle.startTime ? now >= raffle.startTime : false;

  // Define maxPurchasable accounting for both global remaining and per-user remaining
  const remainingSlots = raffle.slotLimit - raffle.slotsSold;
  const userRemainingAllocation = Math.max(0, raffle.maxSlotsPerAddress - userSlots);
  const maxPurchasable = Math.min(remainingSlots, userRemainingAllocation);

  return (
    <div className="bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col min-h-[360px] sm:min-h-[380px] lg:min-h-[420px] overflow-hidden">
      <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-4 flex items-center justify-between">
        Purchase Slots
        {hasTokenGating(raffle) && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Token-Gated
          </span>
        )}
      </h3>

        {/* Reserve flexible space so the action area can stick to bottom even when content above grows */}

        <div className="flex-1 flex flex-col h-full gap-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
            <span className="text-muted-foreground flex items-center gap-2">Slot Fee:
              {typeof raffle.usesCustomFee === 'boolean' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center cursor-help" aria-label="Slot Fee info">
                      <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    {raffle.usesCustomFee === true ? 'Set by Creator' : 'Protocol Slot Fee'}
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
              <p className="font-body text-[length:var(--text-base)] font-medium">{formatSlotFee(raffle.slotFee || '0')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining slots:</span>
              <p className="font-body text-[length:var(--text-base)] font-medium">{raffle.slotLimit - raffle.slotsSold}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Your slots:</span>
            <p className="font-body text-[length:var(--text-base)] font-medium">{userSlots || 0}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Winning Chance:</span>
            <p className="font-body text-[length:var(--text-base)] font-medium">{winningChance !== null ? `${winningChance}%` : 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Max per user:</span>
              <p className="font-body text-[length:var(--text-base)] font-medium">{raffle.maxSlotsPerAddress}</p>
            </div>
            {canClaimRefund() && refundableAmount && refundableAmount.gt && refundableAmount.gt(0) && (
              <div>
                <span className="text-muted-foreground">Your Refundable Amount:</span>
                <p className="font-body text-[length:var(--text-base)] font-medium">
                  {ethers.utils.formatEther(refundableAmount)} {getCurrencySymbol()}
                </p>
              </div>
            )}
          <div></div>
          </div>

        {(raffle.stateNum === 4 || raffle.stateNum === 5 || raffle.stateNum === 6 || raffle.stateNum === 7) ? (
          <>
            <div className="mt-auto">
              {(canClaimPrize() || canClaimRefund()) ? (
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  {canClaimPrize() && (
                    <Button
                      onClick={handleClaimPrize}
                      disabled={claimingPrize || !connected}
                      variant="primary"
                      size="lg"
                      className="flex-1"
                    >
                      {claimingPrize
                        ? (!isEscrowedPrize ? 'Minting...' : 'Claiming...')
                        : (!isEscrowedPrize ? 'Mint' : 'Claim Prize')}
                    </Button>
                  )}
                  {canClaimRefund() && (
                    <Button
                      onClick={handleClaimRefund}
                      disabled={claimingRefund || !connected}
                      variant="primary"
                      size="lg"
                      className="flex-1"
                    >
                      {claimingRefund ? 'Claiming...' : 'Claim Refund'}
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  disabled
                  variant="primary"
                  size="lg"
                  className="w-full opacity-60 cursor-not-allowed"
                >
                  {raffle.state === 'Deleted' || raffle.stateNum === 5 ? 'Pool Deleted' : 'Pool Closed'}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="mt-auto">
            {/* Removed non-active desktop placeholder; rely on min-height */}
            {canClosePool() ? (
              <>
                <Button
                  onClick={handleClosePool}
                  disabled={closingPool}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  {closingPool ? 'Closing...' : (!hasTokenGating(raffle) && isEscrowedPrize && address?.toLowerCase() === raffle.creator.toLowerCase() ? 'Withdraw Prize' : 'Close Pool')}
                </Button>
                {connected &&
                  address?.toLowerCase() === raffle.creator.toLowerCase() &&
                  isEscrowedPrize && (
                    <p className="text-muted-foreground mt-4 text-center text-sm">
                      Closing this pool will automatically transfer the escrowed prize to your wallet
                    </p>
                  )}
              </>
            ) : canRequestRandomness() && (address?.toLowerCase() === raffle.creator.toLowerCase() || userSlots > 0) ? (
              <>
                <Button
                  onClick={handleRequestRandomness}
                  disabled={requestingRandomness}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  {requestingRandomness ? 'Requesting...' : 'Request Randomness'}
                </Button>
                <p className="text-muted-foreground mt-4 text-center text-sm">
                  {raffle.stateNum === 3 
                    ? `Batch ${Math.ceil(raffle.winnersSelected / 25)} complete. ${raffle.winnersCount - raffle.winnersSelected} more winner${raffle.winnersCount - raffle.winnersSelected !== 1 ? 's' : ''} needed. ${address?.toLowerCase() === raffle.creator.toLowerCase() ? 'As the creator' : 'As a participant'}, you can request the next batch.`
                    : `The pool has ended. ${address?.toLowerCase() === raffle.creator.toLowerCase() ? 'As the creator' : 'As a participant'}, you can request the randomness to initiate winner selection.`
                  }
                </p>
              </>
            ) : (raffle.state === 'Completed' || raffle.stateNum === 4 || raffle.stateNum === 6 || raffle.state === 'Deleted' || raffle.stateNum === 5) ? (
              <Button
                disabled
                variant="primary"
                size="lg"
                className="w-full opacity-60 cursor-not-allowed"
              >
                {raffle.state === 'Deleted' || raffle.stateNum === 5 ? 'Pool Deleted' : 'Pool Closed'}
              </Button>
            ) : maxPurchasable <= 0 ? (
              <Button
                disabled
                variant="primary"
                size="lg"
                className="w-full opacity-60 cursor-not-allowed"
              >
                {raffle.state === 'Deleted' || raffle.stateNum === 5
                  ? 'Pool Deleted'
                  : remainingSlots <= 0
                    ? 'All Slots Sold'
                    : userRemainingAllocation <= 0
                      ? 'Limit Reached'
                      : 'Pool Closed'}
              </Button>
        ) : (
            <>
              {/* Show quantity and cost inputs only when tickets can be purchased */}
              {canPurchaseTickets() ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      max={maxPurchasable || 1}
                      value={quantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === null || value === undefined) {
                          setQuantity(1);
                        } else {
                          const parsedValue = parseInt(value);
                          if (isNaN(parsedValue)) {
                            setQuantity(1);
                          } else {
                            setQuantity(Math.max(1, Math.min(maxPurchasable || 1, parsedValue)));
                          }
                        }
                      }}
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-card text-card-foreground transition-colors focus:ring-primary focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1 flex items-center justify-between gap-2">
                      <span 
                        className="cursor-pointer hover:text-primary hover:underline transition-colors"
                        onClick={() => setQuantity(Math.max(1, maxPurchasable))}
                        title="Click to set quantity to maximum"
                      >
                        Max: {maxPurchasable} slots remaining
                      </span>
                      <span className="font-medium">
                        Total: {formatSlotFee(safeSlotFeeToBigNumber(raffle.slotFee).mul(isNaN(quantity) ? 1 : quantity))}
                      </span>
                    </p>
                  </div>
                </>
              ) : null}
              
              {/* ERC721 Token Selector */}
              {shouldShowTokenSelector(raffle) && (
                <TokenSelector 
                  raffle={raffle} 
                  selectedTokenIds={selectedTokenIds} 
                  setSelectedTokenIds={setSelectedTokenIds} 
                  loadingTokens={loadingTokens} 
                  tokenError={tokenError} 
                  userTokenIds={userTokenIds} 
                />
              )}
              
              {!connected && (
                <p className="text-center text-sm font-medium text-muted-foreground">
                  Connect Wallet
                </p>
              )}
              <Button
                onClick={() => handlePurchase(quantity, selectedTokenIds)}
                disabled={loading || !connected || !canPurchaseTickets() || maxPurchasable <= 0 || quantity > maxPurchasable || (socialEngagementRequired && !hasCompletedSocialEngagement) || !isTokenSelectionValid()}
                variant="primary"
                size="lg"
                className="w-full shadow-sm"
              >
                {loading ? 'Processing...' : `Purchase ${quantity} Slot${quantity > 1 ? 's' : ''}`}
              </Button>
              {socialEngagementRequired && !hasCompletedSocialEngagement && address?.toLowerCase() !== raffle.creator?.toLowerCase() && (
                <div className="text-center pt-1.5">
                  <p className="text-muted-foreground text-sm">
                    Complete social media verification to enable slot purchase.
                  </p>
                </div>
              )}
              {address?.toLowerCase() === raffle.creator?.toLowerCase() && (
                <div className="text-center pt-1.5">
                  <p className="text-muted-foreground text-sm">
                    You cannot purchase slots from your own pool.
                  </p>
                </div>
              )}
            </>
            )}
          </div>
        )}


        </div>
    </div>
  );
});

const PrizeImageCard = ({ raffle, isMintableERC721, isEscrowedPrize }) => {
  const { getContractInstance } = useContract();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchSource, setFetchSource] = useState(null); // Track successful source for debugging
  const [suppressRender, setSuppressRender] = useState(false); // For mintable ERC721 with no unrevealedBaseURI
  // Image gateway fallback state
  const [imageCandidates, setImageCandidates] = useState([]);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  // Track the last fetched collection to prevent re-fetching on raffle object updates
  const lastFetchedRef = useRef(null);

  // Multiple gateways for decentralized URIs
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
  ];
  const IPNS_GATEWAYS = IPFS_GATEWAYS.map(g => g.replace('/ipfs/', '/ipns/'));
  const ARWEAVE_GATEWAYS = [
    'https://arweave.net/'
  ];

  // Classify URI format for appropriate processing
  const classifyURI = (uri) => {
    if (uri.includes('.json')) return 'explicit_json';
    if (uri.match(/\/\d+$/)) return 'numeric_endpoint';
    if (uri.includes('{id}')) return 'template_format';
    if (uri.endsWith('/')) return 'base_directory';
    return 'unknown_format';
  };

  // Generate multiple URI variants prioritizing extensionless formats
  // For ERC1155, also include 64-hex {id} style even when baseUri lacks {id}, and consider root candidates
  // For ERC721, try baseUri/root earlier when tokenURI likely points to unrevealed or a shared resource
  const constructMetadataURIs = (baseUri, tokenId, standard, opts = {}) => {
    const uriVariants = [];
    const hadTrailingSlash = /\/$/.test(baseUri);
    const cleanBaseUri = baseUri.replace(/\/$/, ''); // Remove trailing slash

    // Be tolerant when tokenId is undefined/null for mintable/unrevealed cases
    const tokenIdStr = (tokenId !== undefined && tokenId !== null) ? tokenId.toString() : '0';
    const tokenIdBig = (tokenId !== undefined && tokenId !== null) ? BigInt(tokenId) : 0n;
    const hexIdLower = tokenIdBig.toString(16).padStart(64, '0');
    const hexIdUpper = hexIdLower.toUpperCase();
    const isERC1155 = standard === 1;
    const isERC721 = standard === 0;

    // Helper: add root candidates (with and without slash)
    const addRootCandidates = (uri) => {
      const candidates = [];
      const root = uri.replace(/\/?(?:[0-9]+|[a-fA-F0-9]{64})(?:\.json)?$/, '');
      if (root && root !== uri) {
        candidates.push(root);
        candidates.push(`${root}/`);
        // Common root index files
        candidates.push(`${root}/index.json`);
        candidates.push(`${root}/metadata.json`);
      }
      return candidates;
    };

    // Check if the URI already contains the token ID (like tokenURI responses)
    const alreadyContainsTokenId =
      baseUri.match(/\/(?:[0-9]+|[a-fA-F0-9]{64})(?:\.json)?$/) !== null;

    if (alreadyContainsTokenId) {
      // For ERC1155, try collection root early (helps unrevealed/shared)
      if (isERC1155 || opts.prioritizeRoot) {
        uriVariants.push(...addRootCandidates(baseUri));
      }

      // Priority 1: Original URI as-is (tokenURI)
      uriVariants.push(baseUri);

      // Priority 2 (ERC721 requirement): tokenURI + ".json" next
      if (!baseUri.includes('.json')) uriVariants.push(`${baseUri}.json`);

      // For ERC721, only consider root candidates AFTER trying tokenURI and tokenURI.json
      if (isERC721) {
        uriVariants.push(...addRootCandidates(baseUri));
      }

      // ERC1155-specific: also try hex-64 variants when the tokenId appears in the URL
      if (isERC1155) {
        const replaceDecimalWithHex = (uri, alsoJson = true) => {
          const out = [];
          if (uri.match(new RegExp(`/${tokenIdStr}(?:\\.json)?$`))) {
            out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdLower}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdLower}.json`));
            // Uppercase variant (rare)
            out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdUpper}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdUpper}.json`));
          }
          if (uri.match(new RegExp(`${tokenIdStr}(?:\\.json)?$`))) {
            out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdLower}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdLower}.json`));
            out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdUpper}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdUpper}.json`));
          }
          return out;
        };
        uriVariants.push(...replaceDecimalWithHex(baseUri, true));
      }
    } else {
      if (isERC1155) {
        // Try base URI root early
        uriVariants.push(baseUri);
        if (hadTrailingSlash) uriVariants.push(cleanBaseUri + '/');
        // Add common root JSON filenames and baseUri.json (mirroring ERC721 robustness)
        uriVariants.push(`${cleanBaseUri}.json`);
        uriVariants.push(`${cleanBaseUri}/index.json`);
        uriVariants.push(`${cleanBaseUri}/metadata.json`);

        // Priority 1 (ERC1155): hex without extension first
        uriVariants.push(`${cleanBaseUri}/${hexIdLower}`);
        uriVariants.push(`${cleanBaseUri}${hexIdLower}`);
        // Priority 2 (ERC1155): hex.json
        uriVariants.push(`${cleanBaseUri}/${hexIdLower}.json`);
        uriVariants.push(`${cleanBaseUri}${hexIdLower}.json`);
        // Also try uppercase hex (rare)
        uriVariants.push(`${cleanBaseUri}/${hexIdUpper}`);
        uriVariants.push(`${cleanBaseUri}${hexIdUpper}`);
        uriVariants.push(`${cleanBaseUri}/${hexIdUpper}.json`);
        uriVariants.push(`${cleanBaseUri}${hexIdUpper}.json`);
        // Priority 3 (ERC1155): decimal without extension
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}`);
        // Priority 4 (ERC1155): decimal.json
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}.json`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}.json`);
      } else {
        // ERC721: try baseUri earlier (unrevealed/shared)
        uriVariants.push(baseUri);
        if (hadTrailingSlash) uriVariants.push(cleanBaseUri + '/');
        // Also try common root JSON filenames and baseUri.json
        uriVariants.push(`${cleanBaseUri}.json`);
        uriVariants.push(`${cleanBaseUri}/index.json`);
        uriVariants.push(`${cleanBaseUri}/metadata.json`);
        // Keep previous priority (extensionless decimal first)
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}`);
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}.json`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}.json`);
      }

      // Template formats
      if (baseUri.includes('{id}')) {
        // Prefer hex first for ERC1155
        uriVariants.push(baseUri.replace('{id}', hexIdLower));
        uriVariants.push(baseUri.replace('{id}', tokenIdStr));
        // Upper hex variant (rare)
        uriVariants.push(baseUri.replace('{id}', hexIdUpper));
      }
    }

    return [...new Set(uriVariants)]; // Remove duplicates
  };

  // Convert decentralized URIs (ipfs/ipns/ar) and normalize common HTTP gateways to multiple gateway variants
  const convertDecentralizedToHTTP = (uri) => {
    if (!uri) return [];

    // IPFS (ipfs://)
    if (uri.startsWith('ipfs://')) {
      let hash = uri.replace('ipfs://', '');
      if (hash.startsWith('ipfs/')) hash = hash.slice('ipfs/'.length); // normalize ipfs://ipfs/
      return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
    }

    // IPNS (ipns://)
    if (uri.startsWith('ipns://')) {
      let name = uri.replace('ipns://', '');
      if (name.startsWith('ipns/')) name = name.slice('ipns/'.length);
      return IPNS_GATEWAYS.map(gateway => `${gateway}${name}`);
    }

    // Arweave (ar://)
    if (uri.startsWith('ar://')) {
      const id = uri.replace('ar://', '');
      return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
    }

    // If HTTP(s) to a known IPFS/IPNS/Arweave gateway, normalize and fan out
    try {
      const u = new URL(uri);
      // Fix accidental double ipfs segment in HTTP URLs (e.g., /ipfs/ipfs/<hash>)
      let pathname = u.pathname.replace(/\/ipfs\/ipfs\//, '/ipfs/');
      const parts = pathname.split('/').filter(Boolean);

      const ipfsIndex = parts.indexOf('ipfs');
      if (ipfsIndex !== -1 && parts[ipfsIndex + 1]) {
        const hashAndRest = parts.slice(ipfsIndex + 1).join('/');
        return IPFS_GATEWAYS.map(gateway => `${gateway}${hashAndRest}`);
      }

      const ipnsIndex = parts.indexOf('ipns');
      if (ipnsIndex !== -1 && parts[ipnsIndex + 1]) {
        const nameAndRest = parts.slice(ipnsIndex + 1).join('/');
        return IPNS_GATEWAYS.map(gateway => `${gateway}${nameAndRest}`);
      }

      // Arweave gateway (e.g., arweave.net/<id>)
      if (u.hostname.endsWith('arweave.net') || u.hostname === 'arweave.net') {
        const id = parts.join('/');
        return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
      }
    } catch (_) {
      // not a URL, fall through
    }

    // Fallback: return as-is
    return [uri];
  };

  // Extract image URL from metadata with flexible field support
  const extractImageURL = (metadata) => {
    const mediaFields = [
      'image',
      'image_url',
      'imageUrl',
      'animation_url',
      'animationUrl',
      'media',
      'artwork'
    ];

    const normalizeIpfs = (u) => {
      if (!u) return null;
      if (u.startsWith('ipfs://')) {
        // Strip protocol and any leading 'ipfs/' segment
        let rest = u.slice('ipfs://'.length);
        if (rest.startsWith('ipfs/')) rest = rest.slice('ipfs/'.length);
        // Build multiple-gateway HTTP URLs as candidates
        const candidates = IPFS_GATEWAYS.map(gateway => `${gateway}${rest}`);
        return candidates; // Return array to support gateway fallback
      }
      if (u.startsWith('ipns://')) {
        let rest = u.slice('ipns://'.length);
        if (rest.startsWith('ipns/')) rest = rest.slice('ipns/'.length);
        const candidates = IPNS_GATEWAYS.map(gateway => `${gateway}${rest}`);
        return candidates;
      }
      if (u.startsWith('ar://')) {
        const rest = u.slice('ar://'.length);
        const candidates = ARWEAVE_GATEWAYS.map(gateway => `${gateway}${rest}`);
        return candidates;
      }
      return [u]; // Normalize to array
    };

    for (const field of mediaFields) {
      if (metadata[field]) {
        const raw = metadata[field];
        const urls = normalizeIpfs(String(raw)); // returns array
        return urls;
      }
    }

    return null;
  };

  // Handle media (image/video) fallback across multiple gateways
  const handleMediaError = () => {
    if (Array.isArray(imageCandidates) && imageCandidateIndex + 1 < imageCandidates.length) {
      setImageCandidateIndex(imageCandidateIndex + 1);
      setImageUrl(imageCandidates[imageCandidateIndex + 1]);
    } else {
      setImageUrl(null);
    }
  };

  // Enhanced fetch with timeout and error handling
  const fetchWithTimeout = async (url, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Cascading fetch strategy with fallback
  const fetchMetadataWithFallback = async (uriVariants, timeoutMs = 10000) => {
    for (const uri of uriVariants) {
      try {
        // Support data: URIs (on-chain metadata or direct images)
        if (uri.startsWith('data:')) {
          // Example: data:application/json;base64,eyJpbWFnZSI6ICJpcGZzOi8vLi4uIn0=
          const [meta, payload] = uri.split(',', 2);
          const [, mime, encoding] = meta.match(/^data:([^;]+);([^,]+)$/) || [];
          if (mime?.includes('application/json') && encoding === 'base64') {
            const json = JSON.parse(atob(payload));
            const imageUrl = extractImageURL(json) || null;
            if (imageUrl) return { metadata: json, imageUrl, sourceUri: uri };
          } else if (mime?.startsWith('image/') || mime?.startsWith('video/')) {
            // Direct media data URL (image/video)
            return { metadata: { image: uri }, imageUrl: uri, sourceUri: uri };
          }
          // If unsupported data URI, continue to next
          continue;
        }

        const response = await fetchWithTimeout(uri, timeoutMs);

        if (response.ok) {
          const contentType = response.headers.get('content-type');

          // Try to parse as JSON
          try {
            const text = await response.text();
            // Some gateways send text/plain; try JSON.parse regardless
            const metadata = JSON.parse(text);
            if (metadata && typeof metadata === 'object') {
              const imageUrl = extractImageURL(metadata);
              if (imageUrl) {
                return { metadata, imageUrl, sourceUri: uri };
              }
            }
          } catch (jsonError) {
            // If JSON parsing fails, check if response is an image or URL points to image
            if (
              contentType?.startsWith('image/') ||
              contentType?.startsWith('video/') ||
              uri.match(/\.(jpg|jpeg|png|gif|svg|webp|mp4|webm|ogg)$/i)
            ) {
              return { metadata: { image: uri }, imageUrl: uri, sourceUri: uri };
            }
          }
        }
      } catch (error) {
        continue; // Try next variant
      }
    }

    throw new Error('All metadata fetch attempts failed');
  };

  // Main fetch function with enhanced logic
  useEffect(() => {
    let isMounted = true;

    async function fetchPrizeImageEnhanced() {
      // Check if we should attempt to fetch (same logic as render condition)
      const shouldFetch = raffle.isPrized ||
        (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) ||
        (raffle.standard !== undefined && raffle.prizeTokenId !== undefined);

      if (!shouldFetch) {
        return;
      }

      // Create a unique key based on collection, token ID, and standard only.
      // Deliberately exclude isEscrowedPrize: once artwork is fetched successfully,
      // it must be preserved even if isEscrowedPrize toggles from real-time updates.
      const fetchKey = `${raffle.prizeCollection}-${raffle.prizeTokenId}-${raffle.standard}`;

      // Skip if we've already successfully fetched for this exact key
      if (lastFetchedRef.current === fetchKey && imageUrl) {
        return;
      }

      // Only show loading state if we don't already have an image
      if (!imageUrl) {
        setLoading(true);
      }

      try {
        // Step 1: Get base URI from contract
        let baseUri = null;
        const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';
        const contract = getContractInstance(raffle.prizeCollection, contractType);

        // Determine mintable vs escrowed using isEscrowedPrize flag only
        // Mintable when not escrowed; Escrowed when isEscrowedPrize is true
        const isMintable = isEscrowedPrize ? false : true;



        if (!contract) {
          if (!isMounted) return;
          setImageUrl(null);
          setLoading(false);
          return;
        }

        if (raffle.standard === 0) {
          // ERC721 Prize Logic
          if (isMintable) {
            try {
              baseUri = await contract.unrevealedBaseURI();
              // If empty/unavailable, suppress rendering per requirement
              if (!baseUri || baseUri.trim() === '') {
                if (!isMounted) return;
                setSuppressRender(true);
                setImageUrl(null);
                setLoading(false);
                return;
              }
            } catch (error) {
              // unrevealedBaseURI unavailable: suppress render
              if (!isMounted) return;
              setSuppressRender(true);
              setImageUrl(null);
              setLoading(false);
              return;
            }
          } else {
            try {
              baseUri = await contract.tokenURI(raffle.prizeTokenId);
            } catch (error) {
              if (!isMounted) return;
              setImageUrl(null);
              setLoading(false);
              return;
            }
          }
        } else if (raffle.standard === 1) {
          // ERC1155 Prize Logic
          if (isMintable) {
            let unrevealedUri = null;
            let tokenUri = null;
            let revealed = null;

            try {
              unrevealedUri = await contract.unrevealedURI();
            } catch (error) {
              // ignore
            }

            try {
              tokenUri = await contract.tokenURI(raffle.prizeTokenId);
            } catch (error) {
              // ignore
            }

            // Check reveal state to decide which URI to prefer
            try {
              revealed = await contract.isRevealed();
            } catch (error) {
              revealed = null; // Unknown; fall back to previous preference order
            }

            if (revealed === false) {
              // Pre-reveal: prefer unrevealedURI
              if (unrevealedUri && unrevealedUri.trim() !== '') {
                baseUri = unrevealedUri;
              } else if (tokenUri && tokenUri.trim() !== '') {
                baseUri = tokenUri;
              } else {
                // Fallback to uri() method
                try {
                  const tokenIdForCall = raffle?.prizeTokenId;
                  baseUri = await contract.uri(tokenIdForCall);
                } catch (fallbackError) {
                  if (!isMounted) return;
                  setImageUrl(null);
                  setLoading(false);
                  return;
                }
              }
            } else if (revealed === true) {
              // Post-reveal: prefer tokenURI
              if (tokenUri && tokenUri.trim() !== '') {
                baseUri = tokenUri;
              } else {
                // Fallback to uri() method; if that fails, try unrevealedURI as last resort
                try {
                  baseUri = await contract.uri(raffle.prizeTokenId);
                } catch (fallbackError) {
                  if (unrevealedUri && unrevealedUri.trim() !== '') {
                    baseUri = unrevealedUri;
                  } else {
                    if (!isMounted) return;
                    setImageUrl(null);
                    setLoading(false);
                    return;
                  }
                }
              }
            } else {
              // Unknown reveal state: keep prior behavior (prefer tokenURI)
              if (tokenUri && tokenUri.trim() !== '') {
                baseUri = tokenUri;
              } else if (unrevealedUri && unrevealedUri.trim() !== '') {
                baseUri = unrevealedUri;
              } else {
                try {
                  baseUri = await contract.uri(raffle.prizeTokenId);
                } catch (fallbackError) {
                  if (!isMounted) return;
                  setImageUrl(null);
                  setLoading(false);
                  return;
                }
              }
            }
          } else {
            try {
              baseUri = await contract.uri(raffle.prizeTokenId);
            } catch (error) {
              if (!isMounted) return;
              setImageUrl(null);
              setLoading(false);
              return;
            }
          }
        } else {
          if (!isMounted) return;
          setImageUrl(null);
          setLoading(false);
          return;
        }

        if (!baseUri || baseUri.trim() === '') {
          if (!isMounted) return;
          setImageUrl(null);
          setLoading(false);
          return;
        }

        // Step 2: Generate URI variants (pass standard for ERC1155 hex logic)
        const uriVariants = constructMetadataURIs(baseUri, raffle.prizeTokenId, raffle.standard);

        // Step 3: Convert decentralized URIs (IPFS/IPNS/Arweave) and HTTP gateways to multiple gateways
        const allURIs = [];
        for (const variant of uriVariants) {
          allURIs.push(...convertDecentralizedToHTTP(variant));
        }

        // Step 4: Attempt fetch with cascading fallback
        // Optimization: use a shorter timeout for mintable ERC721 unrevealed URIs to reduce perceived latency
        const timeoutMs = (raffle.standard === 0 && isMintable) ? 5000 : 10000;
        const result = await fetchMetadataWithFallback(allURIs, timeoutMs);

        // Build media candidates for gateway fallback
        const imgCandidates = Array.isArray(result.imageUrl) ? result.imageUrl : [result.imageUrl];
        if (!isMounted) return;
        setImageCandidates(imgCandidates);
        setImageCandidateIndex(0);
        setImageUrl(imgCandidates[0]);
        setFetchSource(result.sourceUri);
        lastFetchedRef.current = fetchKey;

      } catch (error) {
        if (isMounted) {
          setImageUrl(null);
          setFetchSource(null);
        }
      }

      if (isMounted) setLoading(false);
    }

    // Trigger fetch only when all prize conditions are met (no dependency on isCollabPool)
    const eligiblePrize = (
      raffle?.isPrized === true &&
      raffle?.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero &&
      (raffle?.standard === 0 || raffle?.standard === 1)
    );

    if (eligiblePrize) fetchPrizeImageEnhanced();

    return () => { isMounted = false; };
  }, [raffle?.prizeCollection, raffle?.prizeTokenId, raffle?.standard, raffle?.isPrized, raffle?._backendArtworkUrl, getContractInstance, isEscrowedPrize]);

  // Render only when prize conditions are met (no dependency on isCollabPool)
  const shouldRender = (
    raffle?.isPrized === true &&
    raffle?.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero &&
    (raffle?.standard === 0 || raffle?.standard === 1)
  );

  if (!shouldRender) {
    return null;
  }

  // Show loading state
  if (loading) {
    return (
      <Card className="detail-beige-card h-full flex flex-col items-center justify-center text-foreground border border-border rounded-xl">
        <CardContent className="flex flex-col items-center justify-center">
          <div className="w-64 h-64 flex items-center justify-center border rounded-lg bg-muted/30">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading prize media...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no image URL after loading
  if (!imageUrl) {

    return null;
  }

  const isVideo = typeof imageUrl === 'string' && /\.(mp4|webm|ogg)$/i.test(imageUrl);

  return (
    <Card className="detail-beige-card h-full flex flex-col items-center justify-center text-foreground border border-border rounded-xl">
      <CardContent className="flex flex-col items-center justify-center">
        {isVideo ? (
          <video
            src={imageUrl}
            className="w-64 h-64 object-contain rounded-lg border"
            style={{ background: '#000' }}
            controls
            playsInline
            onError={handleMediaError}
          />
        ) : (
          <img
            src={imageUrl}
            alt="Prize Art"
            className="w-64 h-64 object-contain rounded-lg border"
            style={{ background: '#fff' }}
            onError={handleMediaError}
          />
        )}
      </CardContent>
    </Card>
  );
};

function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0 || days > 0) formatted += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m`;
  if (!formatted) formatted = '0m';
  return formatted.trim();
}

function ERC20PrizeAmount({ token, amount }) {
  const [symbol, setSymbol] = React.useState('TOKEN');
  React.useEffect(() => {
    let isMounted = true;
    async function fetchSymbol() {
      try {
        if (!window.__erc20SymbolCache) window.__erc20SymbolCache = {};
        if (window.__erc20SymbolCache[token]) {
          setSymbol(window.__erc20SymbolCache[token]);
          return;
        }
        const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
        const erc20Abi = ["function symbol() view returns (string)"];
        const contract = new ethers.Contract(token, erc20Abi, provider);
        const sym = await contract.symbol();
        if (isMounted) {
          setSymbol(sym);
          window.__erc20SymbolCache[token] = sym;
        }
      } catch {
        if (isMounted) setSymbol('TOKEN');
      }
    }
    fetchSymbol();
    return () => { isMounted = false; };
  }, [token]);
  return (
    <div className="flex justify-between">
      <span className="text-foreground/80 dark:text-foreground">Prize Amount:</span>
      <span>{ethers.utils.formatUnits(amount, 18)} {symbol}</span>
    </div>
  );
}

function getRefundability(raffle) {
  if (!raffle) return { label: 'Non-Refundable', refundable: false, reason: 'Unknown' };
  if (raffle.state === 'Deleted') {
    return { label: 'All Slots Refundable', refundable: true, reason: 'Raffle was deleted before ending. All slots are refundable.' };
  }
  
  // Global slot fee pools: 80% refund for all participants
  if (!raffle.usesCustomFee) {
    return { label: 'Slot Fees Refundable', refundable: true, reason: 'This raffle uses the global slot fee. All participants can claim 80% refunds after completion.' };
  }
  
  // Custom fee pools: existing logic
  if (raffle.isPrized && raffle.winnersCount === 1 && raffle.standard !== undefined && (raffle.standard === 0 || raffle.standard === 1)) {
    return { label: 'Slots Refundable if Deleted', refundable: false, reason: 'Single-winner NFT raffles are not refundable unless deleted before ending.' };
  }
  return { label: 'Non-winning Slots Refundable', refundable: true, reason: 'This raffle supports refunds for non-winning slots.' };
}

// Enhanced getExplorerLink: accepts optional chainId, prefers raffle/app context over window.ethereum
// Supports both address and transaction hash links
function getExplorerLink(addressOrTx, chainIdOverride, isTransaction = false) {
  let chainId = 1;
  if (typeof chainIdOverride === 'number') {
    chainId = chainIdOverride;
  } else if (window.ethereum && window.ethereum.chainId) {
    chainId = parseInt(window.ethereum.chainId, 16);
  }
  const explorerMap = {
    1: 'https://etherscan.io',
    5: 'https://goerli.etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    80001: 'https://mumbai.polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    420: 'https://goerli-optimism.etherscan.io',
    42161: 'https://arbiscan.io',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    43114: 'https://snowtrace.io',
    43113: 'https://testnet.snowtrace.io',
    8453: 'https://basescan.org',
    84531: 'https://goerli.basescan.org',
    84532: 'https://sepolia.basescan.org',
    11155420: 'https://sepolia-optimism.etherscan.io', // OP Sepolia
  };
  const baseUrl = explorerMap[chainId] || explorerMap[1];
  const path = isTransaction ? 'tx' : 'address';
  return `${baseUrl}/${path}/${addressOrTx}`;
}



// PrizeTypes.Standard enum mapping
const PRIZE_TYPE_OPTIONS = [
  { label: 'ERC721', value: 0 },
  { label: 'ERC1155', value: 1 },
];

const RaffleDetailPage = () => {
  const { raffleAddress } = useParams();
  const params = useParams();
  const chainSlug = params.chainSlug;

  const navigate = useNavigate();
  const { connected, address, provider, isInitialized, isReconnecting } = useWallet();
  const { getContractInstance, executeTransaction, isContractsReady, contracts } = useContract();
  const { isMobile } = useMobileBreakpoints();
  const { formatSlotFee, formatPrizeAmount, getCurrencySymbol } = useNativeCurrency();
  const makeSharePath = useCallback(() => {
    const currentChainId = provider?.network?.chainId;
    const nameSlug = currentChainId && SUPPORTED_NETWORKS[currentChainId]
      ? SUPPORTED_NETWORKS[currentChainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : (currentChainId || '');
    return `${nameSlug ? `/${nameSlug}` : ''}/pool/${raffleAddress}`;
  }, [provider, raffleAddress]);

  const { refreshTrigger, triggerRefresh } = useRaffleStateManager();
  const { handleError } = useErrorHandler();

  // State declarations first
  const [raffle, setRaffle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isEscrowedPrize, setIsEscrowedPrize] = useState(false);
  const [raffleCollectionName, setRaffleCollectionName] = useState(null);
  const [gatingTokenName, setGatingTokenName] = useState(null);
  const [deletingRaffle, setDeletingRaffle] = useState(false);
  const [hasCompletedSocialEngagement, setHasCompletedSocialEngagement] = useState(false);

  // Auto-refresh state for Drawing state monitoring
  const [lastDrawingStateTime, setLastDrawingStateTime] = useState(null);
  const [autoRefreshCount, setAutoRefreshCount] = useState(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [isRefundable, setIsRefundable] = useState(null);
  const [isCollabPool, setIsCollabPool] = useState(false);
  const [poolMetadata, setPoolMetadata] = useState(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [poolActivity, setPoolActivity] = useState([]);
  const [backendDataLoaded, setBackendDataLoaded] = useState(false);

  // Claim Points state
  const [canClaimParticipantPoints, setCanClaimParticipantPoints] = useState(false);
  const [canClaimCreatorPoints, setCanClaimCreatorPoints] = useState(false);
  const [claimingPoints, setClaimingPoints] = useState(false);
  const [pointsSystemActive, setPointsSystemActive] = useState(false);
  // If URL includes a chain slug, gently ensure wallet is on the right network
  useEffect(() => {
    async function ensureNetworkFromUrl() {
      if (!chainSlug) return; // no slug provided, skip
      const targetChainId = resolveChainIdFromSlug(chainSlug);
      if (!targetChainId) return;
      // If wallet not connected yet, do nothing; switching will be prompted later when needed
      if (!connected || !window.ethereum) return;
      try {
        if (provider?.network?.chainId !== targetChainId) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${targetChainId.toString(16)}` }],
            });
          } catch (switchErr) {
            // If not added, try to add
            if (switchErr?.code === 4902 && SUPPORTED_NETWORKS[targetChainId]) {
              const net = SUPPORTED_NETWORKS[targetChainId];
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${targetChainId.toString(16)}`,
                  chainName: net.name,
                  rpcUrls: [net.rpcUrl],
                  blockExplorerUrls: [net.explorer],
                  nativeCurrency: net.nativeCurrency || { name: 'ETH', symbol: 'ETH', decimals: 18 },
                }],
              });
              // Try switching again
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${targetChainId.toString(16)}` }],
              });
            }
          }
        }
      } catch (e) {
        console.warn('Network switch via URL failed (non-fatal):', e);
      }
    }
    ensureNetworkFromUrl();
  }, [chainSlug, connected, provider]);


  
    
  // Memoize stable values to prevent unnecessary re-renders
  const stableConnected = useMemo(() => connected, [connected]);
  const stableAddress = useMemo(() => address, [address]);
  const stableRaffleAddress = useMemo(() => raffleAddress, [raffleAddress]);

  const actualDurationDebounceRef = useRef(null);
  const lastPolledStateRef = useRef(null);
  const hasInitiallyLoadedRef = useRef(false);
  const fetchActualDurationImmediate = useCallback(async () => {
    try {
      const contract = getContractInstance(stableRaffleAddress || raffleAddress, 'pool');
      if (!contract) return;
      const val = await contract.getActualPoolDuration();
      const num = val?.toNumber ? val.toNumber() : Number(val);
      if (num && num > 0) {
        setRaffle(prev => (prev ? { ...prev, actualDuration: num } : prev));
      }
    } catch (_) {}
  }, [getContractInstance, stableRaffleAddress, raffleAddress]);

  // Event listener for raffle state changes
  // Keep listener active in Completed state so polling detects Completed→AllPrizesClaimed
  const shouldMainListen = !!raffle;

  const { isListening: isMainListening, eventHistory: mainEventHistory } = useRaffleEventListener(raffleAddress, {
    onWinnersSelected: (winners, event) => {
      toast.success(`Winners have been selected! ${winners.length} winner${winners.length !== 1 ? 's' : ''} chosen.`);

      // Reset auto-refresh monitoring since event was successfully received
      setAutoRefreshCount(0);
      setLastDrawingStateTime(null);

      // Trigger immediate refresh to update all components
      triggerRefresh();

      // Additional resilience: Force refresh after delay to handle RPC issues
      setTimeout(() => {
        triggerRefresh();
      }, 5000); // 5 second delay
    },
    onStateChange: (newState, blockNumber) => {
      // Directly update state badge immediately (no waiting for triggerRefresh)
      setRaffle(prev => {
        if (!prev || prev.stateNum === newState) return prev;
        return { ...prev, stateNum: newState, state: POOL_STATE_LABELS[newState] || prev.state };
      });

      // Only perform side effects and full refresh if state actually changed
      if (newState === lastPolledStateRef.current) return;
      lastPolledStateRef.current = newState;

      if (newState !== 3) {
        setAutoRefreshCount(0);
        setLastDrawingStateTime(null);
      }

      if ([2,3,4,5,6,7,8].includes(newState)) {
        if (actualDurationDebounceRef.current) clearTimeout(actualDurationDebounceRef.current);
        actualDurationDebounceRef.current = setTimeout(() => {
          fetchActualDurationImmediate();
        }, 600);
      }

      triggerRefresh();
    },
    onPrizeClaimed: (winner, amount, event) => {
      toast.success(`Prize claimed by ${winner.slice(0, 6)}...${winner.slice(-4)}!`);
      if (address && winner.toLowerCase() === address.toLowerCase()) {
        setWinnerData(prev => prev ? { ...prev, prizeClaimed: true } : prev);
      }
      // Query contract state directly to detect transitions (e.g., → AllPrizesClaimed)
      const poolContract = getContractInstance && getContractInstance(raffleAddress, 'pool');
      if (poolContract) {
        poolContract.state().then(s => {
          const stateVal = s.toNumber ? s.toNumber() : Number(s);
          setRaffle(prev => {
            if (!prev || prev.stateNum === stateVal) return prev;
            return { ...prev, stateNum: stateVal, state: POOL_STATE_LABELS[stateVal] || prev.state };
          });
          // Refresh to update winners list, activity, etc.
          triggerRefresh();
        }).catch(() => {});
      }
    },
    onTicketsPurchased: (participant, quantity, event) => {

      // Only show notification if it's not the current user (to avoid duplicate notifications)
      if (participant.toLowerCase() !== address?.toLowerCase()) {
        toast.info(`${quantity.toString()} slot${quantity.toString() !== '1' ? 's' : ''} purchased by ${participant.slice(0, 6)}...${participant.slice(-4)}`);
      }
      // Trigger refresh to update slot counts
      triggerRefresh();
    },
    onRpcError: (error) => {
      // Log RPC errors for debugging but don't trigger auto-refresh
      console.warn('RPC error detected:', error);
    },
    enablePolling: true,
    pollingInterval: raffle?.stateNum === 3 ? 10000 : 15000, // Faster polling during Drawing state
    autoStart: shouldMainListen,
    raffleState: raffle?.stateNum || null,
    enableStateConditionalListening: true,
    stopOnCompletion: false // Keep polling active in Completed state to detect → AllPrizesClaimed
  });

  // Helper function to transform backend pool data to expected raffle format
  const transformBackendPool = useCallback((pool) => {
    if (!pool) return null;
    return {
      address: pool.address,
      name: pool.name || 'Unknown Pool',
      creator: pool.creator,
      startTime: Number(pool.start_time),
      duration: Number(pool.duration),
      actualDuration: pool.actual_duration ? Number(pool.actual_duration) : undefined,
      slotFee: pool.slot_fee ? ethers.BigNumber.from(pool.slot_fee) : ethers.BigNumber.from(0),
      slotLimit: pool.slot_limit || 0,
      slotsSold: pool.slots_sold || 0,
      winnersCount: pool.winners_count || 0,
      winnersSelected: pool.winners_selected || 0,
      maxSlotsPerAddress: pool.max_slots_per_address || 0,
      stateNum: pool.state,
      state: POOL_STATE_LABELS[pool.state] || 'Unknown',
      isPrized: pool.is_prized || false,
      prizeCollection: pool.prize_collection || ethers.constants.AddressZero,
      prizeTokenId: pool.prize_token_id ? ethers.BigNumber.from(pool.prize_token_id) : ethers.BigNumber.from(0),
      standard: pool.standard,
      erc20PrizeToken: pool.erc20_prize_token || ethers.constants.AddressZero,
      erc20PrizeAmount: pool.erc20_prize_amount ? ethers.BigNumber.from(pool.erc20_prize_amount) : ethers.BigNumber.from(0),
      nativePrizeAmount: pool.native_prize_amount ? ethers.BigNumber.from(pool.native_prize_amount) : ethers.BigNumber.from(0),
      usesCustomFee: pool.uses_custom_fee || false,
      isEscrowedPrize: pool.is_escrowed_prize !== false, // Default to true
      isCollabPool: pool.is_collab_pool || false,
      amountPerWinner: pool.amount_per_winner || 1,
      holderTokenAddress: pool.holder_token_address || ethers.constants.AddressZero,
      holderTokenStandard: pool.holder_token_standard || 0,
      minHolderTokenBalance: pool.min_holder_token_balance ? ethers.BigNumber.from(pool.min_holder_token_balance) : ethers.BigNumber.from(0),
      isRefundable: pool.is_refundable || false,
      chainId: pool.chain_id,
      socialEngagementRequired: pool.social_engagement_required || false,
      socialTaskDescription: pool.social_task_description || null,
      // Pool metadata from backend
      _backendMetadata: (pool.description || pool.twitter_link || pool.discord_link || pool.telegram_link) ? {
        description: pool.description || '',
        twitterLink: pool.twitter_link || '',
        discordLink: pool.discord_link || '',
        telegramLink: pool.telegram_link || '',
        hasMetadata: true,
      } : null,
      _fromBackend: true,
      _backendArtworkUrl: pool.artwork_url || null,
      _backendActivity: pool.activity || [],
      _backendParticipants: pool.participants || [],
      _backendWinners: pool.winners || [],
      _backendCollectionArtwork: pool.collection_artwork || null,
      collection_artwork: pool.collection_artwork || null,
    };
  }, []);

  // Backend-only fetch: loads pool data from Supabase without requiring wallet connection.
  // This enables the page to render for visitors who haven't connected a wallet.
  const fetchBackendOnly = useCallback(async () => {
    if (!stableRaffleAddress) return;
    if (backendDataLoaded) return; // Already loaded

    const currentChainId = resolveChainIdFromSlug(chainSlug) || DEFAULT_CHAIN_ID;

    if (!supabaseService.isAvailable() || !currentChainId) return;

    if (!hasInitiallyLoadedRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const backendPool = await supabaseService.getPoolEnhanced(currentChainId, stableRaffleAddress);
      if (backendPool) {
        const transformedPool = transformBackendPool(backendPool);
        if (transformedPool) {
          setRaffle(prev => {
            if (!prev) return transformedPool;
            const merged = { ...prev, ...transformedPool };
            if (prev.stateNum > merged.stateNum) {
              merged.stateNum = prev.stateNum;
              merged.state = POOL_STATE_LABELS[prev.stateNum] || prev.state;
            }
            return merged;
          });
          setIsRefundable(transformedPool.isRefundable);
          setIsCollabPool(transformedPool.isCollabPool);
          setIsEscrowedPrize(transformedPool.isEscrowedPrize);
          setPoolActivity(prev => {
            const backendActivities = transformedPool._backendActivity || [];
            if (prev.length === 0) return backendActivities;
            const existingIds = new Set(prev.map(a => a.id));
            const newFromBackend = backendActivities.filter(a => !existingIds.has(a.id));
            if (newFromBackend.length === 0) return prev;
            return [...prev, ...newFromBackend].sort((a, b) => {
              const timeA = new Date(a.timestamp || a.created_at).getTime();
              const timeB = new Date(b.timestamp || b.created_at).getTime();
              return timeB - timeA;
            });
          });
          if (transformedPool._backendMetadata) {
            setPoolMetadata(transformedPool._backendMetadata);
          }
          setBackendDataLoaded(true);
          hasInitiallyLoadedRef.current = true;
          setLoading(false);
          return;
        }
      }
      // Backend returned nothing — if no wallet, show a helpful message
      if (!connected) {
        setError('Pool not found in backend. Connect your wallet for on-chain lookup.');
      }
    } catch (err) {
      console.warn('Backend-only fetch failed:', err);
      if (!connected) {
        setError('Failed to load pool data. Connect your wallet for on-chain lookup.');
      }
    } finally {
      if (!hasInitiallyLoadedRef.current) {
        setLoading(false);
      }
    }
  }, [stableRaffleAddress, chainSlug, backendDataLoaded, connected, transformBackendPool]);

  // Memoized fetch function to prevent recreation on every render
  const fetchRaffleData = useCallback(async () => {
      // Only show full-page loading on initial load, not on triggerRefresh()
      // Showing loading on refresh unmounts all children (WinnersSection, etc.)
      if (!hasInitiallyLoadedRef.current) {
        setLoading(true);
      }
      setError(null); // Clear previous errors
      try {
        if (!stableRaffleAddress) {
          throw new Error('No raffle address provided');
        }

        // If wallet is not ready, skip RPC enrichment.
        // Backend-only data (from fetchBackendOnly) is sufficient for read-only viewing.
        if (!isInitialized || isReconnecting || !getContractInstance) {
          if (backendDataLoaded) {
            // Backend data already loaded — no need for RPC, just return
            setLoading(false);
            return;
          }
          // No backend data and no wallet — can't proceed
          throw new Error('Wallet is initializing, please wait...');
        }

        // Get chain ID for backend query
        const currentChainId = resolveChainIdFromSlug(chainSlug) || provider?.network?.chainId;

        // Try backend-first fetching for faster initial load
        let backendPool = null;
        if (supabaseService.isAvailable() && currentChainId) {
          try {
            backendPool = await supabaseService.getPoolEnhanced(currentChainId, stableRaffleAddress);
            if (backendPool) {
              const transformedPool = transformBackendPool(backendPool);
              if (transformedPool) {
                // Set initial data from backend (fast path)
                // On refreshes, never downgrade stateNum from real-time subscription
                setRaffle(prev => {
                  if (!prev) return transformedPool;
                  const merged = { ...prev, ...transformedPool };
                  if (prev.stateNum > merged.stateNum) {
                    merged.stateNum = prev.stateNum;
                    merged.state = POOL_STATE_LABELS[prev.stateNum] || prev.state;
                  }
                  return merged;
                });
                setIsRefundable(transformedPool.isRefundable);
                setIsCollabPool(transformedPool.isCollabPool);
                setIsEscrowedPrize(transformedPool.isEscrowedPrize);
                // Merge backend activities with any real-time activities already received
                // to avoid losing activities that arrived via subscription but aren't yet indexed
                setPoolActivity(prev => {
                  const backendActivities = transformedPool._backendActivity || [];
                  if (prev.length === 0) return backendActivities;
                  // Merge: keep all existing real-time activities, add any new backend ones
                  const existingIds = new Set(prev.map(a => a.id));
                  const newFromBackend = backendActivities.filter(a => !existingIds.has(a.id));
                  if (newFromBackend.length === 0) return prev;
                  return [...prev, ...newFromBackend].sort((a, b) => {
                    const timeA = new Date(a.timestamp || a.created_at).getTime();
                    const timeB = new Date(b.timestamp || b.created_at).getTime();
                    return timeB - timeA;
                  });
                });
                // Use backend metadata if available (avoids RPC event queries)
                if (transformedPool._backendMetadata) {
                  setPoolMetadata(transformedPool._backendMetadata);
                }
                setBackendDataLoaded(true);
                hasInitiallyLoadedRef.current = true;
                setLoading(false);
                
                // Continue to fetch user-specific data via RPC in background
                // (refundable amount, etc.)
              }
            }
          } catch (backendError) {
            console.warn('Backend fetch failed, falling back to RPC:', backendError);
          }
        }

        // Skip RPC enrichment if wallet is not connected.
        // Backend data is sufficient for read-only viewing.
        if (!connected) {
          if (backendDataLoaded || backendPool) {
            setLoading(false);
            return;
          }
          throw new Error('Pool not found in backend. Connect your wallet for on-chain lookup.');
        }

        // Get browser-specific configuration
        const platformConfig = getPlatformConfig();
        const browserInfo = getBrowserInfo();



        // Create contract instances with improved error handling
        const poolContract = getContractInstance(stableRaffleAddress, 'pool');
        if (!poolContract) {
          throw new Error('Failed to create contract instance - no signer/provider available');
        }

        // Create SocialEngagementManager contract instance for social task queries
        // Note: currentChainId already declared above for backend query
        const socialEngagementManagerContract = getContractInstance(
          SUPPORTED_NETWORKS[currentChainId]?.contractAddresses?.socialEngagementManager,
          'socialEngagementManager'
        );

        // Test contract connectivity with safe call
        const connectivityTest = await safeContractCall(
          () => poolContract.name(),
          'name',
          {
            timeout: platformConfig.timeout,
            retries: platformConfig.retries,
            required: true
          }
        );

        if (!connectivityTest.success) {
          throw new Error(`Contract connectivity test failed: ${connectivityTest.error}`);
        }
        // Define contract calls with fallback values for robust execution
        const contractCalls = [
          { method: () => poolContract.name(), name: 'name', required: true, fallback: 'Unknown Pool' },
          { method: () => poolContract.creator(), name: 'creator', required: true, fallback: ethers.constants.AddressZero },
          { method: () => poolContract.startTime(), name: 'startTime', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.duration(), name: 'duration', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.slotFee(), name: 'slotFee', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.slotLimit(), name: 'slotLimit', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.winnersCount(), name: 'winnersCount', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.winnersSelected(), name: 'winnersSelected', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.maxSlotsPerAddress(), name: 'maxSlotsPerAddress', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.isPrized(), name: 'isPrized', required: true, fallback: false },
          { method: () => poolContract.prizeCollection(), name: 'prizeCollection', required: true, fallback: ethers.constants.AddressZero },
          { method: () => poolContract.prizeTokenId(), name: 'prizeTokenId', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.standard(), name: 'standard', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => poolContract.state(), name: 'state', required: true, fallback: ethers.BigNumber.from(0) },
          { method: createSafeMethod(poolContract, 'erc20PrizeToken', ethers.constants.AddressZero), name: 'erc20PrizeToken', required: false, fallback: ethers.constants.AddressZero },
          { method: createSafeMethod(poolContract, 'erc20PrizeAmount', ethers.BigNumber.from(0)), name: 'erc20PrizeAmount', required: false, fallback: ethers.BigNumber.from(0) },
          { method: createSafeMethod(poolContract, 'nativePrizeAmount', ethers.BigNumber.from(0)), name: 'nativePrizeAmount', required: false, fallback: ethers.BigNumber.from(0) },
          { method: createSafeMethod(poolContract, 'usesCustomFee', false), name: 'usesCustomFee', required: false, fallback: false },
          { method: () => address ? poolContract.hasClaimedFeeRefund(address) : false, name: 'hasClaimedFeeRefund', required: false, fallback: false },
          { method: createSafeMethod(poolContract, 'isRefundable', false), name: 'isRefundable', required: false, fallback: false },
          { method: createSafeMethod(poolContract, 'isCollabPool', false), name: 'isCollabPool', required: false, fallback: false },
          { method: createSafeMethod(poolContract, 'isEscrowedPrize', true), name: 'isEscrowedPrize', required: false, fallback: true },
          { method: createSafeMethod(poolContract, 'amountPerWinner', ethers.BigNumber.from(1)), name: 'amountPerWinner', required: false, fallback: ethers.BigNumber.from(1) },
          // Conditionally fetch actual duration only when state is in ended/terminal states
          { method: async () => {
              try {
                const st = await poolContract.state();
                // States: 0 Pending, 1 Active, 2 Ended, 3 Drawing, 4 Completed, 5 Deleted, 6 Activation Failed, 7 Prizes Claimed, 8 Unengaged
                if (typeof st === 'number' ? st >= 2 : (st.toNumber ? st.toNumber() >= 2 : Number(st) >= 2)) {
                  return await poolContract.getActualPoolDuration();
                }
              } catch (_) {}
              return ethers.BigNumber.from(0);
            }, name: 'actualDuration', required: false, fallback: ethers.BigNumber.from(0) },
          // Social engagement queries
          { method: createSafeMethod(poolContract, 'socialEngagementRequired', false), name: 'socialEngagementRequired', required: false, fallback: false },
          // socialTaskDescription is now fetched from events in SocialMediaVerification component
          // Token gating queries
          { method: createSafeMethod(poolContract, 'holderTokenAddress', ethers.constants.AddressZero), name: 'holderTokenAddress', required: false, fallback: ethers.constants.AddressZero },
          { method: createSafeMethod(poolContract, 'holderTokenStandard', 0), name: 'holderTokenStandard', required: false, fallback: 0 },
          { method: createSafeMethod(poolContract, 'minHolderTokenBalance', 0), name: 'minHolderTokenBalance', required: false, fallback: 0 }
        ];

        // Execute contract calls using browser-optimized batch processing
        const [
          name, creator, startTime, duration, slotFee, slotLimit, winnersCount, winnersSelected, maxSlotsPerAddress, isPrizedContract, prizeCollection, prizeTokenId, standard, stateNum, erc20PrizeToken, erc20PrizeAmount, nativePrizeAmount, usesCustomFee, hasClaimedFeeRefund, isRefundableFlag, isCollabPoolFlag, isEscrowedPrize, amountPerWinner, actualDurationValue, socialEngagementRequired, holderTokenAddress, holderTokenStandard, minHolderTokenBalance
        ] = await batchContractCalls(contractCalls, {
          timeout: platformConfig.timeout,
          useSequential: platformConfig.useSequential,
          batchSize: platformConfig.batchSize,
          delayBetweenCalls: platformConfig.delayBetweenCalls
        });

        let slotsSold = 0;
        try {
          const participantsCount = await poolContract.getParticipantsCount();
          slotsSold = participantsCount.toNumber();
        } catch (error) {
          let index = 0;
          while (true) {
            try {
              await poolContract.participants(index);
              slotsSold++;
              index++;
            } catch {
              break;
            }
          }
        }

        let userSlots = 0;
        let userSlotsRemaining = maxSlotsPerAddress.toNumber();

        if (connected && address) {
          try {
            const userSlotCount = await poolContract.slotsPurchased(address);
            userSlots = userSlotCount.toNumber();
            userSlotsRemaining = Math.max(0, maxSlotsPerAddress.toNumber() - userSlots);
          } catch (error) {

            let index = 0;
            while (index < slotsSold) {
              try {
                const participant = await poolContract.participants(index);
                if (participant.toLowerCase() === address.toLowerCase()) {
                  userSlots++;
                }
                index++;
              } catch {
                break;
              }
            }
            userSlotsRemaining = Math.max(0, maxSlotsPerAddress.toNumber() - userSlots);
          }
        }

        const isPrized = !!isPrizedContract;

        const endedStates = [2,3,4,5,6,7,8];
        const actualDurationNumber = (endedStates.includes(stateNum) && actualDurationValue)
          ? (actualDurationValue.toNumber ? actualDurationValue.toNumber() : Number(actualDurationValue))
          : undefined;

        const raffleData = {
          address: raffleAddress,
          name,
          creator,
          startTime: startTime.toNumber(),
          duration: duration.toNumber(),
          actualDuration: actualDurationNumber,
          slotFee,
          slotLimit: slotLimit.toNumber(),
          slotsSold,
          winnersCount: winnersCount.toNumber(),
          winnersSelected: winnersSelected.toNumber(),
          maxSlotsPerAddress: maxSlotsPerAddress.toNumber(),
          isPrized: isPrizedContract,
          prizeCollection,
          prizeTokenId,
          standard,
          stateNum: stateNum,
          state: POOL_STATE_LABELS[stateNum] || 'Unknown',
          erc20PrizeToken,
          erc20PrizeAmount,
          nativePrizeAmount,
          usesCustomFee,
          isEscrowedPrize,
          isCollabPool: isCollabPoolFlag,
          amountPerWinner: amountPerWinner ? (amountPerWinner.toNumber ? amountPerWinner.toNumber() : Number(amountPerWinner)) : 1,
          // Social engagement fields
          socialEngagementRequired: !!socialEngagementRequired,
          // socialTaskDescription is now fetched from events in SocialMediaVerification component
          // Token gating fields
          holderTokenAddress,
          holderTokenStandard: holderTokenStandard ? (holderTokenStandard.toNumber ? holderTokenStandard.toNumber() : Number(holderTokenStandard)) : 0,
          minHolderTokenBalance
        };

        setIsRefundable(isRefundableFlag);
        setIsCollabPool(isCollabPoolFlag);
        // If externally prized, re-query prizeCollection
        let updatedPrizeCollection = prizeCollection;
        if (isCollabPoolFlag) {
          try {
            updatedPrizeCollection = await poolContract.prizeCollection();
          } catch (e) {
            // fallback: keep previous value
          }
        }
        // Update raffle state with latest RPC data while preserving backend-only fields
        // (e.g., _backendArtworkUrl, _backendCollectionArtwork, _fromBackend, _backendMetadata)
        // IMPORTANT: Never downgrade stateNum — real-time subscriptions are authoritative.
        // RPC nodes can be behind, returning stale state that causes badge flashing.
        setRaffle(prev => {
          const merged = { ...prev, ...raffleData, prizeCollection: updatedPrizeCollection };
          if (prev && prev.stateNum > merged.stateNum) {
            merged.stateNum = prev.stateNum;
            merged.state = POOL_STATE_LABELS[prev.stateNum] || prev.state;
          }
          return merged;
        });
      } catch (error) {


        // Don't immediately navigate away on mobile - show error state instead
        const errorMessage = handleError(error, {
          context: { operation: 'fetchRaffleData', isReadOnly: true },
          fallbackMessage: 'Failed to load raffle data'
        });

        // Set error state instead of navigating away immediately
        setError(errorMessage);
      } finally {
        hasInitiallyLoadedRef.current = true;
        setLoading(false);
      }
  }, [stableRaffleAddress, getContractInstance, stableConnected, stableAddress, isInitialized, isReconnecting, refreshTrigger]);

  // Function to check user's social engagement completion status
  // Checks BOTH on-chain flag (set after first purchase) AND Supabase verification (set after task completion).
  // On-chain hasCompletedSocialEngagement is only true after the user's first successful slot purchase,
  // so first-time purchasers rely on Supabase verification to unlock the purchase button.
  const checkSocialEngagementStatus = useCallback(async () => {
    if (!connected || !address || !raffle?.address) {
      setHasCompletedSocialEngagement(false);
      return;
    }

    try {
      let onChainCompleted = false;
      let supabaseCompleted = false;

      // 1. Check on-chain flag (for returning users who already purchased)
      try {
        const poolContract = getContractInstance?.(raffle.address, 'pool');
        if (poolContract && typeof poolContract.hasCompletedSocialEngagement === 'function') {
          onChainCompleted = !!(await poolContract.hasCompletedSocialEngagement(address));
        }
      } catch (blockchainError) {
        console.error('Error checking on-chain social engagement:', blockchainError);
      }

      // 2. Check Supabase verification (for first-time purchasers who completed all tasks)
      try {
        const supabaseResult = await verificationService.checkAllTasksVerified(address, raffle.address);
        supabaseCompleted = !!supabaseResult?.success;
      } catch (supabaseError) {
        console.error('Error checking Supabase verification status:', supabaseError);
      }

      // Either source is sufficient to enable slot purchases
      setHasCompletedSocialEngagement(onChainCompleted || supabaseCompleted);
    } catch (error) {
      console.error('Error checking social engagement status:', error);
      setHasCompletedSocialEngagement(false);
    }
  }, [connected, address, raffle?.address, getContractInstance]);

  // Effect to check social engagement status when dependencies change
  useEffect(() => {
    if (raffle?.socialEngagementRequired && connected && address) {
      checkSocialEngagementStatus();
    }
  }, [raffle?.socialEngagementRequired, connected, address, checkSocialEngagementStatus]);

  // Backend-only fetch: runs immediately without wallet connection.
  // Enables the page to render read-only pool data for all visitors.
  useEffect(() => {
    if (stableRaffleAddress && !backendDataLoaded) {
      fetchBackendOnly();
    }
  }, [stableRaffleAddress, backendDataLoaded, fetchBackendOnly]);

  // RPC enrichment: runs when wallet is connected to add user-specific data
  useEffect(() => {
    if (stableRaffleAddress && getContractInstance && isInitialized && !isReconnecting) {
      fetchRaffleData();
    }
  }, [fetchRaffleData, stableRaffleAddress, getContractInstance, isInitialized, isReconnecting, refreshTrigger]);

  // Real-time subscription for pool updates from Supabase
  // Accept ALL state updates so the page reflects state transitions immediately
  useRealtimePool(stableRaffleAddress, (updatedPool) => {
    // Clear cached backend data so re-navigation fetches fresh data
    if (stableRaffleAddress) {
      const chainIdForCache = resolveChainIdFromSlug(chainSlug) || provider?.network?.chainId;
      if (chainIdForCache) {
        supabaseService.clearCache(`pool_enhanced_${chainIdForCache}_${stableRaffleAddress}`);
      }
    }
    setRaffle(prev => {
      if (!prev) return prev;
      const newState = updatedPool.state !== undefined ? updatedPool.state : prev.stateNum;
      const stateChanged = newState !== prev.stateNum;
      const updated = {
        ...prev,
        slotsSold: updatedPool.slots_sold !== undefined ? updatedPool.slots_sold : prev.slotsSold,
        winnersSelected: updatedPool.winners_selected !== undefined ? updatedPool.winners_selected : prev.winnersSelected,
        stateNum: newState,
        state: POOL_STATE_LABELS[newState] || prev.state,
        actualDuration: updatedPool.actual_duration !== undefined ? Number(updatedPool.actual_duration) : prev.actualDuration,
      };
      // When state transitions to Completed+ (winners/activity now available in backend),
      // schedule a delayed backend refetch to pick up new data
      if (stateChanged && newState >= 3) {
        setTimeout(() => triggerRefresh(), 2000);
      }
      return updated;
    });
  }, true);

  // Real-time subscription for pool-specific activity, participants, and winners
  // Multiplexed onto a single channel for efficiency
  useEffect(() => {
    if (!stableRaffleAddress || !supabaseService.isAvailable()) return;

    const addr = stableRaffleAddress.toLowerCase();
    const channelKey = `pool-detail:${addr}`;
    const channel = supabaseService.client
      .channel(channelKey)
      // Activity feed (slot purchases, refunds, prize claims, etc.)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity',
          filter: `pool_address=eq.${addr}`
        },
        (payload) => {
          const newItem = payload.new;
          if (!newItem) return;

          setPoolActivity(prev => {
            if (prev.some(a => a.id === newItem.id)) return prev;
            return [newItem, ...prev];
          });
        }
      )
      // New participants — immediately increment slotsSold (arrives before pools UPDATE)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_participants',
          filter: `pool_address=eq.${addr}`
        },
        (payload) => {
          const participant = payload.new;
          if (!participant) return;
          const slotCount = participant.slots_purchased || 1;
          setRaffle(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              slotsSold: (prev.slotsSold || 0) + slotCount,
            };
          });
        }
      )
      // New winners — update winnersSelected count
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_winners',
          filter: `pool_address=eq.${addr}`
        },
        (payload) => {
          if (!payload.new) return;
          setRaffle(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              winnersSelected: (prev.winnersSelected || 0) + 1,
            };
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [stableRaffleAddress]);

  // Fetch collection name for raffle detail section
  useEffect(() => {
    const fetchRaffleCollectionName = async () => {
      if (!raffle || !raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        setRaffleCollectionName(null);
        return;
      }

      try {
        const contract = getContractInstance(raffle.prizeCollection, raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize');
        const name = await contract.name();
        setRaffleCollectionName(name);
      } catch (error) {

        setRaffleCollectionName(null);
      }
    };

    fetchRaffleCollectionName();
  }, [raffle, getContractInstance]);

  // Fetch gating token name for token-gated raffles
  useEffect(() => {
    const fetchGatingTokenName = async () => {
      if (!raffle || !raffle.holderTokenAddress || raffle.holderTokenAddress === ethers.constants.AddressZero) {
        setGatingTokenName(null);
        return;
      }

      // Don't fetch for ERC1155 as requested - display contract address
      if (raffle.holderTokenStandard === 1) {
        setGatingTokenName(null);
        return;
      }

      try {
        let tokenName = null;

        if (raffle.holderTokenStandard === 0) {
          // ERC721 - use the same pattern as ERC20PrizeAmount but for name()
          const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
          const erc721Abi = ["function name() view returns (string)", "function symbol() view returns (string)"];
          const contract = new ethers.Contract(raffle.holderTokenAddress, erc721Abi, provider);
          
          // Try to get symbol first, fallback to name
          try {
            tokenName = await contract.symbol();
          } catch {
            try {
              tokenName = await contract.name();
            } catch {
              tokenName = null;
            }
          }
        } else if (raffle.holderTokenStandard === 2) {
          // ERC20 - use the exact same pattern as ERC20PrizeAmount
          const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
          const erc20Abi = ["function symbol() view returns (string)", "function name() view returns (string)"];
          const contract = new ethers.Contract(raffle.holderTokenAddress, erc20Abi, provider);
          
          // Try to get symbol first, fallback to name
          try {
            tokenName = await contract.symbol();
          } catch {
            try {
              tokenName = await contract.name();
            } catch {
              tokenName = null;
            }
          }
        }

        setGatingTokenName(tokenName);
      } catch (error) {
        console.warn('Failed to fetch gating token name:', error);
        setGatingTokenName(null);
      }
    };

    fetchGatingTokenName();
  }, [raffle]);

  // Memoize format functions to prevent recreation
  const formatTime = useCallback((seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    let formatted = '';
    if (days > 0) formatted += `${days}d `;
    if (hours > 0 || days > 0) formatted += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m `;
    formatted += `${secs}s`;
    return formatted.trim();
  }, []);

  const formatDuration = useCallback((seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let formatted = '';
    if (days > 0) formatted += `${days}d `;
    if (hours > 0 || days > 0) formatted += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m`;
    if (!formatted) formatted = '0m';
    return formatted.trim();
  }, []);

  const updateTimer = useCallback(() => {
    if (!raffle) return;
    const now = Math.floor(Date.now() / 1000);
    let label = '';
    let seconds = 0;
    if ([2,3,4,5,6,7,8].includes(raffle.stateNum)) {
      label = 'Duration';
      // Show original duration when actual duration exceeds original; otherwise show actual if available
      const actual = raffle.actualDuration && (raffle.actualDuration.toNumber ? raffle.actualDuration.toNumber() : Number(raffle.actualDuration));
      const original = raffle.duration;
      const displaySeconds = actual && actual > 0
        ? (actual > original ? original : actual)
        : original;
      setTimeLabel(label);
      setTimeValue(formatDuration(displaySeconds));
      return;
    }
    if (now < raffle.startTime) {
      label = 'Starts In';
      seconds = raffle.startTime - now;
    } else {
      label = 'Remaining';
      seconds = (raffle.startTime + raffle.duration) - now;
    }
    setTimeLabel(label);
    setTimeValue(seconds > 0 ? formatTime(seconds) : 'Ended');
  }, [raffle, formatTime, formatDuration]);

  // Timer effect with memoized dependencies
  useEffect(() => {
    if (!raffle) return;
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer]);

  useEffect(() => {
    async function fetchEscrowedPrizeFlag() {
      if (raffleAddress && getContractInstance) {
        try {
          const contract = getContractInstance(raffleAddress, 'pool');
          if (contract) {
            const flag = await contract.isEscrowedPrize();
            setIsEscrowedPrize(flag);
          }
        } catch (e) {
          setIsEscrowedPrize(false);
        }
      }
    }
    fetchEscrowedPrizeFlag();
  }, [raffleAddress, getContractInstance]);

  // Fetch pool metadata from events (RPC fallback — only if backend didn't provide metadata)
  useEffect(() => {
    const fetchMetadata = async () => {
      // Skip RPC fetch if backend already provided metadata
      if (poolMetadata?.hasMetadata) return;
      if (!raffleAddress || !contracts?.poolDeployer) {
        return;
      }

      setLoadingMetadata(true);
      try {
        const metadata = await getPoolMetadata(raffleAddress, contracts.poolDeployer);
        setPoolMetadata(metadata);
      } catch (error) {
        console.error('Error fetching pool metadata via RPC:', error);
      } finally {
        setLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, [raffleAddress, contracts?.poolDeployer, poolMetadata?.hasMetadata]);

  const handlePurchaseTickets = async (quantity, selectedTokenIds = []) => {
    if (!connected || !raffle) {
      throw new Error('Wallet not connected or raffle not loaded');
    }

    const poolContract = getContractInstance(raffle.address, 'pool');
    if (!poolContract) {
      throw new Error('Failed to get pool contract');
    }

    // Ensure slotFee is properly handled as BigNumber
    const slotFeeBN = safeSlotFeeToBigNumber(raffle.slotFee);
    const totalCost = slotFeeBN.mul(quantity);

    // Check if signature is required for social media verification
    let signature = null;
    let deadline = 0;
    
    // Determine signature based on social engagement requirements
    let signatureToUse = '0x'; // Default empty signature
    
    if (raffle.socialEngagementRequired) {
      // Always attempt to generate signature when social engagement is required
      // This covers both:
      // 1. Users who have completed social media verification (hasCompletedSocialEngagement = true from frontend)
      // 2. Users who have previously purchased slots (hasCompletedSocialEngagement = true from contract)
      try {
        const signatureResult = await signatureService.generatePurchaseSignature(
          address, 
          raffle.address, 
          quantity,
          raffle.chainId
        );
        
        if (signatureResult.success) {
          signature = signatureResult.signature;
          deadline = signatureResult.deadline;
          signatureToUse = signature;
        } else {
          throw new Error(signatureResult.error || 'Failed to generate signature');
        }
      } catch (signatureError) {
        console.error('Signature generation failed:', signatureError);
        // If signature generation fails, it means the user hasn't completed social engagement
        // and hasn't purchased before - show appropriate error
        if (!hasCompletedSocialEngagement) {
          throw new Error('Please complete all social media tasks before purchasing slots');
        } else {
          throw new Error('Failed to generate signature. Please try again.');
        }
      }
    } else {
      // Non-social pools: server-signed purchase authorization (anti-bot)
      // Every purchase needs a fresh PurchaseAuthorizer signature
      try {
        const authResult = await purchaseAuthService.generatePurchaseAuthorization(
          address,
          raffle.address,
          raffle.chainId
        );

        if (authResult.success) {
          deadline = authResult.deadline;
          signatureToUse = authResult.signature;
        } else {
          throw new Error(authResult.error || 'Failed to generate purchase authorization');
        }
      } catch (authError) {
        console.error('Purchase authorization failed:', authError);
        throw new Error('Failed to authorize purchase. Please try again.');
      }
    }

    // Call purchaseSlots with deadline, signature, and selected token IDs
    // Convert token IDs to numbers for contract (contract expects uint256[])
    const numericTokenIds = selectedTokenIds.map(id => {
      const tokenId = Number(id);
      if (isNaN(tokenId) || tokenId < 0) {
        throw new Error(`Invalid token ID: ${id}`);
      }
      return tokenId;
    });
    
    const tx = await poolContract.purchaseSlots(quantity, deadline, signatureToUse, numericTokenIds, { value: totalCost });
    const receipt = await tx.wait();
    
    toast.success(`Successfully purchased ${quantity} slot${quantity > 1 ? 's' : ''}!`);
    // Trigger state refresh instead of page reload
    triggerRefresh();
  };

  const handleDeleteRaffle = async () => {
    if (!raffle || !getContractInstance) return;



    setDeletingRaffle(true);
    try {
      const poolContract = getContractInstance(raffle.address, 'pool');
      if (!poolContract) {
        throw new Error('Contract instance not available');
      }

      // Preflight simulate to capture revert reason
      try {
        await poolContract.callStatic.deletePool();
      } catch (simErr) {
        notifyError(simErr, { action: 'deletePool', phase: 'preflight' });
        throw simErr;
      }
      const tx = await poolContract.deletePool();
      await tx.wait();

      toast.success('Raffle deleted successfully!');
        navigate('/');
    } catch (error) {
      const errorDetails = formatErrorForDisplay(error, 'delete raffle');
      logContractError(error, 'Delete Raffle');
      notifyError(error, { action: 'deletePool' });
    } finally {
      setDeletingRaffle(false);
    }
  };

  const canDelete = () => {
    const now = Math.floor(Date.now() / 1000);
    const raffleEndTime = raffle.startTime + raffle.duration;
    
    return (
      connected &&
           address?.toLowerCase() === raffle?.creator.toLowerCase() &&
      (raffle?.state === 'Pending' || raffle?.state === 'Active') &&
      now < raffleEndTime && // Only allow deletion before pool ends
      raffle?.usesCustomFee === true // Only pools with custom slot fee can be deleted
    );
  };

  // Check points claim eligibility
  useEffect(() => {
    const checkPointsEligibility = async () => {
      if (!raffle || !address || !connected || !provider) {
        setCanClaimParticipantPoints(false);
        setCanClaimCreatorPoints(false);
        setPointsSystemActive(false);
        return;
      }

      const chainId = resolveChainIdFromSlug(chainSlug) || provider?.network?.chainId;
      const rewardsFlywheelAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.rewardsFlywheel;
      if (!rewardsFlywheelAddress) {
        console.warn('[ClaimPoints] No rewardsFlywheel address for chainId:', chainId);
        setCanClaimParticipantPoints(false);
        setCanClaimCreatorPoints(false);
        setPointsSystemActive(false);
        return;
      }

      try {
        const rewardsFlywheel = getContractInstance(rewardsFlywheelAddress, 'rewardsFlywheel');
        if (!rewardsFlywheel) {
          console.warn('[ClaimPoints] Failed to create rewardsFlywheel contract instance');
          return;
        }

        // Check if points system is active
        const isActive = await rewardsFlywheel.pointsSystemActive();
        setPointsSystemActive(isActive);
        console.log('[ClaimPoints] pointsSystemActive:', isActive);

        if (!isActive) {
          setCanClaimParticipantPoints(false);
          setCanClaimCreatorPoints(false);
          return;
        }

        // Pool must be in Completed (4) or AllPrizesClaimed (6) state
        const isEligibleState = raffle.stateNum === 4 || raffle.stateNum === 6;
        console.log('[ClaimPoints] stateNum:', raffle.stateNum, 'isEligibleState:', isEligibleState);
        if (!isEligibleState) {
          setCanClaimParticipantPoints(false);
          setCanClaimCreatorPoints(false);
          return;
        }

        const poolContract = getContractInstance(raffle.address, 'pool');
        if (!poolContract) {
          console.warn('[ClaimPoints] Failed to create pool contract instance');
          return;
        }

        // Check participant eligibility
        // Conditions: non-refundable pool (usesCustomFee), user purchased slots, points not already claimed
        const userSlots = await poolContract.getSlotsPurchased(address);
        const hasPurchasedSlots = userSlots && userSlots.gt(0);
        console.log('[ClaimPoints] usesCustomFee:', raffle.usesCustomFee, 'hasPurchasedSlots:', hasPurchasedSlots);

        if (raffle.usesCustomFee && hasPurchasedSlots) {
          const participantPointsAllocated = await rewardsFlywheel.participantPointsAllocated(raffle.address, address);
          console.log('[ClaimPoints] participantPointsAllocated:', participantPointsAllocated);
          setCanClaimParticipantPoints(!participantPointsAllocated);
        } else {
          setCanClaimParticipantPoints(false);
        }

        // Check creator eligibility
        // Conditions: user is creator, points not already claimed
        const isCreator = address?.toLowerCase() === raffle?.creator?.toLowerCase();
        console.log('[ClaimPoints] isCreator:', isCreator, 'address:', address?.toLowerCase(), 'creator:', raffle?.creator?.toLowerCase());
        if (isCreator) {
          const creatorPointsAllocated = await rewardsFlywheel.creatorPointsAllocated(raffle.address);
          console.log('[ClaimPoints] creatorPointsAllocated:', creatorPointsAllocated);
          setCanClaimCreatorPoints(!creatorPointsAllocated);
        } else {
          setCanClaimCreatorPoints(false);
        }
      } catch (error) {
        console.error('[ClaimPoints] Error checking points eligibility:', error);
        setCanClaimParticipantPoints(false);
        setCanClaimCreatorPoints(false);
      }
    };

    checkPointsEligibility();
  }, [raffle, address, connected, provider, getContractInstance, refreshTrigger, chainSlug]);

  // Handle claiming points
  const handleClaimPoints = async (isCreator) => {
    if (!raffle || !connected || !getContractInstance) return;

    setClaimingPoints(true);
    try {
      const poolContract = getContractInstance(raffle.address, 'pool');
      if (!poolContract) {
        throw new Error('Pool contract instance not available');
      }

      let tx;
      if (isCreator) {
        // Preflight simulate
        try {
          await poolContract.callStatic.claimCreatorPoints();
        } catch (simErr) {
          notifyError(simErr, { action: 'claimCreatorPoints', phase: 'preflight' });
          throw simErr;
        }
        tx = await poolContract.claimCreatorPoints();
      } else {
        // Preflight simulate
        try {
          await poolContract.callStatic.claimParticipantPoints();
        } catch (simErr) {
          notifyError(simErr, { action: 'claimParticipantPoints', phase: 'preflight' });
          throw simErr;
        }
        tx = await poolContract.claimParticipantPoints();
      }

      await tx.wait();
      toast.success(`Successfully claimed ${isCreator ? 'creator' : 'participant'} points!`);
      
      // Update state after successful claim
      if (isCreator) {
        setCanClaimCreatorPoints(false);
      } else {
        setCanClaimParticipantPoints(false);
      }
      
      triggerRefresh();
    } catch (error) {
      const errorDetails = formatErrorForDisplay(error, 'claim points');
      logContractError(error, isCreator ? 'Claim Creator Points' : 'Claim Participant Points');
      notifyError(error, { action: isCreator ? 'claimCreatorPoints' : 'claimParticipantPoints' });
    } finally {
      setClaimingPoints(false);
    }
  };

  const getStatusBadge = () => {
    if (!raffle) return null;

    // Check for Live state (startTime passed but no purchases yet)
    const now = Math.floor(Date.now() / 1000);
    const isLive = raffle.state?.toLowerCase() === 'pending' && 
                   raffle.startTime && 
                   now >= raffle.startTime && 
                   raffle.slotsSold === 0;

    // Get dynamic label for Prizes Claimed state based on winner count
    const getDynamicLabel = (stateNum) => {
      if (stateNum === 6) { // AllPrizesClaimed state (6)
        return winnerCount === 1 ? 'Prize Claimed' : 'Prizes Claimed';
      }
      return POOL_STATE_LABELS[stateNum] || 'Unknown';
    };

    const label = isLive ? 'Live' : getDynamicLabel(raffle.stateNum);
    const colorMap = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Live': 'bg-blue-100 text-blue-800',
      'Active': 'bg-green-100 text-green-800',
      'Ended': 'bg-red-100 text-red-800',
      'Drawing': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-blue-100 text-blue-800',
      'Deleted': 'bg-gray-200 text-gray-800',
      'Activation Failed': 'bg-red-200 text-red-900',
      'Prizes Claimed': 'bg-blue-200 text-blue-900',
      'Prize Claimed': 'bg-blue-200 text-blue-900', // Same styling for singular
      'Unengaged': 'bg-gray-100 text-gray-800',
      'Unknown': 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`inline-flex max-w-[60vw] items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${colorMap[label] || colorMap['Unknown']}`}>
        {label}
      </span>
    );
  };

  


  const now = Math.floor(Date.now() / 1000);
  const canActivate = raffle && raffle.startTime ? now >= raffle.startTime : false;

  const [timeLabel, setTimeLabel] = useState('');
  const [timeValue, setTimeValue] = useState('');

  // Winner-related state for claim/refund functionality
  const [claimingPrize, setClaimingPrize] = useState(false);
  const [claimingRefund, setClaimingRefund] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [eligibleForRefund, setEligibleForRefund] = useState(false);
  const [refundClaimed, setRefundClaimed] = useState(false);
  const [refundableAmount, setRefundableAmount] = useState(null);
  const [winnerData, setWinnerData] = useState(null);
  const [winnerCount, setWinnerCount] = useState(0);

  // Check winner status when raffle data changes
  useEffect(() => {
    const checkWinnerStatus = async () => {
      // Check for winners in states that have winners: Completed, AllPrizesClaimed, and Drawing (for multi-batch selection)
      if (!raffle || !address || ![3,4,6].includes(raffle.stateNum)) { // Drawing, Completed, AllPrizesClaimed
        setIsWinner(false);
        setWinnerData(null);
        // Don't reset refund-related states here as they're handled separately
        return;
      }

      try {
        const poolContract = getContractInstance && getContractInstance(raffle.address, 'pool');
        if (!poolContract) return;

        // Check if user is a winner
        const winnersCount = await poolContract.winnersCount();
        const count = winnersCount.toNumber ? winnersCount.toNumber() : Number(winnersCount);

        let userIsWinner = false;
        let userWinnerData = null;

        for (let i = 0; i < count; i++) {
          try {
            const winnerAddress = await poolContract.winners(i);
            if (winnerAddress.toLowerCase() === address.toLowerCase()) {
              const claimedWins = await poolContract.claimedWins(winnerAddress);
              const prizeClaimed = await poolContract.prizeClaimed(winnerAddress);
              const claimedCount = prizeClaimed.toNumber ? prizeClaimed.toNumber() : Number(prizeClaimed);
              userIsWinner = true;
              userWinnerData = {
                address: winnerAddress,
                index: i,
                claimedWins: claimedWins.toNumber ? claimedWins.toNumber() : Number(claimedWins),
                prizeClaimed: claimedCount > 0
              };
              break;
            }
          } catch (error) {
            continue;
          }
        }

        setIsWinner(userIsWinner);
        setWinnerData(userWinnerData);
      } catch (error) {
        setIsWinner(false);
        setWinnerData(null);
      }
    };

    checkWinnerStatus();
  }, [raffle, getContractInstance, address]);

  // Check refund eligibility separately from winner status
  useEffect(() => {
    const checkRefundEligibility = async () => {
      if (!raffle || !address || ![4,5,6,7].includes(raffle.stateNum)) { // Completed, Deleted, AllPrizesClaimed, Unengaged
        setEligibleForRefund(false);
        setRefundableAmount(null);
        return;
      }

      try {
        const poolContract = getContractInstance && getContractInstance(raffle.address, 'pool');
        if (!poolContract) return;

        // Check refund eligibility for both global fee and custom fee pools
        try {
          const refundable = await poolContract.getRefundableAmount(address);
          setRefundableAmount(refundable);
          setEligibleForRefund(refundable && refundable.gt && refundable.gt(0));
        } catch (e) {
          setRefundableAmount(null);
          setEligibleForRefund(false);
        }
      } catch (error) {
        setEligibleForRefund(false);
        setRefundableAmount(null);
      }
    };

    checkRefundEligibility();
  }, [raffle, getContractInstance, address]);

  // Handler to update winnersSelected count from WinnersSection
  const handleWinnersSelectedChange = useCallback((newCount) => {
    setRaffle(prev => prev ? { ...prev, winnersSelected: newCount } : prev);
  }, []);

  // Auto-refresh logic for Drawing state monitoring
  useEffect(() => {
    if (!raffle) return;

    // Track when raffle enters Drawing state
    if (raffle.stateNum === 3) { // Drawing state
      if (!lastDrawingStateTime) {
        setLastDrawingStateTime(Date.now());
      }
    } else {
      // Reset when leaving Drawing state
      if (lastDrawingStateTime) {
        setLastDrawingStateTime(null);
        setAutoRefreshCount(0);
      }
    }
  }, [raffle?.stateNum, lastDrawingStateTime]);

  // Auto-refresh timer for Drawing state - manages visual indicator and checks for state changes
  // Winner checking is now handled by WinnersSection component
  useEffect(() => {
    if (!lastDrawingStateTime || raffle?.stateNum !== 3) return;

    const autoRefreshInterval = setInterval(async () => {
      setIsAutoRefreshing(true);
      setAutoRefreshCount(prev => prev + 1);

      // Check if pool state has changed (e.g., Drawing -> Completed)
      try {
        const poolContract = getContractInstance && getContractInstance(raffle.address, 'pool');
        if (poolContract) {
          const currentState = await poolContract.state();
          const stateNum = currentState.toNumber ? currentState.toNumber() : Number(currentState);
          
          // If state changed from Drawing (3) to something else, trigger full refresh
          if (stateNum !== 3) {
            triggerRefresh();
          }
        }
      } catch (error) {
        console.warn('State polling error:', error);
      }

      // Reset auto-refresh flag after delay (keeps the indicator pulsing)
      setTimeout(() => {
        setIsAutoRefreshing(false);
      }, 3000);
    }, 15000); // Check every 15 seconds

    return () => {
      clearInterval(autoRefreshInterval);
    };
  }, [lastDrawingStateTime, raffle?.stateNum, raffle?.address, autoRefreshCount, getContractInstance, triggerRefresh]);

  const shouldShowClaimPrize = !!winnerData && (
    // Standard prized raffles: winners can claim in Completed (4) or Prizes Claimed (7)
    (raffle?.isPrized && (raffle?.stateNum === 4 || raffle?.stateNum === 6)) ||
    // Externally prized raffles (mintable assigned before Active): winners can mint in Completed (4)
    ((raffle?.isPrized === false) && ((isCollabPool === true) || (raffle?.isCollabPool === true)) && raffle?.stateNum === 4)
  );
  const prizeAlreadyClaimed = winnerData && winnerData.prizeClaimed;
  const shouldShowClaimRefund =
    // Show for global fee pools (any pool with !usesCustomFee) or custom fee refundable pools
    (!raffle?.usesCustomFee || raffle?.isPrized || raffle?.isCollabPool) &&
    [4,5,6,7].includes(raffle?.stateNum) && // Updated: 7 instead of 8 for Unengaged
    eligibleForRefund &&
    refundableAmount && refundableAmount.gt && refundableAmount.gt(0);

  const handleClaimPrize = async () => {
    if (!address || !raffle || !getContractInstance) {
      toast.error('Please connect your wallet to claim your prize');
      return;
    }
    if (!isWinner || !winnerData) {
      toast.error('You are not a winner of this raffle');
      return;
    }
    if (winnerData.prizeClaimed) {
      toast.error('You have already claimed your prize');
      return;
    }
    setClaimingPrize(true);
    try {
      const poolContract = getContractInstance(raffle.address, 'pool');
      if (!poolContract) throw new Error('Failed to get pool contract');
      
      // Determine which function to call based on prize type
      const isMintablePrize = raffle.isPrized && !raffle.isEscrowedPrize;
      const functionName = isMintablePrize ? 'mint' : 'claimPrize';
      
      // Preflight simulate to capture revert reason
      try {
        if (isMintablePrize) {
          await poolContract.callStatic.mint();
        } else {
          await poolContract.callStatic.claimPrize();
        }
      } catch (simErr) {
        notifyError(simErr, { action: functionName, phase: 'preflight' });
        throw simErr;
      }
      
      const result = await executeTransaction(
        isMintablePrize ? poolContract.mint : poolContract.claimPrize
      );
      
      if (result.success) {
        let prizeType = 'prize';
        if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
          prizeType = formatPrizeAmount(raffle.nativePrizeAmount);
        } else if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
          prizeType = `${ethers.utils.formatUnits(raffle.erc20PrizeAmount, 18)} ERC20 tokens`;
        } else if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
          prizeType = raffle.standard === 0 ? 'ERC721 NFT' : 'ERC1155 NFT';
        }
        
        const action = isMintablePrize ? 'minted' : 'claimed';
        toast.success(`Successfully ${action} your ${prizeType}!`);
        // Update winner data directly
        setWinnerData(prev => prev ? { ...prev, prizeClaimed: true } : prev);
        // Prize claim atomically claims available refunds — clear refund state immediately
        setEligibleForRefund(false);
        setRefundableAmount(null);
        // Directly query contract state after claim to detect Completed→AllPrizesClaimed
        // This is more reliable than waiting for events/polling/subscriptions
        try {
          const s = await poolContract.state();
          const stateVal = s.toNumber ? s.toNumber() : Number(s);
          setRaffle(prev => {
            if (!prev || prev.stateNum === stateVal) return prev;
            return { ...prev, stateNum: stateVal, state: POOL_STATE_LABELS[stateVal] || prev.state };
          });
        } catch (_) {}
        triggerRefresh();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorDetails = logContractError(error, 'claim prize', {
        raffleAddress: raffle.address,
        userAddress: address,
        prizeType: raffle.standard,
        isMintable: raffle.isPrized && !raffle.isEscrowedPrize
      });
      notifyError(error, { action: raffle.isPrized && !raffle.isEscrowedPrize ? 'mint' : 'claimPrize' });
    } finally {
      setClaimingPrize(false);
    }
  };

  const handleClaimRefund = async () => {
    if (!address || !raffle || !getContractInstance) {
      toast.error('Please connect your wallet to claim your refund');
      return;
    }
    setClaimingRefund(true);
    try {
      const poolContract = getContractInstance(raffle.address, 'pool');
      if (!poolContract) throw new Error('Failed to get pool contract');
      // Preflight simulate to surface revert reason
      try {
        await poolContract.callStatic.claimRefund();
      } catch (simErr) {
        notifyError(simErr, { action: 'claimRefund', phase: 'preflight' });
        throw simErr;
      }
      const result = await executeTransaction(poolContract.claimRefund);
      if (result.success) {
        toast.success('Successfully claimed your refund!');
        // Trigger state refresh instead of page reload
        triggerRefresh();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorDetails = formatErrorForDisplay(error, 'claim refund');
      logContractError(error, 'Claim Refund');
      notifyError(error, { action: 'claimRefund' });
    } finally {
      setClaimingRefund(false);
    }
  };

  if (loading || (isReconnecting && !raffle)) {
    return (
      <PageContainer className="max-w-[85rem]">
        <ContentLoading
          message={isReconnecting ? "Reconnecting wallet..." : "Loading raffle details..."}
          isMobile={isMobile}
        />
      </PageContainer>
    );
  }

  // Show error state with retry option
  if (error && !loading && !isReconnecting) {
    const isWalletError = error.toLowerCase().includes('wallet') ||
                         error.toLowerCase().includes('signer') ||
                         error.toLowerCase().includes('initializing');
    return (
      <PageContainer variant="wide" className="max-w-[85rem] pt-8 pb-4">
        <div className="text-center py-16">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="font-display text-[length:var(--text-3xl)] font-bold mb-4 leading-tight">
            {isWalletError ? "Wallet Connection Issue" : "Failed to Load Raffle"}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            {isWalletError ?
              "Please ensure your wallet is connected and try again." :
              error
            }
          </p>
          <div className="flex gap-4 justify-center">
          <Button
            onClick={fetchRaffleData}
            variant="primary"
            size="md"
            >
            Try Again
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            size="md"
          >
            Back to Home
          </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!raffle) {
    return (
      <PageContainer variant="wide" className="max-w-[85rem] pt-8 pb-4">
        <div className="text-center py-16">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-[length:var(--text-3xl)] font-bold mb-4 leading-tight">Raffle Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The raffle you're looking for doesn't exist or has been removed.
          </p>
          <Button
            onClick={() => navigate('/')}
            variant="primary"
            size="md"
          >
            Back to Home
          </Button>
        </div>
      </PageContainer>
    );
  }

  // Determine if this is a mintable ERC721 prize (vs escrowed)
  // For escrowed prizes: isCollabPool should be false (prize is held by raffle contract)
  // For mintable prizes: isCollabPool should be true (prize is minted from collection)
  const isMintableERC721 = (
    raffle &&
    raffle.prizeCollection &&
    raffle.prizeCollection !== ethers.constants.AddressZero &&
    raffle.standard === 0 &&
    raffle.isCollabPool === true // Only mintable if collab pool
  );



  return (
    <PageContainer variant="wide" className="max-w-[85rem] pt-8 pb-4">
      <div className="mb-8">
        <Button
          onClick={() => navigate(getAppRootUrl())}
          variant="tertiary"
          size="md"
          className="flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Raffles
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>

            <div className="flex items-center gap-2">
              <h1 className="font-display text-[length:var(--text-3xl)] font-bold mb-2 leading-tight">{raffle.name}</h1>
              <Button
                onClick={() => {
                  const shareUrl = `${window.location.origin}${makeSharePath()}`;
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    toast.success('Share link copied to clipboard');
                  }).catch(() => {
                    toast.error('Failed to copy link');
                  });
                }}
                title="Copy share link"
                variant="tertiary"
                size="icon"
                className="ml-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3.9 12a5 5 0 0 1 5-5h2v2h-2a3 3 0 0 0 0 6h2v2h-2a5 5 0 0 1-5-5zm7-1h2v2h-2v-2zm4.1-4a5 5 0 0 1 0 10h-2v-2h2a3 3 0 0 0 0-6h-2V7h2z" />
                </svg>
              </Button>
            </div>
            
            {/* Pool Metadata - displayed right under pool name */}
            {poolMetadata && hasAnyMetadata(poolMetadata) && (
              <div className="mt-3">
                <PoolMetadataDisplay metadata={poolMetadata} loading={loadingMetadata} />
              </div>
            )}

          </div>
          {/* On mobile, stack state badge and creator actions; on desktop, keep inline */}
          <div className="flex flex-col items-start sm:flex-row sm:items-center sm:gap-3 gap-2 w-full sm:w-auto">
            <div className="self-start sm:self-auto">{getStatusBadge()}</div>

            {/* Auto-refresh indicator */}
            {(isAutoRefreshing || (raffle?.stateNum === 3 && lastDrawingStateTime)) && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></div>
                {isMobile ? 'Checking for winners...' : 'Checking for winner selection...'}
              </div>
            )}

            {canDelete() && (
                <Button
                onClick={handleDeleteRaffle}
                variant="primary"
                size="md"
                className="flex items-center gap-2 text-sm font-medium"
                title={raffle.slotsSold > 0 ? "Delete pool (refunds will be processed automatically)" : "Delete this pool"}
                  disabled={deletingRaffle}
              >
                <Trash2 className="h-4 w-4" />
                  {deletingRaffle ? 'Deleting...' : 'Delete Pool'}
                </Button>
            )}

            {/* Claim Points Buttons */}
            {canClaimCreatorPoints && (
              <Button
                onClick={() => handleClaimPoints(true)}
                variant="primary"
                size="md"
                className="text-sm font-medium"
                title="Claim your creator points for this pool"
                disabled={claimingPoints}
              >
                {claimingPoints ? 'Claiming...' : 'Claim Creator Points'}
              </Button>
            )}

            {canClaimParticipantPoints && (
              <Button
                onClick={() => handleClaimPoints(false)}
                variant="primary"
                size="md"
                className="text-sm font-medium"
                title="Claim your participant points for this pool"
                disabled={claimingPoints}
              >
                {claimingPoints ? 'Claiming...' : 'Claim Points'}
              </Button>
            )}

          </div>
        </div>

        {canDelete() && raffle.slotsSold > 0 && (
          <div className="mt-4 p-4 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg">
            <p className="text-sm text-blue-800">
              ℹ️ As the pool creator, you can delete this pool. Deletion will automatically process refunds for all {raffle.slotsSold} sold slots.
            </p>
          </div>
        )}
      </div>

      <div className="detail-beige-card mb-8 p-4 bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl shadow-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-center items-center text-sm">
          <div>
            <p className="font-body text-[length:var(--text-base)] font-medium mb-1">{raffle.slotsSold}</p>
            <p className="text-xs text-foreground/70 dark:text-foreground/80">Slots Sold</p>
          </div>
          <div>
            <p className="font-body text-[length:var(--text-base)] font-medium mb-1">{raffle.slotLimit}</p>
            <p className="text-xs text-foreground/70 dark:text-foreground/80">Total Slots</p>
          </div>
          <div>
            <p className="font-body text-[length:var(--text-base)] font-medium mb-1">{raffle.winnersCount}</p>
            <p className="text-xs text-foreground/70 dark:text-foreground/80">Winner Slot{raffle.winnersCount !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className={`font-medium mb-1 ${isMobile ? 'text-base' : 'text-lg'}`}>{timeValue}</p>
            <p className="text-xs text-foreground/70 dark:text-foreground/80">{timeLabel}</p>
          </div>
          <div className="flex justify-center lg:justify-end items-center h-full w-full">
            {(isRefundable || !raffle?.usesCustomFee) && raffle && (() => {
              const { refundable, reason, label } = getRefundability(raffle);
              return (
                <span className={`px-3 py-1 rounded-full font-semibold ${refundable ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'} text-xs`}
                  title={reason}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {label}
                  <Info className="inline-block ml-1 h-4 w-4 text-gray-400 align-middle" title={reason} />
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Conditional Layout Rendering based on Pool Type */}
      {isNFTPrizedPool(raffle) ? (
        /* NFT Pool Layout - Showcases artwork as hero element */
        <NFTPoolLayout
          raffle={raffle}
          collectionName={raffleCollectionName}
          isMobile={isMobile}
          prizeImageCard={
            <PrizeImageCardNew
              raffle={raffle}
              isMintableERC721={isMintableERC721}
              isEscrowedPrize={isEscrowedPrize}
              variant="hero"
              showFrame={true}
              collectionName={raffleCollectionName}
            />
          }
          ticketPurchaseSection={
            <TicketPurchaseSection
              raffle={raffle}
              onPurchase={handlePurchaseTickets}
              timeRemaining={timeRemaining}
              winners={[]}
              shouldShowClaimPrize={shouldShowClaimPrize}
              prizeAlreadyClaimed={prizeAlreadyClaimed}
              claimingPrize={claimingPrize}
              handleClaimPrize={handleClaimPrize}
              shouldShowClaimRefund={shouldShowClaimRefund}
              claimingRefund={claimingRefund}
              handleClaimRefund={handleClaimRefund}
              refundableAmount={refundableAmount}
              isMintableERC721={isMintableERC721}
              isEscrowedPrize={isEscrowedPrize}
              isCollabPool={isCollabPool}
              isPrized={raffle.isPrized}
              isMobile={isMobile}
              onStateChange={triggerRefresh}
              socialEngagementRequired={raffle?.socialEngagementRequired}
              hasCompletedSocialEngagement={hasCompletedSocialEngagement}
            />
          }
          winnersSection={
            <WinnersSection
              raffle={raffle}
              isMintableERC721={isMintableERC721}
              isEscrowedPrize={isEscrowedPrize}
              isMobile={isMobile}
              onWinnerCountChange={setWinnerCount}
              onWinnersSelectedChange={handleWinnersSelectedChange}
              backendWinners={raffle?._backendWinners}
            />
          }
          raffleDetailsCard={
            <RaffleDetailsCard
              raffle={raffle}
              isEscrowedPrize={isEscrowedPrize}
              raffleCollectionName={raffleCollectionName}
              gatingTokenName={gatingTokenName}
              isMobile={isMobile}
              variant="tab"
            />
          }
          poolActivitySection={
            <PoolActivity
              raffle={raffle}
              activity={poolActivity}
              variant="nft"
            />
          }
          socialVerification={
            raffle?.socialEngagementRequired ? (
              <SocialMediaVerification
                raffle={raffle}
                userAddress={address}
                socialEngagementRequired={raffle.socialEngagementRequired}
                hasCompletedSocialEngagement={hasCompletedSocialEngagement}
                onVerificationComplete={() => triggerRefresh()}
              />
            ) : null
          }
        />
      ) : (
        /* Standard Pool Layout - For whitelist, native, and ERC20 prize pools */
        <StandardPoolLayout
          raffle={raffle}
          isMobile={isMobile}
          ticketPurchaseSection={
            <TicketPurchaseSection
              raffle={raffle}
              onPurchase={handlePurchaseTickets}
              timeRemaining={timeRemaining}
              winners={[]}
              shouldShowClaimPrize={shouldShowClaimPrize}
              prizeAlreadyClaimed={prizeAlreadyClaimed}
              claimingPrize={claimingPrize}
              handleClaimPrize={handleClaimPrize}
              shouldShowClaimRefund={shouldShowClaimRefund}
              claimingRefund={claimingRefund}
              handleClaimRefund={handleClaimRefund}
              refundableAmount={refundableAmount}
              isMintableERC721={isMintableERC721}
              isEscrowedPrize={isEscrowedPrize}
              isCollabPool={isCollabPool}
              isPrized={raffle.isPrized}
              isMobile={isMobile}
              onStateChange={triggerRefresh}
              socialEngagementRequired={raffle?.socialEngagementRequired}
              hasCompletedSocialEngagement={hasCompletedSocialEngagement}
            />
          }
          winnersSection={
            <WinnersSection
              raffle={raffle}
              isMintableERC721={isMintableERC721}
              isEscrowedPrize={isEscrowedPrize}
              isMobile={isMobile}
              onWinnerCountChange={setWinnerCount}
              onWinnersSelectedChange={handleWinnersSelectedChange}
              backendWinners={raffle?._backendWinners}
            />
          }
          raffleDetailsCard={
            <RaffleDetailsCard
              raffle={raffle}
              isEscrowedPrize={isEscrowedPrize}
              raffleCollectionName={raffleCollectionName}
              gatingTokenName={gatingTokenName}
              isMobile={isMobile}
              variant="tab"
            />
          }
          poolActivitySection={
            <PoolActivity
              raffle={raffle}
              activity={poolActivity}
              variant="standard"
            />
          }
          prizeImageCard={
            /* Only show PrizeImageCard for standard layout if there's an NFT prize (edge case) */
            (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) ? (
              <PrizeImageCard raffle={raffle} isMintableERC721={isMintableERC721} isEscrowedPrize={isEscrowedPrize} />
            ) : null
          }
          socialVerification={
            raffle?.socialEngagementRequired ? (
              <SocialMediaVerification
                raffle={raffle}
                userAddress={address}
                socialEngagementRequired={raffle.socialEngagementRequired}
                hasCompletedSocialEngagement={hasCompletedSocialEngagement}
                onVerificationComplete={() => triggerRefresh()}
              />
            ) : null
          }
        />
      )}

    </PageContainer>
  );
};

export default RaffleDetailPage;

