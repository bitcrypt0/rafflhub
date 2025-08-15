import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useContract } from '../../contexts/ContractContext';
import { useProfileData } from '../../hooks/useProfileData';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../../hooks/useNativeCurrency';
import { Clock, Users, Settings, Activity, ShoppingCart, Crown, RefreshCw, Plus, Search, UserPlus, DollarSign, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../components/ui/sonner';
import { ResponsiveAddressInput, ResponsiveNumberInput } from '../../components/ui/responsive-input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { ethers } from 'ethers';
import { contractABIs } from '../../contracts/contractABIs';

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
      mintLoading: false
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
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
        case 'prize_claimed':
          return <Crown className="h-4 w-4 text-yellow-500" />;
        case 'refund_claimed':
          return <RefreshCw className="h-4 w-4 text-orange-500" />;
        default:
          return <Activity className="h-4 w-4 text-gray-500" />;
      }
    };

    const getActivityTitle = (activity) => {
      const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`;
      const quantity = activity.quantity || activity.ticketCount || 1;

      switch (activity.type) {
        case 'ticket_purchase':
          return `Purchased ${quantity} ${raffleName} ticket${quantity > 1 ? 's' : ''}`;
        case 'raffle_created':
          return `Created raffle "${raffleName}"`;
        case 'prize_won':
          return 'Won Prize!';
        case 'prize_claimed':
          return `Claimed prize from "${raffleName}"`;
        case 'refund_claimed':
          return 'Claimed Refund';
        case 'revenue_withdrawn':
          return `Withdrew revenue from "${raffleName}"`;
        default:
          return 'Activity';
      }
    };

    const getActivityDescription = (activity) => {
      const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`;
      switch (activity.type) {
        case 'ticket_purchase':
          return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : '';
        case 'prize_won':
          return `${raffleName} • Congratulations!`;
        case 'refund_claimed':
          return activity.amount ? `${raffleName} • ${activity.amount} ${getCurrencySymbol()}` : raffleName;
        case 'revenue_withdrawn':
          return activity.amount ? `${activity.amount} ${getCurrencySymbol()}` : '';
        default:
          return raffleName;
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
            className="bg-card border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
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
                  <button
                    onClick={() => handleRaffleClick(activity.raffleAddress)}
                    className="text-sm bg-[#614E41] text-white px-3 py-1.5 rounded-md hover:bg-[#4a3a30] transition-colors"
                  >
                    View Raffle
                  </button>

                  {activity.type === 'ticket_purchase' && activity.state === 'ended' && (
                    <button
                      onClick={() => claimRefund(activity.raffleAddress)}
                      className="text-sm bg-green-500/10 text-green-600 px-3 py-1.5 rounded-md hover:bg-green-500/20 transition-colors"
                    >
                      Claim Refund
                    </button>
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
      return renderDashboardComponent(activeDashboardComponent);
    }

    return (
      <div className="p-4 space-y-4 mobile-component-container">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Creator Dashboard</h3>
          {activeDashboardComponent && (
            <button
              onClick={() => setActiveDashboardComponent(null)}
              className="text-sm text-primary hover:text-primary/80"
            >
              ← Back
            </button>
          )}
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
              {formatRevenueAmount(createdRaffles.reduce((sum, r) => sum + (parseFloat(r.revenue) || 0), 0).toFixed(4))}
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
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Royalty & Reveal</div>
                <div className="text-sm text-muted-foreground">Manage royalties and reveal collections</div>
              </div>
            </div>
          </button>

          {/* Minter Approval */}
          <button
            onClick={() => setActiveDashboardComponent('minter')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Minter Approval</div>
                <div className="text-sm text-muted-foreground">Manage minter approvals for collections</div>
              </div>
            </div>
          </button>

          {/* Create New Token ID & Set Token URI */}
          <button
            onClick={() => setActiveDashboardComponent('tokenCreator')}
            data-dashboard-card
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-muted/30 transition-colors"
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
            className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-muted/30 transition-colors"
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
      case 'minter':
        return renderMinterComponent(handleBack);
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
      updateRoyaltyState({
        collectionData: { ...state.collectionData, [field]: value }
      });
    };

    const loadCollectionInfo = async () => {
      if (!state.collectionData.address || !connected) {
        toast.error('Please enter a collection address and connect your wallet');
        return;
      }

      updateRoyaltyState({ loadingInfo: true });
      try {
        // Auto-detect collection type by trying both ERC721 and ERC1155 - matches desktop
        let contract = null;
        let detectedType = null;

        // Try ERC721 first
        try {
          const erc721Contract = getContractInstance(state.collectionData.address, 'erc721Prize');
          if (erc721Contract) {
            // Test if it's actually ERC721 using proper detection methods
            try {
              // Check if it supports ERC721 interface
              const supportsERC721 = await erc721Contract.supportsInterface('0x80ac58cd'); // ERC721 interface ID
              if (supportsERC721) {
                contract = erc721Contract;
                detectedType = 'erc721';
              }
            } catch (e) {
              // Try alternative method - check for ERC721-specific function
              try {
                // Try calling balanceOf with one parameter (address) - ERC721 specific
                await erc721Contract.balanceOf(state.collectionData.address);
                contract = erc721Contract;
                detectedType = 'erc721';
              } catch (e2) {
                // Not ERC721
              }
            }
          }
        } catch (error) {
          // ERC721 failed, continue to ERC1155
        }

        // If ERC721 failed, try ERC1155
        if (!contract) {
          try {
            const erc1155Contract = getContractInstance(state.collectionData.address, 'erc1155Prize');
            if (erc1155Contract) {
              // Test if it's actually ERC1155 using proper detection methods
              try {
                // Check if it supports ERC1155 interface
                const supportsERC1155 = await erc1155Contract.supportsInterface('0xd9b67a26'); // ERC1155 interface ID
                if (supportsERC1155) {
                  contract = erc1155Contract;
                  detectedType = 'erc1155';
                }
              } catch (e) {
                // Try alternative method - check for ERC1155-specific function
                try {
                  // Try calling uri(0) - ERC1155 specific
                  await erc1155Contract.uri(0);
                  contract = erc1155Contract;
                  detectedType = 'erc1155';
                } catch (e2) {
                  // Not ERC1155
                }
              }
            }
          } catch (error) {
            // Neither worked
          }
        }

        if (!contract || !detectedType) {
          throw new Error('Invalid collection address or unsupported contract type');
        }

        // Update the collection type in state
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

        // Get current royalty info
        const royaltyInfo = await contract.royaltyInfo(1, 10000); // Query with token ID 1 and sale price 10000
        const royaltyPercentage = await contract.royaltyPercentage();
        const royaltyRecipient = await contract.royaltyRecipient();

        updateRoyaltyState({
          collectionInfo: {
            address: state.collectionData.address,
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

        // Check revealed status - match desktop implementation
        try {
          // Use isRevealed() function (bool) - matches desktop
          const revealed = await contract.isRevealed();
          updateRoyaltyState({ isRevealed: !!revealed });
        } catch (e) {
          // If isRevealed() does not exist, fallback to null
          console.log('Could not fetch reveal status:', e.message);
          updateRoyaltyState({ isRevealed: null });
        }

        toast.success('Collection loaded successfully!');
      } catch (error) {
        console.error('Error loading collection info:', error);
        toast.error('Error loading collection info: ' + error.message);
        updateRoyaltyState({ collectionInfo: null, isRevealed: null });
      } finally {
        updateRoyaltyState({ loadingInfo: false });
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
        toast.error('Error updating royalty: ' + error.message);
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
        toast.error('Error revealing collection: ' + (error.message || error));
      } finally {
        updateRoyaltyState({ revealing: false });
      }
    };

    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="text-primary hover:text-primary/80">
            ← Back
          </button>
          <h3 className="text-lg font-semibold">Royalty & Reveal</h3>
        </div>

        {/* Collection Lookup */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Collection Address</label>
            <div className="flex gap-2">
              <ResponsiveAddressInput
                value={state.collectionData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="0x..."
                className="flex-1"
              />
              <button
                onClick={loadCollectionInfo}
                disabled={state.loadingInfo || !connected}
                className="flex items-center gap-2 px-4 py-2 h-10 bg-[#614E41] text-white rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                <Search className="h-4 w-4" />
                {state.loadingInfo ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>
        </div>

        {/* Collection Info Display */}
        {state.collectionInfo && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold">Collection Information</h4>
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
              <button
                onClick={handleReveal}
                disabled={state.revealing || !connected}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state.revealing ? 'Revealing...' : 'Reveal Collection'}
              </button>
            )}
          </div>
        )}

        {/* Royalty Update Form */}
        {state.collectionInfo && state.collectionInfo.isOwner && (
          <div className="space-y-4">
            <h4 className="font-semibold">Update Royalty Settings</h4>

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

            <button
              onClick={handleUpdateRoyalty}
              disabled={state.loading || !connected || !state.collectionInfo || !state.collectionInfo.isOwner}
              className="w-full bg-[#614E41] text-white px-6 py-2.5 h-10 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              <Settings className="h-4 w-4" />
              {state.loading ? 'Updating...' : 'Update Royalty Settings'}
            </button>
          </div>
        )}
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

    const validateAddress = (address) => {
      return ethers.utils.isAddress(address);
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
    const fetchCollection = async () => {
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

      if (!validateAddress(state.collectionAddress)) {
        updateMinterState({ error: 'Please enter a valid Ethereum contract address.' });
        return;
      }

      if (!provider) {
        updateMinterState({ error: 'Provider not available.' });
        return;
      }

      try {
        updateMinterState({ loading: true });

        // Try fetching with ERC721 ABI first - matches desktop exactly
        let contract = new ethers.Contract(
          state.collectionAddress,
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
        } catch (err) {
          // If ERC721 ABI fails, try ERC1155 ABI - matches desktop
          contract = new ethers.Contract(
            state.collectionAddress,
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
          } catch (err) {
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
        } else {
          collectionName = 'ERC1155 Collection';
          collectionSymbol = 'N/A';
        }

        updateMinterState({
          fetchedCollection: state.collectionAddress,
          collectionName,
          collectionSymbol,
          success: `Collection loaded successfully!`,
          loading: false
        });

      } catch (error) {
        console.error('Error fetching collection:', error);
        updateMinterState({
          error: 'Failed to fetch collection: ' + error.message,
          loading: false
        });
      }
    };

    // Load collection details when minter address changes
    const loadCollectionDetails = async () => {
      if (!state.fetchedCollection || !state.minterAddress || !validateAddress(state.minterAddress) || !provider) {
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
          isApproved: currentMinter.toLowerCase() === state.minterAddress.toLowerCase(),
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

      if (!state.minterAddress || !validateAddress(state.minterAddress)) {
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

        const tx = await contract.setMinterApproval(state.minterAddress, approved);
        await tx.wait();

        toast.success(`Minter ${approved ? 'set' : 'removed'} successfully!`);
        updateMinterState({
          isApproved: approved,
          minterAddress: ''
        });

      } catch (err) {
        toast.error(`Failed to set minter approval: ${extractRevertReason(err)}`);
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
          toast.error('Failed to get contract owner');
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
        toast.error(`Failed to ${state.isLocked ? 'unlock' : 'lock'} minter approval: ${extractRevertReason(err)}`);
      } finally {
        updateMinterState({ loading: false });
      }
    };

    // Auto-load collection details when minter address changes - removed useEffect to prevent dependency issues
    // Users can manually check minter status by re-fetching collection if needed

    return (
      <div className="p-4 space-y-4 max-w-full overflow-x-hidden dashboard-component">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="text-primary hover:text-primary/80">
            ← Back
          </button>
          <h3 className="text-lg font-semibold">Minter Approval Management</h3>
        </div>

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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Collection Address</label>
            <div className="flex gap-2">
              <ResponsiveAddressInput
                value={state.collectionAddress}
                onChange={(e) => updateMinterState({ collectionAddress: e.target.value })}
                placeholder="0x..."
                className="flex-1"
              />
              <button
                onClick={fetchCollection}
                disabled={state.loading || !connected}
                className="flex items-center gap-2 px-4 py-2 h-10 bg-[#614E41] text-white rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                <Search className="h-4 w-4" />
                {state.loading ? 'Loading...' : 'Fetch Collection'}
              </button>
            </div>
          </div>
        </div>

        {/* Collection Info */}
        {state.fetchedCollection && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold">Collection Information</h4>
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
              <button
                onClick={toggleMinterApprovalLock}
                disabled={state.loading || !connected}
                className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state.loading ? 'Processing...' : state.isLocked ? 'Unlock Minter Approval' : 'Lock Minter Approval'}
              </button>
            </div>
          </div>
        )}

        {/* Minter Management */}
        {state.fetchedCollection && (
          <div className="space-y-4">
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
              <button
                onClick={() => setMinterApproval(true)}
                disabled={state.loading || state.isApproved || state.isLocked || !state.minterAddress || !validateAddress(state.minterAddress)}
                className="w-full bg-[#614E41] text-white px-4 py-2 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={!state.minterAddress ? "Please enter a minter address" : !validateAddress(state.minterAddress) ? "Please enter a valid address" : state.isApproved ? "Address is already the minter" : state.isLocked ? "Minter approval is locked" : "Set as minter"}
              >
                {state.loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Set Minter
              </button>

              <button
                onClick={() => setMinterApproval(false)}
                disabled={state.loading || !state.isApproved || state.isLocked || !state.minterAddress || !validateAddress(state.minterAddress)}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title={!state.minterAddress ? "Please enter a minter address" : !validateAddress(state.minterAddress) ? "Please enter a valid address" : !state.isApproved ? "Address is not currently the minter" : state.isLocked ? "Minter approval is locked" : "Remove minter"}
              >
                {state.loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Remove Minter
              </button>
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
          contract,
          'createNewToken',
          [tokenId, maxSupply],
          {
            description: `Creating new token ID ${tokenId} with max supply ${maxSupply}`,
            successMessage: `Token ID ${tokenId} created successfully!`
          }
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
          contract,
          'setURI',
          [tokenId, state.uriData.tokenURI],
          {
            description: `Setting URI for token ID ${tokenId}`,
            successMessage: `Token URI set successfully for token ID ${tokenId}!`
          }
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
          <button onClick={handleBack} className="text-primary hover:text-primary/80">
            ← Back
          </button>
          <h3 className="text-lg font-semibold">Create New Token ID & Set Token URI</h3>
        </div>

        {/* Collection Lookup */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">ERC1155 Collection Address</label>
            <div className="flex gap-2">
              <ResponsiveAddressInput
                value={state.collectionData.address}
                onChange={(e) => updateTokenCreatorState({
                  collectionData: { ...state.collectionData, address: e.target.value }
                })}
                placeholder="0x..."
                className="flex-1"
              />
              <button
                onClick={loadCollectionInfo}
                disabled={state.loadingInfo || !connected}
                className="flex items-center gap-2 px-4 py-2 h-10 bg-[#614E41] text-white rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                <Search className="h-4 w-4" />
                {state.loadingInfo ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>
        </div>

        {/* Collection Info Display */}
        {state.collectionInfo && (
          <div className={`p-4 rounded-lg border ${state.collectionInfo.isBlocked ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50'}`}>
            <h4 className="text-sm text-muted-foreground mb-2">Collection Information</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="break-all"><span className="text-muted-foreground">Address:</span> {state.collectionInfo.address}</p>
              <p className="break-all"><span className="text-muted-foreground">Owner:</span> {state.collectionInfo.owner}</p>
              <p><span className="text-muted-foreground">You are owner:</span> {state.collectionInfo.isOwner ? '✅ Yes' : '❌ No'}</p>
              <p><span className="text-muted-foreground">Type:</span> {state.collectionInfo.type === 'erc721' ? '❌ ERC721 Collection (Incompatible)' : '✅ ERC1155 Collection'}</p>
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
          <div className="space-y-4">
            <h4 className="font-semibold">Create New Token ID</h4>
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

            <button
              onClick={handleCreateNewToken}
              disabled={state.loading || !connected || !state.collectionInfo.isOwner || state.collectionInfo.isBlocked || !state.tokenCreationData.tokenId || !state.tokenCreationData.maxSupply}
              className="w-full bg-[#614E41] text-white px-6 py-2.5 h-10 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              <Plus className="h-4 w-4" />
              {state.loading ? 'Creating...' : 'Create New Token ID'}
            </button>
          </div>
        )}

        {/* Set Token URI Section */}
        {state.collectionInfo && state.collectionInfo.isOwner && !state.collectionInfo.isBlocked && (
          <div className="space-y-4">
            <h4 className="font-semibold">Set Token URI</h4>
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

            <button
              onClick={handleSetTokenURI}
              disabled={state.loading || !connected || !state.collectionInfo.isOwner || state.collectionInfo.isBlocked || !state.uriData.tokenId || !state.uriData.tokenURI}
              className="w-full bg-[#614E41] text-white px-6 py-2.5 h-10 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm"
            >
              <Search className="h-4 w-4" />
              {state.loading ? 'Setting...' : 'Set Token URI'}
            </button>
          </div>
        )}
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
        const contract = getContractInstance(raffleAddress, 'raffle');

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

        // Map state number to readable state - matches desktop exactly
        const stateNames = [
          'Pending',           // 0
          'Active',            // 1
          'Ended',             // 2
          'Drawing',           // 3
          'Completed',         // 4
          'Deleted',           // 5
          'ActivationFailed',  // 6
          'AllPrizesClaimed',  // 7
          'Unengaged'          // 8
        ];
        const stateName = stateNames[state] || 'Unknown';

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
        toast.error('Error loading raffle info: ' + error.message);
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
        const contract = getContractInstance(state.raffleData.address, 'raffle');
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
        toast.error('Error withdrawing revenue: ' + error.message);
      } finally {
        updateRevenueState({ loading: false });
      }
    };

    // Creator Mint functionality - matches desktop implementation
    const handleMintDataChange = (field, value) => {
      updateRevenueState({
        mintData: { ...state.mintData, [field]: value }
      });
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
          result = await executeTransaction(contract.creatorMint, state.mintData.recipient, quantity);
        } else {
          // ERC1155: creatorMint(address to, uint256 id, uint256 quantity)
          const tokenId = parseInt(state.mintData.tokenId);
          result = await executeTransaction(contract.creatorMint, state.mintData.recipient, tokenId, quantity);
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
        toast.error('Error minting tokens: ' + error.message);
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

        {/* Raffle Lookup */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Raffle Address</label>
            <div className="flex gap-2">
              <ResponsiveAddressInput
                value={state.raffleData.address}
                onChange={(e) => updateRevenueState({
                  raffleData: { ...state.raffleData, address: e.target.value }
                })}
                placeholder="0x..."
                className="flex-1"
              />
              <button
                onClick={() => loadRaffleInfo(state.raffleData.address)}
                disabled={state.loading || !connected}
                className="flex items-center gap-2 px-4 py-2 h-10 bg-[#614E41] text-white rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                <Search className="h-4 w-4" />
                {state.loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Access to Created Raffles */}
        {createdRaffles.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">Your Created Raffles</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {createdRaffles.slice(0, 5).map((raffle) => (
                <button
                  key={raffle.address}
                  onClick={() => loadRaffleInfo(raffle.address)}
                  className="w-full text-left bg-muted/30 border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm font-medium">{raffle.name || `Raffle ${raffle.address.slice(0, 8)}...`}</div>
                  <div className="text-xs text-muted-foreground">State: {raffle.state}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Raffle Info Display */}
        {state.raffleData.address && state.raffleData.raffleState !== 'unknown' && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
            <h4 className="font-semibold">Raffle Information</h4>
            <div className="space-y-2 text-sm">
              <div className="break-all">
                <span className="font-medium">Address:</span>
                <span className="ml-1 font-mono text-xs">{state.raffleData.address}</span>
              </div>
              <div><span className="font-medium">State:</span> {state.raffleData.raffleState}</div>
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
          <button
            onClick={handleWithdrawRevenue}
            disabled={state.loading || !connected || !canWithdraw}
            className="w-full bg-[#614E41] text-white px-6 py-2.5 h-10 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm"
          >
            <DollarSign className="h-4 w-4" />
            {state.loading ? 'Withdrawing...' : `Withdraw ${state.raffleData.revenueAmount} ${getCurrencySymbol()}`}
          </button>
        )}

        {/* Creator Mint Section - matches desktop implementation */}
        <div className="space-y-4 border-t border-border pt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Creator Mint</h3>
            <p className="text-sm text-muted-foreground">
              Mint tokens directly to winners or any address
            </p>
          </div>

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
          <button
            onClick={handleCreatorMint}
            disabled={state.mintLoading || !connected || !state.mintData.collectionAddress || !state.mintData.recipient || !state.mintData.quantity || (state.mintData.collectionType === 'erc1155' && !state.mintData.tokenId)}
            className="w-full bg-green-600 text-white px-6 py-2.5 h-10 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm"
          >
            <Plus className="h-4 w-4" />
            {state.mintLoading ? 'Minting...' : `Mint ${state.mintData.quantity || '1'} Token(s)`}
          </button>

          {!connected && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-muted-foreground text-sm">
                Please connect your wallet to use creator mint functionality.
              </p>
            </div>
          )}
        </div>
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
            <button
              onClick={() => navigate('/create-raffle')}
              className="bg-[#614E41] text-white px-6 py-2 rounded-lg hover:bg-[#4a3a30] transition-colors"
            >
              Create Your First Raffle
            </button>
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
            className="bg-card border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground text-sm mb-1">
                  {raffle.name || `Raffle ${raffle.address.slice(0, 8)}...`}
                </h4>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">State:</span> {raffle.state}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Tickets Sold:</span> {raffle.ticketsSold || 0} / {raffle.maxTickets || 'Unlimited'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Revenue:</span> {formatRevenueAmount(raffle.revenue || '0')}
                  </p>
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
              <button
                onClick={() => handleRaffleClick(raffle.address)}
                className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors"
              >
                View Details
              </button>
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
            <h3 className="text-lg font-semibold mb-2">No Tickets Purchased Yet</h3>
            <p className="text-muted-foreground text-sm">
              You haven't purchased any raffle tickets yet. Browse active raffles to get started!
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Purchased Tickets</h3>
          <span className="text-sm text-muted-foreground">{purchasedTickets.length} tickets</span>
        </div>

        {purchasedTickets.map((ticket, index) => (
          <div
            key={ticket.id || index}
            className="bg-card border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground text-sm mb-1">
                  {ticket.raffleName || `Raffle ${ticket.raffleAddress?.slice(0, 8)}...`}
                </h4>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Tickets:</span> {ticket.quantity || ticket.ticketCount || 1}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Amount Paid:</span> {ticket.amount || '0'} {getCurrencySymbol()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">State:</span> {ticket.state || 'Unknown'}
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
      <div className="bg-card border-b border-border p-4">
        <h1 className="text-2xl font-bold mb-2">Profile</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Track activities and manage your raffles
        </p>
        <div className="bg-muted/50 border border-border/30 rounded-lg p-3">
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
                : 'border-border bg-background hover:bg-muted text-foreground'
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
                : 'border-border bg-background hover:bg-muted text-foreground'
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
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Tickets</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            data-profile-tab
            className={`p-4 rounded-lg border transition-colors ${
              activeTab === 'dashboard'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-muted text-foreground'
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
    </div>
  );
};

export default NewMobileProfilePage;
