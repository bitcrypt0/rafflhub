import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { AlertCircle, Plus, Link } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from './ui/sonner';
import { ResponsiveAddressInput, ResponsiveNumberInput } from './ui/responsive-input';
import { LoadingSpinner } from './ui/loading';
import { notifyError } from '../utils/notificationService';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';

const CreateNewTokenIDComponent = () => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const { isMobile } = useMobileBreakpoints();
  
  const [loading, setLoading] = useState(false);
  const [collectionData, setCollectionData] = useState({
    address: ''
  });

  const [tokenCreationData, setTokenCreationData] = useState({
    tokenId: '',
    maxSupply: ''
  });

  const [uriData, setUriData] = useState({
    tokenId: '',
    tokenURI: ''
  });
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Auto-clear collection info when address is deleted
  useEffect(() => {
    if (!collectionData.address || collectionData.address.trim() === '') {
      setCollectionInfo(null);
    }
  }, [collectionData.address]);

  // Auto-fetch collection info on valid address input
  useEffect(() => {
    if (!connected || !collectionData.address || !ethers.utils.isAddress(collectionData.address)) return;
    const t = setTimeout(() => {
      if (!loadingInfo) {
        loadCollectionInfo();
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionData.address, connected]);

  const handleCollectionChange = (field, value) => {
    setCollectionData(prev => ({ ...prev, [field]: value }));
  };

  const handleTokenCreationChange = (field, value) => {
    setTokenCreationData(prev => ({ ...prev, [field]: value }));
  };

  const handleUriChange = (field, value) => {
    setUriData(prev => ({ ...prev, [field]: value }));
  };

  // Detect contract type (ERC721 vs ERC1155)
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

      throw new Error('Contract does not support ERC721 or ERC1155 interfaces');
    } catch (error) {
      console.error('Contract type detection error:', error);
      throw new Error('Unable to determine contract type. Please verify the contract address.');
    }
  };

  // Load collection info to verify it's an ERC1155 collection and user is owner
  const loadCollectionInfo = async () => {
    if (!collectionData.address || !connected) {
      toast.error('Please enter a collection address and connect your wallet');
      return;
    }

    setLoadingInfo(true);
    try {
      // First detect the contract type
      const { type, contract } = await detectContractType(collectionData.address);

      // This component is only for ERC1155 collections
      if (type !== 'erc1155') {
        toast.error('❌ This component is only for ERC1155 collections. The provided address appears to be an ERC721 collection. Please use the appropriate component for ERC721 collections.');
        setCollectionInfo({
          address: collectionData.address,
          isOwner: false,
          owner: 'N/A',
          type: 'erc721',
          isBlocked: true
        });
        setLoadingInfo(false);
        return;
      }

      // Check if user is owner
      const owner = await contract.owner();
      const isOwner = owner.toLowerCase() === address.toLowerCase();

      setCollectionInfo({
        address: collectionData.address,
        isOwner,
        owner,
        type: 'erc1155'
      });

      if (!isOwner) {
        toast.error('You are not the owner of this collection');
      } else {
        toast.success('ERC1155 collection loaded successfully');
      }

    } catch (error) {
      console.error('Error loading collection info:', error);
      toast.error('Failed to load collection info. Please verify the address is a valid ERC1155 collection.');
      setCollectionInfo(null);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Create new token ID only
  const handleCreateNewToken = async () => {
    if (!connected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!collectionInfo || !collectionInfo.isOwner || collectionInfo.isBlocked) {
      if (collectionInfo?.isBlocked) {
        toast.error('This component only works with ERC1155 collections. The provided address is an ERC721 collection.');
      } else {
        toast.error('Please load collection info first and ensure you are the owner');
      }
      return;
    }

    if (!tokenCreationData.tokenId || !tokenCreationData.maxSupply) {
      toast.error('Please fill in all required fields');
      return;
    }

    const tokenId = parseInt(tokenCreationData.tokenId);
    const maxSupply = parseInt(tokenCreationData.maxSupply);

    if (isNaN(tokenId) || tokenId < 0) {
      toast.error('Please enter a valid token ID (non-negative integer)');
      return;
    }

    if (isNaN(maxSupply) || maxSupply <= 0) {
      toast.error('Please enter a valid max supply (positive integer)');
      return;
    }

    setLoading(true);
    try {
      const contract = getContractInstance(collectionData.address, 'erc1155Prize');

      const result = await executeTransaction(
        contract.createNewToken,
        tokenId,
        maxSupply
      );

      if (result.success) {
        toast.success(`Token ID ${tokenId} created successfully with max supply of ${maxSupply}!`);
        // Reset token creation form
        setTokenCreationData({
          tokenId: '',
          maxSupply: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating new token:', error);
      notifyError(error, { action: 'createNewToken' });
    } finally {
      setLoading(false);
    }
  };

  // Set URI for existing token ID
  const handleSetTokenURI = async () => {
    if (!connected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!collectionInfo || !collectionInfo.isOwner || collectionInfo.isBlocked) {
      if (collectionInfo?.isBlocked) {
        toast.error('This component only works with ERC1155 collections. The provided address is an ERC721 collection.');
      } else {
        toast.error('Please load collection info first and ensure you are the owner');
      }
      return;
    }

    if (!uriData.tokenId || !uriData.tokenURI) {
      toast.error('Please fill in all required fields');
      return;
    }

    const tokenId = parseInt(uriData.tokenId);

    if (isNaN(tokenId) || tokenId < 0) {
      toast.error('Please enter a valid token ID (non-negative integer)');
      return;
    }

    setLoading(true);
    try {
      const contract = getContractInstance(collectionData.address, 'erc1155Prize');

      const result = await executeTransaction(
        contract.setURI,
        tokenId,
        uriData.tokenURI.trim()
      );

      if (result.success) {
        toast.success(`URI set successfully for token ID ${tokenId}!`);
        // Reset URI form
        setUriData({
          tokenId: '',
          tokenURI: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error setting URI:', error);
      notifyError(error, { action: 'setTokenURI' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-6 p-4">
        <div className="text-base font-medium flex items-center gap-2 mb-1">
          Token ID & URI Management
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Create new token IDs for ERC1155 collections and configure token URIs
        </p>
        {/* Collection Lookup Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Collection Address</label>
            <ResponsiveAddressInput
              value={collectionData.address}
              onChange={(e) => handleCollectionChange('address', e.target.value)}
              placeholder="0x..."
              rightElement={loadingInfo && <LoadingSpinner size="sm" />}
            />
          </div>

          
        </div>

        {/* Collection Info Display */}
        {collectionInfo && (
          <div className={`p-4 rounded-lg border ${collectionInfo.isBlocked ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50'}`}>


            {collectionInfo.isBlocked && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  This component only works with ERC1155 collections. The provided address is an ERC721 collection. Please use the appropriate component for ERC721 collections.
                </span>
              </div>
            )}

            {!collectionInfo.isBlocked && !collectionInfo.isOwner && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  You are not the owner of this collection and cannot create new tokens.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Token Creation Section */}
        {collectionInfo && collectionInfo.isOwner && !collectionInfo.isBlocked && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="text-base font-medium flex items-center gap-2 mb-1">
                Create New Token ID
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new token ID for your ERC1155 collection with specified supply
              </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Token ID</label>
                <ResponsiveNumberInput
                  min="0"
                  value={tokenCreationData.tokenId}
                  onChange={(e) => handleTokenCreationChange('tokenId', e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier for the new token
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Supply</label>
                <ResponsiveNumberInput
                  min="1"
                  value={tokenCreationData.maxSupply}
                  onChange={(e) => handleTokenCreationChange('maxSupply', e.target.value)}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of tokens that can be minted
                </p>
              </div>
            </div>

            <Button
              onClick={handleCreateNewToken}
              disabled={loading || !connected || !collectionInfo.isOwner || collectionInfo.isBlocked || !tokenCreationData.tokenId || !tokenCreationData.maxSupply}
              variant="primary"
              size="md"
              className="w-full"
              title={!connected ? "Please connect your wallet" : !collectionInfo.isOwner ? "Only collection owner can create new tokens" : !tokenCreationData.tokenId || !tokenCreationData.maxSupply ? "Please fill in all required fields" : "Create new token ID"}
            >
              {loading ? 'Creating...' : 'Create New Token ID'}
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Set Token URI Section */}
        {collectionInfo && collectionInfo.isOwner && !collectionInfo.isBlocked && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="text-base font-medium flex items-center gap-2 mb-1">
                Set Token URI
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Set the metadata URI for a specific token ID in your collection
              </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Token ID</label>
                <ResponsiveNumberInput
                  min="0"
                  value={uriData.tokenId}
                  onChange={(e) => handleUriChange('tokenId', e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Token ID to set URI for
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Token URI</label>
                <input
                  type="text"
                  value={uriData.tokenURI}
                  onChange={(e) => handleUriChange('tokenURI', e.target.value)}
                  placeholder="https://example.com/metadata/{id}.json"
                  className={`w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm`}
                  style={isMobile ? { fontSize: '16px' } : {}}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Metadata URI for the token
                </p>
              </div>
            </div>

            <Button
              onClick={handleSetTokenURI}
              disabled={loading || !connected || !collectionInfo.isOwner || collectionInfo.isBlocked || !uriData.tokenId || !uriData.tokenURI}
              variant="primary"
              size="md"
              className="w-full"
              title={!connected ? "Please connect your wallet" : !collectionInfo.isOwner ? "Only collection owner can set URIs" : !uriData.tokenId || !uriData.tokenURI ? "Please fill in all required fields" : "Set token URI"}
            >
              {loading ? 'Setting...' : 'Set Token URI'}
            </Button>
          </CardContent>
        </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default CreateNewTokenIDComponent;
