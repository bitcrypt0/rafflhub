import React, { useState } from 'react';
import { Plus, AlertCircle, Search } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from './ui/sonner';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { ResponsiveAddressInput, ResponsiveNumberInput } from './ui/responsive-input';

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
      toast.error(`Failed to create new token: ${error.message}`);
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
        contract,
        'setURI',
        [tokenId, uriData.tokenURI.trim()],
        {
          description: `Setting URI for token ID ${tokenId}`,
          successMessage: `URI set successfully for token ID ${tokenId}!`
        }
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
      toast.error(`Failed to set URI: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">{/* Simplified container - card wrapper handled by DashboardCard */}
        {/* Collection Lookup Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Collection Address</label>
            <ResponsiveAddressInput
              value={collectionData.address}
              onChange={(e) => handleCollectionChange('address', e.target.value)}
              placeholder="0x..."
            />
          </div>

          <button
            onClick={loadCollectionInfo}
            disabled={loadingInfo || !connected}
            className={`flex items-center gap-2 px-4 py-2 h-10 bg-[#614E41] text-white rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm`}
            title={!connected ? "Please connect your wallet" : !collectionData.address ? "Please enter a collection address" : "Load collection information"}
          >
            <Search className="h-4 w-4" />
            {loadingInfo ? 'Loading...' : 'Load Collection Info'}
          </button>
        </div>

        {/* Collection Info Display */}
        {collectionInfo && (
          <div className={`p-4 rounded-lg border ${collectionInfo.isBlocked ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50'}`}>
            <h4 className="text-sm text-muted-foreground mb-2">Collection Information</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="text-muted-foreground">Address:</span> {collectionInfo.address}</p>
              <p><span className="text-muted-foreground">Owner:</span> {collectionInfo.owner}</p>
              <p><span className="text-muted-foreground">You are owner:</span> {collectionInfo.isOwner ? '✅ Yes' : '❌ No'}</p>
              <p><span className="text-muted-foreground">Type:</span> {collectionInfo.type === 'erc721' ? '❌ ERC721 Collection (Incompatible)' : '✅ ERC1155 Collection'}</p>
            </div>

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
          <div className="space-y-4">
            <h4 className="text-sm text-muted-foreground">Create New Token ID</h4>

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

            <button
              onClick={handleCreateNewToken}
              disabled={loading || !connected || !collectionInfo.isOwner || collectionInfo.isBlocked || !tokenCreationData.tokenId || !tokenCreationData.maxSupply}
              className={`w-full bg-[#614E41] text-white px-6 py-2.5 h-10 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm`}
              title={!connected ? "Please connect your wallet" : !collectionInfo.isOwner ? "Only collection owner can create new tokens" : !tokenCreationData.tokenId || !tokenCreationData.maxSupply ? "Please fill in all required fields" : "Create new token ID"}
            >
              <Plus className="h-4 w-4" />
              {loading ? 'Creating...' : 'Create New Token ID'}
            </button>
          </div>
        )}

        {/* Set Token URI Section */}
        {collectionInfo && collectionInfo.isOwner && !collectionInfo.isBlocked && (
          <div className="space-y-4 border-t border-border pt-6">
            <h4 className="text-sm text-muted-foreground">Set Token URI</h4>

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

            <button
              onClick={handleSetTokenURI}
              disabled={loading || !connected || !collectionInfo.isOwner || collectionInfo.isBlocked || !uriData.tokenId || !uriData.tokenURI}
              className={`w-full bg-[#614E41] text-white px-6 py-2.5 h-10 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm text-sm`}
              title={!connected ? "Please connect your wallet" : !collectionInfo.isOwner ? "Only collection owner can set URIs" : !uriData.tokenId || !uriData.tokenURI ? "Please fill in all required fields" : "Set token URI"}
            >
              <Search className="h-4 w-4" />
              {loading ? 'Setting...' : 'Set Token URI'}
            </button>
          </div>
        )}
    </div>
  );
};

export default CreateNewTokenIDComponent;
