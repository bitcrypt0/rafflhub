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
    newRoyaltyRecipient: '',
    newRoyaltyPercentage: '',
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

      // Get current royalty info
      const royaltyInfo = await executeCall(contract, 'royaltyInfo', [1, 10000]).catch(() => null);
      const owner = await executeCall(contract, 'owner', []).catch(() => 'Unknown');
      const name = await executeCall(contract, 'name', []).catch(() => 'Unknown Collection');

      setCollectionInfo({
        name,
        owner,
        currentRoyaltyRecipient: royaltyInfo ? royaltyInfo[0] : 'Unknown',
        currentRoyaltyPercentage: royaltyInfo ? (royaltyInfo[1].toNumber() / 100).toString() : '0'
      });

      toast.success('Collection information loaded');
    } catch (error) {
      console.error('Error fetching collection info:', error);
      toast.error('Failed to fetch collection information');
    } finally {
      setLoading(false);
    }
  };

  // Update royalty recipient
  const updateRoyaltyRecipient = async () => {
    if (!formData.collectionAddress || !formData.newRoyaltyRecipient || !connected) {
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

      await executeTransaction(contract, 'setRoyaltyRecipient', [formData.newRoyaltyRecipient]);
      toast.success('Royalty recipient updated successfully!');
      
      // Refresh collection info
      fetchCollectionInfo();
      
      // Clear form
      setFormData(prev => ({ ...prev, newRoyaltyRecipient: '' }));
    } catch (error) {
      console.error('Error updating royalty recipient:', error);
      toast.error('Failed to update royalty recipient');
    } finally {
      setLoading(false);
    }
  };

  // Update royalty percentage
  const updateRoyaltyPercentage = async () => {
    if (!formData.collectionAddress || !formData.newRoyaltyPercentage || !connected) {
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

      const percentage = Math.round(parseFloat(formData.newRoyaltyPercentage) * 100);
      await executeTransaction(contract, 'setRoyaltyPercentage', [percentage]);
      toast.success('Royalty percentage updated successfully!');
      
      // Refresh collection info
      fetchCollectionInfo();
      
      // Clear form
      setFormData(prev => ({ ...prev, newRoyaltyPercentage: '' }));
    } catch (error) {
      console.error('Error updating royalty percentage:', error);
      toast.error('Failed to update royalty percentage');
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
      const contract = getContractInstance('erc1155', formData.collectionAddress);
      
      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      await executeTransaction(contract, 'reveal', [formData.baseURI]);
      toast.success('Collection revealed successfully!');
      
      // Clear form
      setFormData(prev => ({ ...prev, baseURI: '' }));
    } catch (error) {
      console.error('Error revealing collection:', error);
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
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{collectionInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner:</span>
                <span className="font-mono text-xs">{collectionInfo.owner.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Royalty:</span>
                <span className="font-medium">{collectionInfo.currentRoyaltyPercentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient:</span>
                <span className="font-mono text-xs">{collectionInfo.currentRoyaltyRecipient.slice(0, 10)}...</span>
              </div>
            </div>
          </div>
        )}

        {/* Update Royalty Recipient */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-4">Update Royalty Recipient</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                New Royalty Recipient Address
              </label>
              <input
                type="text"
                value={formData.newRoyaltyRecipient}
                onChange={(e) => handleInputChange('newRoyaltyRecipient', e.target.value)}
                placeholder="0x..."
                className="w-full p-3 border border-border rounded-lg bg-background text-base"
                style={{ fontSize: '16px' }}
              />
            </div>
            
            <button
              onClick={updateRoyaltyRecipient}
              disabled={loading || !formData.collectionAddress || !formData.newRoyaltyRecipient}
              className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Recipient'}
            </button>
          </div>
        </div>

        {/* Update Royalty Percentage */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-4">Update Royalty Percentage</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                New Royalty Percentage (%)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={formData.newRoyaltyPercentage}
                onChange={(e) => handleInputChange('newRoyaltyPercentage', e.target.value)}
                placeholder="2.5"
                className="w-full p-3 border border-border rounded-lg bg-background text-base"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum 10%. Enter as decimal (e.g., 2.5 for 2.5%)
              </p>
            </div>
            
            <button
              onClick={updateRoyaltyPercentage}
              disabled={loading || !formData.collectionAddress || !formData.newRoyaltyPercentage}
              className="w-full bg-green-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Percentage'}
            </button>
          </div>
        </div>

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
