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
  const { getCurrencySymbol } = useNativeCurrency();

  // Use existing data hook
  const {
    userActivity,
    createdRaffles,
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
      collectionSymbol: ''
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
      createdRaffles: []
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

    const formatDate = (timestamp) => {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      }
    };

    const handleRaffleClick = (raffleAddress) => {
      navigate(`/raffle/${raffleAddress}`);
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
                    className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors"
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
      <div className="p-4 space-y-4">
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

        {/* Creator Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{creatorStats.totalRaffles}</div>
            <div className="text-sm text-muted-foreground">Total Raffles</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{creatorStats.activeRaffles}</div>
            <div className="text-sm text-muted-foreground">Active Raffles</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{creatorStats.totalRevenue} {getCurrencySymbol()}</div>
            <div className="text-sm text-muted-foreground">Total Revenue</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold">{creatorStats.successRate}%</div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
        </div>

        {/* Dashboard Components */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground mb-3">Creator Tools</div>

          {/* Royalty & Reveal */}
          <button
            onClick={() => setActiveDashboardComponent('royalty')}
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
        toast.error('Please enter a collection address');
        return;
      }

      updateRoyaltyState({ loadingInfo: true });
      try {
        // Auto-detect collection type
        const erc721Contract = getContractInstance(state.collectionData.address, 'erc721Prize');
        const erc1155Contract = getContractInstance(state.collectionData.address, 'erc1155Prize');

        let contract, detectedType, name = 'Unknown', symbol = 'Unknown';

        try {
          if (erc721Contract && typeof erc721Contract.name === 'function') {
            name = await erc721Contract.name();
            symbol = await erc721Contract.symbol();
            contract = erc721Contract;
            detectedType = 'erc721';
          }
        } catch (e) {
          try {
            if (erc1155Contract && typeof erc1155Contract.name === 'function') {
              name = await erc1155Contract.name();
              contract = erc1155Contract;
              detectedType = 'erc1155';
            }
          } catch (e2) {
            throw new Error('Unable to detect collection type');
          }
        }

        if (!contract) {
          throw new Error('Failed to create contract instance');
        }

        updateRoyaltyState({
          collectionData: { ...state.collectionData, type: detectedType }
        });

        // Get owner
        let owner = 'Unknown';
        try {
          if (typeof contract.owner === 'function') {
            owner = await contract.owner();
          }
        } catch (e) {
          // owner() not available
        }

        const isOwner = owner !== 'Unknown' && owner.toLowerCase() === address.toLowerCase();

        // Get current royalty info
        const royaltyInfo = await contract.royaltyInfo(1, 10000);
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
            royaltyPercentage: (royaltyPercentage.toNumber() / 100).toString(),
            royaltyRecipient: royaltyRecipient
          }
        });

        // Check revealed status
        try {
          const revealed = await contract.revealed();
          updateRoyaltyState({ isRevealed: revealed });
        } catch (e) {
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
      <div className="p-4 space-y-4">
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
              <div><span className="font-medium">Name:</span> {state.collectionInfo.name}</div>
              {state.collectionInfo.symbol && (
                <div><span className="font-medium">Symbol:</span> {state.collectionInfo.symbol}</div>
              )}
              <div><span className="font-medium">Type:</span> {state.collectionInfo.type?.toUpperCase()}</div>
              <div><span className="font-medium">Owner:</span> {state.collectionInfo.owner}</div>
              <div><span className="font-medium">Current Royalty:</span> {(parseFloat(state.collectionInfo.currentRoyaltyPercentage) / 100).toFixed(2)}%</div>
              <div><span className="font-medium">Royalty Recipient:</span> {state.collectionInfo.currentRoyaltyRecipient}</div>
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

  // Minter Approval Component
  const renderMinterComponent = (handleBack) => {
    const state = dashboardStates.minter;

    const updateMinterState = (updates) => {
      setDashboardStates(prev => ({
        ...prev,
        minter: { ...prev.minter, ...updates }
      }));
    };

    const validateAddress = (address) => {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    };

    const loadCollectionInfo = async () => {
      if (!state.collectionAddress || !connected) {
        toast.error('Please enter a collection address');
        return;
      }

      updateMinterState({ loading: true });
      try {
        // Try ERC721 first
        let contract, collectionType;
        try {
          const erc721Contract = getContractInstance(state.collectionAddress, 'erc721Prize');
          const name = await erc721Contract.name();
          const symbol = await erc721Contract.symbol();
          contract = erc721Contract;
          collectionType = 'erc721';
          updateMinterState({ collectionName: name, collectionSymbol: symbol });
        } catch (e) {
          // Try ERC1155
          try {
            const erc1155Contract = getContractInstance(state.collectionAddress, 'erc1155Prize');
            const name = await erc1155Contract.name();
            contract = erc1155Contract;
            collectionType = 'erc1155';
            updateMinterState({ collectionName: name, collectionSymbol: '' });
          } catch (e2) {
            throw new Error('Unable to detect collection type');
          }
        }

        // Get current minter info
        const currentMinter = await contract.minter();
        const isLocked = await contract.minterLocked();

        updateMinterState({
          currentMinter,
          isLocked,
          loading: false
        });

        toast.success('Collection loaded successfully!');
      } catch (error) {
        console.error('Error loading collection:', error);
        toast.error('Error loading collection: ' + error.message);
        updateMinterState({ loading: false });
      }
    };

    const setMinterApproval = async (approved) => {
      if (!state.minterAddress || !validateAddress(state.minterAddress)) {
        toast.error('Please enter a valid minter address');
        return;
      }

      updateMinterState({ loading: true });
      try {
        const signer = provider.getSigner();
        const contract = new ethers.Contract(
          state.collectionAddress,
          contractABIs.erc721Prize, // Use ERC721 ABI for now - could be enhanced to detect type
          signer
        );

        const tx = await contract.setMinterApproval(state.minterAddress, approved);
        await tx.wait();

        toast.success(`Minter ${approved ? 'approved' : 'revoked'} successfully!`);
        await loadCollectionInfo();
      } catch (error) {
        console.error('Error setting minter approval:', error);
        toast.error('Error setting minter approval: ' + error.message);
      } finally {
        updateMinterState({ loading: false });
      }
    };

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="text-primary hover:text-primary/80">
            ← Back
          </button>
          <h3 className="text-lg font-semibold">Minter Approval</h3>
        </div>

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
                onClick={loadCollectionInfo}
                disabled={state.loading || !connected}
                className="flex items-center gap-2 px-4 py-2 h-10 bg-[#614E41] text-white rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                <Search className="h-4 w-4" />
                {state.loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>
        </div>

        {/* Collection Info */}
        {state.collectionName && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
            <h4 className="font-semibold">Collection Information</h4>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Name:</span> {state.collectionName}</div>
              {state.collectionSymbol && (
                <div><span className="font-medium">Symbol:</span> {state.collectionSymbol}</div>
              )}
              <div><span className="font-medium">Current Minter:</span> {state.currentMinter || 'None'}</div>
              <div><span className="font-medium">Minter Locked:</span> {state.isLocked ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}

        {/* Minter Management */}
        {state.collectionName && !state.isLocked && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Minter Address</label>
              <ResponsiveAddressInput
                value={state.minterAddress}
                onChange={(e) => updateMinterState({ minterAddress: e.target.value })}
                placeholder="0x..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMinterApproval(true)}
                disabled={state.loading || !state.minterAddress || !validateAddress(state.minterAddress)}
                className="flex-1 bg-[#614E41] text-white px-4 py-2 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {state.loading ? 'Setting...' : 'Set as Minter'}
              </button>
              <button
                onClick={() => setMinterApproval(false)}
                disabled={state.loading || !state.minterAddress || !validateAddress(state.minterAddress)}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.loading ? 'Revoking...' : 'Revoke Minter'}
              </button>
            </div>
          </div>
        )}

        {state.isLocked && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">Minter approval is locked for this collection.</span>
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

    const loadCollectionInfo = async () => {
      if (!state.collectionData.address || !connected) {
        toast.error('Please enter a collection address');
        return;
      }

      updateTokenCreatorState({ loadingInfo: true });
      try {
        const contract = getContractInstance(state.collectionData.address, 'erc1155Prize');
        if (!contract) throw new Error('Failed to create ERC1155 contract instance');

        const name = await contract.name();
        const owner = await contract.owner();
        const isOwner = owner.toLowerCase() === address.toLowerCase();
        const isBlocked = await contract.blocked();

        updateTokenCreatorState({
          collectionInfo: {
            address: state.collectionData.address,
            name,
            owner,
            isOwner,
            isBlocked
          },
          collectionData: { ...state.collectionData, type: 'erc1155' }
        });

        toast.success('ERC1155 collection loaded successfully!');
      } catch (error) {
        console.error('Error loading collection:', error);
        toast.error('Error loading collection: ' + error.message);
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
      <div className="p-4 space-y-4">
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

        {/* Collection Info */}
        {state.collectionInfo && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
            <h4 className="font-semibold">Collection Information</h4>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Name:</span> {state.collectionInfo.name}</div>
              <div><span className="font-medium">Owner:</span> {state.collectionInfo.owner}</div>
              <div><span className="font-medium">Blocked:</span> {state.collectionInfo.isBlocked ? 'Yes' : 'No'}</div>
            </div>
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
        toast.error('Please enter a raffle address');
        return;
      }

      updateRevenueState({ loading: true });
      try {
        const contract = getContractInstance(raffleAddress, 'raffle');
        if (!contract) throw new Error('Failed to create raffle contract instance');

        const creator = await contract.creator();
        const isCreator = creator.toLowerCase() === address.toLowerCase();

        // Get raffle state
        const state = await contract.raffleState();
        const stateNames = ['Active', 'Ended', 'Completed', 'AllPrizesClaimed'];
        const raffleState = stateNames[state] || 'Unknown';

        // Get revenue amount
        let revenueAmount = '0';
        try {
          const revenue = await contract.creatorRevenue();
          revenueAmount = ethers.utils.formatEther(revenue);
        } catch (e) {
          console.log('Could not fetch revenue amount:', e);
        }

        updateRevenueState({
          raffleData: {
            address: raffleAddress,
            isCreator,
            revenueAmount,
            raffleState
          }
        });

        toast.success('Raffle info loaded successfully!');
      } catch (error) {
        console.error('Error loading raffle info:', error);
        toast.error('Error loading raffle info: ' + error.message);
        updateRevenueState({
          raffleData: { address: '', isCreator: false, revenueAmount: '0', raffleState: 'unknown' }
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

    const canWithdraw = state.raffleData.isCreator &&
                       parseFloat(state.raffleData.revenueAmount) > 0 &&
                       ['Completed', 'AllPrizesClaimed', 'Ended'].includes(state.raffleData.raffleState);

    return (
      <div className="p-4 space-y-4">
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
              <div><span className="font-medium">Address:</span> {state.raffleData.address}</div>
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
      </div>
    );
  };

  // Main content rendering based on active tab
  const renderContent = () => {
    if (activeTab === 'activity') return renderActivitySection();
    if (activeTab === 'dashboard') return renderDashboardSection();
    return renderActivitySection(); // Default fallback
  };

  return (
    <div className="min-h-screen bg-background">
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

      {/* Tab Navigation */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setActiveTab('activity')}
            className={`p-4 rounded-lg border transition-colors ${
              activeTab === 'activity'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Activity</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
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
