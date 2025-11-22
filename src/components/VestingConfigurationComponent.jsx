import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from './ui/sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Clock, Lock, Unlock, Calendar, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

const VestingConfigurationComponent = () => {
  const { address, provider } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();

  // Collection fetch state
  const [collectionAddress, setCollectionAddress] = useState('');
  const [fetchedCollection, setFetchedCollection] = useState(null);
  const [isERC721, setIsERC721] = useState(null);
  const [loading, setLoading] = useState(false);

  // Vesting configuration state
  const [cliffDays, setCliffDays] = useState(7);
  const [numberOfUnlocks, setNumberOfUnlocks] = useState(2);
  const [unlockIntervalDays, setUnlockIntervalDays] = useState(7);
  const [tokenId, setTokenId] = useState(1); // For ERC1155

  // Collection info state
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [vestingInfo, setVestingInfo] = useState(null);
  const [configuring, setConfiguring] = useState(false);

  // Fetch collection details
  const fetchCollectionDetails = async (addressToFetch) => {
    if (!addressToFetch || !ethers.utils.isAddress(addressToFetch)) {
      // Clear state if address is invalid
      setFetchedCollection(null);
      setCollectionInfo(null);
      setVestingInfo(null);
      setIsERC721(null);
      return;
    }

    setLoading(true);
    try {
      // Try ERC721 first; if not, switch to ERC1155 explicitly
      let contract = getContractInstance(addressToFetch, 'erc721Prize');
      let isERC721Contract = false;

      try {
        const supportsERC721 = await contract.supportsInterface('0x80ac58cd');
        if (supportsERC721) {
          isERC721Contract = true;
        } else {
          contract = getContractInstance(addressToFetch, 'erc1155Prize');
        }
      } catch (e) {
        contract = getContractInstance(addressToFetch, 'erc1155Prize');
      }

      // Get owner
      const owner = await contract.owner();
      
      if (owner.toLowerCase() !== address.toLowerCase()) {
        toast.error('You are not the owner of this collection');
        setLoading(false);
        return;
      }

      setIsERC721(isERC721Contract);
      setFetchedCollection(contract);

      // Get collection info
      if (isERC721Contract) {
        const [maxSupply, creationTime, vestingConfigured, creatorClaimedCount] = await Promise.all([
          contract.maxSupply(),
          contract.creationTime(),
          contract.vestingConfigured(),
          contract.creatorClaimedCount()
        ]);

        const creatorAllocation = maxSupply.div(5);

        const info = {
          maxSupply: maxSupply.toString(),
          creatorAllocation: creatorAllocation.toString(),
          creationTime: creationTime.toString(),
          vestingConfigured,
          creatorClaimedCount: creatorClaimedCount.toString(),
          isERC721: true
        };

        setCollectionInfo(info);

        // If vesting is configured, get vesting details
        if (vestingConfigured) {
          const [config, availableToMint, unlockedAmount] = await Promise.all([
            contract.vestingConfig(),
            contract.getAvailableCreatorMint(),
            contract.getUnlockedAmount()
          ]);

          setVestingInfo({
            cliffEnd: config.cliffEnd.toString(),
            numberOfUnlocks: config.numberOfUnlocks.toString(),
            durationBetweenUnlocks: config.durationBetweenUnlocks.toString(),
            amountPerUnlock: config.amountPerUnlock.toString(),
            availableToMint: availableToMint.toString(),
            unlockedAmount: unlockedAmount.toString()
          });
        }
      } else {
        // ERC1155
        const [maxSupply, creationTime, vestingConfigured, creatorClaimedCount] = await Promise.all([
          contract.maxSupply(tokenId),
          contract.tokenCreationTime(tokenId),
          contract.vestingConfigured(tokenId),
          contract.creatorClaimedCount(tokenId)
        ]);

        const creatorAllocation = maxSupply.div(5);

        const info = {
          maxSupply: maxSupply.toString(),
          creatorAllocation: creatorAllocation.toString(),
          creationTime: creationTime.toString(),
          vestingConfigured,
          creatorClaimedCount: creatorClaimedCount.toString(),
          isERC721: false,
          tokenId
        };

        setCollectionInfo(info);

        // If vesting is configured, get vesting details
        if (vestingConfigured) {
          const [config, availableToMint, unlockedAmount] = await Promise.all([
            contract.vestingConfig(tokenId),
            contract.getAvailableCreatorMint(tokenId),
            contract.getUnlockedAmount(tokenId)
          ]);

          setVestingInfo({
            cliffEnd: config.cliffEnd.toString(),
            numberOfUnlocks: config.numberOfUnlocks.toString(),
            durationBetweenUnlocks: config.durationBetweenUnlocks.toString(),
            amountPerUnlock: config.amountPerUnlock.toString(),
            availableToMint: availableToMint.toString(),
            unlockedAmount: unlockedAmount.toString()
          });
        }
      }

      toast.success('Collection details fetched successfully');
    } catch (error) {
      console.error('Error fetching collection:', error);
      toast.error(`Failed to fetch collection: ${error.message}`);
      setFetchedCollection(null);
      setCollectionInfo(null);
      setVestingInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch collection details when address changes
  useEffect(() => {
    // Debounce to avoid excessive calls while typing
    const timeoutId = setTimeout(() => {
      if (collectionAddress && ethers.utils.isAddress(collectionAddress)) {
        fetchCollectionDetails(collectionAddress);
      } else if (collectionAddress === '') {
        // Clear state when address is cleared
        setFetchedCollection(null);
        setCollectionInfo(null);
        setVestingInfo(null);
        setIsERC721(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [collectionAddress, address]); // Re-fetch if wallet address changes

  // Re-fetch when tokenId changes for ERC1155
  useEffect(() => {
    if (collectionAddress && ethers.utils.isAddress(collectionAddress) && !isERC721 && fetchedCollection) {
      fetchCollectionDetails(collectionAddress);
    }
  }, [tokenId]);

  // Configure vesting
  const configureVesting = async () => {
    if (!fetchedCollection || !collectionInfo) {
      toast.error('Please enter a valid collection address');
      return;
    }

    if (collectionInfo.vestingConfigured) {
      toast.error('Vesting is already configured for this collection/token');
      return;
    }

    // Validation
    if (cliffDays < 7) {
      toast.error('Cliff period must be at least 7 days');
      return;
    }

    if (unlockIntervalDays < 7) {
      toast.error('Unlock interval must be at least 7 days');
      return;
    }

    const creatorAllocation = parseInt(collectionInfo.creatorAllocation);
    
    // Validate minimum unlocks based on allocation
    let minUnlocks = 2;
    if (creatorAllocation >= 2000) {
      minUnlocks = 8;
    } else if (creatorAllocation >= 1000) {
      minUnlocks = 8;
    } else if (creatorAllocation >= 500) {
      minUnlocks = 4;
    }

    if (numberOfUnlocks < minUnlocks) {
      toast.error(`For an allocation of ${creatorAllocation} tokens, minimum ${minUnlocks} unlocks required`);
      return;
    }

    setConfiguring(true);
    try {
      const cliffEnd = Math.floor(Date.now() / 1000) + (cliffDays * 86400);
      const durationBetweenUnlocks = unlockIntervalDays * 86400;

      let tx;
      if (isERC721) {
        tx = await executeTransaction(() => fetchedCollection.configureCreatorVesting(cliffEnd, numberOfUnlocks, durationBetweenUnlocks));
      } else {
        tx = await executeTransaction(() => fetchedCollection.configureCreatorVesting(tokenId, cliffEnd, numberOfUnlocks, durationBetweenUnlocks));
      }

      if (tx) {
        toast.success('Vesting configured successfully!');
        // Refresh collection details
        await fetchCollectionDetails();
      }
    } catch (error) {
      console.error('Error configuring vesting:', error);
      toast.error(`Failed to configure vesting: ${error.message}`);
    } finally {
      setConfiguring(false);
    }
  };

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === '0') return 'Not set';
    return new Date(parseInt(timestamp) * 1000).toLocaleString();
  };

  // Calculate time remaining
  const getTimeRemaining = (timestamp) => {
    if (!timestamp || timestamp === '0') return 'N/A';
    const now = Math.floor(Date.now() / 1000);
    const target = parseInt(timestamp);
    
    if (now >= target) return 'Ended';
    
    const diff = target - now;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    
    return `${days}d ${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Collection Fetch Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Collection Details
          </CardTitle>
          <CardDescription>
            Enter your collection address to view and configure vesting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Collection Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={collectionAddress}
              onChange={(e) => setCollectionAddress(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            />
            {loading && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="animate-spin">⏳</span> Fetching collection details...
              </p>
            )}
          </div>

          {!isERC721 && fetchedCollection && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Token ID (ERC1155 only)</label>
              <input
                type="number"
                placeholder="1"
                value={tokenId}
                onChange={(e) => setTokenId(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                min="1"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Info Display */}
      {collectionInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Collection Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-semibold">{collectionInfo.isERC721 ? 'ERC721' : `ERC1155 (Token ${collectionInfo.tokenId})`}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Max Supply:</span>
                <p className="font-semibold">{collectionInfo.maxSupply}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Creator Allocation (20%):</span>
                <p className="font-semibold">{collectionInfo.creatorAllocation} tokens</p>
              </div>
              <div>
                <span className="text-muted-foreground">Already Claimed:</span>
                <p className="font-semibold">{collectionInfo.creatorClaimedCount} tokens</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Creation Time:</span>
                <p className="font-semibold">{formatDate(collectionInfo.creationTime)}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Vesting Status:</span>
                <p className={`font-semibold flex items-center gap-2 ${collectionInfo.vestingConfigured ? 'text-green-600' : 'text-yellow-600'}`}>
                  {collectionInfo.vestingConfigured ? (
                    <><CheckCircle2 className="h-4 w-4" /> Configured</>
                  ) : (
                    <><AlertCircle className="h-4 w-4" /> Not Configured</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vesting Info Display (if configured) */}
      {vestingInfo && (
        <Card className="border-green-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Vesting Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cliff Ends:</span>
                <p className="font-semibold">{formatDate(vestingInfo.cliffEnd)}</p>
                <p className="text-xs text-muted-foreground">{getTimeRemaining(vestingInfo.cliffEnd)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Unlocks:</span>
                <p className="font-semibold">{vestingInfo.numberOfUnlocks}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Unlock Interval:</span>
                <p className="font-semibold">{parseInt(vestingInfo.durationBetweenUnlocks) / 86400} days</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tokens per Unlock:</span>
                <p className="font-semibold">{vestingInfo.amountPerUnlock}</p>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-muted-foreground">Currently Unlocked:</span>
                <p className="font-semibold text-lg text-blue-600">{vestingInfo.unlockedAmount} tokens</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Available to Mint:</span>
                <p className="font-semibold text-lg text-green-600">{vestingInfo.availableToMint} tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vesting Configuration Form (if not configured) */}
      {collectionInfo && !collectionInfo.vestingConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Configure Vesting Schedule
            </CardTitle>
            <CardDescription>
              Set up the vesting schedule for your creator allocation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliff Period (days)</label>
              <input
                type="number"
                placeholder="7"
                value={cliffDays}
                onChange={(e) => setCliffDays(parseInt(e.target.value) || 7)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                min="7"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 7 days. No tokens can be minted before cliff ends.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Number of Unlocks</label>
              <input
                type="number"
                placeholder="2"
                value={numberOfUnlocks}
                onChange={(e) => setNumberOfUnlocks(parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                min="2"
              />
              <p className="text-xs text-muted-foreground">
                {collectionInfo.creatorAllocation < 500 && 'Minimum 2 unlocks for allocation < 500'}
                {collectionInfo.creatorAllocation >= 500 && collectionInfo.creatorAllocation < 1000 && 'Minimum 4 unlocks for allocation 500-999'}
                {collectionInfo.creatorAllocation >= 1000 && collectionInfo.creatorAllocation < 2000 && 'Minimum 8 unlocks for allocation 1000-1999'}
                {collectionInfo.creatorAllocation >= 2000 && 'Minimum 8 unlocks for allocation ≥ 2000'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Days Between Unlocks</label>
              <input
                type="number"
                placeholder="7"
                value={unlockIntervalDays}
                onChange={(e) => setUnlockIntervalDays(parseInt(e.target.value) || 7)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                min="7"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 7 days between each unlock period.
              </p>
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Preview
              </h4>
              <div className="text-sm space-y-1">
                <p>• Cliff ends in <strong>{cliffDays} days</strong></p>
                <p>• <strong>{numberOfUnlocks}</strong> unlock periods</p>
                <p>• <strong>{Math.ceil(parseInt(collectionInfo.creatorAllocation) / numberOfUnlocks)}</strong> tokens per unlock</p>
                <p>• New unlock every <strong>{unlockIntervalDays} days</strong></p>
                <p>• Full allocation available in <strong>{cliffDays + (numberOfUnlocks - 1) * unlockIntervalDays} days</strong></p>
              </div>
            </div>

            <Button
              onClick={configureVesting}
              disabled={configuring}
              className="w-full"
            >
              {configuring ? 'Configuring...' : 'Configure Vesting'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <AlertCircle className="h-4 w-4" />
            About Vesting
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-blue-700 dark:text-blue-300 space-y-2">
          <p>
            Vesting prevents creators from immediately minting and selling their entire 20% allocation, protecting holders from rug pulls.
          </p>
          <p>
            <strong>Cliff Period:</strong> No tokens can be minted until the cliff period ends.
          </p>
          <p>
            <strong>Unlocks:</strong> After the cliff, tokens become available in batches at regular intervals.
          </p>
          <p>
            <strong>Important:</strong> Vesting can only be configured once and cannot be changed later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VestingConfigurationComponent;
