import React, { useState, useEffect } from 'react';
import { Plus, Package, AlertCircle, Gift, Coins } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { toast } from '../components/ui/sonner';
import { contractABIs } from '../contracts/contractABIs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';

// --- ERC1155DropForm ---
function ERC1155DropForm() {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionAddress: '',
    tokenId: '',
    unitsPerWinner: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    ticketPrice: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      // Step 1: Approve token
      const approvalResult = await approveToken({
        signer,
        tokenAddress: formData.collectionAddress,
        prizeType: 'erc1155',
        spender: contracts.raffleDeployer.address
      });
      if (!approvalResult.success) {
        toast.error('Token approval failed: ' + approvalResult.error);
        setLoading(false);
        return;
      }
      if (!approvalResult.alreadyApproved) {
        toast.success('ERC1155 approval successful!');
        await new Promise(res => setTimeout(res, 2000));
      }
      // Step 2: Create raffle
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ticketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const unitsPerWinner = formData.unitsPerWinner ? parseInt(formData.unitsPerWinner) : 1;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ticketPrice,
        erc721Drop: false,
        prizeCollection: formData.collectionAddress,
        standard: 1, // ERC1155
        prizeTokenId: parseInt(formData.tokenId),
        amountPerWinner: unitsPerWinner,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('ERC1155 Collection raffle created successfully!');
        setFormData({
          name: '',
          collectionAddress: '',
          tokenId: '',
          unitsPerWinner: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          ticketPrice: '',
        });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create ERC1155 Collection Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collectionAddress || ''}
              onChange={e => handleChange('collectionAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              min="0"
              value={formData.tokenId || ''}
              onChange={e => handleChange('tokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Units Per Winner</label>
            <input
              type="number"
              min="1"
              value={formData.unitsPerWinner || ''}
              onChange={e => handleChange('unitsPerWinner', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH)</label>
          <input
            type="number"
            min="0.00000001"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- PrizedRaffleForm ---
const PrizedRaffleForm = () => {
  const { connected, address, provider } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  // Add token-gated state
  const [tokenGatedEnabled, setTokenGatedEnabled] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    customTicketPrice: '',
    prizeSource: 'new',
    prizeCollection: '',
    prizeType: 'erc721',
    prizeTokenId: '',
    amountPerWinner: '1',
    useMintableWorkflow: false,
    isEscrowed: false,
    // New collection fields
    collectionName: '',
    collectionSymbol: '',
    baseURI: '',
    maxSupply: '',
    royaltyPercentage: '',
    // Token-gated fields
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const customTicketPrice = formData.customTicketPrice ? 
        ethers.utils.parseEther(formData.customTicketPrice) : 0;
      let result;
      let params;
      // Token-gated logic
      const holderTokenAddress = tokenGatedEnabled && formData.holderTokenAddress ? formData.holderTokenAddress : ethers.constants.AddressZero;
      const holderTokenStandard = tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0;
      const minHolderBalance = tokenGatedEnabled && formData.minHolderBalance ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0;
      const holderTokenId = tokenGatedEnabled && formData.holderTokenId ? parseInt(formData.holderTokenId) : 0;
      if (formData.prizeSource === 'new') {
        // New ERC721 collection
        params = {
          name: formData.name,
          startTime,
          duration,
          ticketLimit: parseInt(formData.ticketLimit),
          winnersCount: parseInt(formData.winnersCount),
          maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
          isPrized: true,
          customTicketPrice: customTicketPrice,
          erc721Drop: false,
          prizeCollection: ethers.constants.AddressZero,
          standard: 0, // ERC721
          prizeTokenId: 0,
          amountPerWinner: 1,
          collectionName: formData.collectionName,
          collectionSymbol: formData.collectionSymbol,
          collectionBaseURI: formData.baseURI,
          creator: address,
          royaltyPercentage: parseInt(formData.royaltyPercentage || '0'),
          royaltyRecipient: ethers.constants.AddressZero,
          maxSupply: parseInt(formData.maxSupply || formData.winnersCount),
          erc20PrizeToken: ethers.constants.AddressZero,
          erc20PrizeAmount: 0,
          ethPrizeAmount: 0,
          revealType: 0,
          unrevealedBaseURI: '',
          revealTime: 0,
          // Token-gated params
          holderTokenAddress,
          holderTokenStandard,
          minHolderBalance,
          holderTokenId,
        };
      } else {
        // Existing collection (ERC721 or ERC1155)
        const standard = formData.prizeType === 'erc721' ? 0 : 1;
        params = {
          name: formData.name,
          startTime,
          duration,
          ticketLimit: parseInt(formData.ticketLimit),
          winnersCount: parseInt(formData.winnersCount),
          maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
          isPrized: true,
          customTicketPrice: customTicketPrice,
          erc721Drop: formData.useMintableWorkflow,
          prizeCollection: formData.prizeCollection,
          standard: standard,
          prizeTokenId: formData.useMintableWorkflow ? 0 : parseInt(formData.prizeTokenId),
          amountPerWinner: parseInt(formData.amountPerWinner),
          collectionName: '',
          collectionSymbol: '',
          collectionBaseURI: '',
          creator: address,
          royaltyPercentage: 0,
          royaltyRecipient: ethers.constants.AddressZero,
          maxSupply: 0,
          erc20PrizeToken: ethers.constants.AddressZero,
          erc20PrizeAmount: 0,
          ethPrizeAmount: 0,
          revealType: 0,
          unrevealedBaseURI: '',
          revealTime: 0,
          // Token-gated params
          holderTokenAddress,
          holderTokenStandard,
          minHolderBalance,
          holderTokenId,
        };
      }
      result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('Prized raffle created successfully!');
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          customTicketPrice: '',
          prizeSource: 'new',
          prizeCollection: '',
          prizeType: 'erc721',
          prizeTokenId: '',
          amountPerWinner: '1',
          useMintableWorkflow: false,
          isEscrowed: false,
          collectionName: '',
          collectionSymbol: '',
          baseURI: '',
          maxSupply: '',
          royaltyPercentage: '',
          holderTokenAddress: '',
          holderTokenStandard: '0',
          minHolderBalance: '',
          holderTokenId: '',
        });
        setTokenGatedEnabled(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Prized Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Custom Ticket Price */}
        <div>
          <label className="block text-base font-medium mb-2">Custom Ticket Price (ETH)</label>
          <input
            type="number"
            step="0.001"
            value={formData.customTicketPrice || ''}
            onChange={(e) => handleChange('customTicketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            placeholder="Leave empty to use protocol default"
          />
        </div>

        {/* Prize Configuration */}
        <div className="space-y-4">
          <h4 className="font-semibold text-base">Prize Configuration</h4>
          
          <div>
            <label className="block text-base font-medium mb-3">Prize Source</label>
            <div className="flex gap-5">
              <label className="flex items-center gap-2 text-base">
                <input
                  type="radio"
                  name="prizeSource"
                  value="new"
                  checked={formData.prizeSource === 'new'}
                  onChange={(e) => handleChange('prizeSource', e.target.value)}
                  className="w-4 h-4"
                />
                <span>Create New Collection</span>
              </label>
              <label className="flex items-center gap-2 text-base">
                <input
                  type="radio"
                  name="prizeSource"
                  value="existing"
                  checked={formData.prizeSource === 'existing'}
                  onChange={(e) => handleChange('prizeSource', e.target.value)}
                  className="w-4 h-4"
                />
                <span>Use Existing Collection</span>
              </label>
            </div>
          </div>

          {formData.prizeSource === 'new' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl">
              <div>
                <label className="block text-base font-medium mb-2">Collection Name</label>
                <input
                  type="text"
                  value={formData.collectionName || ''}
                  onChange={(e) => handleChange('collectionName', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Collection Symbol</label>
                <input
                  type="text"
                  value={formData.collectionSymbol || ''}
                  onChange={(e) => handleChange('collectionSymbol', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Base URI</label>
                <input
                  type="url"
                  value={formData.baseURI || ''}
                  onChange={(e) => handleChange('baseURI', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Max Supply</label>
                <input
                  type="number"
                  value={formData.maxSupply || ''}
                  onChange={(e) => handleChange('maxSupply', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Royalty Percentage</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.royaltyPercentage || ''}
                  onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="0-10%"
                />
              </div>
            </div>
          )}

          {formData.prizeSource === 'existing' && (
            <div className="space-y-4 p-4 bg-muted/20 rounded-xl">
              <div>
                <label className="block text-base font-medium mb-2">Prize Collection Address</label>
                <input
                  type="text"
                  value={formData.prizeCollection || ''}
                  onChange={(e) => handleChange('prizeCollection', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="0x..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-3">Prize Type</label>
                <div className="flex gap-5">
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="prizeType"
                      value="erc721"
                      checked={formData.prizeType === 'erc721'}
                      onChange={(e) => handleChange('prizeType', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>ERC721</span>
                  </label>
                  <label className="flex items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="prizeType"
                      value="erc1155"
                      checked={formData.prizeType === 'erc1155'}
                      onChange={(e) => handleChange('prizeType', e.target.value)}
                      className="w-4 h-4"
                    />
                    <span>ERC1155</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useMintableWorkflow"
                  checked={formData.useMintableWorkflow}
                  onChange={(e) => handleChange('useMintableWorkflow', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="useMintableWorkflow" className="text-base font-medium">
                  Use Mintable Workflow
                </label>
              </div>

              {!formData.useMintableWorkflow && (
                <div>
                  <label className="block text-base font-medium mb-2">Token ID</label>
                  <input
                    type="number"
                    value={formData.prizeTokenId || ''}
                    onChange={(e) => handleChange('prizeTokenId', e.target.value)}
                    className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                    required
                  />
                </div>
              )}
              
              <div>
                <label className="block text-base font-medium mb-2">Amount Per Winner</label>
                <input
                  type="number"
                  value={formData.amountPerWinner || ''}
                  onChange={(e) => handleChange('amountPerWinner', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={tokenGatedEnabled}
            onCheckedChange={e => setTokenGatedEnabled(e)}
          />
        </div>
        {/* Token-Gated Fields */}
        {tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const NonPrizedRaffleForm = () => {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }

    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds

      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: false,
        customTicketPrice: 0,
        erc721Drop: false,
        erc1155Drop: false,
        prizeCollection: ethers.constants.AddressZero,
        standard: 0,
        prizeTokenId: 0,
        amountPerWinner: 0,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0
      };
      const result = await executeTransaction(
        contracts.raffleDeployer.createRaffle,
        params
      );

      if (result.success) {
        toast.success('Non-prized raffle created successfully!');
        // Reset form
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Non-Prized Raffle</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const WhitelistRaffleForm = () => {
  const { connected, address } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const limits = useRaffleLimits(contracts, false);
  const [loading, setLoading] = useState(false);
  // Add token-gated state
  const [tokenGatedEnabled, setTokenGatedEnabled] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    // Token-gated fields
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      // Token-gated logic
      const holderTokenAddress = tokenGatedEnabled && formData.holderTokenAddress ? formData.holderTokenAddress : ethers.constants.AddressZero;
      const holderTokenStandard = tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0;
      const minHolderBalance = tokenGatedEnabled && formData.minHolderBalance ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0;
      const holderTokenId = tokenGatedEnabled && formData.holderTokenId ? parseInt(formData.holderTokenId) : 0;
      // All prize params are zero/empty for whitelist raffle
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: 1, // Hardcoded to 1 for whitelist raffle
        isPrized: false,
        customTicketPrice: 0,
        erc721Drop: false,
        prizeCollection: ethers.constants.AddressZero,
        standard: 0,
        prizeTokenId: 0,
        amountPerWinner: 0,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        // Token-gated params
        holderTokenAddress,
        holderTokenStandard,
        minHolderBalance,
        holderTokenId,
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('Whitelist raffle created successfully!');
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          holderTokenAddress: '',
          holderTokenStandard: '0',
          minHolderBalance: '',
          holderTokenId: '',
        });
        setTokenGatedEnabled(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Whitelist Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={tokenGatedEnabled}
            onCheckedChange={e => setTokenGatedEnabled(e)}
          />
        </div>
        {/* Token-Gated Fields */}
        {tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
};

const NewERC721DropForm = () => {
  const { connected, address, provider } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    customTicketPrice: '',
    collectionName: '',
    collectionSymbol: '',
    baseURI: '',
    maxSupply: '',
    royaltyPercentage: '',
    // Reveal feature fields
    revealType: '0', // 0 = Instant, 1 = Manual, 2 = Scheduled
    unrevealedBaseURI: '',
    revealTime: '',
    royaltyRecipient: address || '',
    // 1. Add tokenGatedEnabled and token-gated fields to form state
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  useEffect(() => {
    if (address && !formData.royaltyRecipient) {
      setFormData(prev => ({ ...prev, royaltyRecipient: address }));
    }
    // eslint-disable-next-line
  }, [address]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const customTicketPrice = formData.customTicketPrice ? 
        ethers.utils.parseEther(formData.customTicketPrice) : 0;
      let revealType = parseInt(formData.revealType);
      let unrevealedBaseURI = formData.unrevealedBaseURI;
      let revealTime = 0;
      if (revealType === 2) {
        // Scheduled
        revealTime = Math.floor(new Date(formData.revealTime).getTime() / 1000);
      }
      if (revealType !== 2) {
        unrevealedBaseURI = '';
        revealTime = 0;
      }
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: customTicketPrice,
        erc721Drop: false,
        erc1155Drop: false,
        prizeCollection: ethers.constants.AddressZero,
        standard: 0, // ERC721
        prizeTokenId: 0,
        amountPerWinner: 1,
        collectionName: formData.collectionName,
        collectionSymbol: formData.collectionSymbol,
        collectionBaseURI: formData.baseURI,
        creator: address,
        royaltyPercentage: formData.royaltyPercentage ? parseInt(formData.royaltyPercentage) * 100 : 0, // percent to bps
        royaltyRecipient: formData.royaltyRecipient,
        maxSupply: parseInt(formData.maxSupply || formData.winnersCount),
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        // Reveal feature
        revealType: revealType,
        unrevealedBaseURI: unrevealedBaseURI,
        revealTime: revealTime,
        // 2. Add token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('ERC721 Collection raffle created successfully!');
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          customTicketPrice: '',
          collectionName: '',
          collectionSymbol: '',
          baseURI: '',
          maxSupply: '',
          royaltyPercentage: '',
          revealType: '0',
          unrevealedBaseURI: '',
          revealTime: '',
          royaltyRecipient: address || '',
          tokenGatedEnabled: false,
          holderTokenAddress: '',
          holderTokenStandard: '0',
          minHolderBalance: '',
          holderTokenId: '',
        });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create New ERC721 Collection Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Custom Ticket Price (ETH)</label>
            <input
              type="number"
              step="0.001"
              value={formData.customTicketPrice || ''}
              onChange={(e) => handleChange('customTicketPrice', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              placeholder="Leave empty to use protocol default"
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              value={formData.prizeTokenId || ''}
              onChange={e => handleChange('prizeTokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Amount Per Winner</label>
            <input
              type="number"
              value={formData.amountPerWinner || ''}
              onChange={e => handleChange('amountPerWinner', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        {/* Inner card for collection info */}
        <div className="bg-muted/20 border border-border rounded-xl p-4 mt-4">
          <h4 className="font-semibold text-base mb-4">NFT Collection Info</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium mb-2">Collection Name</label>
              <input
                type="text"
                value={formData.collectionName || ''}
                onChange={(e) => handleChange('collectionName', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Collection Symbol</label>
              <input
                type="text"
                value={formData.collectionSymbol || ''}
                onChange={(e) => handleChange('collectionSymbol', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Base URI</label>
              <input
                type="url"
                value={formData.baseURI || ''}
                onChange={(e) => handleChange('baseURI', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Max Supply</label>
              <input
                type="number"
                value={formData.maxSupply || ''}
                onChange={(e) => handleChange('maxSupply', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Royalty Percentage (%)</label>
              <input
                type="number"
                value={formData.royaltyPercentage || ''}
                onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                min="0"
                max="10"
                step="0.01"
                placeholder="e.g. 5 for 5%"
              />
              <span className="text-xs text-muted-foreground">Enter as a percentage (e.g. 5 for 5%)</span>
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Royalty Recipient</label>
              <input
                type="text"
                value={formData.royaltyRecipient || ''}
                onChange={e => handleChange('royaltyRecipient', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
                pattern="^0x[a-fA-F0-9]{40}$"
              />
              <span className="text-xs text-muted-foreground">Must be a valid Ethereum address</span>
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Reveal Type</label>
              <Select
                value={formData.revealType}
                onValueChange={value => handleChange('revealType', value)}
                required
              >
                <SelectTrigger className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background">
                  <SelectValue placeholder="Select Reveal Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Instant Reveal</SelectItem>
                  <SelectItem value="1">Manual Reveal</SelectItem>
                  <SelectItem value="2">Scheduled Reveal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(formData.revealType === '1' || formData.revealType === '2') && (
              <div>
                <label className="block text-base font-medium mb-2">Unrevealed Base URI</label>
                <input
                  type="url"
                  value={formData.unrevealedBaseURI || ''}
                  onChange={e => handleChange('unrevealedBaseURI', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required={formData.revealType === '1' || formData.revealType === '2'}
                />
              </div>
            )}
            {formData.revealType === '2' && (
              <div>
                <label className="block text-base font-medium mb-2">Reveal Time</label>
                <input
                  type="datetime-local"
                  value={formData.revealTime || ''}
                  onChange={e => handleChange('revealTime', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required={formData.revealType === '2'}
                />
              </div>
            )}
          </div>
        </div>
        {/* 3. Add Switch and conditional rendering of token-gated fields */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={formData.tokenGatedEnabled}
            onCheckedChange={e => handleChange('tokenGatedEnabled', e)}
          />
        </div>
        {formData.tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={formData.tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={formData.tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={formData.tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={formData.tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ExistingERC721DropForm() {
  const { connected, address, provider } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  // Add token-gated state
  const [tokenGatedEnabled, setTokenGatedEnabled] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collection: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerUser: '',
    ticketPrice: '',
    // Token-gated fields
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const customTicketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      // Token-gated logic
      const holderTokenAddress = tokenGatedEnabled && formData.holderTokenAddress ? formData.holderTokenAddress : ethers.constants.AddressZero;
      const holderTokenStandard = tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0;
      const minHolderBalance = tokenGatedEnabled && formData.minHolderBalance ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0;
      const holderTokenId = tokenGatedEnabled && formData.holderTokenId ? parseInt(formData.holderTokenId) : 0;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerUser),
        isPrized: true,
        customTicketPrice: customTicketPrice,
        erc721Drop: true,
        erc1155Drop: false,
        prizeCollection: formData.collection,
        standard: 0, // ERC721
        prizeTokenId: 0,
        amountPerWinner: 1,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        // Token-gated params
        holderTokenAddress,
        holderTokenStandard,
        minHolderBalance,
        holderTokenId,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
      toast.success('Existing ERC721 Collection raffle created successfully!');
      setFormData({
        name: '',
        collection: '',
        startTime: '',
        duration: '',
        ticketLimit: '',
        winnersCount: '',
        maxTicketsPerUser: '',
        ticketPrice: '',
        holderTokenAddress: '',
        holderTokenStandard: '0',
        minHolderBalance: '',
        holderTokenId: '',
      });
      setTokenGatedEnabled(false);
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  // Helper for internal status check
  const { status: internalStatus721, checking: checkingInternal721 } = useInternalCollectionStatus(formData.collection, contracts);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Raffle (Existing ERC721 Prize)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collection || ''}
              onChange={e => handleChange('collection', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
            {formData.collection && !checkingInternal721 && internalStatus721 === true && (
              <span className="text-xs text-green-600">Internal Collection</span>
            )}
            {formData.collection && !checkingInternal721 && internalStatus721 === false && (
              <span className="text-xs text-red-600">Not internal</span>
            )}
            {formData.collection && checkingInternal721 && (
              <span className="text-xs text-muted-foreground">Checking internal status...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              min="1"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              min="1"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per User</label>
            <input
              type="number"
              min="1"
              value={formData.maxTicketsPerUser || ''}
              onChange={e => handleChange('maxTicketsPerUser', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH) <span className="font-normal text-xs text-muted-foreground">(Leave empty for NFT giveaway)</span></label>
          <input
            type="number"
            min="0.00000001"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={tokenGatedEnabled}
            onCheckedChange={e => setTokenGatedEnabled(e)}
          />
        </div>
        {/* Token-Gated Fields */}
        {tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            Create Raffle
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- Existing ERC1155 Collection Drop Form ---
function ExistingERC1155DropForm() {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionAddress: '',
    tokenId: '',
    amountPerWinner: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    ticketPrice: '',
    // Token-gated fields
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const customTicketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: customTicketPrice,
        erc721Drop: false,
        erc1155Drop: true,
        prizeCollection: formData.collectionAddress,
        standard: 1, // ERC1155
        prizeTokenId: parseInt(formData.tokenId),
        amountPerWinner: parseInt(formData.amountPerWinner),
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
      toast.success('Existing ERC1155 Collection raffle created successfully!');
      setFormData({
        name: '',
        collectionAddress: '',
        tokenId: '',
        amountPerWinner: '',
        startTime: '',
        duration: '',
        ticketLimit: '',
        winnersCount: '',
        maxTicketsPerParticipant: '',
        ticketPrice: '',
        tokenGatedEnabled: false,
        holderTokenAddress: '',
        holderTokenStandard: '0',
        minHolderBalance: '',
        holderTokenId: '',
      });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(error.message || 'Error creating raffle');
    } finally {
      setLoading(false);
    }
  };

  // Helper for internal status check
  const { status: internalStatus1155, checking: checkingInternal1155 } = useInternalCollectionStatus(formData.collectionAddress, contracts);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Raffle (Existing ERC1155 Collection)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collectionAddress || ''}
              onChange={e => handleChange('collectionAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
            {formData.collectionAddress && !checkingInternal1155 && internalStatus1155 === true && (
              <span className="text-xs text-green-600">Internal Collection</span>
            )}
            {formData.collectionAddress && !checkingInternal1155 && internalStatus1155 === false && (
              <span className="text-xs text-red-600">Not internal</span>
            )}
            {formData.collectionAddress && checkingInternal1155 && (
              <span className="text-xs text-muted-foreground">Checking internal status...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              min="0"
              value={formData.tokenId || ''}
              onChange={e => handleChange('tokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Amount Per Winner</label>
            <input
              type="number"
              min="1"
              value={formData.amountPerWinner || ''}
              onChange={e => handleChange('amountPerWinner', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winners Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Custom Ticket Price (ETH)</label>
            <input
              type="number"
              step="0.001"
              value={formData.ticketPrice || ''}
              onChange={e => handleChange('ticketPrice', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              placeholder="Leave empty to use protocol default"
            />
          </div>
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={formData.tokenGatedEnabled}
            onCheckedChange={e => handleChange('tokenGatedEnabled', e)}
          />
        </div>
        {formData.tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={formData.tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={formData.tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={formData.tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={formData.tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// --- Update FILTERS ---
const FILTERS = {
  raffleType: ['Whitelist/Allowlist', 'NFTDrop', 'Lucky Sale/NFT Giveaway', 'ETH Giveaway', 'ERC20 Token Giveaway'],
  nftStandard: ['ERC721', 'ERC1155'],
  erc721Source: ['New ERC721 Collection', 'Existing ERC721 Collection'],
  escrowedSource: ['Internal NFT Prize', 'External NFT Prize'],
  luckySaleSource: ['Internal NFT Prize', 'External NFT Prize'],
  erc1155Source: ['New ERC1155 Collection', 'Existing ERC1155 Collection'],
};

const CreateRafflePage = () => {
  const { connected } = useWallet();
  const { contracts } = useContract();
  const [allowExisting721, setAllowExisting721] = useState(null);

  // Filter state
  const [raffleType, setRaffleType] = useState('Whitelist/Allowlist');
  const [nftStandard, setNftStandard] = useState('ERC721');
  const [erc721Source, setErc721Source] = useState('New ERC721 Collection');
  const [erc721EscrowedSource, setErc721EscrowedSource] = useState('Internal NFT Prize');
  const [erc1155EscrowedSource, setErc1155EscrowedSource] = useState('Internal NFT Prize');
  const [luckySaleSource, setLuckySaleSource] = useState('Internal NFT Prize');
  const [erc1155Source, setErc1155Source] = useState('New ERC1155 Collection');
  // Track collection address for existing ERC721
  const [existingCollectionAddress, setExistingCollectionAddress] = useState('');

  // Query allowExisting721 if needed
  useEffect(() => {
    const fetchAllowExisting = async () => {
      if (raffleType === 'NFTDrop' && nftStandard === 'ERC721' && erc721Source === 'Existing ERC721 Collection' && contracts.raffleManager) {
        try {
          const allowed = await contracts.raffleManager.toggleAllowExistingCollection();
          setAllowExisting721(!!allowed);
        } catch (e) {
          setAllowExisting721(false);
        }
      }
    };
    fetchAllowExisting();
  }, [raffleType, nftStandard, erc721Source, contracts.raffleManager]);

  // Reset collection address when switching to New ERC721 Collection
  useEffect(() => {
    if (raffleType === 'NFTDrop' && nftStandard === 'ERC721' && erc721Source === 'New ERC721 Collection') {
      setExistingCollectionAddress('');
    }
  }, [raffleType, nftStandard, erc721Source]);

  // --- Dropdown Filter Card UI ---
  const renderFilterCard = () => (
    <div className="flex flex-col gap-4 p-6 bg-card border border-border rounded-xl min-h-0">
      {/* Raffle Type */}
      <div className="flex flex-col gap-2">
        <label className="font-semibold text-sm whitespace-nowrap">Raffle Type</label>
        <select
          className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
          value={raffleType}
          onChange={e => setRaffleType(e.target.value)}
        >
          {FILTERS.raffleType.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      {/* NFTDrop subfilters */}
      {raffleType === 'NFTDrop' && (
        <>
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-sm whitespace-nowrap">NFT Standard</label>
            <select
              className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
              value={nftStandard}
              onChange={e => setNftStandard(e.target.value)}
            >
              {FILTERS.nftStandard.map(std => (
                <option key={std} value={std}>{std}</option>
              ))}
            </select>
          </div>
          {nftStandard === 'ERC721' && (
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-sm whitespace-nowrap">ERC721 Source</label>
              <select
                className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
                value={erc721Source}
                onChange={e => setErc721Source(e.target.value)}
              >
                {FILTERS.erc721Source.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>
          )}
          {nftStandard === 'ERC1155' && (
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-sm whitespace-nowrap">ERC1155 Source</label>
              <select
                className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
                value={erc1155Source}
                onChange={e => setErc1155Source(e.target.value)}
              >
                {FILTERS.erc1155Source.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
      {/* Lucky Sale subfilters */}
      {raffleType === 'Lucky Sale/NFT Giveaway' && (
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm whitespace-nowrap">NFT Standard</label>
          <select
            className="px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
            value={nftStandard}
            onChange={e => setNftStandard(e.target.value)}
          >
            {FILTERS.nftStandard.map(std => (
              <option key={std} value={std}>{std}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  // --- Main Form Rendering Logic ---
  const renderForm = () => {
    if (raffleType === 'Whitelist/Allowlist') return <WhitelistRaffleForm />;
    if (raffleType === 'NFTDrop') {
      if (nftStandard === 'ERC721') {
        if (erc721Source === 'New ERC721 Collection') return <NewERC721DropForm />;
        if (erc721Source === 'Existing ERC721 Collection') return <ExistingERC721DropForm collectionAddress={existingCollectionAddress} setCollectionAddress={setExistingCollectionAddress} />;
      }
      if (nftStandard === 'ERC1155') {
        if (erc1155Source === 'New ERC1155 Collection') return <NewERC1155DropForm />;
        if (erc1155Source === 'Existing ERC1155 Collection') return <ExistingERC1155DropForm />;
        // Escrowed ERC1155 can be handled later
      }
    }
    if (raffleType === 'Lucky Sale/NFT Giveaway') {
      if (nftStandard === 'ERC721') return <LuckySaleERC721Form />;
      if (nftStandard === 'ERC1155') return <LuckySaleERC1155Form />;
    }
    if (raffleType === 'ETH Giveaway') return <ETHGiveawayForm />;
    if (raffleType === 'ERC20 Token Giveaway') return <ERC20GiveawayForm />;
    return null;
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Plus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">Please connect your wallet to create raffles and deploy collections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6 pb-16">
      <div className="container mx-auto px-8">
        <div className="mb-4 text-center">
          <h1 className="text-4xl font-bold mb-4">
            Create an on-chain raffle for your community
          </h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[315px_1fr] gap-8 max-w-7xl mx-auto mt-16">
          <div className="lg:col-span-1 flex flex-col gap-6 items-start">
            <div className="w-full max-w-[315px]">
            {renderFilterCard()}
            </div>
          </div>
          <div className="lg:col-span-1">
            {renderForm()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add LuckySaleERC721Form
function LuckySaleERC721Form() {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionAddress: '',
    tokenId: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    ticketPrice: '',
    // Token-gated fields
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      // Step 1: Approve token
      const approvalResult = await approveToken({
        signer,
        tokenAddress: formData.collectionAddress,
        prizeType: 'erc721',
        spender: contracts.raffleDeployer.address,
        tokenId: formData.tokenId
      });
      if (!approvalResult.success) {
        toast.error('Token approval failed: ' + approvalResult.error);
        setLoading(false);
        return;
      }
      if (!approvalResult.alreadyApproved) {
        toast.success('ERC721 approval successful!');
        await new Promise(res => setTimeout(res, 2000));
      }
      // Step 2: Create raffle
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ticketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ticketPrice,
        erc721Drop: false,
        prizeCollection: formData.collectionAddress,
        standard: 0, // ERC721
        prizeTokenId: parseInt(formData.tokenId),
        amountPerWinner: 1,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('Lucky Sale ERC721 raffle created successfully!');
        setFormData({
          name: '',
          collectionAddress: '',
          tokenId: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          ticketPrice: '',
          tokenGatedEnabled: false,
          holderTokenAddress: '',
          holderTokenStandard: '0',
          minHolderBalance: '',
          holderTokenId: '',
        });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  // Helper for whitelist status check
  const { status: whitelistStatusLucky721, checking: checkingWhitelistLucky721 } = useCollectionWhitelistStatus(formData.collectionAddress, contracts);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Lucky Sale (ERC721 Escrowed Prize)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collectionAddress || ''}
              onChange={e => handleChange('collectionAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
            {formData.collectionAddress && !checkingWhitelistLucky721 && whitelistStatusLucky721 === true && (
              <span className="text-xs text-green-600">Whitelisted</span>
            )}
            {formData.collectionAddress && !checkingWhitelistLucky721 && whitelistStatusLucky721 === false && (
              <span className="text-xs text-red-600">Not whitelisted</span>
            )}
            {formData.collectionAddress && checkingWhitelistLucky721 && (
              <span className="text-xs text-muted-foreground">Checking whitelist status...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              min="0"
              value={formData.tokenId || ''}
              onChange={e => handleChange('tokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH) <span className="font-normal text-xs text-muted-foreground">(Leave empty for NFT giveaway)</span></label>
          <input
            type="number"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={formData.tokenGatedEnabled}
            onCheckedChange={e => handleChange('tokenGatedEnabled', e)}
          />
        </div>
        {formData.tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={formData.tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={formData.tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={formData.tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={formData.tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Add LuckySaleERC1155Form (like ERC1155DropForm but no deploy button)
function LuckySaleERC1155Form() {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionAddress: '',
    tokenId: '',
    unitsPerWinner: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    ticketPrice: '',
    // Token-gated fields
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      // Step 1: Approve token
      const approvalResult = await approveToken({
        signer,
        tokenAddress: formData.collectionAddress,
        prizeType: 'erc1155',
        spender: contracts.raffleDeployer.address
      });
      if (!approvalResult.success) {
        toast.error('Token approval failed: ' + approvalResult.error);
        setLoading(false);
        return;
      }
      if (!approvalResult.alreadyApproved) {
        toast.success('ERC1155 approval successful!');
        await new Promise(res => setTimeout(res, 2000));
      }
      // Step 2: Create raffle
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ticketPrice = formData.ticketPrice ? ethers.utils.parseEther(formData.ticketPrice) : 0;
      const unitsPerWinner = formData.unitsPerWinner ? parseInt(formData.unitsPerWinner) : 1;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ticketPrice,
        erc721Drop: false,
        prizeCollection: formData.collectionAddress,
        standard: 1, // ERC1155
        prizeTokenId: parseInt(formData.tokenId),
        amountPerWinner: unitsPerWinner,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('Lucky Sale ERC1155 raffle created successfully!');
        setFormData({
          name: '',
          collectionAddress: '',
          tokenId: '',
          unitsPerWinner: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          ticketPrice: '',
          tokenGatedEnabled: false,
          holderTokenAddress: '',
          holderTokenStandard: '0',
          minHolderBalance: '',
          holderTokenId: '',
        });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  // Helper for whitelist status check
  const { status: whitelistStatusLucky1155, checking: checkingWhitelistLucky1155 } = useCollectionWhitelistStatus(formData.collectionAddress, contracts);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create Lucky Sale (ERC1155 Escrowed Prize)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Collection Address</label>
            <input
              type="text"
              value={formData.collectionAddress || ''}
              onChange={e => handleChange('collectionAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
            {formData.collectionAddress && !checkingWhitelistLucky1155 && whitelistStatusLucky1155 === true && (
              <span className="text-xs text-green-600">Whitelisted</span>
            )}
            {formData.collectionAddress && !checkingWhitelistLucky1155 && whitelistStatusLucky1155 === false && (
              <span className="text-xs text-red-600">Not whitelisted</span>
            )}
            {formData.collectionAddress && checkingWhitelistLucky1155 && (
              <span className="text-xs text-muted-foreground">Checking whitelist status...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              min="0"
              value={formData.tokenId || ''}
              onChange={e => handleChange('tokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Units Per Winner</label>
            <input
              type="number"
              min="1"
              value={formData.unitsPerWinner || ''}
              onChange={e => handleChange('unitsPerWinner', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Ticket Price (ETH) <span className="font-normal text-xs text-muted-foreground">(Leave empty for NFT giveaway)</span></label>
          <input
            type="number"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={formData.tokenGatedEnabled}
            onCheckedChange={e => handleChange('tokenGatedEnabled', e)}
          />
        </div>
        {formData.tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={formData.tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={formData.tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={formData.tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={formData.tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Add ETHGiveawayForm
function ETHGiveawayForm() {
  const { connected, address, provider } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ethAmount: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    // Token-gated fields
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const ethAmount = formData.ethAmount ? ethers.utils.parseEther(formData.ethAmount) : 0;
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: 0,
        erc721Drop: false,
        prizeCollection: ethers.constants.AddressZero, // Use zero address for ETH
        standard: 3, // Use 3 for ETH
        prizeTokenId: 0,
        amountPerWinner: 0,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: ethers.BigNumber.from(0),
        ethPrizeAmount: ethAmount,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled ? parseInt(formData.holderTokenId) : 0,
      };
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params, { value: ethAmount });
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('ETH Giveaway raffle created successfully!');
        setFormData({
          name: '',
          ethAmount: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Feeling Generous? Now's a great time to give away some ETH!</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Total ETH Prize</label>
            <input
              type="number"
              min="0.00000001"
              step="any"
              value={formData.ethAmount || ''}
              onChange={e => handleChange('ethAmount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={formData.tokenGatedEnabled}
            onCheckedChange={e => handleChange('tokenGatedEnabled', e)}
          />
        </div>
        {formData.tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={formData.tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={formData.tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={formData.tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={formData.tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Add ERC20GiveawayForm
function ERC20GiveawayForm() {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tokenAddress: '',
    tokenAmount: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    // Token-gated fields
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });
  const [whitelistStatus, setWhitelistStatus] = useState(null); // null | true | false
  const [checkingWhitelist, setCheckingWhitelist] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkWhitelist(addr) {
      if (!contracts?.raffleManager || !addr || addr.length !== 42) {
        setWhitelistStatus(null);
        return;
      }
      setCheckingWhitelist(true);
      try {
        const isWhitelisted = await contracts.raffleManager.isERC20PrizeWhitelisted(addr);
        if (!cancelled) setWhitelistStatus(isWhitelisted);
      } catch {
        if (!cancelled) setWhitelistStatus(false);
      } finally {
        if (!cancelled) setCheckingWhitelist(false);
      }
    }
    checkWhitelist(formData.tokenAddress);
    return () => { cancelled = true; };
  }, [formData.tokenAddress, contracts]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      // Step 1: Approve token
      const approvalResult = await approveToken({
        signer,
        tokenAddress: formData.tokenAddress,
        prizeType: 'erc20',
        spender: contracts.raffleDeployer.address,
        amount: formData.tokenAmount
      });
      if (!approvalResult.success) {
        toast.error('Token approval failed: ' + approvalResult.error);
        setLoading(false);
        return;
      }
      if (!approvalResult.alreadyApproved) {
        toast.success('ERC20 approval successful!');
        await new Promise(res => setTimeout(res, 2000));
      }
      // Step 2: Create raffle
      const decimals = await (new ethers.Contract(formData.tokenAddress, contractABIs.erc20, signer)).decimals();
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60;
      const tokenAmount = formData.tokenAmount ? ethers.utils.parseUnits(formData.tokenAmount, decimals) : ethers.BigNumber.from(0); // default 18 decimals
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: ethers.BigNumber.from(0),
        erc721Drop: false,
        prizeCollection: ethers.constants.AddressZero, // Use zero address for ERC20
        standard: 2, // Use 2 for ERC20
        prizeTokenId: 0,
        amountPerWinner: 0,
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: '',
        creator: address,
        royaltyPercentage: 0,
        royaltyRecipient: ethers.constants.AddressZero,
        maxSupply: 0,
        erc20PrizeToken: formData.tokenAddress,
        erc20PrizeAmount: tokenAmount,
        ethPrizeAmount: ethers.BigNumber.from(0),
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('ERC20 Giveaway raffle created successfully!');
        setFormData({
          name: '',
          tokenAddress: '',
          tokenAmount: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: ''
        });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">It's a great day to give out some tokens! 🎁</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">ERC20 Token Address</label>
            <input
              type="text"
              value={formData.tokenAddress || ''}
              onChange={e => handleChange('tokenAddress', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
              placeholder="0x..."
              required
            />
            {formData.tokenAddress && !checkingWhitelist && whitelistStatus === true && (
              <span className="text-xs text-green-600">Whitelisted</span>
            )}
            {formData.tokenAddress && !checkingWhitelist && whitelistStatus === false && (
              <span className="text-xs text-red-600">Not whitelisted</span>
            )}
            {formData.tokenAddress && checkingWhitelist && (
              <span className="text-xs text-muted-foreground">Checking whitelist status...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Total Token Amount</label>
            <input
              type="number"
              min="0.00000001"
              step="any"
              value={formData.tokenAmount || ''}
              onChange={e => handleChange('tokenAmount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winner Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={formData.tokenGatedEnabled}
            onCheckedChange={e => handleChange('tokenGatedEnabled', e)}
          />
        </div>
        {formData.tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={formData.tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={formData.tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={formData.tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={formData.tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Approving & Creating...' : 'Approve Prize & Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Utility function to robustly check if tokens are already approved
async function checkTokenApproval(signer, tokenAddress, prizeType, spender, amount, tokenId) {
  try {
    let contract;
    const userAddress = await signer.getAddress();
    if (prizeType === 'erc20') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc20, signer);
      const decimals = await contract.decimals();
      const requiredAmount = ethers.utils.parseUnits(amount, decimals);
      const allowance = await contract.allowance(userAddress, spender);
      if (allowance.gte(requiredAmount)) return true;
      // If allowance is 0, check recent Approval events as a fallback
      if (allowance.isZero()) {
        try {
          const currentBlock = await signer.provider.getBlockNumber();
          const fromBlock = Math.max(0, currentBlock - 1000);
          const approvalEventSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
          const userAddressPadded = '0x' + userAddress.slice(2).padStart(64, '0');
          const spenderAddressPadded = '0x' + spender.slice(2).padStart(64, '0');
          const logs = await signer.provider.getLogs({
            address: tokenAddress,
            topics: [approvalEventSignature, userAddressPadded, spenderAddressPadded],
            fromBlock,
            toBlock: currentBlock
          });
          for (const log of logs) {
            const approvalAmount = ethers.BigNumber.from(log.data);
            if (approvalAmount.gte(requiredAmount)) {
              return true;
            }
          }
        } catch (error) {
          // fallback failed, ignore
        }
      }
      return false;
    } else if (prizeType === 'erc721') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc721Prize, signer);
      const approved = await contract.getApproved(tokenId);
      return approved && approved.toLowerCase() === spender.toLowerCase();
    } else if (prizeType === 'erc1155') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc1155Prize, signer);
      return await contract.isApprovedForAll(userAddress, spender);
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Utility function for token approval (ERC20, ERC721, ERC1155)
async function approveToken({ signer, tokenAddress, prizeType, spender, amount, tokenId }) {
  try {
    // Robust check for existing approval
    const isAlreadyApproved = await checkTokenApproval(signer, tokenAddress, prizeType, spender, amount, tokenId);
    if (isAlreadyApproved) {
      return { success: true, alreadyApproved: true };
    }
    let contract, tx;
    if (prizeType === 'erc20') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc20, signer);
      const decimals = await contract.decimals();
      const approvalAmount = ethers.utils.parseUnits(amount, decimals);
      tx = await contract.approve(spender, approvalAmount);
    } else if (prizeType === 'erc721') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc721Prize, signer);
      tx = await contract.approve(spender, tokenId);
    } else if (prizeType === 'erc1155') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc1155Prize, signer);
      tx = await contract.setApprovalForAll(spender, true);
    }
    await tx.wait();
    await new Promise(res => setTimeout(res, 2000));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Utility to extract only the revert reason from contract errors
function extractRevertReason(error) {
  if (error?.reason) return error.reason;
  if (error?.data?.message) return error.data.message;
  const msg = error?.message || error?.data?.message || error?.toString() || '';
  const match = msg.match(/execution reverted:?\s*([^\n]*)/i);
  if (match && match[1]) return match[1].trim();
  return msg;
}

// --- New ERC1155 Collection Drop Form ---
function NewERC1155DropForm() {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const limits = useRaffleLimits(contracts, true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    ticketLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
    customTicketPrice: '',
    collectionName: '',
    collectionSymbol: '',
    baseURI: '',
    maxSupply: '',
    royaltyPercentage: '',
    prizeTokenId: '1',
    amountPerWinner: '',
    // Reveal feature fields
    revealType: '0', // 0 = Instant, 1 = Manual, 2 = Scheduled
    unrevealedBaseURI: '',
    revealTime: '',
    royaltyRecipient: address || '',
    // 1. Add tokenGatedEnabled and token-gated fields to form state
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderBalance: '',
    holderTokenId: '',
  });

  useEffect(() => {
    if (address && !formData.royaltyRecipient) {
      setFormData(prev => ({ ...prev, royaltyRecipient: address }));
    }
    // eslint-disable-next-line
  }, [address]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !contracts.raffleDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const duration = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const customTicketPrice = formData.customTicketPrice ? 
        ethers.utils.parseEther(formData.customTicketPrice) : 0;
      let revealType = parseInt(formData.revealType);
      let unrevealedBaseURI = formData.unrevealedBaseURI;
      let revealTime = 0;
      if (revealType === 2) {
        // Scheduled
        revealTime = Math.floor(new Date(formData.revealTime).getTime() / 1000);
      }
      if (revealType !== 2) {
        unrevealedBaseURI = '';
        revealTime = 0;
      }
      const params = {
        name: formData.name,
        startTime,
        duration,
        ticketLimit: parseInt(formData.ticketLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxTicketsPerParticipant: parseInt(formData.maxTicketsPerParticipant),
        isPrized: true,
        customTicketPrice: customTicketPrice,
        erc721Drop: false,
        erc1155Drop: false,
        prizeCollection: ethers.constants.AddressZero,
        standard: 1, // ERC1155
        prizeTokenId: parseInt(formData.prizeTokenId),
        amountPerWinner: parseInt(formData.amountPerWinner),
        collectionName: formData.collectionName,
        collectionSymbol: formData.collectionSymbol,
        collectionBaseURI: formData.baseURI,
        creator: address,
        royaltyPercentage: formData.royaltyPercentage ? parseInt(formData.royaltyPercentage) * 100 : 0, // percent to bps
        royaltyRecipient: formData.royaltyRecipient,
        maxSupply: parseInt(formData.maxSupply || formData.winnersCount),
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        ethPrizeAmount: 0,
        // Reveal feature
        revealType: revealType,
        unrevealedBaseURI: unrevealedBaseURI,
        revealTime: revealTime,
        // 2. Add token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
      toast.success('New ERC1155 Collection raffle created successfully!');
      setFormData({
        name: '',
        startTime: '',
        duration: '',
        ticketLimit: '',
        winnersCount: '',
        maxTicketsPerParticipant: '',
        customTicketPrice: '',
        collectionName: '',
        collectionSymbol: '',
        baseURI: '',
        maxSupply: '',
        royaltyPercentage: '',
        prizeTokenId: '1',
        amountPerWinner: '',
        revealType: '0',
        unrevealedBaseURI: '',
        revealTime: '',
        royaltyRecipient: address || '',
        tokenGatedEnabled: false,
        holderTokenAddress: '',
        holderTokenStandard: '0',
        minHolderBalance: '',
        holderTokenId: '',
      });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(error.message || 'Error creating raffle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Create New ERC1155 Collection Raffle</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium mb-2">Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={e => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minDuration && limits.maxDuration && (
              <span className="text-xs text-muted-foreground">
                Min Allowed: {Math.ceil(Number(limits.minDuration)/60)} min, Max Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
              </span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Ticket Limit</label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {limits.minTicket && limits.maxTicket && (
              <span className="text-xs text-muted-foreground">Min Allowed: {limits.minTicket}, Max Allowed: {limits.maxTicket}</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Winners Count</label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Max Tickets Per Participant</label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
            {(() => { console.log('maxTicketsPerParticipant limit:', limits.maxTicketsPerParticipant); return null; })()}
            {typeof limits.maxTicketsPerParticipant === 'string' && limits.maxTicketsPerParticipant !== '' ? (
              <span className="text-xs text-muted-foreground">Max Allowed: {limits.maxTicketsPerParticipant}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Loading...</span>
            )}
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Custom Ticket Price (ETH)</label>
            <input
              type="number"
              step="0.001"
              value={formData.customTicketPrice || ''}
              onChange={e => handleChange('customTicketPrice', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              placeholder="Leave empty to use protocol default"
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Prize Token ID</label>
            <input
              type="number"
              value={formData.prizeTokenId || ''}
              onChange={e => handleChange('prizeTokenId', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">Amount Per Winner</label>
            <input
              type="number"
              value={formData.amountPerWinner || ''}
              onChange={e => handleChange('amountPerWinner', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        {/* Inner card for collection info */}
        <div className="bg-muted/20 border border-border rounded-xl p-4 mt-4">
          <h4 className="font-semibold text-base mb-4">NFT Collection Info</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium mb-2">Collection Name</label>
              <input
                type="text"
                value={formData.collectionName || ''}
                onChange={e => handleChange('collectionName', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Collection Symbol</label>
              <input
                type="text"
                value={formData.collectionSymbol || ''}
                onChange={e => handleChange('collectionSymbol', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Base URI</label>
              <input
                type="url"
                value={formData.baseURI || ''}
                onChange={e => handleChange('baseURI', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                required
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Max Supply</label>
              <input
                type="number"
                value={formData.maxSupply || ''}
                onChange={e => handleChange('maxSupply', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Royalty Percentage (%)</label>
              <input
                type="number"
                value={formData.royaltyPercentage || ''}
                onChange={e => handleChange('royaltyPercentage', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                min="0"
                max="10"
                step="0.01"
                placeholder="e.g. 5 for 5%"
              />
              <span className="text-xs text-muted-foreground">Enter as a percentage (e.g. 5 for 5%)</span>
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Royalty Recipient</label>
              <input
                type="text"
                value={formData.royaltyRecipient || ''}
                onChange={e => handleChange('royaltyRecipient', e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
                pattern="^0x[a-fA-F0-9]{40}$"
              />
              <span className="text-xs text-muted-foreground">Must be a valid Ethereum address</span>
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Reveal Type</label>
              <Select
                value={formData.revealType}
                onValueChange={value => handleChange('revealType', value)}
                required
              >
                <SelectTrigger className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background">
                  <SelectValue placeholder="Select Reveal Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Instant Reveal</SelectItem>
                  <SelectItem value="1">Manual Reveal</SelectItem>
                  <SelectItem value="2">Scheduled Reveal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(formData.revealType === '1' || formData.revealType === '2') && (
              <div>
                <label className="block text-base font-medium mb-2">Unrevealed Base URI</label>
                <input
                  type="url"
                  value={formData.unrevealedBaseURI || ''}
                  onChange={e => handleChange('unrevealedBaseURI', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required={formData.revealType === '1' || formData.revealType === '2'}
                />
              </div>
            )}
            {formData.revealType === '2' && (
              <div>
                <label className="block text-base font-medium mb-2">Reveal Time</label>
                <input
                  type="datetime-local"
                  value={formData.revealTime || ''}
                  onChange={e => handleChange('revealTime', e.target.value)}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  required={formData.revealType === '2'}
                />
              </div>
            )}
          </div>
        </div>
        {/* Token-Gated Toggle */}
        <div className="flex items-center gap-2 mb-2">
          <label className="font-medium">Enable Token-Gated Access</label>
          <Switch
            checked={formData.tokenGatedEnabled}
            onCheckedChange={e => handleChange('tokenGatedEnabled', e)}
          />
        </div>
        {formData.tokenGatedEnabled && (
          <div className="p-4 border rounded-lg bg-muted/10 mb-4">
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Address</label>
              <input
                type="text"
                value={formData.holderTokenAddress}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required={formData.tokenGatedEnabled}
              />
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Token Standard</label>
              <select
                value={formData.holderTokenStandard}
                onChange={e => handleChange('holderTokenStandard', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-black text-white"
                required={formData.tokenGatedEnabled}
              >
                <option value="0">ERC721</option>
                <option value="1">ERC1155</option>
                <option value="2">ERC20</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="block text-base font-medium mb-1">Minimum Holder Balance</label>
              <input
                type="number"
                value={formData.minHolderBalance}
                onChange={e => handleChange('minHolderBalance', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                placeholder="Minimum balance required to enter"
                required={formData.tokenGatedEnabled}
              />
            </div>
            {(formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') && (
              <div className="mb-2">
                <label className="block text-base font-medium mb-1">Token ID</label>
                <input
                  type="number"
                  value={formData.holderTokenId}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  placeholder="Token ID (for ERC721/1155)"
                  required={formData.tokenGatedEnabled}
                />
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white px-5 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Add a utility hook to fetch limits from RaffleManager
function useRaffleLimits(contracts, isPrized) {
  const [limits, setLimits] = useState({
    minTicket: undefined,
    maxTicket: undefined,
    minDuration: undefined,
    maxDuration: undefined,
    maxTicketsPerParticipant: undefined,
  });
  useEffect(() => {
    if (!contracts?.raffleManager) return;
    async function fetchLimits() {
      try {
        if (isPrized) {
          const [ticketLimits, durationLimits, maxTickets] = await Promise.all([
            contracts.raffleManager.getAllTicketLimits(),
            contracts.raffleManager.getDurationLimits(),
            contracts.raffleManager.getMaxTicketsPerParticipant()
          ]);
          setLimits({
            minTicket: ticketLimits.minPrized?.toString(),
            maxTicket: ticketLimits.max?.toString(),
            minDuration: durationLimits.min?.toString(),
            maxDuration: durationLimits.max?.toString(),
            maxTicketsPerParticipant: maxTickets?.toString(),
          });
        } else {
          const [ticketLimits, durationLimits, maxTickets] = await Promise.all([
            contracts.raffleManager.getAllTicketLimits(),
            contracts.raffleManager.getDurationLimits(),
            contracts.raffleManager.maxTicketsPerParticipant()
          ]);
          setLimits({
            minTicket: ticketLimits.minNonPrized?.toString(),
            maxTicket: ticketLimits.max?.toString(),
            minDuration: durationLimits.min?.toString(),
            maxDuration: durationLimits.max?.toString(),
            maxTicketsPerParticipant: maxTickets?.toString(),
          });
        }
      } catch (e) {
        // fallback: do nothing
      }
    }
    fetchLimits();
  }, [contracts, isPrized]);
  return limits;
}

// --- Update forms to use the hook and show helper texts ---
// For each form, call useRaffleLimits(contracts, isPrized) and display helper text under relevant fields.
// For WhitelistRaffleForm, hardcode maxTicketsPerParticipant to 1 and disable the input.

// Helper for whitelist status check
function useCollectionWhitelistStatus(address, contracts) {
  const [status, setStatus] = useState(null); // null | true | false
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function check(addr) {
      if (!contracts?.raffleManager || !addr || addr.length !== 42) {
        setStatus(null);
        return;
      }
      setChecking(true);
      try {
        const isWhite = await contracts.raffleManager.isWhitelisted(addr);
        if (!cancelled) setStatus(isWhite);
      } catch {
        if (!cancelled) setStatus(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check(address);
    return () => { cancelled = true; };
  }, [address, contracts]);
  return { status, checking };
}

// Helper for internal status check
function useInternalCollectionStatus(address, contracts) {
  const [status, setStatus] = useState(null); // null | true | false
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function check(addr) {
      if (!contracts?.raffleManager || !addr || addr.length !== 42) {
        setStatus(null);
        return;
      }
      setChecking(true);
      try {
        const isInternal = await contracts.raffleManager.isInternalCollection(addr);
        if (!cancelled) setStatus(isInternal);
      } catch {
        if (!cancelled) setStatus(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    check(address);
    return () => { cancelled = true; };
  }, [address, contracts]);
  return { status, checking };
}

export default CreateRafflePage;