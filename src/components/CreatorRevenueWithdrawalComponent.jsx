import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from './ui/sonner';
import { ResponsiveAddressInput } from './ui/responsive-input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { LoadingSpinner } from './ui/loading';
import { notifyError } from '../utils/notificationService';
import { Button } from './ui/button';

const CreatorRevenueWithdrawalComponent = () => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const { formatRevenueAmount, getCurrencySymbol } = useNativeCurrency();
  const [loading, setLoading] = useState(false);
  const [raffleData, setRaffleData] = useState({
    address: '',
    revenueAmount: '0',
    isOwner: false,
    raffleState: 'unknown'
  });
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [createdRaffles, setCreatedRaffles] = useState([]);
  const [loadingRaffles, setLoadingRaffles] = useState(false);

  // Creator Mint state
  const [mintData, setMintData] = useState({
    collectionAddress: '',
    collectionType: 'erc721', // erc721 or erc1155
    recipient: '',
    quantity: '',
    tokenId: '' // Only for ERC1155
  });
  const [mintLoading, setMintLoading] = useState(false);
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [loadingCollectionInfo, setLoadingCollectionInfo] = useState(false);

  const handleChange = (field, value) => {
    setRaffleData(prev => ({ ...prev, [field]: value }));
  };

  const handleMintChange = (field, value) => {
    setMintData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-detect collection type and load collection info for minting
  const loadCollectionInfoForMint = async () => {
    if (!mintData.collectionAddress || !connected) {
      toast.error('Please enter a collection address and connect your wallet');
      return;
    }

    setLoadingCollectionInfo(true);
    try {
      // Auto-detect collection type by trying both ERC721 and ERC1155
      let contract = null;
      let detectedType = null;

      // Try ERC721 first (most common)
      try {
        const erc721Contract = getContractInstance(mintData.collectionAddress, 'erc721Prize');
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
              // Try calling totalSupply() - ERC721 specific
              await erc721Contract.totalSupply();
              contract = erc721Contract;
              detectedType = 'erc721';
            } catch (e2) {
              // Not ERC721
            }
          }
        }
      } catch (error) {
        // Not ERC721, try ERC1155
      }

      // If ERC721 failed, try ERC1155
      if (!contract) {
        try {
          const erc1155Contract = getContractInstance(mintData.collectionAddress, 'erc1155Prize');
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
      setMintData(prev => ({ ...prev, collectionType: detectedType }));

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
          // User will need to specify tokenId for accurate vesting info
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

      setCollectionInfo({
        name,
        symbol,
        owner,
        type: detectedType,
        isOwner,
        vestingConfigured,
        unlockedAmount,
        availableAmount
      });

      if (detectedType === 'erc1155') {
        toast.success('Collection loaded');
      } else {
        toast.success(`Collection loaded: ${name} (${detectedType.toUpperCase()})`);
      }
    } catch (error) {
      console.error('Error loading collection info:', error);
      toast.error('Failed to load collection information: ' + error.message);
      setCollectionInfo(null);
    } finally {
      setLoadingCollectionInfo(false);
    }
  };

  // Handle creator mint
  const handleCreatorMint = async () => {
    if (!connected || !collectionInfo) {
      toast.error('Please connect your wallet and load collection info first');
      return;
    }

    if (!collectionInfo.isOwner) {
      toast.error('You are not the owner of this collection');
      return;
    }

    if (!mintData.recipient || !mintData.quantity) {
      toast.error('Please fill in recipient address and quantity');
      return;
    }

    if (mintData.collectionType === 'erc1155' && !mintData.tokenId) {
      toast.error('Please specify token ID for ERC1155 minting');
      return;
    }

    const quantity = parseInt(mintData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setMintLoading(true);
    try {
      const contractType = mintData.collectionType === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
      const contract = getContractInstance(mintData.collectionAddress, contractType);

      if (!contract) {
        throw new Error('Failed to create contract instance');
      }

      let result;
      if (mintData.collectionType === 'erc721') {
        // ERC721: creatorMint(address to, uint256 quantity)
        result = await executeTransaction(contract.creatorMint, mintData.recipient, quantity);
      } else {
        // ERC1155: creatorMint(address to, uint256 id, uint256 quantity)
        const tokenId = parseInt(mintData.tokenId);
        if (isNaN(tokenId)) {
          throw new Error('Invalid token ID');
        }
        result = await executeTransaction(contract.creatorMint, mintData.recipient, tokenId, quantity);
      }

      if (result.success) {
        toast.success(`Successfully minted ${quantity} token(s)! Transaction: ${result.hash}`);
        // Clear form
        setMintData(prev => ({
          ...prev,
          recipient: '',
          quantity: '',
          tokenId: ''
        }));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error minting tokens:', error);
      notifyError(error, { action: 'creatorMint' });
    } finally {
      setMintLoading(false);
    }
  };

  const loadRaffleInfo = async (raffleAddress) => {
    if (!raffleAddress || !connected) {
      toast.error('Please enter a raffle address and connect your wallet');
      return;
    }

    setLoadingInfo(true);
    try {
      const contract = getContractInstance(raffleAddress, 'pool');
      
      if (!contract) {
        throw new Error('Failed to create raffle contract instance');
      }

      // Get raffle information
      const [
        creator,
        revenueRecipient,
        totalRevenue,
        state
      ] = await Promise.all([
        contract.creator(),
        contract.revenueRecipient(),
        contract.totalCreatorRevenue(),
        contract.state()
      ]);

      const isCreator = creator.toLowerCase() === address.toLowerCase();
      const isRevenueRecipient = revenueRecipient.toLowerCase() === address.toLowerCase();
      const isBothCreatorAndRecipient = isCreator && isRevenueRecipient;
      
      // Map state number to readable state
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
      const stateName = stateNames[state] || 'Unknown';

      setRaffleData({
        address: raffleAddress,
        revenueAmount: ethers.utils.formatEther(totalRevenue),
        isCreator,
        isRevenueRecipient,
        isBothCreatorAndRecipient,
        raffleState: stateName,
        totalRevenue
      });

    } catch (error) {
      console.error('Error loading raffle info:', error);
      toast.error('Error loading raffle info: ' + error.message);
      setRaffleData({
        address: raffleAddress,
        revenueAmount: '0',
        isCreator: false,
        raffleState: 'error'
      });
    } finally {
      setLoadingInfo(false);
    }
  };

  const loadCreatedRaffles = async () => {
    if (!connected) return;

    setLoadingRaffles(true);
    try {
      // In a real implementation, you would query events or a subgraph
      // to get raffles created by the current user
      // For now, we'll show a placeholder message
      setCreatedRaffles([]);
    } catch (error) {
      console.error('Error loading created raffles:', error);
    } finally {
      setLoadingRaffles(false);
    }
  };

  const handleWithdrawRevenue = async () => {
    if (!connected || !raffleData.address) {
      toast.error('Please connect your wallet and load raffle info first');
      return;
    }

    if (!raffleData.isRevenueRecipient) {
      toast.error('You are not the revenue recipient of this raffle');
      return;
    }

    if (parseFloat(raffleData.revenueAmount) <= 0) {
      toast.info('No revenue available for withdrawal');
      return;
    }

    // Check if raffle is in a valid state for withdrawal
    const validStates = ['Completed', 'AllPrizesClaimed', 'Ended'];
    if (!validStates.includes(raffleData.raffleState)) {
      toast.info(`Revenue can only be withdrawn from completed raffles. Current state: ${raffleData.raffleState}`);
      return;
    }

    setLoading(true);
    try {
      const contract = getContractInstance(raffleData.address, 'pool');
      
      if (!contract) {
        throw new Error('Failed to create raffle contract instance');
      }

      const result = await executeTransaction(contract.withdrawCreatorRevenue);

      if (result.success) {
        toast.success(`Revenue withdrawn successfully! Transaction: ${result.hash}`);
        // Reload raffle info to show updated values
        await loadRaffleInfo(raffleData.address);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error withdrawing revenue:', error);
      notifyError(error, { action: 'withdrawRevenue' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected) {
      loadCreatedRaffles();
    }
  }, [connected]);

  // Auto-fetch raffle info when a valid address is entered
  useEffect(() => {
    const addr = raffleData.address;
    if (!connected || !addr || !ethers.utils.isAddress(addr)) return;
    const t = setTimeout(() => {
      if (!loadingInfo) {
        loadRaffleInfo(addr);
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffleData.address, connected]);

  // Auto-fetch mint collection info when a valid address is entered
  useEffect(() => {
    const addr = mintData.collectionAddress;
    if (!connected || !addr || !ethers.utils.isAddress(addr)) return;
    const t = setTimeout(() => {
      if (!loadingCollectionInfo) {
        loadCollectionInfoForMint();
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintData.collectionAddress, connected]);

  const getStateColor = (state) => {
    switch (state) {
      case 'Completed':
      case 'AllPrizesClaimed':
        return 'text-green-600';
      case 'Ended':
        return 'text-red-600';
      case 'Active':
        return 'text-blue-600';
      case 'Pending':
        return 'text-yellow-600';
      case 'Drawing':
        return 'text-purple-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const hasRevenue = (raffleData.totalRevenue && ethers.BigNumber.isBigNumber(raffleData.totalRevenue))
    ? !raffleData.totalRevenue.isZero()
    : parseFloat(raffleData.revenueAmount) > 0;

  const canWithdraw = raffleData.isRevenueRecipient &&
                     hasRevenue &&
                     ['Completed', 'AllPrizesClaimed', 'Ended'].includes(raffleData.raffleState);

  return (
    <div className="space-y-6">{/* Simplified container - card wrapper handled by DashboardCard */}
        {/* Raffle Lookup Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Raffle Contract Address</label>
            <ResponsiveAddressInput
              value={raffleData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="0x..."
              rightElement={loadingInfo && <LoadingSpinner size="sm" />}
            />
          </div>
        </div>

        {/* Raffle Info Display */}
        {raffleData.address && raffleData.raffleState !== 'unknown' && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-3">Raffle Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Address:</span>
                <div className="font-mono break-all">{raffleData.address}</div>
              </div>
              <div>
                <span className="text-muted-foreground">State:</span>
                <div className={`font-semibold ${getStateColor(raffleData.raffleState)}`}>
                  {raffleData.raffleState}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Creator Revenue:</span>
                <div className="font-semibold">
                  {formatRevenueAmount(raffleData.totalRevenue || raffleData.revenueAmount)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Your Role:</span>
                <div className="flex items-center gap-2">
                  {raffleData.isBothCreatorAndRecipient && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Creator
                    </span>
                  )}
                  {raffleData.isRevenueRecipient && !raffleData.isBothCreatorAndRecipient && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Revenue Recipient
                    </span>
                  )}
                  {raffleData.isOwner && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Owner
                    </span>
                  )}
                  {!raffleData.isCreator && !raffleData.isRevenueRecipient && !raffleData.isOwner && (
                    <span className="text-muted-foreground text-xs">No special role</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Status Messages */}
            {!raffleData.isRevenueRecipient && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  You are not the revenue recipient of this raffle
                </span>
              </div>
            )}

            {raffleData.isRevenueRecipient && !hasRevenue && (
              <div className="mt-3 p-3 bg-yellow-50/80 dark:bg-yellow-900/20 backdrop-blur-sm border border-yellow-200/50 dark:border-yellow-700/50 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  No revenue available for withdrawal
                </span>
              </div>
            )}

            {raffleData.isRevenueRecipient && !['Completed', 'AllPrizesClaimed', 'Ended'].includes(raffleData.raffleState) && (
              <div className="mt-3 p-3 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Revenue can only be withdrawn from completed raffles.
                </span>
              </div>
            )}

            {canWithdraw && (
              <div className="mt-3 p-3 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm border border-green-200/50 dark:border-green-700/50 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Revenue is available for withdrawal!
                </span>
              </div>
            )}
          </div>
        )}

        {/* Withdrawal Button */}
        <div className="space-y-4">
          <Button
            onClick={handleWithdrawRevenue}
            disabled={loading || !connected || !canWithdraw}
            variant="primary"
            size="md"
            className="w-full h-10 flex items-center justify-center gap-2 shadow-sm text-sm"
            title={!connected ? "Please connect your wallet" : !raffleData.address ? "Please load raffle info first" : raffleData.raffleState === 'unknown' ? "Raffle state unknown" : !raffleData.isRevenueRecipient ? "Only revenue recipient can withdraw revenue" : !canWithdraw ? "Withdrawal not available - check raffle state and revenue amount" : `Withdraw ${formatRevenueAmount(raffleData.totalRevenue || raffleData.revenueAmount)}`}
          >
            <DollarSign className="h-4 w-4" />
            {loading ? 'Withdrawing...' : raffleData.address && (raffleData.totalRevenue || raffleData.revenueAmount) ? `Withdraw ${formatRevenueAmount(raffleData.totalRevenue || raffleData.revenueAmount)}` : 'Withdraw Revenue'}
          </Button>

          {!canWithdraw && raffleData.isRevenueRecipient && raffleData.address && (
            <p className="text-sm text-muted-foreground text-center">
              Withdrawal is not available at this time. Check the raffle state and revenue amount.
            </p>
          )}
        </div>

        {!connected && (
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-muted-foreground">
              Please connect your wallet to withdraw creator revenue.
            </p>
          </div>
        )}

        {/* Creator Mint Section */}
        <div className="space-y-4 border-t border-border pt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Creator Mint</h3>
          </div>

          {/* Collection Address Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Collection Contract Address</label>
              <ResponsiveAddressInput
                value={mintData.collectionAddress}
                onChange={(e) => handleMintChange('collectionAddress', e.target.value)}
                placeholder="0x..."
                rightElement={loadingCollectionInfo && <LoadingSpinner size="sm" />}
              />
            </div>

            {/* Collection Info Display */}
            {collectionInfo && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {collectionInfo.type === 'erc721' && (
                    <>
                      <div>
                        <span className="font-medium">Name:</span> {collectionInfo.name}
                      </div>
                      <div>
                        <span className="font-medium">Symbol:</span> {collectionInfo.symbol}
                      </div>
                    </>
                  )}
                  <div>
                    <span className="font-medium">Type:</span> {collectionInfo.type.toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium">Owner:</span> {collectionInfo.isOwner ? 'You' : 'Other'}
                  </div>
                </div>

                {/* Vesting Information */}
                {collectionInfo.vestingConfigured && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-sm font-medium mb-2 text-primary">Vesting Information</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Unlocked Amount:</span> {collectionInfo.unlockedAmount}
                      </div>
                      <div>
                        <span className="font-medium">Available Amount:</span> {collectionInfo.availableAmount}
                      </div>
                    </div>
                    {collectionInfo.type === 'erc1155' && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Note: Vesting info shown for Token ID 1. Specify exact Token ID for accurate amounts.
                      </div>
                    )}
                  </div>
                )}

                {!collectionInfo.isOwner && (
                  <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">
                      You are not the owner of this collection and cannot mint tokens.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Mint Form */}
            {collectionInfo && collectionInfo.isOwner && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Recipient Address</label>
                    <ResponsiveAddressInput
                      value={mintData.recipient}
                      onChange={(e) => handleMintChange('recipient', e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      value={mintData.quantity}
                      onChange={(e) => handleMintChange('quantity', e.target.value)}
                      placeholder="1"
                      min="1"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                </div>

                {/* Token ID for ERC1155 */}
                {collectionInfo.type === 'erc1155' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Token ID</label>
                    <input
                      type="number"
                      value={mintData.tokenId}
                      onChange={(e) => handleMintChange('tokenId', e.target.value)}
                      placeholder="1"
                      min="0"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                )}

                {/* Mint Button */}
                <Button
                  onClick={handleCreatorMint}
                  disabled={mintLoading || !connected || !collectionInfo.isOwner || !mintData.recipient || !mintData.quantity || (collectionInfo.type === 'erc1155' && !mintData.tokenId)}
                  variant="primary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2 shadow-sm"
                >
                  {mintLoading ? 'Minting...' : 'Mint'}
                </Button>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

export default CreatorRevenueWithdrawalComponent;
