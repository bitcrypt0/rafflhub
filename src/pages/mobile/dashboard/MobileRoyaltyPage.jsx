import React, { useState } from 'react';
import { ArrowLeft, Crown, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../../contexts/WalletContext';
import { useContract } from '../../../contexts/ContractContext';
import { toast } from '../../../components/ui/sonner';

/**
 * Mobile-specific Royalty Management Page
 * Uses standard HTML inputs to avoid Android keyboard issues
 */
const MobileRoyaltyPage = () => {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction, executeCall } = useContract();

  // Form state with standard HTML inputs
  const [formData, setFormData] = useState({
    collectionAddress: '',
    collectionType: null, // Will be auto-detected
    royaltyPercentage: '',
    royaltyRecipient: '',
    baseURI: ''
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

  // Fetch collection information with auto-detection
  const fetchCollectionInfo = async () => {
    if (!formData.collectionAddress || !connected) {
      return;
    }

    try {
      setLoading(true);

      // Auto-detect collection type by trying both ERC721 and ERC1155
      let contract = null;
      let type = null;

      // Try ERC721 first
      try {
        const erc721Contract = getContractInstance(formData.collectionAddress, 'erc721Prize');
        if (erc721Contract) {
          // Test if it's actually ERC721 by calling a specific method
          await executeCall(erc721Contract, 'name', []);
          contract = erc721Contract;
          type = 'erc721';
        }
      } catch (error) {
        // Not ERC721, try ERC1155
      }

      // If ERC721 failed, try ERC1155
      if (!contract) {
        try {
          const erc1155Contract = getContractInstance(formData.collectionAddress, 'erc1155Prize');
          if (erc1155Contract) {
            // Test if it's actually ERC1155 by calling a specific method
            await executeCall(erc1155Contract, 'name', []);
            contract = erc1155Contract;
            type = 'erc1155';
          }
        } catch (error) {
          // Neither worked
        }
      }

      if (!contract || !type) {
        toast.error('Invalid collection address or unsupported contract type');
        return;
      }

      // Get current royalty info
      const royaltyInfo = await executeCall(contract, 'royaltyInfo', [1, 10000]).catch(() => null);
      const owner = await executeCall(contract, 'owner', []).catch(() => 'Unknown');
      const name = await executeCall(contract, 'name', []).catch(() => 'Unknown Collection');
      const symbol = await executeCall(contract, 'symbol', []).catch(() => 'Unknown');

      // Check reveal status
      let revealStatus = null;
      try {
        revealStatus = await executeCall(contract, 'isRevealed', []);
      } catch (error) {
        // Silently handle reveal status fetch error
      }

      setFormData(prev => ({ ...prev, collectionType: type }));
      setCollectionInfo({
        address: formData.collectionAddress,
        name,
        symbol,
        owner,
        type,
        isOwner: owner.toLowerCase() === address.toLowerCase(),
        currentRoyaltyRecipient: royaltyInfo ? royaltyInfo[0] : 'Unknown',
        currentRoyaltyPercentage: royaltyInfo ? (royaltyInfo[1].toNumber() / 100).toString() : '0',
        isRevealed: revealStatus
      });

      toast.success('Collection information loaded');
    } catch (error) {
      toast.error('Failed to fetch collection information');
    } finally {
      setLoading(false);
    }
  };

  // Update royalty settings (unified method like desktop)
  const updateRoyalty = async () => {
    if (!formData.collectionAddress || !formData.royaltyPercentage || !formData.royaltyRecipient || !connected) {
      toast.error('Please fill in all required fields');
      return;
    }

    const royaltyPercentage = parseFloat(formData.royaltyPercentage);
    if (isNaN(royaltyPercentage) || royaltyPercentage < 0) {
      toast.error('Please enter a valid royalty percentage (minimum 0%)');
      return;
    }

    try {
      setLoading(true);
      const contractType = formData.collectionType === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
      const contract = getContractInstance(formData.collectionAddress, contractType);

      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      // Convert percentage to basis points (multiply by 100) - matches desktop
      const royaltyBasisPoints = Math.floor(royaltyPercentage * 100);

      await executeTransaction(contract, 'setRoyalty', [royaltyBasisPoints, formData.royaltyRecipient]);
      toast.success('Royalty settings updated successfully!');

      // Refresh collection info
      fetchCollectionInfo();

      // Clear form
      setFormData(prev => ({
        ...prev,
        royaltyPercentage: '',
        royaltyRecipient: ''
      }));
    } catch (error) {
      toast.error('Failed to update royalty settings');
    } finally {
      setLoading(false);
    }
  };

  // Reveal collection
  const revealCollection = async () => {
    if (!formData.collectionAddress || !formData.baseURI || !connected) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const contract = getContractInstance(formData.collectionAddress, 'erc1155');
      
      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      await executeTransaction(contract, 'reveal', [formData.baseURI]);
      toast.success('Collection revealed successfully!');
      
      // Clear form
      setFormData(prev => ({ ...prev, baseURI: '' }));
    } catch (error) {
      toast.error('Failed to reveal collection');
    } finally {
      setLoading(false);
    }
  };

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
            <Crown className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Royalty & Reveal</h1>
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
                Collection Address
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
                <span className="font-medium">Name:</span>
                <span>{collectionInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Symbol:</span>
                <span>{collectionInfo.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Type:</span>
                <span>{collectionInfo.type.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Owner:</span>
                <span>{collectionInfo.isOwner ? 'You' : 'Other'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Current Royalty:</span>
                <span>{collectionInfo.currentRoyaltyPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Revealed:</span>
                <span>{collectionInfo.isRevealed === null ? 'Unknown' : collectionInfo.isRevealed ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <div className="text-sm">
                <div className="font-medium mb-1">Address:</div>
                <div className="font-mono text-xs break-all bg-background p-2 rounded border">
                  {collectionInfo.address}
                </div>
              </div>
              <div className="text-sm">
                <div className="font-medium mb-1">Royalty Recipient:</div>
                <div className="font-mono text-xs break-all bg-background p-2 rounded border">
                  {collectionInfo.currentRoyaltyRecipient}
                </div>
              </div>
            </div>

            {!collectionInfo.isOwner && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">
                  You are not the owner of this collection and cannot modify royalty settings.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Update Royalty Settings (Unified Form) */}
        {collectionInfo?.isOwner && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-4">Update Royalty Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  New Royalty Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.royaltyPercentage}
                  onChange={(e) => handleInputChange('royaltyPercentage', e.target.value)}
                  placeholder="2.5"
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter as decimal (e.g., 2.5 for 2.5%)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  New Royalty Recipient Address
                </label>
                <input
                  type="text"
                  value={formData.royaltyRecipient}
                  onChange={(e) => handleInputChange('royaltyRecipient', e.target.value)}
                  placeholder="0x..."
                  className="w-full p-3 border border-border rounded-lg bg-background text-base"
                  style={{ fontSize: '16px' }}
                />
              </div>

              <button
                onClick={updateRoyalty}
                disabled={loading || !formData.collectionAddress || !formData.royaltyPercentage || !formData.royaltyRecipient}
                className="w-full bg-purple-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Royalty Settings'}
              </button>
            </div>
          </div>
        )}

        {/* Reveal Collection */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-4">Reveal Collection</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Base URI for Revealed Metadata
              </label>
              <input
                type="text"
                value={formData.baseURI}
                onChange={(e) => handleInputChange('baseURI', e.target.value)}
                placeholder="https://api.example.com/metadata/"
                className="w-full p-3 border border-border rounded-lg bg-background text-base"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The base URI where your revealed metadata is hosted
              </p>
            </div>
            
            <button
              onClick={revealCollection}
              disabled={loading || !formData.collectionAddress || !formData.baseURI}
              className="w-full bg-purple-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Revealing...' : 'Reveal Collection'}
            </button>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800 mb-1">Important</h3>
              <p className="text-sm text-yellow-700">
                Only the collection owner can perform these operations. Make sure you're connected with the correct wallet.
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

export default MobileRoyaltyPage;
