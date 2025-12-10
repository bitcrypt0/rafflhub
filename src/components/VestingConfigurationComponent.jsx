import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from './ui/sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Clock, Lock, Unlock, Calendar, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { notifyError } from '../utils/notificationService';

const VestingConfigurationComponent = () => {
  const { address, provider } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();

  // Collection fetch state
  const [collectionAddress, setCollectionAddress] = useState('');
  const [fetchedCollection, setFetchedCollection] = useState(null);
  const [isERC721, setIsERC721] = useState(null);
  const [loading, setLoading] = useState(false);

  // Vesting configuration state
  const [cliffDateTime, setCliffDateTime] = useState('');
  const [numberOfUnlocks, setNumberOfUnlocks] = useState(2);
  const [unlockIntervalDays, setUnlockIntervalDays] = useState(7);
  const [tokenId, setTokenId] = useState(1); // For ERC1155

  // Collection info state
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [vestingInfo, setVestingInfo] = useState(null);
  const [configuring, setConfiguring] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [cutting, setCutting] = useState(false);
  const [reducing, setReducing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [allocationPercent, setAllocationPercent] = useState('');
  const [allocationTokenId, setAllocationTokenId] = useState('');
  const [reductionPercent, setReductionPercent] = useState('');
  const [poolAddress, setPoolAddress] = useState('');
  const [poolAllocation, setPoolAllocation] = useState(null);
  const [fetchingPool, setFetchingPool] = useState(false);

  // Auto-fetch pool allocation when pool address changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (poolAddress && ethers.utils.isAddress(poolAddress.trim())) {
        fetchPoolAllocation(poolAddress);
      } else {
        setPoolAllocation(null);
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timer);
  }, [poolAddress, fetchedCollection, collectionInfo, isERC721]);

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
        const [maxSupply, creatorAllocation, creationTime, vestingConfigured, creatorClaimedCount, unlockedAmount, availableSupply, creatorAllocationDeclared] = await Promise.all([
          contract.maxSupply(),
          contract.creatorAllocation(),
          contract.creationTime(),
          contract.vestingConfigured(),
          contract.creatorClaimedCount(),
          contract.getUnlockedCreatorAllocation(),
          contract.availableSupply(),
          contract.creatorAllocationDeclared()
        ]);

        const info = {
          maxSupply: maxSupply.toString(),
          creatorAllocation: creatorAllocation.toString(),
          creationTime: creationTime.toString(),
          vestingConfigured,
          creatorClaimedCount: creatorClaimedCount.toString(),
          unlockedAmount: unlockedAmount.toString(),
          availableSupply: availableSupply.toString(),
          creatorAllocationDeclared,
          isERC721: true
        };

        setCollectionInfo(info);

        // If vesting is configured, get vesting details
        if (vestingConfigured) {
          const [config, availableToMint, unlockedAmount] = await Promise.all([
            contract.vestingConfig(),
            contract.getAvailableCreatorMint(),
            contract.getUnlockedCreatorAllocation()
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
        const [maxSupply, creatorAllocation, creationTime, vestingConfigured, creatorClaimedCount, unlockedAmount, availableSupply, creatorAllocationDeclared] = await Promise.all([
          contract.maxSupply(tokenId),
          contract.creatorAllocation(tokenId),
          contract.tokenCreationTime(tokenId),
          contract.vestingConfigured(tokenId),
          contract.creatorClaimedCount(tokenId),
          contract.getUnlockedCreatorAllocation(tokenId),
          contract.availableSupply(tokenId),
          contract.creatorAllocationDeclared(tokenId)
        ]);

        const info = {
          maxSupply: maxSupply.toString(),
          creatorAllocation: creatorAllocation.toString(),
          creationTime: creationTime.toString(),
          vestingConfigured,
          creatorClaimedCount: creatorClaimedCount.toString(),
          unlockedAmount: unlockedAmount.toString(),
          availableSupply: availableSupply.toString(),
          creatorAllocationDeclared,
          isERC721: false,
          tokenId
        };

        setCollectionInfo(info);

        // If vesting is configured, get vesting details
        if (vestingConfigured) {
          const [config, availableToMint, unlockedAmount] = await Promise.all([
            contract.vestingConfig(tokenId),
            contract.getAvailableCreatorMint(tokenId),
            contract.getUnlockedCreatorAllocation(tokenId)
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

  // Set default cliff date to 7 days from now
  useEffect(() => {
    const defaultCliff = new Date();
    defaultCliff.setDate(defaultCliff.getDate() + 7);
    setCliffDateTime(defaultCliff.toISOString().slice(0, 16));
  }, []);

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

    // Validation - check that cliff date is selected
    if (!cliffDateTime) {
      toast.error('Please select a cliff end date and time');
      return;
    }

    const cliffDate = new Date(cliffDateTime);
    const now = new Date();
    
    if (cliffDate < now) {
      toast.error('Cliff date must be in the future');
      return;
    }

    if (unlockIntervalDays < 1) {
      toast.error('Unlock interval must be at least 1 day');
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
      const cliffEnd = Math.floor(cliffDate.getTime() / 1000); // Convert to Unix timestamp
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
      notifyError(error, { action: 'configureVesting' });
    } finally {
      setConfiguring(false);
    }
  };

  // Declare creator allocation function
  const declareAllocation = async () => {
    if (!fetchedCollection || !collectionInfo) {
      toast.error('Please enter a valid collection address');
      return;
    }
    setDeclaring(true);
    try {
      const pct = Number(allocationPercent);
      if (!isFinite(pct) || pct <= 0 || pct > 100) {
        toast.error('Enter a valid percentage between 0 and 100');
        setDeclaring(false);
        return;
      }
      const percentage = ethers.BigNumber.from(pct);
      if (isERC721) {
        await fetchedCollection.callStatic.declareCreatorAllocation(percentage);
        await executeTransaction(() => fetchedCollection.declareCreatorAllocation(percentage));
      } else {
        const tid = allocationTokenId ? parseInt(allocationTokenId) : tokenId;
        await fetchedCollection.callStatic.declareCreatorAllocation(tid, percentage);
        await executeTransaction(() => fetchedCollection.declareCreatorAllocation(tid, percentage));
      }
      toast.success('Creator allocation declared');
      await fetchCollectionDetails(collectionAddress);
    } catch (error) {
      notifyError(error, { action: 'declareAllocation' });
    } finally {
      setDeclaring(false);
    }
  };

  // Reduce creator allocation function
  const reduceAllocation = async () => {
    if (!fetchedCollection || !collectionInfo) {
      toast.error('Please enter a valid collection address');
      return;
    }
    setReducing(true);
    try {
      const pct = Number(reductionPercent);
      if (!isFinite(pct) || pct <= 0 || pct > 100) {
        toast.error('Enter a valid percentage between 0 and 100');
        setReducing(false);
        return;
      }
      
      // Check if there's remaining allocation to reduce
      const totalAllocation = Number(collectionInfo.creatorAllocation);
      const claimedAllocation = Number(collectionInfo.creatorClaimedCount);
      const remainingAllocation = totalAllocation - claimedAllocation;
      
      if (remainingAllocation <= 0) {
        toast.error('No remaining creator allocation to reduce');
        setReducing(false);
        return;
      }
      
      const percentage = ethers.BigNumber.from(pct);
      if (isERC721) {
        await fetchedCollection.callStatic.reduceCreatorAllocation(percentage);
        await executeTransaction(() => fetchedCollection.reduceCreatorAllocation(percentage));
      } else {
        const tid = collectionInfo.tokenId || tokenId;
        await fetchedCollection.callStatic.reduceCreatorAllocation(tid, percentage);
        await executeTransaction(() => fetchedCollection.reduceCreatorAllocation(tid, percentage));
      }
      toast.success('Creator allocation reduced successfully');
      setReductionPercent('');
      await fetchCollectionDetails(collectionAddress);
    } catch (error) {
      console.error('Error reducing creator allocation:', error);
      if (error.message.includes('No remaining creator allocation')) {
        toast.error('No remaining creator allocation to reduce');
      } else if (error.message.includes('Creator allocation must be declared')) {
        toast.error('Creator allocation must be declared first');
      } else {
        toast.error('Failed to reduce creator allocation: ' + error.message);
      }
      setReducing(false);
    }
  };

  // Restore minter allocation function
  const restoreMinterAllocation = async () => {
    if (!fetchedCollection || !collectionInfo) {
      toast.error('Please enter a valid collection address');
      return;
    }
    
    // Validate pool address
    const sanitizedPoolAddress = poolAddress.trim();
    if (!sanitizedPoolAddress) {
      toast.error('Please enter a pool address');
      return;
    }
    if (!ethers.utils.isAddress(sanitizedPoolAddress)) {
      toast.error('Please enter a valid pool address');
      return;
    }
    
    setRestoring(true);
    try {
      // Check if the current user is the owner
      let owner;
      try {
        if (typeof fetchedCollection.owner === 'function') {
          owner = await fetchedCollection.owner();
        } else {
          toast.error('Contract does not support owner functionality');
          setRestoring(false);
          return;
        }
      } catch (e) {
        toast.error('Failed to get contract owner');
        setRestoring(false);
        return;
      }

      const signer = provider.getSigner();
      const currentAddress = await signer.getAddress();

      if (owner.toLowerCase() !== currentAddress.toLowerCase()) {
        toast.error('Only the contract owner can restore minter allocation');
        setRestoring(false);
        return;
      }

      // Call restoreMinterAllocation with pool address parameter
      if (isERC721) {
        await fetchedCollection.callStatic.restoreMinterAllocation(sanitizedPoolAddress);
        await executeTransaction(() => fetchedCollection.restoreMinterAllocation(sanitizedPoolAddress));
      } else {
        const tid = collectionInfo.tokenId || tokenId;
        await fetchedCollection.callStatic.restoreMinterAllocation(sanitizedPoolAddress);
        await executeTransaction(() => fetchedCollection.restoreMinterAllocation(sanitizedPoolAddress));
      }

      toast.success('Minter allocation restored successfully!');
      setPoolAddress(''); // Clear input after success
      
      // Refresh collection info to show updated state
      await fetchCollectionDetails(fetchedCollection._address);
    } catch (error) {
      console.error('Error in restoreMinterAllocation:', error);
      if (error.message.includes('Pool is not a minter')) {
        toast.error('The specified pool is not a minter for this collection');
      } else if (error.message.includes('Pool is not in failed state')) {
        toast.error('Pool must be in deleted or unengaged state to restore allocation');
      } else if (error.message.includes('Only owner')) {
        toast.error('Only the contract owner can restore minter allocation');
      } else {
        toast.error('Failed to restore minter allocation: ' + error.message);
      }
    } finally {
      setRestoring(false);
    }
  };

  // Fetch pool allocation data for live calculation
  const fetchPoolAllocation = async (poolAddressToFetch) => {
    if (!poolAddressToFetch || !ethers.utils.isAddress(poolAddressToFetch) || !fetchedCollection || !collectionInfo) {
      setPoolAllocation(null);
      return;
    }

    const sanitizedPoolAddress = poolAddressToFetch.trim();
    setFetchingPool(true);
    
    try {
      // Fetch pool's allocated supply from the collection contract
      let allocation;
      if (isERC721) {
        allocation = await fetchedCollection.allocatedSupply(sanitizedPoolAddress);
      } else {
        // For ERC1155, we also need to get the tokenId for this pool
        const tokenId = await fetchedCollection.poolTokenId(sanitizedPoolAddress);
        allocation = await fetchedCollection.allocatedSupply(sanitizedPoolAddress);
      }

      // Convert to number for display
      const allocationAmount = Number(allocation.toString());
      
      // Use the same available supply as shown in Collection Information
      const currentAvailableSupply = Number(collectionInfo.availableSupply || 0);
      
      // Calculate new available supply after restoration
      const newAvailableSupply = currentAvailableSupply + allocationAmount;

      setPoolAllocation({
        amount: allocationAmount,
        currentAvailableSupply: currentAvailableSupply,
        newAvailableSupply: newAvailableSupply,
        isValid: allocationAmount > 0
      });
    } catch (error) {
      console.error('Error fetching pool allocation:', error);
      setPoolAllocation(null);
      // Don't show error to user for live calculation - just don't show the calculation
    } finally {
      setFetchingPool(false);
    }
  };

  // Cut supply function
  const cutSupply = async () => {
    if (!fetchedCollection || !collectionInfo) {
      toast.error('Please enter a valid collection address');
      return;
    }
    setCutting(true);
    try {
      const pct = Number(allocationPercent);
      if (!isFinite(pct) || pct <= 0 || pct > 100) {
        toast.error('Enter a valid percentage between 0 and 100');
        setCutting(false);
        return;
      }
      const percentage = ethers.BigNumber.from(pct);
      if (isERC721) {
        await fetchedCollection.callStatic.cutSupply(percentage);
        await executeTransaction(() => fetchedCollection.cutSupply(percentage));
      } else {
        const tid = allocationTokenId ? parseInt(allocationTokenId) : tokenId;
        await fetchedCollection.callStatic.cutSupply(tid, percentage);
        await executeTransaction(() => fetchedCollection.cutSupply(tid, percentage));
      }
      toast.success('Supply cut successfully');
      await fetchCollectionDetails(collectionAddress);
    } catch (error) {
      notifyError(error, { action: 'cutSupply' });
    } finally {
      setCutting(false);
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
            Supply, Creator Allocation & Vesting Management
          </CardTitle>
          <CardDescription>
            Enter your collection address to view and configure supply, creator allocation and vesting
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
                <span className="text-muted-foreground">Creator Allocation:</span>
                <p className="font-semibold">{collectionInfo.creatorAllocation} tokens</p>
              </div>
              <div>
                <span className="text-muted-foreground">Already Claimed:</span>
                <p className="font-semibold">{collectionInfo.creatorClaimedCount} tokens</p>
              </div>
              <div>
                <span className="text-muted-foreground">Unlocked Amount:</span>
                <p className="font-semibold">{collectionInfo.unlockedAmount} tokens</p>
              </div>
              <div>
                <span className="text-muted-foreground">Available Supply:</span>
                <p className="font-semibold">{collectionInfo.availableSupply} tokens</p>
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

      {/* Cut Supply Section */}
      {collectionInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cut Supply
            </CardTitle>
            <CardDescription>
              Reduce the maximum supply and proportionally reduce creator allocation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isERC721 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Token ID (ERC1155 only)</label>
                <input type="number" placeholder="1" value={allocationTokenId} onChange={(e) => setAllocationTokenId(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cut Percentage (%)</label>
              <input type="number" placeholder="20" value={allocationPercent} onChange={(e) => setAllocationPercent(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
              <p className="text-xs text-muted-foreground">Enter percentage as a whole number (e.g., 20 = 20%). This will reduce both maxSupply and creatorAllocation proportionally.</p>
              {allocationPercent && Number(allocationPercent) > 0 && Number(allocationPercent) <= 100 && (
                <p className="text-xs text-red-600">
                  Will remove: {Math.floor(Number(collectionInfo.maxSupply) * Number(allocationPercent) / 100)} tokens from max supply
                  {collectionInfo.creatorAllocationDeclared && (
                    <>
                      <br />
                      Will remove: {Math.floor(Number(collectionInfo.creatorAllocation) * Number(allocationPercent) / 100)} tokens from creator allocation
                    </>
                  )}
                </p>
              )}
            </div>
            <Button onClick={cutSupply} disabled={!allocationPercent || cutting} className="w-full">
              {cutting ? 'Cutting...' : 'Cut Supply'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Restore Deleted/Unengaged Pool's Allocation Section */}
      {collectionInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Restore Deleted/Unengaged Pool's Allocation
            </CardTitle>
            <CardDescription>
              Restore supply allocated to failed pools (deleted or unengaged) back to the collection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Pool Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={poolAddress}
                  onChange={(e) => setPoolAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={restoring}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the address of the deleted or unengaged pool to restore its allocation
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This function restores minter allocation that was locked by pools that failed to activate properly 
                  (deleted or unengaged state). The restored supply becomes available for future pool creation.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-3 rounded-md">
                  <div>
                    <span className="text-muted-foreground">Current Available Supply:</span>
                    <p className="font-semibold">
                      {collectionInfo.availableSupply !== undefined 
                        ? `${collectionInfo.availableSupply} tokens`
                        : 'Loading...'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Collection Type:</span>
                    <p className="font-semibold">{isERC721 ? 'ERC721' : 'ERC1155'}</p>
                  </div>
                </div>

                {/* Live Calculation Display */}
                {fetchingPool && (
                  <div className="text-sm text-muted-foreground animate-pulse">
                    Fetching pool allocation data...
                  </div>
                )}

                {poolAllocation && poolAllocation.isValid && (
                  <div className="space-y-2 text-sm bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <div className="font-medium text-blue-700 dark:text-blue-400">
                      Live Calculation Preview
                    </div>
                    <div className="space-y-1">
                      <p>
                        <span className="text-muted-foreground">Pool allocation to restore:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 ml-2">
                          {poolAllocation.amount} tokens
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">New available supply after restoration:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400 ml-2">
                          {poolAllocation.newAvailableSupply} tokens
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        (+{poolAllocation.amount} tokens will be added to available supply)
                      </p>
                    </div>
                  </div>
                )}

                {poolAllocation && !poolAllocation.isValid && (
                  <div className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md p-3">
                    This pool has no allocated supply to restore (0 tokens allocated)
                  </div>
                )}
              </div>
            </div>
            <Button onClick={restoreMinterAllocation} disabled={!poolAddress || restoring} className="w-full">
              {restoring ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restore Pool Allocation
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Declare Creator Allocation (placed above configure) */}
      {collectionInfo && !collectionInfo.creatorAllocationDeclared && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Declare Creator Allocation
            </CardTitle>
            <CardDescription>
              Declare the creator allocation percentage for this collection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isERC721 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Token ID (ERC1155 only)</label>
                <input type="number" placeholder="1" value={allocationTokenId} onChange={(e) => setAllocationTokenId(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Allocation Percentage (%)</label>
              <input type="number" placeholder="20" value={allocationPercent} onChange={(e) => setAllocationPercent(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-background" />
              <p className="text-xs text-muted-foreground">Enter percentage as a whole number (e.g., 20 = 20%)</p>
            </div>
            <Button onClick={declareAllocation} disabled={!allocationPercent || declaring} className="w-full">
              {declaring ? 'Declaring...' : 'Declare Allocation'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reduce Creator Allocation */}
      {collectionInfo && collectionInfo.creatorAllocationDeclared && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Reduce Creator Allocation
            </CardTitle>
            <CardDescription>
              Reduce your remaining locked creator allocation by a percentage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-3 rounded-md">
              <div>
                <span className="text-muted-foreground">Total Allocation:</span>
                <p className="font-semibold">{collectionInfo.creatorAllocation} tokens</p>
              </div>
              <div>
                <span className="text-muted-foreground">Already Claimed:</span>
                <p className="font-semibold">{collectionInfo.creatorClaimedCount} tokens</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Remaining Locked:</span>
                <p className="font-semibold">
                  {Math.max(0, Number(collectionInfo.creatorAllocation) - Number(collectionInfo.creatorClaimedCount))} tokens
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reduction Percentage</label>
              <input 
                type="number" 
                placeholder="25" 
                value={reductionPercent} 
                onChange={(e) => setReductionPercent(e.target.value)} 
                className="w-full px-3 py-2 border border-border rounded-md bg-background" 
                min="1" 
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Enter percentage to reduce from remaining locked allocation (e.g., 25 = 25%).
              </p>
              {reductionPercent && Number(reductionPercent) > 0 && Number(reductionPercent) <= 100 && (
                <p className="text-xs text-red-600">
                  Will reduce: {Math.floor((Number(collectionInfo.creatorAllocation) - Number(collectionInfo.creatorClaimedCount)) * Number(reductionPercent) / 100)} tokens
                </p>
              )}
            </div>
            <Button onClick={reduceAllocation} disabled={!reductionPercent || reducing} className="w-full">
              {reducing ? 'Reducing...' : 'Reduce Allocation'}
            </Button>
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
              <label className="text-sm font-medium">Cliff End Date & Time</label>
              <input
                type="datetime-local"
                value={cliffDateTime}
                onChange={(e) => setCliffDateTime(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Select the date and time when the cliff period ends. Must be at least 7 days from now.
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
                <p>• Cliff ends on <strong>{cliffDateTime ? new Date(cliffDateTime).toLocaleString() : 'Not set'}</strong></p>
                <p>• <strong>{numberOfUnlocks}</strong> unlock periods</p>
                <p>• <strong>{Math.ceil(parseInt(collectionInfo.creatorAllocation) / numberOfUnlocks)}</strong> tokens per unlock</p>
                <p>• New unlock every <strong>{unlockIntervalDays} days</strong></p>
                {cliffDateTime && (
                  <p>• Full allocation available in <strong>{Math.ceil((new Date(cliffDateTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24) + (numberOfUnlocks - 1) * unlockIntervalDays)} days</strong></p>
                )}
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
      {!collectionInfo && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="text-xs text-blue-700 dark:text-blue-300 space-y-1 p-4">
            <div className="text-base font-medium flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-1">
              <AlertCircle className="h-4 w-4" />
              About Vesting
            </div>
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
      )}
    </div>
  );
};

export default VestingConfigurationComponent;
