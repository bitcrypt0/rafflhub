import React, { useState } from 'react';
import { ArrowLeft, Key, Search, AlertCircle, CheckCircle, UserCheck, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../../contexts/WalletContext';
import { useContract } from '../../../contexts/ContractContext';
import { toast } from '../../../components/ui/sonner';

/**
 * Mobile-specific Minter Approval Management Page
 * Uses standard HTML inputs to avoid Android keyboard issues
 */
const MobileMinterPage = () => {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction, executeCall } = useContract();

  // Form state with standard HTML inputs
  const [formData, setFormData] = useState({
    collectionAddress: '',
    minterAddress: '',
    tokenId: ''
  });

  const [loading, setLoading] = useState(false);
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [minterStatus, setMinterStatus] = useState(null);

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

      setCollectionInfo({
        name,
        owner,
        isOwner: owner.toLowerCase() === address.toLowerCase()
      });

      toast.success('Collection information loaded');
    } catch (error) {
      console.error('Error fetching collection info:', error);
      toast.error('Failed to fetch collection information');
    } finally {
      setLoading(false);
    }
  };

  // Check minter status
  const checkMinterStatus = async () => {
    if (!formData.collectionAddress || !formData.minterAddress || !connected) {
      toast.error('Please fill in collection and minter addresses');
      return;
    }

    try {
      setLoading(true);
      const contract = getContractInstance('erc1155', formData.collectionAddress);
      
      if (!contract) {
        toast.error('Invalid collection address');
        return;
      }

      // Check if address is approved minter
      const isApproved = await executeCall(contract, 'minters', [formData.minterAddress]).catch(() => false);

      setMinterStatus({
        address: formData.minterAddress,
        isApproved
      });

      toast.success('Minter status checked');
    } catch (error) {
      console.error('Error checking minter status:', error);
      toast.error('Failed to check minter status');
    } finally {
      setLoading(false);
    }
  };

  // Approve minter
  const approveMinter = async () => {
    if (!formData.collectionAddress || !formData.minterAddress || !connected) {
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

      await executeTransaction(contract, 'setMinter', [formData.minterAddress, true]);
      toast.success('Minter approved successfully!');
      
      // Refresh minter status
      checkMinterStatus();
    } catch (error) {
      console.error('Error approving minter:', error);
      toast.error('Failed to approve minter');
    } finally {
      setLoading(false);
    }
  };

  // Revoke minter
  const revokeMinter = async () => {
    if (!formData.collectionAddress || !formData.minterAddress || !connected) {
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

      await executeTransaction(contract, 'setMinter', [formData.minterAddress, false]);
      toast.success('Minter revoked successfully!');
      
      // Refresh minter status
      checkMinterStatus();
    } catch (error) {
      console.error('Error revoking minter:', error);
      toast.error('Failed to revoke minter');
    } finally {
      setLoading(false);
    }
  };

  // Mint tokens (if user is approved minter)
  const mintTokens = async () => {
    if (!formData.collectionAddress || !formData.minterAddress || !formData.tokenId || !connected) {
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

      // Mint 1 token to the minter address
      await executeTransaction(contract, 'mint', [formData.minterAddress, formData.tokenId, 1, '0x']);
      toast.success('Token minted successfully!');
      
      // Clear token ID
      setFormData(prev => ({ ...prev, tokenId: '' }));
    } catch (error) {
      console.error('Error minting tokens:', error);
      toast.error('Failed to mint tokens');
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
            <Key className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Minter Approval</h1>
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
                <span className="text-muted-foreground">You are owner:</span>
                <span className={`font-medium ${collectionInfo.isOwner ? 'text-green-600' : 'text-red-600'}`}>
                  {collectionInfo.isOwner ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Minter Address Input */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-4">Minter Address</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Minter Address
              </label>
              <input
                type="text"
                value={formData.minterAddress}
                onChange={(e) => handleInputChange('minterAddress', e.target.value)}
                placeholder="0x..."
                className="w-full p-3 border border-border rounded-lg bg-background text-base"
                style={{ fontSize: '16px' }}
              />
            </div>
            
            <button
              onClick={checkMinterStatus}
              disabled={loading || !formData.collectionAddress || !formData.minterAddress}
              className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Checking...' : 'Check Minter Status'}
            </button>
          </div>
        </div>

        {/* Minter Status */}
        {minterStatus && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              {minterStatus.isApproved ? (
                <UserCheck className="h-4 w-4 text-green-600" />
              ) : (
                <UserX className="h-4 w-4 text-red-600" />
              )}
              Minter Status
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-mono text-xs">{minterStatus.address.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved:</span>
                <span className={`font-medium ${minterStatus.isApproved ? 'text-green-600' : 'text-red-600'}`}>
                  {minterStatus.isApproved ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Minter Management (Owner Only) */}
        {collectionInfo?.isOwner && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-4">Manage Minter Approval</h2>
            
            <div className="space-y-3">
              <button
                onClick={approveMinter}
                disabled={loading || !formData.collectionAddress || !formData.minterAddress}
                className="w-full bg-green-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Approve Minter'}
              </button>
              
              <button
                onClick={revokeMinter}
                disabled={loading || !formData.collectionAddress || !formData.minterAddress}
                className="w-full bg-red-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Revoke Minter'}
              </button>
            </div>
          </div>
        )}

        {/* Mint Tokens (Approved Minters) */}
        {minterStatus?.isApproved && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-4">Mint Tokens</h2>
            
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
                  Token ID to mint (will mint 1 token to the minter address)
                </p>
              </div>
              
              <button
                onClick={mintTokens}
                disabled={loading || !formData.collectionAddress || !formData.minterAddress || !formData.tokenId}
                className="w-full bg-purple-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Minting...' : 'Mint Token'}
              </button>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800 mb-1">Important</h3>
              <p className="text-sm text-yellow-700">
                Only collection owners can approve/revoke minters. Approved minters can mint tokens to any address.
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

export default MobileMinterPage;
