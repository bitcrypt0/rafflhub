import React, { useState } from 'react';
import { ArrowLeft, Plus, Search, AlertCircle, CheckCircle, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../../contexts/WalletContext';
import { useContract } from '../../../contexts/ContractContext';
import { toast } from '../../../components/ui/sonner';

/**
 * Mobile-specific Token Creator Page for ERC1155 collections
 * Uses standard HTML inputs to avoid Android keyboard issues
 */
const MobileTokenCreatorPage = () => {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction, executeCall } = useContract();

  // Form state with standard HTML inputs
  const [formData, setFormData] = useState({
    collectionAddress: ''
  });

  const [tokenCreationData, setTokenCreationData] = useState({
    tokenId: '',
    maxSupply: '1'
  });

  const [uriData, setUriData] = useState({
    tokenId: '',
    metadataURI: ''
  });

  const [loading, setLoading] = useState(false);
  const [collectionInfo, setCollectionInfo] = useState(null);

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Fetch collection information
  const fetchCollectionInfo = async () => {
    if (!formData.collectionAddress || !connected) {
      return;
    }

    try {
      setLoading(true);

      // Only ERC1155 supports createNewToken method
      const contract = getContractInstance(formData.collectionAddress, 'erc1155Prize');

      if (!contract) {
        toast.error('Invalid ERC1155 collection address');
        return;
      }

      const owner = await executeCall(contract, 'owner', []).catch(() => 'Unknown');
      const name = await executeCall(contract, 'name', []).catch(() => 'Unknown Collection');
      const symbol = await executeCall(contract, 'symbol', []).catch(() => 'Unknown');

      setCollectionInfo({
        name,
        symbol,
        owner,
        isOwner: owner.toLowerCase() === address.toLowerCase()
      });

      toast.success('Collection information loaded');
    } catch (error) {
      toast.error('Failed to fetch collection information');
    } finally {
      setLoading(false);
    }
  };

  // Check if token ID exists
  const checkTokenExists = async () => {
    if (!formData.collectionAddress || !formData.tokenId || !connected) {
      return false;
    }

    try {
      const contract = getContractInstance(formData.collectionAddress, 'erc1155');
      if (!contract) return false;

      // Try to get total supply for this token ID
      const totalSupply = await executeCall(contract, 'totalSupply', [formData.tokenId]).catch(() => null);
      return totalSupply !== null && totalSupply.gt(0);
    } catch (error) {
      return false;
    }
  };

  // Create new token ID (matches desktop implementation)
  const createToken = async () => {
    if (!formData.collectionAddress || !tokenCreationData.tokenId || !tokenCreationData.maxSupply || !connected) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!collectionInfo || !collectionInfo.isOwner) {
      toast.error('Only collection owner can create new tokens');
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

    try {
      setLoading(true);
      const contract = getContractInstance(formData.collectionAddress, 'erc1155Prize');

      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      // Use createNewToken method (matches desktop implementation)
      await executeTransaction(contract, 'createNewToken', [tokenId, maxSupply]);
      toast.success(`Token ID ${tokenId} created successfully with max supply of ${maxSupply}!`);

      // Clear token creation form
      setTokenCreationData({
        tokenId: '',
        maxSupply: '1'
      });

      // Refresh collection info
      fetchCollectionInfo();
    } catch (error) {
      toast.error('Failed to create token');
    } finally {
      setLoading(false);
    }
  };

  // Set token URI (if supported)
  const setTokenURI = async () => {
    if (!formData.collectionAddress || !uriData.tokenId || !uriData.metadataURI || !connected) {
      toast.error('Please fill in collection address, token ID, and metadata URI');
      return;
    }

    if (!collectionInfo || !collectionInfo.isOwner) {
      toast.error('Only collection owner can set token URIs');
      return;
    }

    const tokenId = parseInt(uriData.tokenId);

    if (isNaN(tokenId) || tokenId < 0) {
      toast.error('Please enter a valid token ID (non-negative integer)');
      return;
    }

    try {
      setLoading(true);
      const contract = getContractInstance(formData.collectionAddress, 'erc1155Prize');

      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      // Use setURI function with tokenId and URI parameters
      await executeTransaction(contract, 'setURI', [tokenId, uriData.metadataURI]);
      toast.success(`URI set successfully for token ID ${tokenId}!`);

      // Clear URI form
      setUriData({
        tokenId: '',
        metadataURI: ''
      });
    } catch (error) {
      toast.error('Failed to set token URI');
    } finally {
      setLoading(false);
    }
  };

  const canCreateTokens = collectionInfo && (collectionInfo.isOwner || collectionInfo.isMinter);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Create New Token ID & Set Token URI</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Collection Lookup */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-4 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Collection Lookup
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                ERC1155 Collection Address
              </label>
              <input
                type="text"
                value={formData.collectionAddress}
                onChange={(e) => handleInputChange('collectionAddress', e.target.value)}
                placeholder="0x..."
                className="w-full p-3 border border-border rounded-lg bg-background text-base"
                style={{ fontSize: '16px' }} // Prevent zoom on iOS
              />
            </div>
            
            <button
              onClick={fetchCollectionInfo}
              disabled={loading || !formData.collectionAddress}
              className="w-full bg-primary text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Fetch Collection Info'}
            </button>
          </div>
        </div>

        {/* Collection Information */}
        {collectionInfo && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Collection Information
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{collectionInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner:</span>
                <span className="font-mono text-xs">{collectionInfo.owner.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You are owner:</span>
                <span className={`font-medium ${collectionInfo.isOwner ? 'text-green-600' : 'text-red-600'}`}>
                  {collectionInfo.isOwner ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You are minter:</span>
                <span className={`font-medium ${collectionInfo.isMinter ? 'text-green-600' : 'text-red-600'}`}>
                  {collectionInfo.isMinter ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Create Token Form */}
        {canCreateTokens && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-4">Create New Token ID</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Token ID
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.tokenId}
                  onChange={(e) => handleInputChange('tokenId', e.target.value)}
                  placeholder="1"
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Unique identifier for the new token
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Supply
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxSupply}
                  onChange={(e) => handleInputChange('maxSupply', e.target.value)}
                  placeholder="1"
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum number of tokens that can be minted for this ID
                </p>
              </div>
              
              <button
                onClick={createToken}
                disabled={loading || !formData.collectionAddress || !formData.tokenId || !formData.maxSupply || !collectionInfo?.isOwner}
                className="w-full bg-[#614E41] text-white p-3 rounded-lg font-medium hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create New Token ID'}
              </button>
            </div>
          </div>
        )}

        {/* Set Token URI */}
        {canCreateTokens && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-4 flex items-center gap-2">
              <Image className="h-4 w-4" />
              Set Token Metadata URI
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Token ID
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.tokenId}
                  onChange={(e) => handleInputChange('tokenId', e.target.value)}
                  placeholder="1"
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Metadata URI
                </label>
                <input
                  type="text"
                  value={formData.metadataURI}
                  onChange={(e) => handleInputChange('metadataURI', e.target.value)}
                  placeholder="https://api.example.com/metadata/1.json"
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL pointing to the token's metadata JSON file
                </p>
              </div>
              
              <button
                onClick={setTokenURI}
                disabled={loading || !formData.collectionAddress || !formData.tokenId || !formData.metadataURI}
                className="w-full bg-[#614E41] text-white p-3 rounded-lg font-medium hover:bg-[#4a3a30] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Setting...' : 'Set Token URI'}
              </button>
            </div>
          </div>
        )}

        {/* Access Denied */}
        {collectionInfo && !collectionInfo.isOwner && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 mb-1">Access Denied</h3>
                <p className="text-sm text-red-700">
                  Only the collection owner can create new token IDs.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-800 mb-1">How it works</h3>
              <p className="text-sm text-blue-700">
                Creating a new token ID in an ERC1155 collection mints the initial supply to the specified address. 
                Each token ID can have its own metadata and supply.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom padding for mobile navigation */}
        <div className="h-20"></div>
      </div>
    </div>
  );
};

export default MobileTokenCreatorPage;
