import React, { useState } from 'react';
import { Plus, AlertCircle, Search } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from './ui/sonner';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';

const CreateNewTokenIDComponent = () => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const { isMobile } = useMobileBreakpoints();
  
  const [loading, setLoading] = useState(false);
  const [collectionData, setCollectionData] = useState({
    address: '',
    tokenId: '',
    maxSupply: ''
  });
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  const handleChange = (field, value) => {
    setCollectionData(prev => ({ ...prev, [field]: value }));
  };

  // Load collection info to verify it's an ERC1155 collection and user is owner
  const loadCollectionInfo = async () => {
    if (!collectionData.address || !connected) {
      toast.error('Please enter a collection address and connect your wallet');
      return;
    }

    setLoadingInfo(true);
    try {
      const contract = getContractInstance(collectionData.address, 'erc1155Prize');
      
      if (!contract) {
        throw new Error('Failed to create contract instance');
      }

      // Check if user is owner
      const owner = await contract.owner();
      const isOwner = owner.toLowerCase() === address.toLowerCase();

      // Try to get collection name (if available)
      let collectionName = 'ERC1155 Collection';
      try {
        // Some ERC1155 contracts might have a name function
        collectionName = await contract.name();
      } catch (e) {
        // If no name function, use default
        collectionName = `ERC1155 Collection (${collectionData.address.slice(0, 6)}...${collectionData.address.slice(-4)})`;
      }

      setCollectionInfo({
        address: collectionData.address,
        name: collectionName,
        isOwner,
        owner
      });

      if (!isOwner) {
        toast.error('You are not the owner of this collection');
      } else {
        toast.success('Collection loaded successfully');
      }

    } catch (error) {
      console.error('Error loading collection info:', error);
      toast.error('Failed to load collection info. Please verify the address is a valid ERC1155 collection.');
      setCollectionInfo(null);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Create new token ID
  const handleCreateNewToken = async () => {
    if (!connected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!collectionInfo || !collectionInfo.isOwner) {
      toast.error('Please load collection info first and ensure you are the owner');
      return;
    }

    if (!collectionData.tokenId || !collectionData.maxSupply) {
      toast.error('Please fill in all required fields');
      return;
    }

    const tokenId = parseInt(collectionData.tokenId);
    const maxSupply = parseInt(collectionData.maxSupply);

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
        // Reset form
        setCollectionData(prev => ({
          ...prev,
          tokenId: '',
          maxSupply: ''
        }));
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

  return (
    <div className={`bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg ${isMobile ? 'p-4' : 'p-6'}`}>
      <div className="space-y-6">
        {/* Collection Lookup Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Collection Address</label>
            <input
              type="text"
              value={collectionData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className={`w-full px-3 py-2 border border-border rounded-md bg-background ${isMobile ? 'text-sm' : ''}`}
              placeholder="0x..."
            />
          </div>

          <button
            onClick={loadCollectionInfo}
            disabled={loadingInfo || !connected}
            className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${isMobile ? 'text-sm' : ''}`}
            title={!connected ? "Please connect your wallet" : !collectionData.address ? "Please enter a collection address" : "Load collection information"}
          >
            <Search className="h-4 w-4" />
            {loadingInfo ? 'Loading...' : 'Load Collection Info'}
          </button>
        </div>

        {/* Collection Info Display */}
        {collectionInfo && (
          <div className={`p-4 bg-muted/50 rounded-lg border ${isMobile ? 'text-sm' : ''}`}>
            <h4 className="font-medium mb-2">Collection Information</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium">Name:</span> {collectionInfo.name}</p>
              <p><span className="font-medium">Address:</span> {collectionInfo.address}</p>
              <p><span className="font-medium">Owner:</span> {collectionInfo.owner}</p>
              <p><span className="font-medium">You are owner:</span> {collectionInfo.isOwner ? '✅ Yes' : '❌ No'}</p>
            </div>

            {!collectionInfo.isOwner && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  You are not the owner of this collection and cannot create new tokens.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Token Creation Form */}
        {collectionInfo && collectionInfo.isOwner && (
          <div className="space-y-4">
            <h4 className={`font-medium ${isMobile ? 'text-base' : ''}`}>Create New Token</h4>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-2">Token ID</label>
                <input
                  type="number"
                  min="0"
                  value={collectionData.tokenId}
                  onChange={(e) => handleChange('tokenId', e.target.value)}
                  className={`w-full px-3 py-2 border border-border rounded-md bg-background ${isMobile ? 'text-sm' : ''}`}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier for the new token
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Supply</label>
                <input
                  type="number"
                  min="1"
                  value={collectionData.maxSupply}
                  onChange={(e) => handleChange('maxSupply', e.target.value)}
                  className={`w-full px-3 py-2 border border-border rounded-md bg-background ${isMobile ? 'text-sm' : ''}`}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of tokens that can be minted
                </p>
              </div>
            </div>

            <button
              onClick={handleCreateNewToken}
              disabled={loading || !connected || !collectionInfo.isOwner}
              className={`w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm ${isMobile ? 'text-sm' : ''}`}
              title={!connected ? "Please connect your wallet" : !collectionInfo.isOwner ? "Only collection owner can create new tokens" : !collectionData.tokenId || !collectionData.maxSupply ? "Please fill in all required fields" : "Create new token ID"}
            >
              <Plus className="h-4 w-4" />
              {loading ? 'Creating...' : 'Create New Token ID'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateNewTokenIDComponent;
