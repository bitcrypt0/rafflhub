import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Ticket, Trophy, DollarSign, Settings, Trash2, Eye, Clock, Users, Gift, Plus, Minus, ShoppingCart, Crown, RefreshCw, Activity, CircleDot } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import RoyaltyAdjustmentComponent from '../components/RoyaltyAdjustmentComponent';

import MinterApprovalComponent from '../components/MinterApprovalComponent';
import { SUPPORTED_NETWORKS } from '../networks';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/Layout';
import ProfileTabs from '../components/ProfileTabs';
import { toast } from '../components/ui/sonner';

import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useProfileData } from '../hooks/useProfileData';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { getTicketsSoldCount } from '../utils/contractCallUtils';
import NewMobileProfilePage from './mobile/NewMobileProfilePage';

function mapPoolState(stateNum) {
  switch (stateNum) {
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
}

const ActivityCard = ({ activity }) => {
  const navigate = useNavigate();
  const { getCurrencySymbol } = useNativeCurrency();

  const getActivityIcon = () => {
    // Icons removed as requested
    return null;
  };

  const getActivityDescription = () => {
    switch (activity.type) {
      case 'ticket_purchase':
        const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`;
        const quantity = activity.quantity || activity.ticketCount || 1;
        return `Purchased ${quantity} ${raffleName} slot${quantity > 1 ? 's' : ''}`;
      case 'raffle_created':
        return `Created raffle "${activity.raffleName}"`;
      case 'raffle_deleted':
        return `Deleted raffle "${activity.raffleName}"`;
      case 'prize_won':
        return `Won prize in "${activity.raffleName}"`;
      case 'prize_claimed':
        const prizeType = activity.prizeType || 'Prize';
        const prizeDetails = activity.amount ? ` (${activity.amount} ${activity.prizeType === 'Native Currency' ? getCurrencySymbol() : activity.prizeType === 'ERC20 Token' ? 'tokens' : ''})` :
                           activity.tokenId ? ` (Token ID: ${activity.tokenId})` : '';
        return `Claimed ${prizeType} from "${activity.raffleName}"${prizeDetails}`;
      case 'refund_claimed':
        return `Claimed refund for "${activity.raffleName}"`;
      case 'revenue_withdrawn':
        return `Withdrew ${activity.amount} ${getCurrencySymbol()} revenue from "${activity.raffleName}"`;
      case 'admin_withdrawn':
        return `Withdrew ${ethers.utils.formatEther(activity.amount)} ${getCurrencySymbol()} admin revenue`;

      default:
        return activity.description;
    }
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-xl hover:border-border/80 transition-all duration-300">
      <div className="flex items-start gap-3">
        <div className="mt-1">
          {getActivityIcon()}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{getActivityDescription()}</p>
          {activity.type === 'ticket_purchase' && activity.amount && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {activity.amount} {getCurrencySymbol()}
            </p>
          )}
          {activity.type === 'prize_claimed' && activity.prizeType && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {activity.prizeType}
              {activity.amount && ` - ${activity.amount} ${activity.prizeType === 'Native Currency' ? getCurrencySymbol() : activity.prizeType === 'ERC20 Token' ? 'tokens' : ''}`}
              {activity.tokenId && ` - Token ID: ${activity.tokenId}`}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {activity.timestamp ? new Date(activity.timestamp * 1000).toLocaleDateString() : 'Unknown date'}
          </p>
          {activity.txHash && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
              Tx: {activity.txHash.slice(0, 10)}...
            </p>
          )}
        </div>
        {activity.raffleAddress && (
          <button
            onClick={() => {
              const slug = activity.chainId && SUPPORTED_NETWORKS[activity.chainId] ? SUPPORTED_NETWORKS[activity.chainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (activity.chainId || '');
              const path = slug ? `/${slug}/raffle/${activity.raffleAddress}` : `/raffle/${activity.raffleAddress}`;
              navigate(path);
            }}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const CreatedRaffleCard = ({ raffle, onDelete, onViewRevenue }) => {
  const navigate = useNavigate();
  const { executeTransaction, getContractInstance } = useContract();
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    let interval;
    function updateTimer() {
      const now = Math.floor(Date.now() / 1000);
      let targetTime;
      if (raffle.state === 'pending') {
        targetTime = raffle.startTime;
        const remaining = targetTime - now;
      if (remaining > 0) {
          setTimeRemaining(formatTime(remaining));
        } else {
          // If still pending after start time, start counting down to end time
          targetTime = raffle.startTime + raffle.duration;
          const remainingToEnd = targetTime - now;
          if (remainingToEnd > 0) {
            setTimeRemaining(formatTime(remainingToEnd));
      } else {
        setTimeRemaining('Ended');
      }
        }
      } else if (raffle.state === 'active') {
        targetTime = raffle.startTime + raffle.duration;
        const remaining = targetTime - now;
        if (remaining > 0) {
          setTimeRemaining(formatTime(remaining));
        } else {
          setTimeRemaining('Ended');
        }
      } else {
        setTimeRemaining('Ended');
      }
    }
    function formatTime(seconds) {
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
    }
    updateTimer();
    interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [raffle]);

  const getStatusBadge = () => {
    // Use the actual contract state instead of time-based logic
    switch (raffle.state) {
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded-full text-xs">Pending</span>;
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs">Active</span>;
      case 'ended':
        return <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-full text-xs">Ended</span>;
      case 'drawing':
        return <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-xs">Drawing</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs">Completed</span>;
      case 'deleted':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full text-xs">Deleted</span>;
      case 'activationFailed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-full text-xs">Activation Failed</span>;
      case 'allPrizesClaimed':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs">All Prizes Claimed</span>;
      case 'unengaged':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full text-xs">Unengaged</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full text-xs">Unknown</span>;
    }
  };

  const canDelete = () => {
    // Updated logic: Raffles can now be deleted even after tickets have been sold
    // The contract will handle refunds automatically
    return raffle.state === 'pending' || raffle.state === 'active';
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold truncate">{raffle.name}</h3>
        {getStatusBadge()}
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Tickets Sold:</span>
          <span>{raffle.ticketsSold} / {raffle.slotLimit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Revenue:</span>
          <span>{ethers.utils.formatEther(raffle.totalRevenue || '0')} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Time:</span>
          <span>{timeRemaining}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => {
              const slug = raffle.chainId && SUPPORTED_NETWORKS[raffle.chainId] ? SUPPORTED_NETWORKS[raffle.chainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (raffle.chainId || '');
              const path = slug ? `/${slug}/raffle/${raffle.address}` : `/raffle/${raffle.address}`;
              navigate(path);
            }}
          className="flex-1 bg-[#614E41] text-white px-3 py-2 rounded-md hover:bg-[#4a3a30] transition-colors text-sm"
        >
          View
        </Button>
        <Button
          onClick={() => onViewRevenue(raffle)}
          disabled={!raffle.totalRevenue || parseFloat(ethers.utils.formatEther(raffle.totalRevenue)) <= 0}
          className="px-3 py-2 bg-[#614E41] text-white rounded-md hover:bg-[#4a3a30] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title={raffle.totalRevenue && parseFloat(ethers.utils.formatEther(raffle.totalRevenue)) > 0 ? "View revenue details" : "No revenue available"}
        >
          Revenue
        </Button>
        <Button
          onClick={() => onDelete(raffle)}
          disabled={!canDelete()}
          className="px-3 py-2 bg-[#614E41] text-white rounded-md hover:bg-[#4a3a30] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title={canDelete() ? (raffle.ticketsSold > 0 ? "Delete raffle (refunds will be processed automatically)" : "Delete this raffle") : "Cannot delete: Raffle is not in pending or active state"}
        >
          Delete
        </Button>
        <Button
          onClick={async () => {
            try {
              const raffleContract = getContractInstance(raffle.address, 'pool');
              if (!raffleContract) throw new Error('Failed to get raffle contract');
              const result = await executeTransaction(raffleContract.mintToWinner);
              if (result.success) {
                toast.success('mintToWinner() executed successfully!');
                window.location.reload();
              } else {
                throw new Error(result.error);
              }
            } catch (err) {
              toast.error(extractRevertReason(err));
            }
          }}
          disabled={!raffle.isCreator}
          className="bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          title={raffle.isCreator ? "Mint NFT to winner" : "Only raffle creator can mint to winner"}
        >
          Mint to Winner
        </Button>
      </div>

      {/* Show deletion info for raffles with sold tickets */}
      {canDelete() && raffle.ticketsSold > 0 && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          <p>ℹ️ Deletion will automatically process refunds for sold tickets</p>
        </div>
      )}

      {/* Show info for non-deletable raffles */}
      {!canDelete() && (
        <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-800">
          <p>⚠️ Cannot delete: Raffle is not in pending or active state</p>
        </div>
      )}
    </div>
  );
};

const PurchasedTicketsCard = ({ ticket, onClaimPrize, onClaimRefund }) => {
  const navigate = useNavigate();

  const canClaimPrize = () => {
    return ticket.isWinner && (ticket.raffleState === 'Completed' || ticket.raffleState === 'AllPrizesClaimed') && !ticket.prizeClaimed;
  };

  const canClaimRefund = () => {
    return !ticket.isWinner && (ticket.raffleState === 'Completed' || ticket.raffleState === 'AllPrizesClaimed') && !ticket.refundClaimed;
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold truncate">{ticket.raffleName}</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">{ticket.quantity} slots</span>
      </div>

      <div className="space-y-1 text-sm mb-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Cost:</span>
          <span>{ethers.utils.formatEther(ticket.totalCost)} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Purchased:</span>
          <span>{ticket.purchaseTime ? new Date((ticket.purchaseTime < 1e12 ? ticket.purchaseTime * 1000 : ticket.purchaseTime)).toLocaleString() : 'Unknown'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">State:</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            ticket.raffleState === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
            ticket.raffleState === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
            ticket.raffleState === 'drawing' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
            ticket.raffleState === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
            ticket.raffleState === 'allPrizesClaimed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
            ticket.raffleState === 'ended' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {ticket.raffleState.charAt(0).toUpperCase() + ticket.raffleState.slice(1)}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => {
              const slug = ticket.chainId && SUPPORTED_NETWORKS[ticket.chainId] ? SUPPORTED_NETWORKS[ticket.chainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (ticket.chainId || '');
              const path = slug ? `/${slug}/raffle/${ticket.raffleAddress}` : `/raffle/${ticket.raffleAddress}`;
              navigate(path);
            }}
          className="w-full bg-[#614E41] text-white px-3 py-2 rounded-md hover:bg-[#4a3a30] transition-colors text-sm"
        >
          Visit Raffle Page
        </Button>

        <Button
          onClick={() => onClaimPrize(ticket)}
          disabled={!canClaimPrize()}
          className="bg-[#614E41] text-white px-3 py-2 rounded-md hover:bg-[#4a3a30] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title={canClaimPrize() ? "Claim your prize" : "Prize not available for claiming"}
        >
          Claim Prize
        </Button>

        {canClaimRefund() && (
          <button
            onClick={() => onClaimRefund(ticket)}
            className="bg-[#614E41] text-white px-3 py-2 rounded-md hover:bg-[#4a3a30] transition-colors text-sm"
          >
            Claim Refund
          </button>
        )}
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const { isMobile, isInitialized } = useMobileBreakpoints();

  // Wait for hydration to complete before making routing decisions
  // This prevents React Error #130 caused by hydration mismatch
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
            Rafflhub
          </div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  // Now safe to route based on mobile detection after hydration is complete
  if (isMobile) {
    return <NewMobileProfilePage />;
  }

  // Desktop/Tablet implementation continues below
  return <DesktopProfilePage />;
};

// Desktop/Tablet ProfilePage implementation (original)
const DesktopProfilePage = () => {
  const { connected, address, provider, chainId } = useWallet();
  const { contracts, getContractInstance, executeTransaction, executeCall } = useContract();
  const navigate = useNavigate();
  const { isMobile } = useMobileBreakpoints(); // Move hook to top to fix Rules of Hooks violation
  const { getCurrencySymbol } = useNativeCurrency();

  // Use the same hook as mobile for consistent data structure
  const {
    userActivity,
    createdRaffles,
    purchasedTickets,
    activityStats,
    creatorStats,
    loading,
    showRevenueModal,
    selectedRaffle,
    setSelectedRaffle,
    fetchCreatedRaffles,
    fetchPurchasedTickets,
    withdrawRevenue,
    claimRefund
  } = useProfileData();

  const [activeTab, setActiveTab] = useState('activity');

  // Transform raw activity data to match ProfileTabs expectations
  const transformedActivities = useMemo(() => {
    return userActivity.map(activity => {
      const getActivityTitle = () => {
        const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`;
        const quantity = activity.quantity || activity.ticketCount || 1;

        switch (activity.type) {
          case 'ticket_purchase':
            return `Purchased ${quantity} ${raffleName} slot${quantity > 1 ? 's' : ''}`;
          case 'raffle_created':
            return `Created raffle "${raffleName}"`;
          case 'raffle_deleted':
            return `Deleted raffle "${raffleName}"`;
          case 'prize_won':
            return `Won prize in "${raffleName}"`;
          case 'prize_claimed':
            return `Claimed prize from "${raffleName}"`;
          case 'refund_claimed':
            return `Claimed refund from "${raffleName}"`;
          case 'revenue_withdrawn':
            return `Withdrew revenue from "${raffleName}"`;
          case 'admin_withdrawn':
            return `Admin withdrawal: ${activity.amount} ${getCurrencySymbol()}`;
          default:
            return activity.description || 'Activity';
        }
      };

      const getActivityDescription = () => {
        switch (activity.type) {
          case 'ticket_purchase':
            return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : '';
          case 'refund_claimed':
            return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : '';
          default:
            return activity.description || '';
        }
      };

      const getActivityIcon = () => {
        switch (activity.type) {
          case 'ticket_purchase':
            return <ShoppingCart className="h-4 w-4 text-blue-500" />;
          case 'raffle_created':
            return <Plus className="h-4 w-4 text-green-500" />;
          case 'raffle_deleted':
            return <Activity className="h-4 w-4 text-red-500" />;
          case 'prize_won':
            return <Crown className="h-4 w-4 text-yellow-500" />;
          case 'prize_claimed':
            return <Crown className="h-4 w-4 text-yellow-500" />;
          case 'refund_claimed':
            return <RefreshCw className="h-4 w-4 text-orange-500" />;
          case 'revenue_withdrawn':
            return <DollarSign className="h-4 w-4 text-green-500" />;
          case 'admin_withdrawn':
            return <DollarSign className="h-4 w-4 text-purple-500" />;
          default:
            return <Activity className="h-4 w-4 text-gray-500" />;
        }
      };

      return {
        ...activity,
        title: getActivityTitle(),
        description: getActivityDescription(),
        icon: getActivityIcon(),
        timestamp: activity.timestamp ? new Date(activity.timestamp < 1e12 ? activity.timestamp * 1000 : activity.timestamp).toLocaleString() : 'Unknown date'
      };
    });
  }, [userActivity]);

  // Utility to extract only the revert reason from contract errors
  function extractRevertReason(error) {
    if (error?.reason) return error.reason;
    if (error?.data?.message) return error.data.message;
    const msg = error?.message || error?.data?.message || error?.toString() || '';
    const match = msg.match(/execution reverted:?\s*([^\n]*)/i);
    if (match && match[1]) return match[1].trim();
    return msg;
  }

  // Note: Fetch functions are now provided by useProfileData hook
  // Removed duplicate fetchOnChainActivity function


  // Note: fetchCreatedRaffles is now provided by useProfileData hook


  // Note: fetchPurchasedTickets is now provided by useProfileData hook


  // Load data when wallet connects, reset when disconnects
  // Note: Data fetching is now handled by useProfileData hook

  const handleDeleteRaffle = async (raffle) => {
    let confirmMessage = `Are you sure you want to delete "${raffle.name}"?`;

    if (raffle.ticketsSold > 0) {
      confirmMessage += `\n\nThis raffle has ${raffle.ticketsSold} sold tickets. Deletion will automatically process refunds for all participants.`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const raffleContract = getContractInstance(raffle.address, 'pool');
      if (!raffleContract) {
        throw new Error('Failed to get raffle contract');
      }

      const result = await executeTransaction(raffleContract.deleteRaffle);

      if (result.success) {
        const successMessage = raffle.ticketsSold > 0
          ? `Raffle deleted successfully! Refunds have been processed automatically for ${raffle.ticketsSold} sold tickets.`
          : 'Raffle deleted successfully!';
        toast.success(successMessage);
        // Refresh data after deletion
        setLoading(true);
        await Promise.all([
          fetchCreatedRaffles(),
          fetchPurchasedTickets()
        ]);
        setLoading(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(extractRevertReason(error));
    }
  };

  const handleViewRevenue = (raffle) => {
    setSelectedRaffle(raffle);
    setShowRevenueModal(true);
  };

  const handleClaimPrize = async (ticket) => {
    try {
      const poolContract = getContractInstance(ticket.raffleAddress, 'pool');
      if (!poolContract) {
        throw new Error('Failed to get pool contract');
      }

      let result;
      if (ticket.prizeAmount > 1) {
        // Multiple prizes - use claimPrizes
        result = await executeTransaction(poolContract.claimPrizes, ticket.prizeAmount);
      } else {
        // Single prize - use claimPrize
        result = await executeTransaction(poolContract.claimPrize);
      }

      if (result.success) {
        toast.success('Prize claimed successfully!');
        // Refresh data after claiming
        setLoading(true);
        await Promise.all([
          fetchCreatedRaffles(),
          fetchPurchasedTickets()
        ]);
        setLoading(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(extractRevertReason(error));
    }
  };

  const handleClaimRefund = async (ticket) => {
    try {
      const poolContract = getContractInstance(ticket.raffleAddress, 'pool');
      if (!poolContract) {
        throw new Error('Failed to get pool contract');
      }

      const refundClaimed = await poolContract.refundedNonWinningTickets(address);
      const refundClaimedBool = refundClaimed && refundClaimed.gt && refundClaimed.gt(0);

      const result = await executeTransaction(poolContract.claimRefund);

      if (result.success) {
        toast.success('Refund claimed successfully!');
        // Refresh data after claiming
        setLoading(true);
        await Promise.all([
          fetchCreatedRaffles(),
          fetchPurchasedTickets()
        ]);
        setLoading(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(extractRevertReason(error));
    }
  };

  if (!connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">

          <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your profile and activity.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'activity', label: 'Activity', icon: Clock },
    { id: 'created', label: 'My Raffles', icon: Users },
    { id: 'tickets', label: 'Slots Purchased', icon: CircleDot },
    { id: 'collections', label: 'Creator Dashboard', icon: Settings }
  ];

  const getPrizeType = (raffle) => {
    // Note: This is a simplified version. Full collab detection requires async holderTokenAddress() check
    // For now, only detecting NFT Collab via isCollabPool until async enhancement is implemented
    if (raffle.isCollabPool) return 'NFT Collab';
    if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
      // Display native currency ticker + 'Giveaway' (e.g., 'AVAX Giveaway', 'ETH Giveaway')
      return `${getCurrencySymbol()} Giveaway`;
    }
    if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
      // Display 'Token Giveaway' for ERC20 tokens
      return 'Token Giveaway';
    }
    if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) return 'NFT Prize';
    return raffle.isPrized ? 'Token Giveaway' : 'Whitelist';
  }

  return (
    <PageContainer variant="profile" className={isMobile ? 'py-4' : 'py-8'}>
      <div className={isMobile ? 'mb-6' : 'mb-8'}>
        <div className={`${isMobile ? 'mb-4' : 'flex items-center justify-between mb-4'}`}>
          <div>
            <h1 className={`font-bold mb-2 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>Profile</h1>
            <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
              Track activities, manage your raffles, revenue and collections
            </p>
          </div>
        </div>
        <div className={`mt-4 bg-muted/50 backdrop-blur-sm border border-border/30 rounded-lg ${isMobile ? 'p-3' : 'p-4'}`}>
          <p className="text-sm font-medium">Connected Account:</p>
          <p className={`font-mono ${isMobile ? 'text-xs break-all' : 'text-sm'}`}>{address}</p>
        </div>
      </div>

        {/* Activity Stats - Mobile Optimized */}
        {!isMobile && (
          <div className="mb-8">
            <h2 className={`font-semibold mb-4 ${isMobile ? 'text-lg' : 'text-xl'}`}>Activity Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl border-border/80 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <Ticket className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{Number(activityStats.totalSlotsPurchased || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Slots Purchased</p>
                  </div>
                </div>
              </div>
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl border-border/80 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <Plus className="h-8 w-8 text-green-500" />
                  <div>
                    <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{Number(activityStats.totalRafflesCreated || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Raffles Created</p>
                  </div>
                </div>
              </div>
              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl border-border/80 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{Number(activityStats.totalPrizesWon || 0).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Wins</p>
                  </div>
                </div>
              </div>

              <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl border-border/80 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>
                      {(() => {
                        const bn = activityStats.totalClaimableRefunds;
                        const symbol = getCurrencySymbol();
                        if (!bn || !bn.toString) return `0 ${symbol}`;
                        try {
                          const v = parseFloat(ethers.utils.formatEther(bn));
                          // Show up to 8 decimals; trim trailing zeros for cleaner rendering
                          const fixed = v.toFixed(8);
                          const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
                          const out = (trimmed === '' || trimmed === '.') ? '0' : trimmed;
                          return `${out} ${symbol}`;
                        } catch {
                          return `0 ${symbol}`;
                        }
                      })()}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Claimable Refunds</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Tabs - now always rendered; show lightweight loader above */}
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading on-chain data…</p>
          </div>
        )}
        <ProfileTabs
          activities={transformedActivities}
          createdRaffles={createdRaffles}
          purchasedTickets={purchasedTickets}
          creatorStats={creatorStats}
          onDeleteRaffle={handleDeleteRaffle}
          onViewRevenue={handleViewRevenue}
          onClaimPrize={handleClaimPrize}
          onClaimRefund={handleClaimRefund}
        />

        {/* Revenue Modal */}
        {showRevenueModal && selectedRaffle && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card/90 backdrop-blur-md border border-border/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <h3 className="text-lg font-semibold mb-4">Revenue Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Raffle:</span>
                  <span className="font-medium">{selectedRaffle.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Revenue:</span>
                  <span className="font-medium">{ethers.utils.formatEther(selectedRaffle.totalRevenue)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tickets Sold:</span>
                  <span className="font-medium">{selectedRaffle.ticketsSold}</span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRevenueModal(false)}
                  className="flex-1 bg-[#614E41] text-white px-4 py-2 rounded-md hover:bg-[#4a3a30] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Handle revenue withdrawal
                    setShowRevenueModal(false);
                  }}
                  className="flex-1 bg-[#614E41] text-white px-4 py-2 rounded-md hover:bg-[#4a3a30] transition-colors"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        )}
    </PageContainer>
  );
};

export default ProfilePage;

