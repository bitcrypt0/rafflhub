import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { contractABIs } from '../contracts/contractABIs';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from './ui/sonner';
import { extractRevertReason } from '../utils/errorHandling';
import { notifyError } from '../utils/notificationService';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  AlertCircle,
  CheckCircle,
  UserCheck,
  Loader2,
  Info,
  Search,
  Users
} from 'lucide-react';
import { ResponsiveAddressInput, ResponsiveNumberInput } from './ui/responsive-input';

const KOLApprovalComponent = () => {
  const { address, connected, provider } = useWallet();
  const { getContractInstance } = useContract();
  const [loading, setLoading] = useState(false);
  const [collectionAddress, setCollectionAddress] = useState('');
  const [fetchedCollection, setFetchedCollection] = useState('');
  const [kolAddress, setKolAddress] = useState('');
  const [poolLimit, setPoolLimit] = useState('');
  const [enforcedSlotFee, setEnforcedSlotFee] = useState('');
  const [enforcedWinnerCount, setEnforcedWinnerCount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collectionSymbol, setCollectionSymbol] = useState('');
  const [collectionType, setCollectionType] = useState(null);
  const [kolDetails, setKolDetails] = useState(null);
  const [kolDetailsLoading, setKolDetailsLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Fetch collection details by address
  const fetchCollection = async () => {
    setError('');
    setSuccess('');
    setFetchedCollection('');
    setCollectionName('');
    setCollectionSymbol('');
    setCollectionType(null);
    setKolDetails(null);
    setIsOwner(false);

    if (!collectionAddress || !ethers.utils.isAddress(collectionAddress)) {
      setError('Please enter a valid collection address');
      return;
    }

    if (!connected) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);

    try {
      // Try ERC721 first
      try {
        const erc721Contract = new ethers.Contract(
          collectionAddress,
          contractABIs.erc721Prize,
          provider
        );
        
        const name = await erc721Contract.name();
        const symbol = await erc721Contract.symbol();
        
        setCollectionName(name);
        setCollectionSymbol(symbol);
        setCollectionType('erc721');
        setFetchedCollection(collectionAddress);
        setSuccess(`ERC721 Collection found: ${name} (${symbol})`);
        
        // Check if current user is the owner
        try {
          const owner = await erc721Contract.owner();
          const isUserOwner = owner.toLowerCase() === address.toLowerCase();
          setIsOwner(isUserOwner);
        } catch (e) {
          setIsOwner(false);
        }
        
        return;
      } catch (erc721Error) {
        console.log('Not an ERC721 collection, trying ERC1155...');
      }

      // Try ERC1155
      try {
        const erc1155Contract = new ethers.Contract(
          collectionAddress,
          contractABIs.erc1155Prize,
          provider
        );
        
        // ERC1155 doesn't have name/symbol in standard, but our implementation might
        try {
          const uri = await erc1155Contract.uri(0);
          setCollectionName('ERC1155 Collection');
          setCollectionSymbol('ERC1155');
        } catch (e) {
          setCollectionName('ERC1155 Collection');
          setCollectionSymbol('ERC1155');
        }
        
        setCollectionType('erc1155');
        setFetchedCollection(collectionAddress);
        setSuccess('ERC1155 Collection found');
        
        // Check if current user is the owner
        try {
          const owner = await erc1155Contract.owner();
          const isUserOwner = owner.toLowerCase() === address.toLowerCase();
          setIsOwner(isUserOwner);
        } catch (e) {
          setIsOwner(false);
        }
        
        return;
      } catch (erc1155Error) {
        console.log('Not an ERC1155 collection either');
      }

      setError('Collection not found or not a supported type (ERC721/ERC1155)');
    } catch (err) {
      console.error('Error fetching collection:', err);
      setError(`Failed to fetch collection: ${extractRevertReason(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch collection when a valid address is entered
  useEffect(() => {
    const isValid = collectionAddress && ethers.utils.isAddress(collectionAddress);
    if (!connected) return;
    if (!isValid) return;
    // Debounce to avoid firing on every keystroke
    const t = setTimeout(() => {
      // Prevent duplicate fetches while loading
      if (!loading) {
        fetchCollection();
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAddress, connected]);

  const fetchKOLDetails = async () => {
    try {
      if (!fetchedCollection || !collectionType || !provider) return;
      if (!ethers.utils.isAddress(kolAddress)) return;
      setKolDetailsLoading(true);
      const contract = new ethers.Contract(
        fetchedCollection,
        collectionType === 'erc721' ? contractABIs.erc721Prize : contractABIs.erc1155Prize,
        provider
      );
      const details = await contract.getKOLApprovalDetails(kolAddress);
      // Ethers returns an object with named outputs; normalize to plain object
      const normalized = {
        approved: details.approved,
        poolLimit: details.poolLimit ? Number(details.poolLimit) : 0,
        enforcedSlotFee: details.enforcedSlotFee ? details.enforcedSlotFee : ethers.BigNumber.from(0),
        enforcedWinnerCount: details.enforcedWinnerCount ? Number(details.enforcedWinnerCount) : 0,
        poolCount: details.poolCount ? Number(details.poolCount) : 0,
      };
      setKolDetails(normalized);
    } catch (err) {
      console.error('Error fetching KOL details:', err);
      setError(`Failed to fetch KOL details: ${extractRevertReason(err)}`);
      setKolDetails(null);
    } finally {
      setKolDetailsLoading(false);
    }
  };

  // Auto-query KOL details when a valid KOL address is entered and collection is fetched
  useEffect(() => {
    const isValidKol = kolAddress && ethers.utils.isAddress(kolAddress);
    if (!isValidKol) return;
    if (!fetchedCollection || !collectionType) return;
    const t = setTimeout(() => {
      fetchKOLDetails();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kolAddress, fetchedCollection, collectionType]);

  const approveKOL = async () => {
    if (!fetchedCollection || !provider) {
      toast.error('Please fetch a collection first');
      return;
    }

    if (!ethers.utils.isAddress(kolAddress)) {
      toast.error('Please enter a valid KOL address');
      return;
    }

    if (!poolLimit || isNaN(poolLimit) || parseInt(poolLimit) <= 0) {
      toast.error('Please enter a valid pool limit');
      return;
    }

    if (!enforcedSlotFee || isNaN(enforcedSlotFee) || parseFloat(enforcedSlotFee) < 0) {
      toast.error('Please enter a valid enforced slot fee');
      return;
    }

    if (!enforcedWinnerCount || isNaN(enforcedWinnerCount) || parseInt(enforcedWinnerCount) <= 0) {
      toast.error('Please enter a valid enforced winner count');
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
      let owner;
      try {
        if (typeof contract.owner === 'function') {
          owner = await contract.owner();
        } else {
          toast.error('Contract does not support owner functionality');
          return;
        }
      } catch (e) {
        toast.error('Failed to get contract owner');
        return;
      }
      
      const currentAddress = await signer.getAddress();
      if (owner.toLowerCase() !== currentAddress.toLowerCase()) {
        toast.error('Only the contract owner can approve KOLs');
        return;
      }

      // Convert enforced slot fee to wei
      const enforcedSlotFeeWei = ethers.utils.parseEther(enforcedSlotFee.toString());

      const tx = await contract.approveKOL(
        kolAddress,
        parseInt(poolLimit),
        enforcedSlotFeeWei,
        parseInt(enforcedWinnerCount)
      );
      
      await tx.wait();
      toast.success('KOL approved successfully!');
      setSuccess(`KOL ${kolAddress} approved with pool limit ${poolLimit}, slot fee ${enforcedSlotFee} ETH, and ${enforcedWinnerCount} winners`);
      
      // Clear form
      setKolAddress('');
      setPoolLimit('');
      setEnforcedSlotFee('');
      setEnforcedWinnerCount('');
      await fetchKOLDetails();
    } catch (err) {
      console.error('Error approving KOL:', err);
      notifyError(err, { action: 'approveKOL' });
      setError(`Failed to approve KOL: ${extractRevertReason(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const revokeKOL = async () => {
    if (!fetchedCollection || !provider) {
      toast.error('Please fetch a collection first');
      return;
    }
    if (!ethers.utils.isAddress(kolAddress)) {
      toast.error('Please enter a valid KOL address');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        fetchedCollection,
        collectionType === 'erc721' ? contractABIs.erc721Prize : contractABIs.erc1155Prize,
        signer
      );
      // Owner check
      let owner;
      try {
        if (typeof contract.owner === 'function') {
          owner = await contract.owner();
        }
      } catch {}
      const currentAddress = await signer.getAddress();
      if (!owner || owner.toLowerCase() !== currentAddress.toLowerCase()) {
        toast.error('Only the contract owner can revoke KOLs');
        return;
      }
      const tx = await contract.revokeKOL(kolAddress);
      await tx.wait();
      toast.success('KOL revoked successfully!');
      setSuccess(`KOL ${kolAddress} revoked`);
      await fetchKOLDetails();
    } catch (err) {
      console.error('Error revoking KOL:', err);
      notifyError(err, { action: 'revokeKOL' });
      setError(`Failed to revoke KOL: ${extractRevertReason(err)}`);
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
            <Users className="h-5 w-5" />
            KOL Approval Management
          </CardTitle>
          <CardDescription>
            Please connect your wallet to manage KOL approvals for collections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to manage KOL approvals.
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
          <Users className="h-5 w-5" />
          KOL Approval Management
        </CardTitle>
        <CardDescription>
          Approve Key Opinion Leaders (KOLs) for collections with specific pool limits and slot fees
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Collection Lookup */}
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4" />
            <h3 className="text-sm font-medium">Collection Lookup</h3>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="collection">Collection Address</Label>
            <ResponsiveAddressInput
              id="collection"
              placeholder="0x..."
              value={collectionAddress}
              onChange={(e) => setCollectionAddress(e.target.value)}
              disabled={loading}
            />
            {collectionAddress && !ethers.utils.isAddress(collectionAddress) && (
              <p className="text-sm text-red-600">Invalid Ethereum address</p>
            )}
          </div>

          {fetchedCollection && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Collection Found</span>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Name:</strong> {collectionName}</p>
                <p><strong>Symbol:</strong> {collectionSymbol}</p>
                <p><strong>Type:</strong> {collectionType?.toUpperCase()}</p>
                <div className="mt-2">
                  <Label className="text-sm">Address</Label>
                  <p className="text-sm font-mono bg-green-100 text-green-800 p-2 rounded break-words">
                    {fetchedCollection}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KOL Approval Form */}
        {fetchedCollection && (
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4" />
              <h3 className="text-sm font-medium">KOL Approval</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kol">KOL Address</Label>
                <ResponsiveAddressInput
                  id="kol"
                  placeholder="0x..."
                  value={kolAddress}
                  onChange={(e) => setKolAddress(e.target.value)}
                  disabled={loading}
                />
                {kolAddress && !ethers.utils.isAddress(kolAddress) && (
                  <p className="text-sm text-red-600">Invalid Ethereum address</p>
                )}
              </div>

              {/* Current Approval Details */}
              {kolDetailsLoading && (
                <div className="p-3 bg-muted border rounded-lg text-sm">Loading KOL details...</div>
              )}
              {kolDetails && (
                <div className="p-3 bg-muted border rounded-lg space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={kolDetails.approved ? 'default' : 'secondary'}>
                      {kolDetails.approved ? 'Approved' : 'Not Approved'}
                    </Badge>
                    <span className="text-muted-foreground">Current approval status</span>
                  </div>
                  <div>Pool Limit: <strong>{kolDetails.poolLimit}</strong></div>
                  <div>
                    Enforced Slot Fee: <strong>{ethers.utils.formatEther(kolDetails.enforcedSlotFee)} ETH</strong>
                  </div>
                  <div>Enforced Winner Count: <strong>{kolDetails.enforcedWinnerCount}</strong></div>
                  <div>Pool Count: <strong>{kolDetails.poolCount}</strong></div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="poolLimit">Pool Limit</Label>
                <ResponsiveNumberInput
                  id="poolLimit"
                  placeholder="Enter pool limit (e.g., 100)"
                  value={poolLimit}
                  onChange={(e) => setPoolLimit(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of participants allowed in the KOL's pool
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enforcedSlotFee">Enforced Slot Fee (ETH)</Label>
                <ResponsiveNumberInput
                  id="enforcedSlotFee"
                  placeholder="Enter slot fee in ETH (e.g., 0.01)"
                  value={enforcedSlotFee}
                  onChange={(e) => setEnforcedSlotFee(e.target.value)}
                  disabled={loading}
                  step="0.001"
                />
                <p className="text-xs text-muted-foreground">
                  Fixed slot fee that participants must pay to join the KOL's pool
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enforcedWinnerCount">Enforced Winner Count</Label>
                <ResponsiveNumberInput
                  id="enforcedWinnerCount"
                  placeholder="Enter winner count (e.g., 5)"
                  value={enforcedWinnerCount}
                  onChange={(e) => setEnforcedWinnerCount(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Fixed number of winners that the KOL must use when creating pools
                </p>
              </div>

              <Button
                onClick={approveKOL}
                disabled={
                  !fetchedCollection || 
                  !validateAddress(kolAddress) || 
                  !poolLimit || 
                  !enforcedSlotFee || 
                  !enforcedWinnerCount ||
                  loading
                }
                variant="primary"
                size="md"
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4 mr-2" />
                )}
                Approve KOL
              </Button>

              <Button
                onClick={revokeKOL}
                disabled={
                  !fetchedCollection ||
                  !validateAddress(kolAddress) ||
                  loading
                }
                variant="destructive"
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <AlertCircle className="h-4 w-4 mr-2" />
                )}
                Revoke KOL
              </Button>
            </div>
          </div>
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

        {/* Info Alert - Only show when collection is fetched and user is owner */}
        {fetchedCollection && isOwner && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> Only the collection owner can approve KOLs. KOL approval allows the approved address to create pools using this collection as prize.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default KOLApprovalComponent;
