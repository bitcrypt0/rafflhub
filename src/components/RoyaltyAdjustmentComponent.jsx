import React, { useState } from 'react';
import { Settings, Search, AlertCircle } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from './ui/sonner';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import { ResponsiveAddressInput, ResponsiveNumberInput } from './ui/responsive-input';

const RoyaltyAdjustmentComponent = () => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [collectionData, setCollectionData] = useState({
    address: '',
    type: null, // Will be auto-detected
    royaltyPercentage: '',
    royaltyRecipient: ''
  });
  const [collectionInfo, setCollectionInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  // Reveal state
  const [isRevealed, setIsRevealed] = useState(null);
  const [revealing, setRevealing] = useState(false);

  const handleChange = (field, value) => {
    setCollectionData(prev => ({ ...prev, [field]: value }));
  };

  // Check if collection is revealed after loading info
  const checkRevealedStatus = async (contract) => {
    try {
      if (!contract) return;
      // Use isRevealed() function (bool)
      const revealed = await contract.isRevealed();
      setIsRevealed(!!revealed);
    } catch (e) {
      // If isRevealed() does not exist, fallback to null
      console.log('Could not fetch reveal status:', e.message);
      setIsRevealed(null);
    }
  };

  // Auto-detect collection type and load collection info
  const loadCollectionInfo = async () => {
    if (!collectionData.address || !connected) {
      toast.error('Please enter a collection address and connect your wallet');
      return;
    }

    setLoadingInfo(true);
    try {
      // Auto-detect collection type by trying both ERC721 and ERC1155
      let contract = null;
      let detectedType = null;

      // Try ERC721 first
      try {
        const erc721Contract = getContractInstance(collectionData.address, 'erc721Prize');
        if (erc721Contract) {
          // Test if it's actually ERC721 by calling a specific method
          await erc721Contract.name(); // This should work for ERC721
          contract = erc721Contract;
          detectedType = 'erc721';
        }
      } catch (error) {
        // Not ERC721, try ERC1155
      }

      // If ERC721 failed, try ERC1155
      if (!contract) {
        try {
          const erc1155Contract = getContractInstance(collectionData.address, 'erc1155Prize');
          if (erc1155Contract) {
            // Test if it's actually ERC1155 by calling a specific method
            await erc1155Contract.name(); // This should work for ERC1155
            contract = erc1155Contract;
            detectedType = 'erc1155';
          }
        } catch (error) {
          // Neither worked
        }
      }

      if (!contract || !detectedType) {
        throw new Error('Invalid collection address or unsupported contract type');
      }

      // Update the collection type in state
      setCollectionData(prev => ({ ...prev, type: detectedType }));

      // Get collection info (same as Creator Mint UI)
      const name = await contract.name().catch(() => 'Unknown Collection');
      const symbol = await contract.symbol().catch(() => 'Unknown');
      const owner = await contract.owner().catch(() => 'Unknown');
      const isOwner = owner.toLowerCase() === address.toLowerCase();

      // Get current royalty info
      const royaltyInfo = await contract.royaltyInfo(1, 10000); // Query with token ID 1 and sale price 10000
      const royaltyPercentage = await contract.royaltyPercentage();
      const royaltyRecipient = await contract.royaltyRecipient();

      setCollectionInfo({
        address: collectionData.address,
        name,
        symbol,
        owner,
        type: detectedType,
        isOwner,
        currentRoyaltyPercentage: royaltyPercentage.toString(),
        currentRoyaltyRecipient: royaltyRecipient,
        royaltyAmount: royaltyInfo[1].toString()
      });

      // Pre-fill form with current values
      setCollectionData(prev => ({
        ...prev,
        royaltyPercentage: (royaltyPercentage.toNumber() / 100).toString(),
        royaltyRecipient: royaltyRecipient
      }));

      // Check revealed status
      await checkRevealedStatus(contract);

    } catch (error) {
      console.error('Error loading collection info:', error);
      toast.error('Error loading collection info: ' + error.message);
      setCollectionInfo(null);
      setIsRevealed(null);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleUpdateRoyalty = async () => {
    if (!connected || !collectionInfo) {
      toast.error('Please connect your wallet and load collection info first');
      return;
    }

    if (!collectionInfo.isOwner) {
      toast.error('You are not the owner of this collection');
      return;
    }

    const royaltyPercentage = parseFloat(collectionData.royaltyPercentage);
    if (isNaN(royaltyPercentage) || royaltyPercentage < 0 || royaltyPercentage > 10) {
      toast.error('Please enter a valid royalty percentage (0-10%)');
      return;
    }

    if (!collectionData.royaltyRecipient) {
      toast.error('Please enter a royalty recipient address');
      return;
    }

    setLoading(true);
    try {
      const contractType = collectionData.type === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
      const contract = getContractInstance(collectionData.address, contractType);
      
      if (!contract) {
        throw new Error('Failed to create contract instance');
      }

      // Convert percentage to basis points (multiply by 100)
      const royaltyBasisPoints = Math.floor(royaltyPercentage * 100);

      const result = await executeTransaction(
        contract.setRoyalty,
        royaltyBasisPoints,
        collectionData.royaltyRecipient
      );

      if (result.success) {
        toast.success(`Royalty updated successfully! Transaction: ${result.hash}`);
        // Reload collection info to show updated values
        await loadCollectionInfo();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error updating royalty:', error);
      toast.error('Error updating royalty: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Reveal handler
  const handleReveal = async () => {
    if (!connected || !collectionInfo) {
      toast.error('Please connect your wallet and load collection info first');
      return;
    }
    setRevealing(true);
    try {
      const contractType = collectionData.type === 'erc721' ? 'erc721Prize' : 'erc1155Prize';
      const contract = getContractInstance(collectionData.address, contractType);
      if (!contract) throw new Error('Failed to create contract instance');
      const result = await executeTransaction(contract.reveal);
      if (result.success) {
        toast.success('Collection revealed successfully!');
        await loadCollectionInfo();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Error revealing collection: ' + (error.message || error));
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="space-y-6">{/* Simplified container - card wrapper handled by DashboardCard */}
        {/* Collection Lookup Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Collection Address</label>
            <div className="flex gap-2">
              <ResponsiveAddressInput
                value={collectionData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="0x..."
                className="flex-1"
              />
              <button
                onClick={loadCollectionInfo}
                disabled={loadingInfo || !connected}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title={!connected ? "Please connect your wallet" : !collectionData.address ? "Please enter a collection address" : "Load collection information"}
              >
                <Search className="h-4 w-4" />
                {loadingInfo ? 'Loading...' : 'Load Info'}
              </button>
            </div>
          </div>
        </div>

        {/* Collection Info Display */}
        {collectionInfo && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-3">Collection Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Name:</span> {collectionInfo.name}
              </div>
              <div>
                <span className="font-medium">Symbol:</span> {collectionInfo.symbol}
              </div>
              <div>
                <span className="font-medium">Type:</span> {collectionInfo.type.toUpperCase()}
              </div>
              <div>
                <span className="font-medium">Owner:</span> {collectionInfo.isOwner ? 'You' : 'Other'}
              </div>
              <div>
                <span className="font-medium">Current Royalty:</span> {(parseInt(collectionInfo.currentRoyaltyPercentage) / 100).toFixed(2)}%
              </div>
              <div>
                <span className="font-medium">Revealed:</span> {isRevealed === null ? 'Unknown' : isRevealed ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-sm">
                <div className="mb-1">
                  <span className="font-medium">Address:</span>
                </div>
                <div className="font-mono text-xs break-all bg-background p-2 rounded border">
                  {collectionInfo.address}
                </div>
              </div>
              <div className="text-sm mt-2">
                <div className="mb-1">
                  <span className="font-medium">Royalty Recipient:</span>
                </div>
                <div className="font-mono text-xs break-all bg-background p-2 rounded border">
                  {collectionInfo.currentRoyaltyRecipient}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Reveal Status:</span>
                <span className="text-sm font-semibold">
                  {isRevealed === null ? 'Unknown' : isRevealed ? 'Revealed' : 'Not Revealed'}
                </span>
                <button
                  onClick={handleReveal}
                  disabled={revealing || isRevealed || !collectionInfo.isOwner}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
                  title={!collectionInfo.isOwner ? "Only collection owner can reveal" : isRevealed ? "Collection already revealed" : "Reveal collection"}
                >
                  {revealing ? 'Revealing...' : 'Reveal Collection'}
                </button>
              </div>
            </div>
            
            {!collectionInfo.isOwner && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  You are not the owner of this collection and cannot modify royalties.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Royalty Update Form */}
        {collectionInfo && collectionInfo.isOwner && (
          <div className="space-y-4">
            <h4 className="font-semibold">Update Royalty Settings</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  New Royalty Percentage (%)
                </label>
                <ResponsiveNumberInput
                  min="0"
                  step="0.01"
                  value={collectionData.royaltyPercentage}
                  onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                  placeholder="2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  New Royalty Recipient
                </label>
                <ResponsiveAddressInput
                  value={collectionData.royaltyRecipient}
                  onChange={(e) => handleChange('royaltyRecipient', e.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>

            <button
              onClick={handleUpdateRoyalty}
              disabled={loading || !connected || !collectionInfo || !collectionInfo.isOwner}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              title={!connected ? "Please connect your wallet" : !collectionInfo ? "Please load collection info first" : !collectionInfo.isOwner ? "Only collection owner can update royalties" : !collectionData.royaltyPercentage || !collectionData.royaltyRecipient ? "Please fill in all required fields" : "Update royalty settings"}
            >
              <Settings className="h-4 w-4" />
              {loading ? 'Updating...' : 'Update Royalty Settings'}
            </button>
          </div>
        )}

        {!connected && (
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-muted-foreground">
              Please connect your wallet to manage collection royalties.
            </p>
          </div>
        )}
    </div>
  );
};

export default RoyaltyAdjustmentComponent;

