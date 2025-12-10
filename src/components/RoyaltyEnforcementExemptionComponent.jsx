import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { contractABIs } from '../contracts/contractABIs';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { toast } from './ui/sonner';
import { extractRevertReason } from '../utils/errorHandling';
import { notifyError } from '../utils/notificationService';
import { LoadingSpinner } from './ui/loading';

import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react';
import { ResponsiveAddressInput } from './ui/responsive-input';

const RoyaltyEnforcementExemptionComponent = () => {
  const { address, connected, provider } = useWallet();
  const { getContractInstance } = useContract();
  const [loading, setLoading] = useState(false);
  const [collectionAddress, setCollectionAddress] = useState('');
  const [fetchedCollection, setFetchedCollection] = useState('');
  const [exemptAddress, setExemptAddress] = useState('');
  const [isExempt, setIsExempt] = useState(false);
  const [royaltyEnforcementEnabled, setRoyaltyEnforcementEnabled] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collectionSymbol, setCollectionSymbol] = useState('');
  const [collectionType, setCollectionType] = useState(null);

  const sanitizeAddress = (addr) => {
    if (!addr) return '';
    const trimmed = String(addr).trim().replace(/\u200B|\u200C|\u200D|\u2060|\uFEFF/g, '');
    return trimmed.startsWith('0X') ? '0x' + trimmed.slice(2) : trimmed;
  };

  // Fetch collection details by address
  const fetchCollection = async () => {
    setError('');
    setSuccess('');
    setFetchedCollection('');
    setRoyaltyEnforcementEnabled(false);
    setIsExempt(false);
    setCollectionName('');
    setCollectionSymbol('');
    setCollectionType(null);
    const addr = sanitizeAddress(collectionAddress);
    if (!ethers.utils.isAddress(addr)) {
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
        addr,
        contractABIs.erc721Prize,
        provider
      );
      let isERC721 = false;
      try {
        const enforcementEnabled = await contract.royaltyEnforcementEnabled();
        setRoyaltyEnforcementEnabled(enforcementEnabled);
        setCollectionType('erc721');
        isERC721 = true;
      } catch (err) {
        // If ERC721 ABI fails, try ERC1155 ABI
        contract = new ethers.Contract(
          addr,
          contractABIs.erc1155Prize,
          provider
        );
        try {
          const enforcementEnabled = await contract.royaltyEnforcementEnabled();
          setRoyaltyEnforcementEnabled(enforcementEnabled);
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
          if (typeof contract.name === 'function') {
            const name = await contract.name();
            setCollectionName(name);
          } else {
            setCollectionName('N/A');
          }
        } catch (e) {
          setCollectionName('N/A');
        }
        try {
          if (typeof contract.symbol === 'function') {
            const symbol = await contract.symbol();
            setCollectionSymbol(symbol);
          } else {
            setCollectionSymbol('N/A');
          }
        } catch (e) {
          setCollectionSymbol('N/A');
        }
      } else {
        setCollectionName('ERC1155 Collection');
        setCollectionSymbol('N/A');
      }
      setFetchedCollection(addr);
    } catch (err) {
      setError('Failed to fetch collection: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load exemption status when exempt address changes
  useEffect(() => {
    if (fetchedCollection && exemptAddress && ethers.utils.isAddress(exemptAddress) && provider) {
      loadExemptionStatus();
    }
    // eslint-disable-next-line
  }, [exemptAddress, fetchedCollection]);

  // Auto-fetch collection when a valid address is entered
  useEffect(() => {
    const addr = sanitizeAddress(collectionAddress);
    if (!connected || !addr || !ethers.utils.isAddress(addr)) return;
    const t = setTimeout(() => {
      if (!loading) {
        fetchCollection();
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionAddress, connected]);

  const loadExemptionStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const abi = collectionType === 'erc1155' ? contractABIs.erc1155Prize : contractABIs.erc721Prize;
      const contract = new ethers.Contract(
        fetchedCollection,
        abi,
        provider
      );
      const sanitizedExempt = sanitizeAddress(exemptAddress);
      const exempt = await contract.isRoyaltyEnforcementExempt(sanitizedExempt);
      setIsExempt(exempt);
    } catch (err) {
      setError('Failed to load exemption status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const setRoyaltyEnforcementExemption = async (exempt) => {
    if (!fetchedCollection || !exemptAddress || !provider) {
      toast.error('Please fetch a collection and enter a valid address');
      return;
    }
    const target = sanitizeAddress(exemptAddress);
    if (!ethers.utils.isAddress(target)) {
      toast.error('Please enter a valid Ethereum address');
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
        tx = await contract.setRoyaltyEnforcementExemption(target, exempt);
      } else if (collectionType === 'erc1155') {
        tx = await contract.setRoyaltyEnforcementExemption(target, exempt);
      }
      await tx.wait();
      toast.success(`Exemption ${exempt ? 'granted' : 'revoked'} successfully!`);
      setIsExempt(exempt);
      setExemptAddress('');
    } catch (err) {
      notifyError(err, { action: 'setRoyaltyEnforcementExemption' });
    } finally {
      setLoading(false);
    }
  };

  const toggleRoyaltyEnforcement = async () => {
    if (!fetchedCollection || !provider) {
      toast.error('Please fetch a collection first');
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
        toast.error('Only the contract owner can toggle royalty enforcement');
        return;
      }

      let tx;
      if (collectionType === 'erc721') {
        tx = await contract.toggleRoyaltyEnforcement(!royaltyEnforcementEnabled);
      } else if (collectionType === 'erc1155') {
        tx = await contract.toggleRoyaltyEnforcement(!royaltyEnforcementEnabled);
      }

      console.log('Transaction sent:', tx.hash);
      await tx.wait();
      toast.success(`Royalty enforcement ${royaltyEnforcementEnabled ? 'disabled' : 'enabled'} successfully!`);
      setRoyaltyEnforcementEnabled(!royaltyEnforcementEnabled);
    } catch (err) {
      console.error('Error in toggleRoyaltyEnforcement:', err);
      notifyError(err, { action: 'toggleRoyaltyEnforcement' });
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
        <CardContent className="space-y-4 p-4">
          <div className="text-base font-medium flex items-center gap-2 mb-1">
            Royalty Enforcement Management
          </div>
          <p className="text-sm text-muted-foreground">
            Please connect your wallet to manage royalty enforcement and exemptions.
          </p>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to manage royalty enforcement.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-4">
        <div className="text-base font-medium flex items-center gap-2 mb-1">
          Royalty Enforcement Management
        </div>
        <p className="text-sm text-muted-foreground">
          Manage royalty enforcement and exemptions for collections
        </p>
        {/* Wallet not connected warning */}
        {!connected && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to load collection info and manage royalty enforcement.
            </AlertDescription>
          </Alert>
        )}
        {/* Collection Address Input */}
        <div className="space-y-2">
          <Label htmlFor="collection-address">Collection Contract Address</Label>
          <ResponsiveAddressInput
            id="collection-address"
            placeholder="0x..."
            value={collectionAddress}
            onChange={(e) => setCollectionAddress(e.target.value)}
            disabled={loading || !connected}
            rightElement={loading && <LoadingSpinner size="sm" />}
          />
        </div>

        {/* Show royalty enforcement management UI only if collection is fetched */}
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
                <Badge variant={royaltyEnforcementEnabled ? "default" : "secondary"}>
                  {royaltyEnforcementEnabled ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      Royalty Enforcement Enabled
                    </>
                  ) : (
                    <>
                      Royalty Enforcement Disabled
                    </>
                  )}
                </Badge>
              </div>
            </div>

            {/* Royalty Enforcement Toggle */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Toggle Royalty Enforcement</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable royalty enforcement for this collection
                  </p>
                </div>
                <Button
                  onClick={toggleRoyaltyEnforcement}
                  disabled={loading}
                  variant={royaltyEnforcementEnabled ? "secondary" : "primary"}
                  size="md"
                  className="transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={royaltyEnforcementEnabled ? "Disable royalty enforcement" : "Enable royalty enforcement"}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {royaltyEnforcementEnabled ? 'Disable Enforcement' : 'Enable Enforcement'}
                </Button>
              </div>
            </div>

            {/* Royalty Enforcement Exemption Management */}
            <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="exempt-address">Exemption Address</Label>
                <ResponsiveAddressInput
                  id="exempt-address"
                  placeholder="0x... (address to exempt/enforce)"
                  value={exemptAddress}
                  onChange={(e) => setExemptAddress(e.target.value)}
                  disabled={loading}
                />
                {exemptAddress && !ethers.utils.isAddress(sanitizeAddress(exemptAddress)) && (
                  <p className="text-sm text-red-600">Invalid Ethereum address</p>
                )}
              </div>

              {exemptAddress && validateAddress(sanitizeAddress(exemptAddress)) && (
                <div className="space-y-2">
                  <Label>Current Status</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant={isExempt ? "default" : "secondary"}>
                      {isExempt ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Is Exempt
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Not Exempt
                        </>
                      )}
                    </Badge>
                  </div>
                  {isExempt && (
                    <p className="text-sm text-green-600">
                      This address is currently exempt from royalty enforcement.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  disabled={!fetchedCollection || !ethers.utils.isAddress(sanitizeAddress(exemptAddress)) || loading}
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError('');
                      const contract = new ethers.Contract(
                        fetchedCollection,
                        collectionType === 'erc721' ? contractABIs.erc721Prize : contractABIs.erc1155Prize,
                        provider
                      );
                      const exempt = await contract.isRoyaltyEnforcementExempt(sanitizeAddress(exemptAddress));
                      toast.success(exempt ? 'Address is exempt from royalty enforcement' : 'Address is NOT exempt');
                    } catch (err) {
                      notifyError(err, { action: 'checkExemption' });
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Check exemption
                </Button>

                <Button
                  onClick={() => setRoyaltyEnforcementExemption(true)}
                  disabled={loading || isExempt}
                  className="flex-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!exemptAddress ? "Please enter an address" : !validateAddress(sanitizeAddress(exemptAddress)) ? "Please enter a valid address" : isExempt ? "Address is already exempt" : "Grant exemption"}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Grant Exemption
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => setRoyaltyEnforcementExemption(false)}
                  disabled={loading || !isExempt}
                  className="flex-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!exemptAddress ? "Please enter an address" : !validateAddress(sanitizeAddress(exemptAddress)) ? "Please enter a valid address" : !isExempt ? "Address is not exempt" : "Revoke exemption"}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Revoke Exemption
                </Button>
              </div>
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

export default RoyaltyEnforcementExemptionComponent;
