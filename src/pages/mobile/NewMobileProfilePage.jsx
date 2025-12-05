import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useContract } from '../../contexts/ContractContext';
import { useProfileData } from '../../hooks/useProfileData';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../../hooks/useNativeCurrency';
import { Clock, Users, Settings, Activity, ShoppingCart, Crown, RefreshCw, Plus, Search, UserPlus, DollarSign, AlertCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../components/ui/sonner';
import { ResponsiveAddressInput, ResponsiveNumberInput } from '../../components/ui/responsive-input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { notifyError } from '../../utils/notificationService';
import { ethers } from 'ethers';
import { contractABIs } from '../../contracts/contractABIs';
import KOLApprovalComponent from '../../components/KOLApprovalComponent';
import VestingConfigurationComponent from '../../components/VestingConfigurationComponent';

import { SUPPORTED_NETWORKS } from '../../networks';

/**
 * New Mobile Profile Page - Simple, stable implementation
 * No dynamic component rendering to prevent React Error #130
 */
const NewMobileProfilePage = () => {
  const { connected, address, provider } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('activity');
  const [activeDashboardComponent, setActiveDashboardComponent] = useState(null);
  const { getCurrencySymbol, formatRevenueAmount } = useNativeCurrency();
  const fetchSeqRef = useRef(0);

  
  // Use existing data hook - match desktop data usage
  const {
    userActivity,
    createdRaffles,
    purchasedTickets,
    activityStats,
    loading,
    claimRefund,
    creatorStats
  } = useProfileData();


  // Unified raffle state badge renderer (matches LandingPage/RaffleDetailPage styles)
  const renderStateBadge = (value, opts = {}) => {
    const { stateNum, winnerCount } = opts;
    const labels = ['Pending','Active','Ended','Drawing','Completed','Deleted','AllPrizesClaimed','Unengaged'];
    let label = 'Unknown';
    if (Number.isFinite(stateNum)) {
      label = (stateNum === 6 && typeof winnerCount === 'number')
        ? (winnerCount === 1 ? 'Prize Claimed' : 'Prizes Claimed')
        : (labels[stateNum] || 'Unknown');
    } else if (typeof value === 'string') {
      const key = value.toLowerCase().replace(/[^a-z]/g, '');
      const strMap = {
        pending: 'Pending',
        active: 'Active',
        ended: 'Ended',
        drawing: 'Drawing',
        completed: 'Completed',
        deleted: 'Deleted',
        allprizesclaimed: 'AllPrizesClaimed',
        all_prizes_claimed: 'AllPrizesClaimed',
        unengaged: 'Unengaged',
        unknown: 'Unknown'
      };
      label = strMap[key] || (value.charAt(0).toUpperCase() + value.slice(1));
    }
    const colorMap = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Active': 'bg-green-100 text-green-800',
      'Ended': 'bg-red-100 text-red-800',
      'Drawing': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-blue-100 text-blue-800',
      'Deleted': 'bg-gray-200 text-gray-800',
      'AllPrizesClaimed': 'bg-blue-200 text-blue-900',
      'Prize Claimed': 'bg-blue-200 text-blue-900',
      'Unengaged': 'bg-gray-100 text-gray-800',
      'Unknown': 'bg-gray-100 text-gray-800'
    };
    return (
      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${colorMap[label] || colorMap['Unknown']}`}>{label}</span>
    );
  };

  // Dashboard component states
  const [dashboardStates, setDashboardStates] = useState({
    royalty: {
      loading: false,
      collectionData: { address: '', type: null, royaltyPercentage: '', royaltyRecipient: '' },
      collectionInfo: null,
      loadingInfo: false,
      isRevealed: null,
      revealing: false
    },
    minter: {
      loading: false,
      collectionAddress: '',
      minterAddress: '',
      isApproved: false,
      isLocked: false,
      currentMinter: '',
      collectionName: '',
      collectionSymbol: '',
      collectionType: null, // 'erc721' or 'erc1155'
      fetchedCollection: '',
      error: '',
      success: ''
    },
    kol: {
      loading: false,
      collectionAddress: '',
      kolAddress: '',
      poolLimit: '',
      enforcedSlotFee: '',
      enforcedWinnerCount: '',
      error: '',
      success: '',
      collectionName: '',
      collectionSymbol: '',
      collectionType: null,
      kolDetails: null,
      kolDetailsLoading: false
    },
    tokenCreator: {
      loading: false,
      collectionData: { address: '', type: null },
      collectionInfo: null,
      loadingInfo: false,
      tokenCreationData: { tokenId: '', maxSupply: '' },
      uriData: { tokenId: '', tokenURI: '' }
    },
    revenue: {
      loading: false,
      raffleData: { address: '', isCreator: false, revenueAmount: '0', raffleState: 'unknown' },
      createdRaffles: [],
      // Creator Mint state
      mintData: {
        collectionAddress: '',
        collectionType: 'erc721', // erc721 or erc1155
        recipient: '',
        quantity: '',
        tokenId: '' // Only for ERC1155
      },
      mintLoading: false,
      collectionInfo: null,
      loadingCollectionInfo: false
    }
  });

  // Wallet connection check
  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your profile and activity.
          </p>
        </div>
      </div>
    );
  }



  // Activity section rendering
  const renderActivitySection = () => {
    const getActivityIcon = (type) => {
      switch (type) {
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

    const getActivityTitle = (activity) => {
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

    const getActivityDescription = (activity) => {
      const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`;
      switch (activity.type) {
        case 'ticket_purchase':
          return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : '';
        case 'prize_won':
          return `${raffleName} • Congratulations!`;
        case 'prize_claimed':
          const prizeType = activity.prizeType || 'Prize';
          const prizeDetails = activity.amount ? ` (${activity.amount} ${activity.prizeType === 'Native Currency' ? getCurrencySymbol() : activity.prizeType === 'ERC20 Token' ? 'tokens' : ''})` :
                             activity.tokenId ? ` (Token ID: ${activity.tokenId})` : '';
          return `${prizeType}${prizeDetails}`;
        case 'refund_claimed':
          return activity.amount ? `${raffleName} • ${activity.amount} ${getCurrencySymbol()}` : raffleName;
        case 'revenue_withdrawn':
          return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : '';
        default:
          return activity.description || '';
      }
    };

    const formatDate = (value) => {
      try {
        if (!value && value !== 0) return 'Unknown';
        let tsMs;
        if (value instanceof Date) {
          tsMs = value.getTime();
        } else if (typeof value === 'number') {
          // If it's likely seconds, scale to ms
          tsMs = value < 1e12 ? value * 1000 : value;
        } else {
          const d = new Date(value);
          tsMs = isNaN(d.getTime()) ? null : d.getTime();
        }
        if (tsMs == null) return 'Unknown';
        const nowMs = Date.now();
        let diffSec = Math.floor((nowMs - tsMs) / 1000);
        if (diffSec < 0) diffSec = 0; // future timestamps -> Just now
        if (diffSec < 60) return diffSec <= 1 ? 'Just now' : `${diffSec}s ago`;
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        return `${diffDay}d ago`;
      } catch (_) {
        return 'Unknown';
      }
    };

    const handleRaffleClick = (raffleAddress) => {
      const currentChainId = (typeof window !== 'undefined' && window.ethereum && window.ethereum.chainId) ? parseInt(window.ethereum.chainId, 16) : null;
      const slug = currentChainId && SUPPORTED_NETWORKS[currentChainId]
        ? SUPPORTED_NETWORKS[currentChainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : (currentChainId || '');
      const path = slug ? `/${slug}/raffle/${raffleAddress}` : `/raffle/${raffleAddress}`;
      navigate(path);
    };

    if (!userActivity || userActivity.length === 0) {
      return (
        <div className="p-6">
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
            <p className="text-muted-foreground text-sm">
              Activity will appear here once you participate in raffles.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <span className="text-sm text-muted-foreground">{userActivity.length} activities</span>
        </div>

        {userActivity.slice(0, 10).map((activity, index) => (
          <div
            key={activity.id || index}
            className="bg-card border border-border rounded-lg p-4 hover:bg-card/90 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(activity.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm">
                      {getActivityTitle(activity)}
                    </h4>
                    <p className="text-muted-foreground text-sm mt-1">
                      {getActivityDescription(activity)}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground flex-shrink-0">
                    {formatDate(activity.timestamp)}
                  </span>
                </div>

                <div className="flex gap-2 mt-3">
                  {activity.type === 'ticket_purchase' && activity.state === 'ended' && (
                    <Button
                      onClick={() => claimRefund(activity.raffleAddress)}
                      variant="primary"
                      size="sm"
                    >
                      Claim Refund
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Dashboard section rendering with all four components
  const renderDashboardSection = () => {
    if (activeDashboardComponent) {
      return (
        <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
          {/* Component renders immediately in full viewport */}
          {renderDashboardComponent(activeDashboardComponent)}
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4 mobile-component-container">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Creator Dashboard</h3>
        </div>

        {/* Creator Stats - Match Desktop Calculations Exactly */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{createdRaffles.length}</div>
            <div className="text-sm text-muted-foreground">Total Raffles</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{createdRaffles.filter(r => r.state === 'active').length}</div>
            <div className="text-sm text-muted-foreground">Active Raffles</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">
              {formatRevenueAmount(activityStats.withdrawableRevenue || '0')}
            </div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">
              {createdRaffles.length > 0 ?
                Math.round((createdRaffles.filter(r => r.state === 'completed').length / createdRaffles.length) * 100) : 0}%
            </div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
        </div>

        {/* Dashboard Components */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground mb-3">Creator Tools</div>

          {/* Royalty & Reveal */}
          <button
            onClick={() => setActiveDashboardComponent('royalty')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-card/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Royalty & Reveal</div>
                <div className="text-sm text-muted-foreground">Manage royalties and reveal collections</div>
              </div>
            </div>
          </button>

          {/* Configure Creator Allocation & Vesting */}
          <button
            onClick={() => setActiveDashboardComponent('vesting')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-card/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Supply, Creator Allocation & Vesting Management</div>
                <div className="text-sm text-muted-foreground">Configure vesting schedules for creator token allocations</div>
              </div>
            </div>
          </button>

          {/* Minter Approval */}
          <button
            onClick={() => setActiveDashboardComponent('minter')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-card/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Minter Approval</div>
                <div className="text-sm text-muted-foreground">Manage minter approvals for collections</div>
              </div>
            </div>
          </button>

          {/* KOL Approval Management */}
          <button
            onClick={() => setActiveDashboardComponent('kol')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-card/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">KOL Approval Management</div>
                <div className="text-sm text-muted-foreground">Approve Key Opinion Leaders (KOLs) for collections with specific pool limits and slot fees</div>
              </div>
            </div>
          </button>

          {/* Create New Token ID & Set Token URI */}
          <button
            onClick={() => setActiveDashboardComponent('tokenCreator')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-card/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Create New Token ID & Set Token URI</div>
                <div className="text-sm text-muted-foreground">Add new token IDs to ERC1155 collections and set metadata URIs</div>
              </div>
            </div>
          </button>

          {/* Creator Mint & Revenue Withdrawal */}
          <button
            onClick={() => setActiveDashboardComponent('revenue')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-card/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Creator Mint & Revenue Withdrawal</div>
                <div className="text-sm text-muted-foreground">Withdraw revenue from completed raffles</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  };

  // Individual dashboard component rendering
  const renderDashboardComponent = (componentType) => {
    const handleBack = () => setActiveDashboardComponent(null);

    switch (componentType) {
      case 'royalty':
        return renderRoyaltyComponent(handleBack);
      case 'vesting':
        return renderVestingComponent(handleBack);
      case 'minter':
        return renderMinterComponent(handleBack);
      case 'kol':
        return renderKOLComponent(handleBack);
      case 'tokenCreator':
        return renderTokenCreatorComponent(handleBack);
      case 'revenue':
        return renderRevenueComponent(handleBack);
      default:
        return renderDashboardSection();
    }
  };

  // Royalty & Reveal Component
  const renderRoyaltyComponent = (handleBack) => {
    const state = dashboardStates.royalty;

    const updateRoyaltyState = (updates) => {
      setDashboardStates(prev => ({
        ...prev,
        royalty: { ...prev.royalty, ...updates }
      }));
    };

    const handleChange = (field, value) => {
      const next = { ...state.collectionData, [field]: value };
      updateRoyaltyState({ collectionData: next });
      if (field === 'address') {
        const addr = (value || '').trim();
        console.log('royalty.handleChange.address', { addr, connected, hasProvider: !!provider, loadingInfo: state.loadingInfo });
        if (ethers.utils.isAddress(addr) && !state.loadingInfo) {
          console.log('royalty.handleChange.scheduleLoad', { delayMs: 400 });
          setTimeout(() => {
            console.log('royalty.handleChange.invokeLoad', { invokedAddr: addr, loadingInfo: state.loadingInfo });
            if (!state.loadingInfo) {
              loadCollectionInfo(addr);
            }
          }, 400);
        }
      }
    };

    const loadCollectionInfo = async (addrOverride) => {
      const addr = ((addrOverride ?? state.collectionData.address) || '').trim();
      console.log('royalty.load.start', { addr, connected, hasProvider: !!provider });
      if (!ethers.utils.isAddress(addr)) {
        console.warn('royalty.load.invalidAddress', { addr });
        toast.error('Please enter a valid collection address');
        return;
      }
      if (!provider) {
        console.warn('royalty.load.noProvider');
        toast.error('Provider not available. Please connect your wallet');
        return;
      }

      updateRoyaltyState({ loadingInfo: true });
      try {
        // Auto-detect collection type by trying both ERC721 and ERC1155 - matches desktop
        let contract = null;
        let detectedType = null;

        // Try ERC721 first
        try {
          const erc721Contract = getContractInstance(addr, 'erc721Prize');
          if (erc721Contract) {
            // Test if it's actually ERC721 using proper detection methods
            try {
              // Check if it supports ERC721 interface
              const supportsERC721 = await erc721Contract.supportsInterface('0x80ac58cd');
              console.log('royalty.detect.erc721.supports', { supportsERC721 });
              if (supportsERC721) {
                contract = erc721Contract;
                detectedType = 'erc721';
              }
            } catch (e) {
              // Try alternative method - check for ERC721-specific function
              try {
                // Try calling balanceOf with one parameter (address) - ERC721 specific
                await erc721Contract.balanceOf(addr);
                console.log('royalty.detect.erc721.balanceOf.success');
                contract = erc721Contract;
                detectedType = 'erc721';
              } catch (e2) {
                // Not ERC721
                console.log('royalty.detect.erc721.balanceOf.fail', { error: e2?.message });
              }
            }
          }
        } catch (error) {
          // ERC721 failed, continue to ERC1155
          console.log('royalty.detect.erc721.error', { error: error?.message });
        }

        // If ERC721 failed, try ERC1155
        if (!contract) {
          try {
            const erc1155Contract = getContractInstance(addr, 'erc1155Prize');
            if (erc1155Contract) {
              // Test if it's actually ERC1155 using proper detection methods
              try {
                // Check if it supports ERC1155 interface
                const supportsERC1155 = await erc1155Contract.supportsInterface('0xd9b67a26');
                console.log('royalty.detect.erc1155.supports', { supportsERC1155 });
                if (supportsERC1155) {
                  contract = erc1155Contract;
                  detectedType = 'erc1155';
                }
              } catch (e) {
                // Try alternative method - check for ERC1155-specific function
                try {
                  // Try calling uri(0) - ERC1155 specific
                  await erc1155Contract.uri(0);
                  console.log('royalty.detect.erc1155.uri.success');
                  contract = erc1155Contract;
                  detectedType = 'erc1155';
                } catch (e2) {
                  // Not ERC1155
                  console.log('royalty.detect.erc1155.uri.fail', { error: e2?.message });
                }
              }
            }
          } catch (error) {
            // Neither worked
            console.log('royalty.detect.erc1155.error', { error: error?.message });
          }
        }

        if (!contract || !detectedType) {
          throw new Error('Invalid collection address or unsupported contract type');
        }

        // Update the collection type in state
        console.log('royalty.detect.done', { detectedType });
        updateRoyaltyState({
          collectionData: { ...state.collectionData, type: detectedType }
        });

        // Get collection info (handle ERC1155 contracts that may not have name/symbol)
        let name = 'Unknown Collection';
        let symbol = 'Unknown';
        let owner = 'Unknown';

        try {
          if (typeof contract.name === 'function') {
            name = await contract.name();
          }
        } catch (e) {}

        try {
          if (typeof contract.symbol === 'function') {
            symbol = await contract.symbol();
          }
        } catch (e) {}

        try {
          if (typeof contract.owner === 'function') {
            owner = await contract.owner();
          }
        } catch (e) {}

        const isOwner = owner !== 'Unknown' && owner.toLowerCase() === address.toLowerCase();

        // Get current royalty info
        const royaltyInfo = await contract.royaltyInfo(1, 10000); // Query with token ID 1 and sale price 10000
        const royaltyPercentage = await contract.royaltyPercentage();
        const royaltyRecipient = await contract.royaltyRecipient();

        updateRoyaltyState({
          collectionInfo: {
            address: addr,
            name,
            symbol,
            owner,
            type: detectedType,
            isOwner,
            currentRoyaltyPercentage: royaltyPercentage.toString(),
            currentRoyaltyRecipient: royaltyRecipient,
            royaltyAmount: royaltyInfo[1].toString()
          },
          collectionData: {
            ...state.collectionData,
            type: detectedType,
            royaltyPercentage: (royaltyPercentage.toNumber() / 100).toString(),
            royaltyRecipient: royaltyRecipient
          }
        });
        console.log('royalty.load.info', { name, symbol, owner, isOwner, royaltyPercentage: royaltyPercentage.toString(), royaltyRecipient });

        // Check revealed status - match desktop implementation
        try {
          const revealed = await contract.isRevealed();
          updateRoyaltyState({ isRevealed: !!revealed });
          console.log('royalty.load.revealed', { revealed: !!revealed });
        } catch (e) {
          console.log('royalty.load.revealed.fail', { error: e?.message });
          updateRoyaltyState({ isRevealed: null });
        }

        toast.success('Collection loaded successfully!');
        console.log('royalty.load.success');
      } catch (error) {
        console.error('royalty.load.error', error);
        notifyError(error, { action: 'loadCollectionInfoMobile' });
        updateRoyaltyState({ collectionInfo: null, isRevealed: null });
      } finally {
        updateRoyaltyState({ loadingInfo: false });
        console.log('royalty.load.end');
      }
    };

    const handleUpdateRoyalty = async () => {
      if (!connected || !state.collectionInfo) {
        toast.error('Please connect your wallet and load collection info first');
        return;
      }

      if (!state.collectionInfo.isOwner) {
        toast.error('You are not the owner of this collection');
        return;
      }

      const royaltyPercentage = parseFloat(state.collectionData.royaltyPercentage);
      if (isNaN(royaltyPercentage) || royaltyPercentage < 0) {
        toast.error('Please enter a valid royalty percentage (minimum 0%)');
        return;
      }

      if (!state.collectionData.royaltyRecipient) {
        toast.error('Please enter a royalty recipient address');
        return;
      }

      updateRoyaltyState({ loading: true });
      try {
        const contractType = state.collectionData.type === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
        const contract = getContractInstance(state.collectionData.address, contractType);

        if (!contract) {
          throw new Error('Failed to create contract instance');
        }

        const royaltyBasisPoints = Math.floor(royaltyPercentage * 100);

        const result = await executeTransaction(
          contract.setRoyalty,
          royaltyBasisPoints,
          state.collectionData.royaltyRecipient
        );

        if (result.success) {
          toast.success(`Royalty updated successfully! Transaction: ${result.hash}`);
          await loadCollectionInfo();
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Error updating royalty:', error);
        notifyError(error, { action: 'updateRoyaltyMobile' });
      } finally {
        updateRoyaltyState({ loading: false });
      }
    };

    const handleReveal = async () => {
      if (!connected || !state.collectionInfo) {
        toast.error('Please connect your wallet and load collection info first');
        return;
      }

      updateRoyaltyState({ revealing: true });
      try {
        const contractType = state.collectionData.type === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
        const contract = getContractInstance(state.collectionData.address, contractType);
        if (!contract) throw new Error('Failed to create contract instance');

        const result = await executeTransaction(contract.reveal);
        if (result.success) {
          toast.success('Collection revealed successfully!');
          await loadCollectionInfo();
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        notifyError(error, { action: 'revealCollectionMobile' });
      } finally {
        updateRoyaltyState({ revealing: false });
      }
    };

    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={handleBack} variant="tertiary" size="md">
            ← Back
          </Button>
          <h3 className="text-lg font-semibold">Royalty & Reveal</h3>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Royalty & Reveal Management
            </CardTitle>
            <CardDescription>
              Manage royalties and reveal collections for your NFT contracts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Collection Lookup */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4" />
                <h3 className="text-sm font-medium">Collection Lookup</h3>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Collection Address</label>
                <ResponsiveAddressInput
                  value={state.collectionData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="0x..."
                  className="flex-1"
                />
              </div>
            </div>

            {/* Collection Info Display */}
            {state.collectionInfo && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Collection Information</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="break-words"><span className="font-medium">Name:</span> {state.collectionInfo.name}</div>
                  {state.collectionInfo.symbol && (
                    <div className="break-words"><span className="font-medium">Symbol:</span> {state.collectionInfo.symbol}</div>
                  )}
                  <div><span className="font-medium">Type:</span> {state.collectionInfo.type?.toUpperCase()}</div>
                  <div className="break-all">
                    <span className="font-medium">Owner:</span>
                    <span className="ml-1 font-mono text-xs">{state.collectionInfo.owner}</span>
                  </div>
                  <div><span className="font-medium">Current Royalty:</span> {(parseFloat(state.collectionInfo.currentRoyaltyPercentage) / 100).toFixed(2)}%</div>
                  <div className="break-all">
                    <span className="font-medium">Royalty Recipient:</span>
                    <span className="ml-1 font-mono text-xs">{state.collectionInfo.currentRoyaltyRecipient}</span>
                  </div>
                  {state.isRevealed !== null && (
                    <div><span className="font-medium">Revealed:</span> {state.isRevealed ? 'Yes' : 'No'}</div>
                  )}
                </div>

                {/* Reveal Button */}
                {state.collectionInfo.isOwner && state.isRevealed === false && (
                  <Button
                    onClick={handleReveal}
                    disabled={state.revealing || !connected}
                    variant="primary"
                    size="md"
                    className="w-full"
                  >
                    {state.revealing ? 'Revealing...' : 'Reveal Collection'}
                  </Button>
                )}
              </div>
            )}

            {/* Royalty Update Form */}
            {state.collectionInfo && state.collectionInfo.isOwner && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Update Royalty Settings</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      New Royalty Percentage (%)
                    </label>
                    <ResponsiveNumberInput
                      min="0"
                      step="0.01"
                      value={state.collectionData.royaltyPercentage}
                      onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                      placeholder="2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      New Royalty Recipient
                    </label>
                    <ResponsiveAddressInput
                      value={state.collectionData.royaltyRecipient}
                      onChange={(e) => handleChange('royaltyRecipient', e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                </div>

                <Button
                  onClick={handleUpdateRoyalty}
                  disabled={state.loading || !connected || !state.collectionInfo || !state.collectionInfo.isOwner}
                  variant="primary"
                  size="md"
                  className="w-full h-10 flex items-center justify-center gap-2 shadow-sm text-sm"
                >
                  <Settings className="h-4 w-4" />
                  {state.loading ? 'Updating...' : 'Update Royalty Settings'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Vesting Configuration Component - Mobile Wrapper
  const renderVestingComponent = (handleBack) => {
    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={handleBack} variant="tertiary" size="md">
            ← Back
          </Button>
          <h2 className="text-xl font-semibold">Supply, Creator Allocation & Vesting Management</h2>
        </div>
        <VestingConfigurationComponent />
      </div>
    );
  };

  // Minter Approval Component - Desktop Parity Implementation
  const renderMinterComponent = (handleBack) => {
    const state = dashboardStates.minter;

    const updateMinterState = (updates) => {
      setDashboardStates(prev => ({
        ...prev,
        minter: { ...prev.minter, ...updates }
      }));
    };

    const sanitizeAddress = (addr) => {
      if (!addr) return '';
      const trimmed = String(addr).trim().replace(/\u200B|\u200C|\u200D|\u2060|\uFEFF/g, '');
      const normalizedPrefix = trimmed.startsWith('0X') ? '0x' + trimmed.slice(2) : trimmed;
      console.log('sanitizeAddress', { input: addr, output: normalizedPrefix });
      return normalizedPrefix;
    };

    const validateAddress = (address) => {
      const a = sanitizeAddress(address);
      const isValid = ethers.utils.isAddress(a);
      console.log('validateAddress', { input: address, sanitized: a, isValid });
      return isValid;
    };

    const extractRevertReason = (error) => {
      if (error?.reason) return error.reason;
      if (error?.message) {
        const match = error.message.match(/reason="([^"]+)"/);
        if (match) return match[1];
        return error.message;
      }
      return 'Transaction failed';
    };

    // Fetch collection details by address - matches desktop implementation exactly
    const fetchCollection = async (addrParam) => {
      const mySeq = ++fetchSeqRef.current;
      console.log('minter.fetchCollection.begin', { seq: mySeq, raw: addrParam });
      updateMinterState({
        error: '',
        success: '',
        fetchedCollection: '',
        isLocked: false,
        currentMinter: '',
        isApproved: false,
        collectionName: '',
        collectionSymbol: '',
        collectionType: null
      });

      const addr = sanitizeAddress(addrParam ?? state.collectionAddress);
      if (!validateAddress(addr)) {
        console.warn('minter.fetchCollection.invalidAddress', { addr });
        updateMinterState({ error: 'Please enter a valid Ethereum contract address.' });
        return;
      }

      if (!provider) {
        console.warn('minter.fetchCollection.noProvider');
        updateMinterState({ error: 'Provider not available.' });
        return;
      }

      try {
        updateMinterState({ loading: true });

        const bytecode = await provider.getCode(addr);
        console.log('minter.fetchCollection.bytecode', { addr, bytecode });
        if (!bytecode || bytecode === '0x') {
          updateMinterState({ error: 'The provided address is not a contract.' , loading: false });
          return;
        }

        // Try fetching with ERC721 ABI first - matches desktop exactly
        let contract = new ethers.Contract(
          addr,
          contractABIs.erc721Prize,
          provider
        );

        let isERC721 = false;
        let collectionName = '';
        let collectionSymbol = '';

        try {
          // Test ERC721 compatibility by calling minter functions - matches desktop
          const locked = await contract.minterLocked();
          const currentMinter = await contract.minter();

          updateMinterState({
            isLocked: locked,
            currentMinter,
            collectionType: 'erc721'
          });
          isERC721 = true;
          console.log('minter.fetchCollection.detectedERC721', { addr, locked, currentMinter });
        } catch (err) {
          // If ERC721 ABI fails, try ERC1155 ABI - matches desktop
          contract = new ethers.Contract(
            addr,
            contractABIs.erc1155Prize,
            provider
          );
          try {
            const locked = await contract.minterLocked();
            const currentMinter = await contract.minter();

            updateMinterState({
              isLocked: locked,
              currentMinter,
              collectionType: 'erc1155'
            });
            console.log('minter.fetchCollection.detectedERC1155', { addr, locked, currentMinter });
          } catch (err) {
            console.error('minter.fetchCollection.detectFailed', { addr, error: err?.message });
            updateMinterState({
              error: 'Failed to fetch collection: ' + err.message,
              collectionType: null,
              loading: false
            });
            return;
          }
        }

        // Fetch name and symbol only for ERC721 - matches desktop
        if (isERC721) {
          try {
            if (typeof contract.name === 'function') {
              collectionName = await contract.name();
            } else {
              collectionName = 'N/A';
            }
          } catch (e) {
            collectionName = 'N/A';
          }
          try {
            if (typeof contract.symbol === 'function') {
              collectionSymbol = await contract.symbol();
            } else {
              collectionSymbol = 'N/A';
            }
          } catch (e) {
            collectionSymbol = 'N/A';
          }
          console.log('minter.fetchCollection.erc721Meta', { name: collectionName, symbol: collectionSymbol });
        } else {
          collectionName = 'ERC1155 Collection';
          collectionSymbol = 'N/A';
          console.log('minter.fetchCollection.erc1155Meta');
        }

        // Ignore stale requests: only update if latest sequence
        const stillCurrent = (mySeq === fetchSeqRef.current);
        console.log('minter.fetchCollection.complete', { seq: mySeq, stillCurrent, addr, currentInput: dashboardStates.minter.collectionAddress });
        if (stillCurrent) {
          updateMinterState({
            fetchedCollection: addr,
            collectionName,
            collectionSymbol,
            success: `Collection loaded successfully!`,
            loading: false
          });
        }

      } catch (error) {
        console.error('minter.fetchCollection.error', { addr, error: error?.message });
        updateMinterState({
          error: 'Failed to fetch collection: ' + error.message,
          loading: false
        });
      }
    };

    // Load collection details when minter address changes
    const loadCollectionDetails = async () => {
      const minterAddr = sanitizeAddress(state.minterAddress);
      if (!state.fetchedCollection || !minterAddr || !validateAddress(minterAddr) || !provider) {
        return;
      }

      try {
        updateMinterState({ loading: true, error: '' });

        const contract = new ethers.Contract(
          state.fetchedCollection,
          state.collectionType === 'erc721' ? contractABIs.erc721Prize : contractABIs.erc1155Prize,
          provider
        );

        const currentMinter = await contract.minter();
        updateMinterState({
          isApproved: currentMinter.toLowerCase() === minterAddr.toLowerCase(),
          currentMinter,
          loading: false
        });
      } catch (err) {
        updateMinterState({
          error: 'Failed to load collection details: ' + err.message,
          loading: false
        });
      }
    };

    // Set minter approval - matches desktop implementation
    const setMinterApproval = async (approved) => {
      if (!state.fetchedCollection || !provider) {
        toast.error('Please fetch a collection and enter a valid minter address');
        return;
      }

      const targetMinter = sanitizeAddress(state.minterAddress);
      if (!targetMinter || !validateAddress(targetMinter)) {
        toast.error('Please enter a valid Ethereum address');
        return;
      }

      try {
        updateMinterState({ loading: true, error: '', success: '' });

        const signer = provider.getSigner();
        let contract;

        if (state.collectionType === 'erc721') {
          contract = new ethers.Contract(
            state.fetchedCollection,
            contractABIs.erc721Prize,
            signer
          );
        } else if (state.collectionType === 'erc1155') {
          contract = new ethers.Contract(
            state.fetchedCollection,
            contractABIs.erc1155Prize,
            signer
          );
        }

        const tx = await contract.setMinterApproval(targetMinter, approved);
        await tx.wait();

        toast.success(`Minter ${approved ? 'set' : 'removed'} successfully!`);
        updateMinterState({
          isApproved: approved,
          minterAddress: ''
        });

      } catch (err) {
        notifyError(err, { action: 'setMinterApprovalMobile' });
      } finally {
        updateMinterState({ loading: false });
      }
    };

    // Toggle minter approval lock - matches desktop implementation
    const toggleMinterApprovalLock = async () => {
      if (!state.fetchedCollection || !provider) {
        toast.error('Please fetch a collection first');
        return;
      }

      try {
        updateMinterState({ loading: true, error: '', success: '' });

        const signer = provider.getSigner();
        let contract;

        if (state.collectionType === 'erc721') {
          contract = new ethers.Contract(
            state.fetchedCollection,
            contractABIs.erc721Prize,
            signer
          );
        } else if (state.collectionType === 'erc1155') {
          contract = new ethers.Contract(
            state.fetchedCollection,
            contractABIs.erc1155Prize,
            signer
          );
        }

        // Check if the current user is the owner
        let owner;
        try {
          if (typeof contract.owner === 'function') {
            owner = await contract.owner();
          } else {
            toast.error('Contract does not support owner functionality');
            updateMinterState({ loading: false });
            return;
          }
        } catch (e) {
          notifyError(e, { action: 'getOwnerMobile' });
          updateMinterState({ loading: false });
          return;
        }

        const currentAddress = await signer.getAddress();

        if (owner.toLowerCase() !== currentAddress.toLowerCase()) {
          toast.error('Only the contract owner can lock/unlock minter approval');
          updateMinterState({ loading: false });
          return;
        }

        let tx;
        if (state.collectionType === 'erc721') {
          if (state.isLocked) {
            console.log('Attempting to unlock minter approval...');
            tx = await contract.unlockMinterApproval();
          } else {
            console.log('Attempting to lock minter approval...');
            tx = await contract.lockMinterApproval();
          }
        } else if (state.collectionType === 'erc1155') {
          if (state.isLocked) {
            console.log('Attempting to unlock minter approval...');
            tx = await contract.unlockMinterApproval();
          } else {
            console.log('Attempting to lock minter approval...');
            tx = await contract.lockMinterApproval();
          }
        }

        console.log('Transaction sent:', tx.hash);
        await tx.wait();
        toast.success(`Minter approval ${state.isLocked ? 'unlocked' : 'locked'} successfully!`);
        updateMinterState({
          isLocked: !state.isLocked
        });

      } catch (err) {
        console.error('Error in toggleMinterApprovalLock:', err);
        notifyError(err, { action: state.isLocked ? 'unlockMinterApprovalMobile' : 'lockMinterApprovalMobile' });
      } finally {
        updateMinterState({ loading: false });
      }
    };

    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={handleBack} variant="tertiary" size="md">
            ← Back
          </Button>
          <h3 className="text-lg font-semibold">Minter Approval Management</h3>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Minter Approval Management
            </CardTitle>
            <CardDescription>
              Manage minter approvals for collections and control royalty enforcement exemptions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

        {/* Error/Success Messages */}
        {state.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">{state.error}</span>
            </div>
          </div>
        )}

        {state.success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-800">{state.success}</div>
          </div>
        )}

        {/* Collection Lookup */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4" />
                <h3 className="text-sm font-medium">Collection Lookup</h3>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Collection Address</label>
                <ResponsiveAddressInput
                  value={state.collectionAddress}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const addr = sanitizeAddress(raw);
                    console.log('minter.input.change', { raw, sanitized: addr });
                    updateMinterState({ collectionAddress: addr });
                    
                    // Auto-fetch when address changes (using sanitized address)
                    if (addr && ethers.utils.isAddress(addr) && connected && !state.loading) {
                      console.log('minter.autofetch.trigger', { addr });
                      setTimeout(() => {
                        if (!state.loading) {
                          console.log('minter.autofetch.start', { addr });
                          fetchCollection(addr);
                        }
                      }, 350);
                    }
                  }}
                  placeholder="0x..."
                  className="flex-1"
                />
              </div>
            </div>

        {/* Collection Info */}
            {state.fetchedCollection && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Collection Information</h3>
                </div>
                <div className="text-sm space-y-2">
                  <div className="break-all">
                    <span className="font-medium">Address:</span>
                    <span className="ml-1 font-mono text-xs">{state.fetchedCollection}</span>
                  </div>
                  <div className="break-words"><span className="font-medium">Name:</span> {state.collectionName}</div>
                  {state.collectionSymbol && (
                    <div className="break-words"><span className="font-medium">Symbol:</span> {state.collectionSymbol}</div>
                  )}
                  <div><span className="font-medium">Type:</span> {state.collectionType?.toUpperCase()}</div>
                  <div className="break-all">
                    <span className="font-medium">Current Minter:</span>
                    <span className="ml-1 font-mono text-xs">{state.currentMinter || 'None'}</span>
                  </div>
                  <div><span className="font-medium">Minter Locked:</span> {state.isLocked ? 'Yes' : 'No'}</div>
                </div>

                {/* Lock/Unlock Button */}
                <div className="pt-2 border-t border-border">
                  <Button
                    onClick={toggleMinterApprovalLock}
                    disabled={state.loading || !connected}
                    variant="primary"
                    size="md"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {state.loading ? 'Processing...' : state.isLocked ? 'Unlock Minter Approval' : 'Lock Minter Approval'}
                  </Button>
                </div>
              </div>
            )}

        {/* Minter Management */}
            {state.fetchedCollection && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Minter Management</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Minter Address</label>
                  <ResponsiveAddressInput
                    value={state.minterAddress}
                    onChange={(e) => updateMinterState({ minterAddress: e.target.value })}
                    placeholder="0x..."
                  />
                  {state.minterAddress && state.isApproved && (
                    <p className="text-sm text-green-600 mt-1">✓ This address is currently the minter</p>
                  )}
                </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setMinterApproval(true)}
                disabled={state.loading || state.isApproved || state.isLocked || !state.minterAddress || !validateAddress(state.minterAddress)}
                variant="primary"
                size="md"
                className="w-full flex items-center justify-center gap-2"
                title={!state.minterAddress ? "Please enter a minter address" : !validateAddress(state.minterAddress) ? "Please enter a valid address" : state.isApproved ? "Address is already the minter" : state.isLocked ? "Minter approval is locked" : "Set as minter"}
              >
                {state.loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Set Minter
              </Button>

              <Button
                onClick={() => setMinterApproval(false)}
                disabled={state.loading || !state.isApproved || state.isLocked || !state.minterAddress || !validateAddress(state.minterAddress)}
                variant="primary"
                size="md"
                className="w-full flex items-center justify-center gap-2"
                title={!state.minterAddress ? "Please enter a minter address" : !validateAddress(state.minterAddress) ? "Please enter a valid address" : !state.isApproved ? "Address is not currently the minter" : state.isLocked ? "Minter approval is locked" : "Remove minter"}
              >
                {state.loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Remove Minter
              </Button>
            </div>

            {/* Royalty Enforcement Exemption Utility */}
                <div className="space-y-3 pt-3 border-t border-border">
                  <label className="block text-sm font-medium mb-1">Royalty Enforcement Exemption Address</label>
                  <ResponsiveAddressInput
                    value={state.minterAddress}
                    onChange={(e) => updateMinterState({ minterAddress: e.target.value })}
                    placeholder="0x..."
                  />

                  <div className="flex flex-col gap-2">
                <Button
                  onClick={async () => {
                    try {
                      updateMinterState({ loading: true, error: '' });
                      const contract = new ethers.Contract(
                        state.fetchedCollection,
                        state.collectionType === 'erc721' ? contractABIs.erc721Prize : contractABIs.erc1155Prize,
                        provider
                      );
                      const exempt = await contract.isRoyaltyEnforcementExempt(state.minterAddress);
                      toast.success(exempt ? 'Address is exempt from royalty enforcement' : 'Address is NOT exempt');
                    } catch (err) {
                      notifyError(err, { action: 'checkExemptionMobile' });
                      } finally {
                        updateMinterState({ loading: false });
                      }
                  }}
                  disabled={!state.fetchedCollection || !state.minterAddress || !validateAddress(state.minterAddress) || state.loading}
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  Check exemption
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      updateMinterState({ loading: true, error: '' });
                      const signer = provider.getSigner();
                      const contract = new ethers.Contract(
                        state.fetchedCollection,
                        state.collectionType === 'erc721' ? contractABIs.erc721Prize : contractABIs.erc1155Prize,
                        signer
                      );
                      const tx = await contract.setRoyaltyEnforcementExemption(state.minterAddress, true);
                      await tx.wait();
                      toast.success('Exemption granted successfully');
                    } catch (err) {
                      notifyError(err, { action: 'grantExemptionMobile' });
                    } finally {
                      updateMinterState({ loading: false });
                    }
                  }}
                  disabled={!state.fetchedCollection || !state.minterAddress || !validateAddress(state.minterAddress) || state.loading}
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  Grant Exemption
                </Button>

                <Button
                  onClick={async () => {
                    try {
                      updateMinterState({ loading: true, error: '' });
                      const signer = provider.getSigner();
                      const contract = new ethers.Contract(
                        state.fetchedCollection,
                        state.collectionType === 'erc721' ? contractABIs.erc721Prize : contractABIs.erc1155Prize,
                        signer
                      );
                      const tx = await contract.setRoyaltyEnforcementExemption(state.minterAddress, false);
                      await tx.wait();
                      toast.success('Exemption revoked successfully');
                    } catch (err) {
                      notifyError(err, { action: 'revokeExemptionMobile' });
                    } finally {
                      updateMinterState({ loading: false });
                    }
                  }}
                  disabled={!state.fetchedCollection || !state.minterAddress || !validateAddress(state.minterAddress) || state.loading}
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  Revoke Exemption
                </Button>
              </div>
            </div>

              </div>
            )}

            {state.isLocked && state.fetchedCollection && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Minter approval is locked for this collection. Use the unlock button above to enable changes.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // KOL Approval Management Component - Mobile Implementation
  const renderKOLComponent = (handleBack) => {
    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={handleBack} variant="tertiary" size="md">
            ← Back
          </Button>
          <h3 className="text-lg font-semibold">KOL Approval Management</h3>
        </div>

        {/* KOL Approval Component - Mobile Optimized */}
        <div className="w-full">
          <KOLApprovalComponent />
        </div>
      </div>
    );
  };

  // Token Creator Component
  const renderTokenCreatorComponent = (handleBack) => {
    const state = dashboardStates.tokenCreator;

    const updateTokenCreatorState = (updates) => {
      setDashboardStates(prev => ({
        ...prev,
        tokenCreator: { ...prev.tokenCreator, ...updates }
      }));
    };

    // Detect contract type (ERC721 vs ERC1155) - matches desktop implementation
    const detectContractType = async (contractAddress) => {
      try {
        // Try ERC1155 first - check for ERC1155-specific functions
        const erc1155Contract = getContractInstance(contractAddress, 'erc1155Prize');
        if (erc1155Contract) {
          try {
            // Check if it supports ERC1155 interface
            const supportsERC1155 = await erc1155Contract.supportsInterface('0xd9b67a26'); // ERC1155 interface ID
            if (supportsERC1155) {
              return { type: 'erc1155', contract: erc1155Contract };
            }
          } catch (e) {
            // Try alternative method - check for ERC1155-specific function
            try {
              // Try calling balanceOf with two parameters (address, tokenId) - ERC1155 specific
              await erc1155Contract.balanceOf(contractAddress, 0);
              return { type: 'erc1155', contract: erc1155Contract };
            } catch (e2) {
              // Not ERC1155
            }
          }
        }

        // Try ERC721 - check for ERC721-specific functions
        const erc721Contract = getContractInstance(contractAddress, 'erc721Prize');
        if (erc721Contract) {
          try {
            // Check if it supports ERC721 interface
            const supportsERC721 = await erc721Contract.supportsInterface('0x80ac58cd'); // ERC721 interface ID
            if (supportsERC721) {
              return { type: 'erc721', contract: erc721Contract };
            }
          } catch (e) {
            // Try alternative method - check for ERC721-specific function
            try {
              // Try calling balanceOf with one parameter (address) - ERC721 specific
              await erc721Contract.balanceOf(contractAddress);
              return { type: 'erc721', contract: erc721Contract };
            } catch (e2) {
              // Not ERC721
            }
          }
        }

        throw new Error('Contract is neither ERC721 nor ERC1155 compatible');
      } catch (error) {
        throw new Error(`Failed to detect contract type: ${error.message}`);
      }
    };

    const loadCollectionInfo = async () => {
      if (!state.collectionData.address || !connected) {
        toast.error('Please enter a collection address');
        return;
      }

      updateTokenCreatorState({ loadingInfo: true });
      try {
        // First detect the contract type
        const { type, contract } = await detectContractType(state.collectionData.address);

        // This component is only for ERC1155 collections
        if (type !== 'erc1155') {
          toast.error('❌ This component is only for ERC1155 collections. The provided address appears to be an ERC721 collection. Please use the appropriate component for ERC721 collections.');
          updateTokenCreatorState({
            collectionInfo: {
              address: state.collectionData.address,
              isOwner: false,
              owner: 'N/A',
              type: 'erc721',
              isBlocked: true
            },
            loadingInfo: false
          });
          return;
        }

        // Check if user is owner - matches desktop implementation
        const owner = await contract.owner();
        const isOwner = owner.toLowerCase() === address.toLowerCase();

        updateTokenCreatorState({
          collectionInfo: {
            address: state.collectionData.address,
            isOwner,
            owner,
            type: 'erc1155'
          },
          collectionData: { ...state.collectionData, type: 'erc1155' }
        });

        if (!isOwner) {
          toast.error('You are not the owner of this collection');
        } else {
          toast.success('ERC1155 collection loaded successfully');
        }

      } catch (error) {
        console.error('Error loading collection info:', error);
        toast.error('Failed to load collection info. Please verify the address is a valid ERC1155 collection.');
        updateTokenCreatorState({ collectionInfo: null });
      } finally {
        updateTokenCreatorState({ loadingInfo: false });
      }
    };

    const handleCreateNewToken = async () => {
      if (!connected || !state.collectionInfo) {
        toast.error('Please connect your wallet and load collection info first');
        return;
      }

      const tokenId = parseInt(state.tokenCreationData.tokenId);
      const maxSupply = parseInt(state.tokenCreationData.maxSupply);

      if (isNaN(tokenId) || tokenId < 0) {
        toast.error('Please enter a valid token ID');
        return;
      }

      if (isNaN(maxSupply) || maxSupply <= 0) {
        toast.error('Please enter a valid max supply');
        return;
      }

      updateTokenCreatorState({ loading: true });
      try {
        const contract = getContractInstance(state.collectionData.address, 'erc1155Prize');

        const result = await executeTransaction(
          contract.createNewToken,
          tokenId,
          maxSupply
        );

        if (result.success) {
          toast.success(`Token ID ${tokenId} created successfully with max supply of ${maxSupply}!`);
          updateTokenCreatorState({
            tokenCreationData: { tokenId: '', maxSupply: '' }
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Error creating new token:', error);
        toast.error(`Failed to create new token: ${error.message}`);
      } finally {
        updateTokenCreatorState({ loading: false });
      }
    };

    const handleSetTokenURI = async () => {
      if (!connected || !state.collectionInfo) {
        toast.error('Please connect your wallet and load collection info first');
        return;
      }

      const tokenId = parseInt(state.uriData.tokenId);
      if (isNaN(tokenId) || tokenId < 0) {
        toast.error('Please enter a valid token ID');
        return;
      }

      if (!state.uriData.tokenURI) {
        toast.error('Please enter a token URI');
        return;
      }

      updateTokenCreatorState({ loading: true });
      try {
        const contract = getContractInstance(state.collectionData.address, 'erc1155Prize');

        const result = await executeTransaction(
          contract.setURI,
          tokenId,
          state.uriData.tokenURI
        );

        if (result.success) {
          toast.success(`Token URI set successfully for token ID ${tokenId}!`);
          updateTokenCreatorState({
            uriData: { tokenId: '', tokenURI: '' }
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Error setting token URI:', error);
        toast.error(`Failed to set token URI: ${error.message}`);
      } finally {
        updateTokenCreatorState({ loading: false });
      }
    };

    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <Button onClick={handleBack} variant="tertiary" size="md">
            ← Back
          </Button>
          <h3 className="text-lg font-semibold">Create New Token ID & Set Token URI</h3>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Token Creator
            </CardTitle>
            <CardDescription>
              Add new token IDs to ERC1155 collections and set metadata URIs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

        {/* Collection Lookup */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4" />
                <h3 className="text-sm font-medium">Collection Lookup</h3>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ERC1155 Collection Address</label>
                <ResponsiveAddressInput
                    value={state.collectionData.address}
                    onChange={(e) => {
                      updateTokenCreatorState({
                        collectionData: { ...state.collectionData, address: e.target.value }
                      });
                      
                      // Auto-fetch when address changes
                      const value = e.target.value;
                      if (value && ethers.utils.isAddress(value) && connected && !state.loadingInfo) {
                        setTimeout(() => {
                          if (!state.loadingInfo) {
                            loadCollectionInfo();
                          }
                        }, 400);
                      }
                    }}
                    placeholder="0x..."
                    className="flex-1"
                  />
              </div>
            </div>

        {/* Collection Info Display */}
            {state.collectionInfo && (
              <div className={`space-y-4 p-4 border border-border rounded-lg ${state.collectionInfo.isBlocked ? 'bg-destructive/10 border-destructive/20' : 'bg-card'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Collection Information</h3>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="break-all"><span className="font-medium">Address:</span> {state.collectionInfo.address}</p>
                  <p className="break-all"><span className="font-medium">Owner:</span> {state.collectionInfo.owner}</p>
                  <p><span className="font-medium">You are owner:</span> {state.collectionInfo.isOwner ? '✅ Yes' : '❌ No'}</p>
                  <p><span className="font-medium">Type:</span> {state.collectionInfo.type === 'erc721' ? '❌ ERC721 Collection (Incompatible)' : '✅ ERC1155 Collection'}</p>
                </div>

                {state.collectionInfo.isBlocked && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">
                      This component only works with ERC1155 collections. The provided address is an ERC721 collection. Please use the appropriate component for ERC721 collections.
                    </span>
                  </div>
                )}

                {!state.collectionInfo.isBlocked && !state.collectionInfo.isOwner && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">
                      You are not the owner of this collection and cannot create new tokens.
                    </span>
                  </div>
                )}
              </div>
            )}

        {/* Create New Token Section */}
            {state.collectionInfo && state.collectionInfo.isOwner && !state.collectionInfo.isBlocked && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Create New Token ID</h3>
                </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Token ID</label>
                <ResponsiveNumberInput
                  min="0"
                  value={state.tokenCreationData.tokenId}
                  onChange={(e) => updateTokenCreatorState({
                    tokenCreationData: { ...state.tokenCreationData, tokenId: e.target.value }
                  })}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Supply</label>
                <ResponsiveNumberInput
                  min="1"
                  value={state.tokenCreationData.maxSupply}
                  onChange={(e) => updateTokenCreatorState({
                    tokenCreationData: { ...state.tokenCreationData, maxSupply: e.target.value }
                  })}
                  placeholder="100"
                />
              </div>
            </div>

            <Button
              onClick={handleCreateNewToken}
              disabled={state.loading || !connected || !state.collectionInfo.isOwner || state.collectionInfo.isBlocked || !state.tokenCreationData.tokenId || !state.tokenCreationData.maxSupply}
              variant="primary"
              size="md"
              className="w-full h-10 flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              <Plus className="h-4 w-4" />
              {state.loading ? 'Creating...' : 'Create New Token ID'}
            </Button>
          </div>
        )}

        {/* Set Token URI Section */}
            {state.collectionInfo && state.collectionInfo.isOwner && !state.collectionInfo.isBlocked && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Set Token URI</h3>
                </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Token ID</label>
                <ResponsiveNumberInput
                  min="0"
                  value={state.uriData.tokenId}
                  onChange={(e) => updateTokenCreatorState({
                    uriData: { ...state.uriData, tokenId: e.target.value }
                  })}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Token URI</label>
                <ResponsiveAddressInput
                  value={state.uriData.tokenURI}
                  onChange={(e) => updateTokenCreatorState({
                    uriData: { ...state.uriData, tokenURI: e.target.value }
                  })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <Button
              onClick={handleSetTokenURI}
              disabled={state.loading || !connected || !state.collectionInfo.isOwner || state.collectionInfo.isBlocked || !state.uriData.tokenId || !state.uriData.tokenURI}
              variant="primary"
              size="md"
              className="w-full h-10 flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              <Search className="h-4 w-4" />
              {state.loading ? 'Setting...' : 'Set Token URI'}
            </Button>
          </div>
        )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Revenue Withdrawal Component
  const renderRevenueComponent = (handleBack) => {
    const state = dashboardStates.revenue;

    const updateRevenueState = (updates) => {
      setDashboardStates(prev => ({
        ...prev,
        revenue: { ...prev.revenue, ...updates }
      }));
    };

    const loadRaffleInfo = async (raffleAddress) => {
      if (!raffleAddress || !connected) {
        toast.error('Please enter a raffle address and connect your wallet');
        return;
      }

      updateRevenueState({ loading: true });
      try {
        const contract = getContractInstance(raffleAddress, 'pool');

        if (!contract) {
          throw new Error('Failed to create raffle contract instance');
        }

        // Get raffle information - matches desktop implementation
        const [
          creator,
          totalRevenue,
          state
        ] = await Promise.all([
          contract.creator(),
          contract.totalCreatorRevenue(),
          contract.state()
        ]);

        const isCreator = creator.toLowerCase() === address.toLowerCase();

        // Map state number (BigNumber/string/number) to readable state - robust conversion
        const stateNames = [
          'Pending',           // 0
          'Active',            // 1
          'Ended',             // 2
          'Drawing',           // 3
          'Completed',         // 4
          'Deleted',           // 5
          'AllPrizesClaimed',  // 6
          'Unengaged'          // 7
        ];
        const stateIndex = (state && typeof state === 'object' && typeof state.toNumber === 'function')
          ? state.toNumber()
          : Number(state);
        const stateName = (Number.isFinite(stateIndex) && stateIndex >= 0 && stateIndex < stateNames.length)
          ? stateNames[stateIndex]
          : 'Unknown';

        updateRevenueState({
          raffleData: {
            address: raffleAddress,
            revenueAmount: ethers.utils.formatEther(totalRevenue),
            isCreator,
            raffleState: stateName,
            totalRevenue
          }
        });

      } catch (error) {
        console.error('Error loading raffle info:', error);
        notifyError(error, { action: 'loadRaffleInfoMobile' });
        updateRevenueState({
          raffleData: {
            address: raffleAddress,
            revenueAmount: '0',
            isCreator: false,
            raffleState: 'error'
          }
        });
      } finally {
        updateRevenueState({ loading: false });
      }
    };

    const handleWithdrawRevenue = async () => {
      if (!connected || !state.raffleData.address) {
        toast.error('Please connect your wallet and load raffle info first');
        return;
      }

      if (!state.raffleData.isCreator) {
        toast.error('You are not the creator of this raffle');
        return;
      }

      if (parseFloat(state.raffleData.revenueAmount) <= 0) {
        toast.info('No revenue available for withdrawal');
        return;
      }

      const validStates = ['Completed', 'AllPrizesClaimed', 'Ended'];
      if (!validStates.includes(state.raffleData.raffleState)) {
        toast.info(`Revenue can only be withdrawn from completed raffles. Current state: ${state.raffleData.raffleState}`);
        return;
      }

      updateRevenueState({ loading: true });
      try {
        const contract = getContractInstance(state.raffleData.address, 'pool');
        if (!contract) throw new Error('Failed to create raffle contract instance');

        const result = await executeTransaction(contract.withdrawCreatorRevenue);

        if (result.success) {
          toast.success(`Revenue withdrawn successfully! Transaction: ${result.hash}`);
          await loadRaffleInfo(state.raffleData.address);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Error withdrawing revenue:', error);
        notifyError(error, { action: 'withdrawRevenueMobile' });
      } finally {
        updateRevenueState({ loading: false });
      }
    };

    // Creator Mint functionality - matches desktop implementation
    const handleMintDataChange = (field, value) => {
      updateRevenueState({
        mintData: { ...state.mintData, [field]: value }
      });

      // Trigger collection fetching when address changes (with debouncing)
      if (field === 'collectionAddress') {
        // Clear any existing timeout
        if (window.collectionFetchTimeout) {
          clearTimeout(window.collectionFetchTimeout);
        }
        
        // Debounce the collection fetch to prevent race conditions during typing
        window.collectionFetchTimeout = setTimeout(() => {
          loadCollectionInfoForMint(value);
        }, 500);
      }
    };

    // Load collection info for mobile version
    const loadCollectionInfoForMint = async (collectionAddress) => {
      if (!collectionAddress || !connected) {
        updateRevenueState({ collectionInfo: null });
        return;
      }

      updateRevenueState({ loadingCollectionInfo: true });
      try {
        // Auto-detect collection type by trying both ERC721 and ERC1155
        let contract = null;
        let detectedType = null;

        // Try ERC721 first (most common)
        try {
          const erc721Contract = getContractInstance(collectionAddress, 'erc721Prize');
          if (erc721Contract) {
            const supportsERC721 = await erc721Contract.supportsInterface('0x80ac58cd');
            if (supportsERC721) {
              contract = erc721Contract;
              detectedType = 'erc721';
            }
          }
        } catch (e) {
          // Try ERC1155 if ERC721 fails
        }

        if (!contract && detectedType !== 'erc721') {
          try {
            const erc1155Contract = getContractInstance(collectionAddress, 'erc1155Prize');
            if (erc1155Contract) {
              const supportsERC1155 = await erc1155Contract.supportsInterface('0xd9b67a26');
              if (supportsERC1155) {
                contract = erc1155Contract;
                detectedType = 'erc1155';
              }
            }
          } catch (e) {
            // ERC1155 also failed
          }
        }

        if (!contract || !detectedType) {
          throw new Error('Invalid collection address or unsupported contract type');
        }

        // Update the collection type in state (preserve collectionAddress)
        updateRevenueState({
          mintData: { 
            ...state.mintData, 
            collectionType: detectedType,
            collectionAddress: collectionAddress // Explicitly preserve the address
          }
        });

        // Get collection info
        let name = 'Unknown Collection';
        let symbol = 'Unknown';
        let owner = 'Unknown';

        try {
          if (typeof contract.name === 'function') {
            name = await contract.name();
          }
        } catch (e) {
          // name() not available or failed
        }

        try {
          if (typeof contract.symbol === 'function') {
            symbol = await contract.symbol();
          }
        } catch (e) {
          // symbol() not available or failed
        }

        try {
          if (typeof contract.owner === 'function') {
            owner = await contract.owner();
          }
        } catch (e) {
          // owner() not available or failed
        }

        const isOwner = owner !== 'Unknown' && owner.toLowerCase() === address.toLowerCase();

        // Fetch vesting information if available
        let vestingConfigured = false;
        let unlockedAmount = '0';
        let availableAmount = '0';

        try {
          // Check if vesting is configured
          if (detectedType === 'erc721') {
            vestingConfigured = await contract.vestingConfigured();
            if (vestingConfigured) {
              unlockedAmount = (await contract.getUnlockedAmount()).toString();
              availableAmount = (await contract.getAvailableCreatorMint()).toString();
            }
          } else if (detectedType === 'erc1155') {
            // For ERC1155, we need a tokenId - use default 1 for initial fetch
            vestingConfigured = await contract.vestingConfigured(1);
            if (vestingConfigured) {
              unlockedAmount = (await contract.getUnlockedAmount(1)).toString();
              availableAmount = (await contract.getAvailableCreatorMint(1)).toString();
            }
          }
        } catch (e) {
          // Vesting functions might not be available or failed
          console.log('Vesting info not available:', e.message);
        }

        updateRevenueState({
          collectionInfo: {
            name,
            symbol,
            owner,
            type: detectedType,
            isOwner,
            vestingConfigured,
            unlockedAmount,
            availableAmount
          }
        });

        toast.success(`Collection loaded: ${name} (${detectedType.toUpperCase()})`);
      } catch (error) {
        console.error('Error loading collection info:', error);
        toast.error('Failed to load collection information: ' + error.message);
        updateRevenueState({ collectionInfo: null });
      } finally {
        updateRevenueState({ loadingCollectionInfo: false });
      }
    };

    const handleCreatorMint = async () => {
      if (!connected || !address) {
        toast.error('Please connect your wallet');
        return;
      }

      if (!state.mintData.collectionAddress || !state.mintData.recipient || !state.mintData.quantity) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (!ethers.utils.isAddress(state.mintData.recipient)) {
        toast.error('Please enter a valid recipient address');
        return;
      }

      const quantity = parseInt(state.mintData.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        toast.error('Please enter a valid quantity');
        return;
      }

      if (state.mintData.collectionType === 'erc1155') {
        const tokenId = parseInt(state.mintData.tokenId);
        if (isNaN(tokenId) || tokenId < 0) {
          toast.error('Please enter a valid token ID for ERC1155');
          return;
        }
      }

      updateRevenueState({ mintLoading: true });
      try {
        const contractType = state.mintData.collectionType === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
        const contract = getContractInstance(state.mintData.collectionAddress, contractType);

        if (!contract) {
          throw new Error('Failed to create contract instance');
        }

        let result;
        if (state.mintData.collectionType === 'erc721') {
          // ERC721: creatorMint(address to, uint256 quantity)
          result = await executeTransaction(() => contract.creatorMint(state.mintData.recipient, quantity));
        } else {
          // ERC1155: creatorMint(address to, uint256 id, uint256 quantity)
          const tokenId = parseInt(state.mintData.tokenId);
          result = await executeTransaction(() => contract.creatorMint(state.mintData.recipient, tokenId, quantity));
        }

        if (result.success) {
          toast.success(`Successfully minted ${quantity} token(s)! Transaction: ${result.hash}`);
          // Clear form
          updateRevenueState({
            mintData: {
              ...state.mintData,
              recipient: '',
              quantity: '',
              tokenId: ''
            }
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('Error minting tokens:', error);
        notifyError(error, { action: 'creatorMintMobile' });
      } finally {
        updateRevenueState({ mintLoading: false });
      }
    };

    const canWithdraw = state.raffleData.isCreator &&
                       parseFloat(state.raffleData.revenueAmount) > 0 &&
                       ['Completed', 'AllPrizesClaimed', 'Ended'].includes(state.raffleData.raffleState);

    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="text-primary hover:text-primary/80">
            ← Back
          </button>
          <h3 className="text-lg font-semibold">Creator Mint & Revenue Withdrawal</h3>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Creator Mint & Revenue Withdrawal
            </CardTitle>
            <CardDescription>
              Withdraw revenue from completed raffles and mint creator tokens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

        {/* Raffle Lookup */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4" />
                <h3 className="text-sm font-medium">Raffle Lookup</h3>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Raffle Address</label>
                <ResponsiveAddressInput
                  value={state.raffleData.address}
                  onChange={(e) => {
                    updateRevenueState({
                      raffleData: { ...state.raffleData, address: e.target.value }
                    });
                    
                    // Auto-fetch when address changes
                    const value = e.target.value;
                    if (value && ethers.utils.isAddress(value) && connected && !state.loading) {
                      setTimeout(() => {
                        if (!state.loading) {
                          loadRaffleInfo(value);
                        }
                      }, 400);
                    }
                  }}
                  placeholder="0x..."
                  className="flex-1"
                />
              </div>
            </div>

        {/* Quick Access to Created Raffles */}
            {createdRaffles.length > 0 && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Your Created Raffles</h3>
                </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {createdRaffles.slice(0, 5).map((raffle) => (
                <button
                  key={raffle.address}
                  onClick={() => loadRaffleInfo(raffle.address)}
                  className="w-full text-left bg-card border border-border rounded-lg p-3 hover:bg-card/90 transition-colors"
                >
                  <div className="text-sm font-medium">{raffle.name || `Raffle ${raffle.address.slice(0, 8)}...`}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">State: {renderStateBadge(raffle.state, { stateNum: raffle.stateNum })}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Raffle Info Display */}
            {state.raffleData.address && state.raffleData.raffleState !== 'unknown' && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-medium">Raffle Information</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="break-all">
                    <span className="font-medium">Address:</span>
                    <span className="ml-1 font-mono text-xs">{state.raffleData.address}</span>
                  </div>
                  <div className="flex items-center gap-2"><span className="font-medium">State:</span> {renderStateBadge(state.raffleData.raffleState, { stateNum: state.raffleData.stateNum, winnerCount: state.raffleData.winnerCount })}</div>
                  <div><span className="font-medium">You are creator:</span> {state.raffleData.isCreator ? 'Yes' : 'No'}</div>
                  <div><span className="font-medium">Available Revenue:</span> {state.raffleData.revenueAmount} {getCurrencySymbol()}</div>
                </div>

                {/* Withdrawal Status */}
                {state.raffleData.isCreator && (
                  <div className="mt-4">
                    {canWithdraw ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="text-sm text-green-800">
                          ✓ Revenue withdrawal is available
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="text-sm text-yellow-800">
                          {parseFloat(state.raffleData.revenueAmount) <= 0
                            ? 'No revenue available for withdrawal'
                            : `Revenue withdrawal not available - raffle state: ${state.raffleData.raffleState}`
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

        {/* Withdrawal Button */}
        {state.raffleData.isCreator && (
          <Button
            onClick={handleWithdrawRevenue}
            disabled={state.loading || !connected || !canWithdraw}
            variant="primary"
            size="md"
            className="w-full h-10 flex items-center justify-center gap-2 shadow-sm text-sm"
          >
            <DollarSign className="h-4 w-4" />
            {state.loading ? 'Withdrawing...' : `Withdraw ${state.raffleData.revenueAmount} ${getCurrencySymbol()}`}
          </Button>
        )}

        {/* Creator Mint Section - matches desktop implementation */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4" />
                <h3 className="text-sm font-medium">Creator Mint</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Mint tokens directly to winners or any address
              </p>

              {/* Collection Type Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Collection Type</label>
                <Select
                  value={state.mintData.collectionType}
                  onValueChange={(value) => handleMintDataChange('collectionType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erc721">ERC721</SelectItem>
                    <SelectItem value="erc1155">ERC1155</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Collection Address */}
              <div>
                <label className="block text-sm font-medium mb-1">Collection Address</label>
                <ResponsiveAddressInput
                  value={state.mintData.collectionAddress}
                  onChange={(e) => handleMintDataChange('collectionAddress', e.target.value)}
                  placeholder="0x..."
                />
              </div>

              {/* Collection Info Display */}
              {state.collectionInfo && (
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {state.collectionInfo.type === 'erc721' && (
                      <>
                        <div>
                          <span className="font-medium">Name:</span> {state.collectionInfo.name}
                        </div>
                        <div>
                          <span className="font-medium">Symbol:</span> {state.collectionInfo.symbol}
                        </div>
                      </>
                    )}
                    <div>
                      <span className="font-medium">Type:</span> {state.collectionInfo.type.toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium">Owner:</span> {state.collectionInfo.isOwner ? 'You' : 'Other'}
                    </div>
                  </div>

                  {/* Vesting Information */}
                  {state.collectionInfo.vestingConfigured && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-sm font-medium mb-2 text-primary">Vesting Information</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Unlocked Amount:</span> {state.collectionInfo.unlockedAmount}
                        </div>
                        <div>
                          <span className="font-medium">Available Amount:</span> {state.collectionInfo.availableAmount}
                        </div>
                      </div>
                      {state.collectionInfo.type === 'erc1155' && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Note: Vesting info shown for Token ID 1. Specify exact Token ID for accurate amounts.
                        </div>
                      )}
                    </div>
                  )}

                  {!state.collectionInfo.isOwner && (
                    <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm text-destructive">
                        You are not the owner of this collection and cannot mint tokens.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Recipient Address */}
              <div>
                <label className="block text-sm font-medium mb-1">Recipient Address</label>
                <ResponsiveAddressInput
                  value={state.mintData.recipient}
                  onChange={(e) => handleMintDataChange('recipient', e.target.value)}
                  placeholder="0x..."
                />
              </div>

          {/* Token ID (ERC1155 only) */}
          {state.mintData.collectionType === 'erc1155' && (
            <div>
              <label className="block text-sm font-medium mb-1">Token ID</label>
              <ResponsiveNumberInput
                min="0"
                value={state.mintData.tokenId}
                onChange={(e) => handleMintDataChange('tokenId', e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <ResponsiveNumberInput
              min="1"
              value={state.mintData.quantity}
              onChange={(e) => handleMintDataChange('quantity', e.target.value)}
              placeholder="1"
            />
          </div>

          {/* Mint Button */}
          <Button
            onClick={handleCreatorMint}
            disabled={state.mintLoading || !connected || !state.mintData.collectionAddress || !state.mintData.recipient || !state.mintData.quantity || (state.mintData.collectionType === 'erc1155' && !state.mintData.tokenId)}
            variant="primary"
            size="md"
            className="w-full h-10 flex items-center justify-center gap-2 shadow-sm text-sm"
          >
            {state.mintLoading ? 'Minting...' : 'Mint'}
          </Button>

              {!connected && (
                <div className="text-center p-4 bg-card rounded-lg">
                  <p className="text-muted-foreground text-sm">
                    Please connect your wallet to use creator mint functionality.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // My Raffles section rendering - matches desktop functionality
  const renderMyRafflesSection = () => {
    const handleRaffleClick = (raffleAddress) => {
      const currentChainId = (typeof window !== 'undefined' && window.ethereum && window.ethereum.chainId) ? parseInt(window.ethereum.chainId, 16) : null;
      const slug = currentChainId && SUPPORTED_NETWORKS[currentChainId]
        ? SUPPORTED_NETWORKS[currentChainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : (currentChainId || '');
      const path = slug ? `/${slug}/raffle/${raffleAddress}` : `/raffle/${raffleAddress}`;
      navigate(path);
    };

    if (!createdRaffles || createdRaffles.length === 0) {
      return (
        <div className="p-6">
          <div className="text-center py-12">
            <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Raffles Created Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              You haven't created any raffles yet. Start by creating your first raffle!
            </p>
            <Button
              onClick={() => navigate('/create-raffle')}
              variant="primary"
              size="md"
            >
              Create Your First Raffle
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">My Raffles</h3>
          <span className="text-sm text-muted-foreground">{createdRaffles.length} raffles</span>
        </div>

        {createdRaffles.map((raffle) => (
          <div
            key={raffle.address}
            className="bg-card border border-border rounded-lg p-4 hover:bg-card/90 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground text-sm mb-1">
                  {raffle.name || `Raffle ${raffle.address.slice(0, 8)}...`}
                </h4>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Slots Sold:</span> {raffle.ticketsSold || 0} / {raffle.maxTickets || 'Unlimited'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Revenue:</span> {formatRevenueAmount(raffle.revenue || '0')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Created:</span> {raffle.createdAt ? new Date((raffle.createdAt < 1e12 ? raffle.createdAt * 1000 : raffle.createdAt)).toLocaleString() : 'Unknown'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  raffle.state === 'active' ? 'bg-green-100 text-green-800' :
                  raffle.state === 'completed' ? 'bg-blue-100 text-blue-800' :
                  raffle.state === 'ended' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {raffle.state}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                onClick={() => handleRaffleClick(raffle.address)}
                variant="primary"
                size="sm"
              >
                View Details
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Purchased Tickets section rendering - matches desktop functionality
  const renderPurchasedTicketsSection = () => {
    const handleRaffleClick = (raffleAddress) => {
      const currentChainId = (typeof window !== 'undefined' && window.ethereum && window.ethereum.chainId) ? parseInt(window.ethereum.chainId, 16) : null;
      const slug = currentChainId && SUPPORTED_NETWORKS[currentChainId]
        ? SUPPORTED_NETWORKS[currentChainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : (currentChainId || '');
      const path = slug ? `/${slug}/raffle/${raffleAddress}` : `/raffle/${raffleAddress}`;
      navigate(path);
    };

    if (!purchasedTickets || purchasedTickets.length === 0) {
      return (
        <div className="p-6">
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Slots Purchased Yet</h3>
            <p className="text-muted-foreground text-sm">
              You haven't purchased any pool slots yet. Browse active pools to get started!
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Purchased Slots</h3>
          <span className="text-sm text-muted-foreground">{purchasedTickets.length} slots</span>
        </div>

        {purchasedTickets.map((ticket, index) => (
          <div
            key={ticket.id || index}
            className="bg-card border border-border rounded-lg p-4 hover:bg-card/90 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground text-sm mb-1">
                  {ticket.raffleName || ticket.poolName || ticket.name || `Raffle ${ticket.raffleAddress?.slice(0, 8)}...`}
                </h4>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Slots:</span> {ticket.quantity || ticket.ticketCount || 1}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Amount Paid:</span> {(() => {
                      const amt = ticket.totalSpent ?? ticket.amount;
                      if (amt === undefined || amt === null || amt === '') {
                        const qty = ticket.quantity || ticket.ticketCount || 0;
                        const price = ticket.slotFee; // ether units string
                        if (price) {
                          const computed = (parseFloat(price) || 0) * qty;
                          return formatRevenueAmount(computed.toString());
                        }
                        return formatRevenueAmount('0');
                      }
                      return formatRevenueAmount(amt);
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Purchased:</span> {ticket.purchaseTime ? new Date((ticket.purchaseTime < 1e12 ? ticket.purchaseTime * 1000 : ticket.purchaseTime)).toLocaleString() : 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">State:</span> {renderStateBadge(ticket.state, { stateNum: ticket.stateNum })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              {ticket.state === 'ended' && (
                <button
                  onClick={() => claimRefund(ticket.raffleAddress)}
                  className="text-sm bg-green-500/10 text-green-600 px-3 py-1.5 rounded-md hover:bg-green-500/20 transition-colors"
                >
                  Claim Refund
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Main content rendering based on active tab
  const renderContent = () => {
    if (activeTab === 'activity') return renderActivitySection();
    if (activeTab === 'created') return renderMyRafflesSection();
    if (activeTab === 'purchased') return renderPurchasedTicketsSection();
    if (activeTab === 'dashboard') return renderDashboardSection();
    return renderActivitySection(); // Default fallback
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <div className="bg-background border-b border-border p-4">
        <h1 className="text-2xl font-bold mb-2">Profile</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Track activities and manage your raffles
        </p>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-sm font-medium">Connected Account:</p>
          <p className="text-xs font-mono break-all">{address}</p>
        </div>
      </div>

      {/* Tab Navigation - 4 tabs to match desktop */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setActiveTab('activity')}
            data-profile-tab
            className={`p-4 rounded-lg border transition-colors ${
              activeTab === 'activity'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-card/90 text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Activity</span>
          </button>
          <button
            onClick={() => setActiveTab('created')}
            data-profile-tab
            className={`p-4 rounded-lg border transition-colors ${
              activeTab === 'created'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-card/90 text-foreground'
            }`}
          >
            <span className="text-sm font-medium">My Raffles</span>
          </button>
          <button
            onClick={() => setActiveTab('purchased')}
            data-profile-tab
            className={`p-4 rounded-lg border transition-colors ${
              activeTab === 'purchased'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-card/90 text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Slots</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            data-profile-tab
            className={`p-4 rounded-lg border transition-colors ${
              activeTab === 'dashboard'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-card/90 text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Dashboard</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pb-8">
        {renderContent()}
      </div>

      {loading && (
        <div className="text-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-xs text-muted-foreground">Loading on-chain data…</p>
        </div>
      )}
    </div>
  );
};

export default NewMobileProfilePage;
