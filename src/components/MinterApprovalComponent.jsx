import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { contractABIs } from '../contracts/contractABIs';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { 
  AlertCircle, 
  CheckCircle, 
  Lock, 
  Unlock, 
  UserPlus, 
  UserMinus,
  Loader2,
  Info,
  Search
} from 'lucide-react';
import { ResponsiveAddressInput } from './ui/responsive-input';

const MinterApprovalComponent = () => {
  const { address, connected, provider } = useWallet();
  const { getContractInstance } = useContract();
  const [loading, setLoading] = useState(false);
  const [collectionAddress, setCollectionAddress] = useState('');
  const [fetchedCollection, setFetchedCollection] = useState('');
  const [minterAddress, setMinterAddress] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [currentMinter, setCurrentMinter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collectionSymbol, setCollectionSymbol] = useState('');
  // 1. Add state: collectionType ('erc721' | 'erc1155' | null)
  const [collectionType, setCollectionType] = useState(null);

  // Fetch collection details by address
  const fetchCollection = async () => {
    setError('');
    setSuccess('');
    setFetchedCollection('');
    setIsLocked(false);
    setCurrentMinter('');
    setIsApproved(false);
    setCollectionName('');
    setCollectionSymbol('');
    setCollectionType(null); // Reset collection type
    if (!ethers.utils.isAddress(collectionAddress)) {
      setError('Please enter a valid Ethereum contract address.');
      return;
    }
    if (!provider) {
      setError('Provider not available.');
      return;
    }
    try {
      setLoading(true);
      // Try fetching with ERC721 ABI first
      let contract = new ethers.Contract(
        collectionAddress,
        contractABIs.erc721Prize,
        provider
      );
      let isERC721 = false;
      try {
        const locked = await contract.minterLocked();
        setIsLocked(locked);
        const currentMinter = await contract.minter();
        setCurrentMinter(currentMinter);
        setCollectionType('erc721');
        isERC721 = true;
      } catch (err) {
        // If ERC721 ABI fails, try ERC1155 ABI
        contract = new ethers.Contract(
          collectionAddress,
          contractABIs.erc1155Prize,
          provider
        );
        try {
      const locked = await contract.minterLocked();
      setIsLocked(locked);
      const currentMinter = await contract.minter();
      setCurrentMinter(currentMinter);
          setCollectionType('erc1155');
        } catch (err) {
          setError('Failed to fetch collection: ' + err.message);
          setCollectionType(null);
          return;
        }
      }
      // Fetch name and symbol only for ERC721
      if (isERC721) {
        try {
      const name = await contract.name();
          setCollectionName(name);
        } catch (e) {
          setCollectionName('N/A');
        }
        try {
      const symbol = await contract.symbol();
      setCollectionSymbol(symbol);
        } catch (e) {
          setCollectionSymbol('N/A');
        }
      } else {
        setCollectionName('ERC1155 Collection');
        setCollectionSymbol('N/A');
      }
      setFetchedCollection(collectionAddress);
    } catch (err) {
      setError('Failed to fetch collection: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load collection details when minter address changes
  React.useEffect(() => {
    if (fetchedCollection && minterAddress && ethers.utils.isAddress(minterAddress) && provider) {
      loadCollectionDetails();
    }
    // eslint-disable-next-line
  }, [minterAddress, fetchedCollection]);

  const loadCollectionDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const contract = new ethers.Contract(
        fetchedCollection,
        contractABIs.erc721Prize,
        provider
      );
        const currentMinter = await contract.minter();
        setIsApproved(currentMinter.toLowerCase() === minterAddress.toLowerCase());
        setCurrentMinter(currentMinter);
    } catch (err) {
      setError('Failed to load collection details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const setMinterApproval = async (approved) => {
    if (!fetchedCollection || !minterAddress || !provider) {
      setError('Please fetch a collection and enter a valid minter address');
      return;
    }
    if (!ethers.utils.isAddress(minterAddress)) {
      setError('Please enter a valid Ethereum address');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const signer = provider.getSigner();
      let contract;
      if (collectionType === 'erc721') {
        contract = new ethers.Contract(
        fetchedCollection,
        contractABIs.erc721Prize,
        signer
      );
      } else if (collectionType === 'erc1155') {
        contract = new ethers.Contract(
          fetchedCollection,
          contractABIs.erc1155Prize,
          signer
        );
      }
      
      let tx;
      if (collectionType === 'erc721') {
        tx = await contract.setMinterApproval(minterAddress, approved);
      } else if (collectionType === 'erc1155') {
        tx = await contract.setMinterApproval(minterAddress, approved);
      }
      await tx.wait();
      setSuccess(`Minter ${approved ? 'set' : 'removed'} successfully!`);
      setIsApproved(approved);
      setMinterAddress('');
    } catch (err) {
      setError('Failed to set minter approval: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMinterApprovalLock = async () => {
    if (!fetchedCollection || !provider) {
      setError('Please fetch a collection first');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const signer = provider.getSigner();
      let contract;
      if (collectionType === 'erc721') {
        contract = new ethers.Contract(
        fetchedCollection,
        contractABIs.erc721Prize,
        signer
      );
      } else if (collectionType === 'erc1155') {
        contract = new ethers.Contract(
          fetchedCollection,
          contractABIs.erc1155Prize,
          signer
        );
      }
      
      // Check if the current user is the owner
      const owner = await contract.owner();
      const currentAddress = await signer.getAddress();
      
      if (owner.toLowerCase() !== currentAddress.toLowerCase()) {
        setError('Only the contract owner can lock/unlock minter approval');
        return;
      }

      let tx;
      if (collectionType === 'erc721') {
        if (isLocked) {
          console.log('Attempting to unlock minter approval...');
          tx = await contract.unlockMinterApproval();
        } else {
          console.log('Attempting to lock minter approval...');
          tx = await contract.lockMinterApproval();
        }
      } else if (collectionType === 'erc1155') {
      if (isLocked) {
        console.log('Attempting to unlock minter approval...');
        tx = await contract.unlockMinterApproval();
      } else {
        console.log('Attempting to lock minter approval...');
        tx = await contract.lockMinterApproval();
        }
      }
      
      console.log('Transaction sent:', tx.hash);
      await tx.wait();
      setSuccess(`Minter approval ${isLocked ? 'unlocked' : 'locked'} successfully!`);
      setIsLocked(!isLocked);
    } catch (err) {
      console.error('Error in toggleMinterApprovalLock:', err);
      setError(`Failed to ${isLocked ? 'unlock' : 'lock'} minter approval: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const validateAddress = (address) => {
    return ethers.utils.isAddress(address);
  };

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Minter Approval Management
          </CardTitle>
          <CardDescription>
            Please connect your wallet to manage minter approvals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to manage minter approvals.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Minter Approval Management
        </CardTitle>
        <CardDescription>
          Manage and control minter approvals for your prize collections.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet not connected warning */}
        {!connected && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to load collection info and manage minter approvals.
            </AlertDescription>
          </Alert>
        )}
        {/* Collection Address Input */}
        <div className="space-y-2">
          <Label htmlFor="collection-address">Collection Contract Address</Label>
          <div className="flex gap-2">
            <ResponsiveAddressInput
              id="collection-address"
              placeholder="0x..."
              value={collectionAddress}
              onChange={(e) => setCollectionAddress(e.target.value)}
              disabled={loading || !connected}
              className="flex-1"
            />
            <Button
              onClick={fetchCollection}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!connected ? "Please connect your wallet" : !collectionAddress ? "Please enter a collection address" : "Load collection information"}
            >
              <Search className="h-4 w-4" />
              {loading ? 'Loading...' : 'Load Info'}
            </Button>
          </div>
        </div>

        {/* Show minter approval management UI only if collection is fetched */}
        {fetchedCollection && (
          <>
            {/* Collection Info */}
            <div className="space-y-2">
              <Label>Collection Info</Label>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{collectionName}</span>
                <span className="text-muted-foreground">({collectionSymbol})</span>
              </div>
        </div>

        {/* Collection Status */}
          <div className="space-y-2">
            <Label>Collection Status</Label>
            <div className="flex items-center gap-2">
              <Badge variant={isLocked ? "destructive" : "default"}>
                {isLocked ? (
                  <>
                    <Lock className="h-3 w-3 mr-1" />
                    Minter Approval Locked
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3 mr-1" />
                    Minter Approval Unlocked
                  </>
                )}
              </Badge>
            </div>
            {currentMinter && (
              <div className="mt-2">
                <Label className="text-sm">Current Minter</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded">
                  {currentMinter}
                </p>
              </div>
            )}
          </div>

        {/* Minter Approval Control */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="minter">Minter Address</Label>
              <ResponsiveAddressInput
                id="minter"
                placeholder="0x..."
                value={minterAddress}
                onChange={(e) => setMinterAddress(e.target.value)}
                disabled={loading}
              />
              {minterAddress && !validateAddress(minterAddress) && (
                <p className="text-sm text-red-600">Invalid Ethereum address</p>
              )}
            </div>

            {minterAddress && validateAddress(minterAddress) && (
              <div className="space-y-2">
                <Label>Current Status</Label>
                <div className="flex items-center gap-2">
                  <Badge variant={isApproved ? "default" : "secondary"}>
                    {isApproved ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Is Current Minter
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Not Current Minter
                      </>
                    )}
                  </Badge>
                </div>
                {isApproved && (
                  <p className="text-sm text-green-600">
                    This address is currently the minter for this collection.
                  </p>
                )}
              </div>
            )}

              <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setMinterApproval(true)}
                disabled={loading || isApproved || isLocked}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!minterAddress ? "Please enter a minter address" : !validateAddress(minterAddress) ? "Please enter a valid address" : isApproved ? "Address is already the minter" : isLocked ? "Minter approval is locked" : "Set as minter"}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Set Minter
              </Button>
              <Button
                onClick={() => setMinterApproval(false)}
                disabled={loading || !isApproved || isLocked}
                className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!minterAddress ? "Please enter a minter address" : !validateAddress(minterAddress) ? "Please enter a valid address" : !isApproved ? "Address is not currently the minter" : isLocked ? "Minter approval is locked" : "Remove minter"}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserMinus className="h-4 w-4 mr-2" />
                )}
                Remove Minter
              </Button>
            </div>
              
            <Button
              onClick={toggleMinterApprovalLock}
              disabled={loading}
              variant={isLocked ? "default" : "outline"}
              className={`w-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isLocked
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                  : 'border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
              }`}
              title={isLocked ? "Unlock minter approval to allow changes" : "Lock minter approval to prevent changes"}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isLocked ? (
                <Unlock className="h-4 w-4 mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {isLocked ? 'Unlock Minter Approval' : 'Lock Minter Approval'}
            </Button>
          </div>
          </>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default MinterApprovalComponent; 