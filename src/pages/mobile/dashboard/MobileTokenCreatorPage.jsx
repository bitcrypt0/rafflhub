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
    collectionAddress: '',
    tokenId: '',
    initialSupply: '1',
    metadataURI: '',
    recipientAddress: ''
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
      const contract = getContractInstance('erc1155', formData.collectionAddress);
      
      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      const owner = await executeCall(contract, 'owner', []).catch(() => 'Unknown');
      const name = await executeCall(contract, 'name', []).catch(() => 'Unknown Collection');
      
      // Check if current user is approved minter
      const isMinter = await executeCall(contract, 'minters', [address]).catch(() => false);

      setCollectionInfo({
        name,
        owner,
        isOwner: owner.toLowerCase() === address.toLowerCase(),
        isMinter
      });

      toast.success('Collection information loaded');
    } catch (error) {
      console.error('Error fetching collection info:', error);
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
      const contract = getContractInstance('erc1155', formData.collectionAddress);
      if (!contract) return false;

      // Try to get total supply for this token ID
      const totalSupply = await executeCall(contract, 'totalSupply', [formData.tokenId]).catch(() => null);
      return totalSupply !== null && totalSupply.gt(0);
    } catch (error) {
      return false;
    }
  };

  // Create new token ID
  const createToken = async () => {
    if (!formData.collectionAddress || !formData.tokenId || !formData.initialSupply || !connected) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const contract = getContractInstance('erc1155', formData.collectionAddress);
      
      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      // Check if token already exists
      const exists = await checkTokenExists();
      if (exists) {
        toast.error('Token ID already exists');
        return;
      }

      const recipient = formData.recipientAddress || address;
      const supply = parseInt(formData.initialSupply);

      // Mint the initial supply to create the token
      await executeTransaction(contract, 'mint', [recipient, formData.tokenId, supply, '0x']);
      toast.success('Token created successfully!');
      
      // Clear form
      setFormData(prev => ({
        ...prev,
        tokenId: '',
        initialSupply: '1',
        metadataURI: '',
        recipientAddress: ''
      }));
      
      // Refresh collection info
      fetchCollectionInfo();
    } catch (error) {
      console.error('Error creating token:', error);
      toast.error('Failed to create token');
    } finally {
      setLoading(false);
    }
  };

  // Set token URI (if supported)
  const setTokenURI = async () => {
    if (!formData.collectionAddress || !formData.tokenId || !formData.metadataURI || !connected) {
      toast.error('Please fill in collection address, token ID, and metadata URI');
      return;
    }

    try {
      setLoading(true);
      const contract = getContractInstance('erc1155', formData.collectionAddress);
      
      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      // Try to set URI for specific token (if contract supports it)
      await executeTransaction(contract, 'setTokenURI', [formData.tokenId, formData.metadataURI]);
      toast.success('Token URI set successfully!');
      
      // Clear URI field
      setFormData(prev => ({ ...prev, metadataURI: '' }));
    } catch (error) {
      console.error('Error setting token URI:', error);
      toast.error('Failed to set token URI (contract may not support this feature)');
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
            <h1 className="text-lg font-semibold">Create Token ID</h1>
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
                  Initial Supply
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.initialSupply}
                  onChange={(e) => handleInputChange('initialSupply', e.target.value)}
                  placeholder="1"
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of tokens to mint initially
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipient Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.recipientAddress}
                  onChange={(e) => handleInputChange('recipientAddress', e.target.value)}
                  placeholder="0x... (leave empty to mint to yourself)"
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Address to receive the initial supply (defaults to your address)
                </p>
              </div>
              
              <button
                onClick={createToken}
                disabled={loading || !formData.collectionAddress || !formData.tokenId || !formData.initialSupply}
                className="w-full bg-green-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Token'}
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
                className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Setting...' : 'Set Token URI'}
              </button>
            </div>
          </div>
        )}

        {/* Access Denied */}
        {collectionInfo && !canCreateTokens && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 mb-1">Access Denied</h3>
                <p className="text-sm text-red-700">
                  You need to be the collection owner or an approved minter to create new tokens.
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
