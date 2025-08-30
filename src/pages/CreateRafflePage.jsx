import React, { useState, useEffect } from 'react';
import { Plus, Package, AlertCircle, Gift, Coins, CheckCircle, XCircle, Info } from 'lucide-react';
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
import TokenGatedSection from '../components/TokenGatedSection';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { RaffleErrorDisplay } from '../components/ui/raffle-error-display';
import CreateRaffleSideFilterBar from '../components/CreateRaffleSideFilterBar';
import { useErrorHandler } from '../utils/errorHandling';
import { SUPPORTED_NETWORKS } from '../networks';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';

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
        nativePrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('Your raffle was created successfully!');
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
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">ERC1155 Collection Raffle</h3>
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
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
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
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Info">
                      <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Ticket Limit info">
                      <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Winner Count info">
                    <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Max Tickets Per Participant info">
                    <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')}</label>
          <input
            type="number"
            min="0"
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
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
      const minHolderTokenBalance = tokenGatedEnabled && formData.minHolderTokenBalance
        ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18)
        : ethers.BigNumber.from(0);
      const holderTokenId = tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0;
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
          nativePrizeAmount: 0,
          revealType: 0,
          unrevealedBaseURI: '',
          revealTime: 0,
          // Token-gated params
          holderTokenAddress,
          holderTokenStandard,
          minHolderTokenBalance,
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
          nativePrizeAmount: 0,
          revealType: 0,
          unrevealedBaseURI: '',
          revealTime: 0,
          // Token-gated params
          holderTokenAddress,
          holderTokenStandard,
          minHolderTokenBalance,
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
        toast.success('Your raffle was created successfully!');
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
          minHolderTokenBalance: '',
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
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Prized Raffle</h3>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Info">
                      <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Ticket Limit info">
                      <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Winner Count info">
                    <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                  </span>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center cursor-help" data-tooltip-icon aria-label="Max Tickets Per Participant info">
                    <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={1}
              disabled
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        {/* Custom Ticket Price */}
        <div>
          <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')}</label>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl shadow-md">
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
                  onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                />
              </div>
              
              <div>
                <label className="block text-base font-medium mb-2">Royalty Percentage</label>
                <input
                  type="number"
                  min="0"
                  value={formData.royaltyPercentage || ''}
                  onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                  onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                  className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                  placeholder="e.g. 5 for 5%"
                />
              </div>
            </div>
          )}

          {formData.prizeSource === 'existing' && (
            <div className="space-y-4 p-4 bg-muted/20 rounded-xl shadow-md">
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

        <TokenGatedSection
          tokenGatedEnabled={tokenGatedEnabled}
          onTokenGatedChange={setTokenGatedEnabled}
          formData={formData}
          handleChange={handleChange}
          required={true}
        />

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
        nativePrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0
      };
      const result = await executeTransaction(
        contracts.raffleDeployer.createRaffle,
        params
      );

      if (result.success) {
        toast.success('Your raffle was created successfully!');
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
        // Error already handled by executeTransaction, just show user-friendly message
        toast.error(result.error || 'Failed to create raffle');
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      // Only show toast if it's not already handled
      if (!error.message?.includes('Transaction failed')) {
        toast.error(extractRevertReason(error));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Non-Prized Raffle</h3>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { isMobile } = useMobileBreakpoints();
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
    minHolderTokenBalance: '',
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
      const minHolderTokenBalance = tokenGatedEnabled && formData.minHolderTokenBalance
        ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18)
        : ethers.BigNumber.from(0);
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
        nativePrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,

        // Token-gated params
        holderTokenAddress,
        holderTokenStandard,
        minHolderTokenBalance,
        holderTokenId,
      };
      // Runtime validation
      // const undefinedOrEmptyFields = Object.entries(params).filter(([k, v]) => v === undefined || v === '');
      // if (undefinedOrEmptyFields.length > 0) {
      //   console.warn('Params contain undefined or empty string values:', undefinedOrEmptyFields);
      // }
      // console.log('Params to be sent to createRaffle:', params);
      let result = { success: false };
      try {
        const tx = await contracts.raffleDeployer.createRaffle(params);
        const receipt = await tx.wait();
        result = { success: true, receipt, hash: tx.hash };
      } catch (error) {
        result = { success: false, error: error.message };
      }
      if (result.success) {
        toast.success('Your raffle was created successfully!');
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          ticketLimit: '',
          winnersCount: '',
          maxTicketsPerParticipant: '',
          holderTokenAddress: '',
          holderTokenStandard: '0',
          minHolderTokenBalance: '',
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
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Whitelist Raffle</h3>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Only one entry is allowed for Whitelist Raffles
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={1}
              disabled
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <TokenGatedSection
          tokenGatedEnabled={tokenGatedEnabled}
          onTokenGatedChange={setTokenGatedEnabled}
          formData={formData}
          handleChange={handleChange}
          required={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
      // Preserve unrevealedBaseURI for Manual (1) and Scheduled (2). Only clear for Instant (0)
      if (revealType === 0) {
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
        nativePrizeAmount: 0,
        // Reveal feature
        revealType: revealType,
        unrevealedBaseURI: unrevealedBaseURI,
        revealTime: revealTime,

        // 2. Add token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : ethers.BigNumber.from(0),
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('Your raffle was created successfully!');
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
          minHolderTokenBalance: '',
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
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">New ERC721 Collection Raffle</h3>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={(e) => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')}</label>
            <input
              type="number"
              step="0.001"
              value={formData.customTicketPrice || ''}
              onChange={(e) => handleChange('customTicketPrice', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              placeholder="Leave empty to use protocol default"
            />
          </div>
        </div>
        {/* Inner card for collection info */}
        <div className="bg-muted/20 border border-border rounded-xl p-4 mt-4 shadow-md">
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
                onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-base font-medium mb-2">Royalty Percentage (%)</label>
              <input
                type="number"
                value={formData.royaltyPercentage || ''}
                onChange={(e) => handleChange('royaltyPercentage', e.target.value)}
                onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                min="0"
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
            <div>

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
        <TokenGatedSection
          formData={formData}
          handleChange={handleChange}
          required={true}
          useFormDataEnabled={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
      const minHolderTokenBalance = tokenGatedEnabled && formData.minHolderTokenBalance ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : 0;
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
        nativePrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,

        // Token-gated params
        holderTokenAddress,
        holderTokenStandard,
        minHolderTokenBalance,
        holderTokenId,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
      toast.success('Your raffle was created successfully!');
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
        minHolderTokenBalance: '',
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

  // Helper for internal collection status check
  const { status: internalStatus721, checking: checkingInternal721 } = useInternalCollectionStatus(formData.collection, contracts);

  // Show toast when status changes
  useEffect(() => {
    if (formData.collection && !checkingInternal721 && internalStatus721 !== null) {
      if (internalStatus721) {
        toast.success("This collection is approved");
      } else {
        toast.error("This collection is not approved");
      }
    }
  }, [formData.collection, checkingInternal721, internalStatus721]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Existing ERC721 Prize Raffle</h3>
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
            <div className="relative">
              <input
                type="text"
                value={formData.collection || ''}
                onChange={e => handleChange('collection', e.target.value)}
                className="w-full px-3 py-2.5 pr-10 text-base border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
              />
              {formData.collection && !checkingInternal721 && internalStatus721 === true && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
              {formData.collection && !checkingInternal721 && internalStatus721 === false && (
                <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
              )}
            </div>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              min="1"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              min="1"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              min="1"
              value={formData.maxTicketsPerUser || ''}
              onChange={e => handleChange('maxTicketsPerUser', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')} <span className="font-normal text-xs text-muted-foreground">(Enter 0 for NFT giveaway)</span></label>
          <input
            type="number"
            min="0"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        <TokenGatedSection
          tokenGatedEnabled={tokenGatedEnabled}
          onTokenGatedChange={setTokenGatedEnabled}
          formData={formData}
          handleChange={handleChange}
          required={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
        nativePrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : 0,
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
      toast.success('Your raffle was created successfully!');
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
        minHolderTokenBalance: '',
        holderTokenId: '',
      });
    } catch (error) {
      console.error('Error creating raffle:', error);
      toast.error(error.message || 'Error creating raffle');
    } finally {
      setLoading(false);
    }
  };

  // Helper for internal collection status check
  const { status: internalStatus1155, checking: checkingInternal1155 } = useInternalCollectionStatus(formData.collectionAddress, contracts);

  // Show toast when status changes
  useEffect(() => {
    if (formData.collectionAddress && !checkingInternal1155 && internalStatus1155 !== null) {
      if (internalStatus1155) {
        toast.success("This collection is approved");
      } else {
        toast.error("This collection is not approved");
      }
    }
  }, [formData.collectionAddress, checkingInternal1155, internalStatus1155]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Existing ERC1155 Collection Raffle</h3>
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
            <div className="relative">
              <input
                type="text"
                value={formData.collectionAddress || ''}
                onChange={e => handleChange('collectionAddress', e.target.value)}
                className="w-full px-3 py-2.5 pr-10 text-base border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
              />
              {formData.collectionAddress && !checkingInternal1155 && internalStatus1155 === true && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
              {formData.collectionAddress && !checkingInternal1155 && internalStatus1155 === false && (
                <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
              )}
            </div>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')}</label>
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
        <TokenGatedSection
          formData={formData}
          handleChange={handleChange}
          required={true}
          useFormDataEnabled={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  raffleType: ['Whitelist/Allowlist', 'NFTDrop', 'Lucky Sale/NFT Giveaway', 'Native Token Giveaway', 'ERC20 Token Giveaway'],
  nftStandard: ['ERC721', 'ERC1155'],
  erc721Source: ['New ERC721 Collection', 'Existing ERC721 Collection'],
  escrowedSource: ['Internal NFT Prize', 'External NFT Prize'],
  luckySaleSource: ['Internal NFT Prize', 'External NFT Prize'],
  erc1155Source: ['New ERC1155 Collection', 'Existing ERC1155 Collection'],
};

const CreateRafflePage = () => {
  const { connected, chainId } = useWallet();
  const { contracts } = useContract();
  const { getCurrencyLabel } = useNativeCurrency();

  // Check if contracts are available on current network
  const areContractsAvailable = () => {
    if (!chainId || !SUPPORTED_NETWORKS[chainId]) {
      return false;
    }
    const contractAddresses = SUPPORTED_NETWORKS[chainId].contractAddresses;
    return contractAddresses?.raffleDeployer &&
           contractAddresses.raffleDeployer !== '0x...' &&
           contractAddresses?.raffleManager &&
           contractAddresses.raffleManager !== '0x...';
  };
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

  // SideFilterBar state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
    if (raffleType === 'Native Token Giveaway') return <ETHGiveawayForm />;
    if (raffleType === 'ERC20 Token Giveaway') return <ERC20GiveawayForm />;
    return null;
  };

  const { isMobile } = useMobileBreakpoints();

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Plus className={`mx-auto mb-4 text-muted-foreground ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
          <h2 className={`font-bold mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Connect Your Wallet</h2>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
            Please connect your wallet to create raffles and deploy collections.
          </p>
        </div>
      </div>
    );
  }

  // Check if contracts are available on this network
  if (!areContractsAvailable()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RaffleErrorDisplay
          error="CONTRACTS_NOT_AVAILABLE"
          onRetry={null}
          isMobile={isMobile}
          showCreateButton={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className={`${isMobile ? 'px-4' : 'container mx-auto px-8'}`}>
        {/* Page Header */}
        <div className={`text-center ${isMobile ? 'mb-6 mt-4' : 'mb-4'}`}>
          <h1 className={`font-bold ${isMobile ? 'text-2xl mb-2' : 'text-4xl mb-4'}`}>
            Create an on-chain raffle for your community
          </h1>
          <p className={`font-semibold ${isMobile ? 'text-base' : 'text-2xl'}`}>
            Configure your raffle <a href="#" onClick={(e) => { e.preventDefault(); setIsFilterOpen(true); }} className="text-primary hover:text-primary/90 no-underline font-medium transition-colors">here</a>
          </p>
        </div>

        {/* Filter Button and Form Section - Responsive Layout */}
        <div className={`max-w-7xl mx-auto ${isMobile ? 'mt-6' : 'mt-16'}`}>
          {isMobile ? (
            /* Mobile: Stacked Layout */
            <div className="space-y-4">
              {/* Form Section */}
              <div className="w-full">
                {renderForm()}
              </div>
            </div>
          ) : (
            /* Desktop: Side by Side Layout */
            <div className="flex gap-2 items-start">
              {/* Form Section */}
              <div className="flex-1">
                {renderForm()}
              </div>
            </div>
          )}
        </div>

        {/* SideFilterBar */}
        <CreateRaffleSideFilterBar
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
          raffleType={raffleType}
          setRaffleType={setRaffleType}
          nftStandard={nftStandard}
          setNftStandard={setNftStandard}
          erc721Source={erc721Source}
          setErc721Source={setErc721Source}
          erc1155Source={erc1155Source}
          setErc1155Source={setErc1155Source}
        />
      </div>
    </div>
  );
};

// Add LuckySaleERC721Form
function LuckySaleERC721Form() {
  const { connected, address, provider } = useWallet();
  const { contracts } = useContract();
  const { isMobile } = useMobileBreakpoints();
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
        nativePrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : ethers.BigNumber.from(0),
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('Your raffle was created successfully!');
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
          minHolderTokenBalance: '',
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

  // Show toast when status changes
  useEffect(() => {
    if (formData.collectionAddress && !checkingWhitelistLucky721 && whitelistStatusLucky721 !== null) {
      if (whitelistStatusLucky721) {
        toast.success("This collection is approved");
      } else {
        toast.error("This collection is not approved");
      }
    }
  }, [formData.collectionAddress, checkingWhitelistLucky721, whitelistStatusLucky721]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Gift className="h-5 w-5" />
        <h3 className={`font-semibold ${isMobile ? 'text-lg' : 'text-xl'}`}>Lucky Sale (ERC721 Escrowed Prize)</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block font-medium mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className={`block font-medium mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>Prize Collection Address</label>
            <div className="relative">
              <input
                type="text"
                value={formData.collectionAddress || ''}
                onChange={e => handleChange('collectionAddress', e.target.value)}
                className="w-full px-3 py-2.5 pr-10 text-base border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
              />
              {formData.collectionAddress && !checkingWhitelistLucky721 && whitelistStatusLucky721 === true && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
              {formData.collectionAddress && !checkingWhitelistLucky721 && whitelistStatusLucky721 === false && (
                <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
              )}
            </div>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  This raffle type supports only one Winner
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')} <span className="font-normal text-xs text-muted-foreground">(Enter 0 for NFT giveaway)</span></label>
          <input
            type="number"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        <TokenGatedSection
          formData={formData}
          handleChange={handleChange}
          required={true}
          useFormDataEnabled={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
        nativePrizeAmount: 0,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : ethers.BigNumber.from(0),
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('Your raffle was created successfully!');
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
          minHolderTokenBalance: '',
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

  // Show toast when status changes
  useEffect(() => {
    if (formData.collectionAddress && !checkingWhitelistLucky1155 && whitelistStatusLucky1155 !== null) {
      if (whitelistStatusLucky1155) {
        toast.success("This collection is approved");
      } else {
        toast.error("This collection is not approved");
      }
    }
  }, [formData.collectionAddress, checkingWhitelistLucky1155, whitelistStatusLucky1155]);

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Lucky Sale (ERC1155 Escrowed Prize)</h3>
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
            <div className="relative">
              <input
                type="text"
                value={formData.collectionAddress || ''}
                onChange={e => handleChange('collectionAddress', e.target.value)}
                className="w-full px-3 py-2.5 pr-10 text-base border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
              />
              {formData.collectionAddress && !checkingWhitelistLucky1155 && whitelistStatusLucky1155 === true && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
              {formData.collectionAddress && !checkingWhitelistLucky1155 && whitelistStatusLucky1155 === false && (
                <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
              )}
            </div>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')} <span className="font-normal text-xs text-muted-foreground">(Enter 0 for NFT giveaway)</span></label>
          <input
            type="number"
            step="any"
            value={formData.ticketPrice || ''}
            onChange={e => handleChange('ticketPrice', e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
            required
          />
        </div>
        <TokenGatedSection
          formData={formData}
          handleChange={handleChange}
          required={true}
          useFormDataEnabled={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { isMobile } = useMobileBreakpoints();
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
        nativePrizeAmount: ethAmount,
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : ethers.BigNumber.from(0),
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0,
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
        toast.success('Your raffle was created successfully!');
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
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-5 w-5" />
        <h3 className={`font-semibold ${isMobile ? 'text-lg' : 'text-xl'}`}>{getCurrencyLabel()} Giveaway</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block font-medium mb-2 ${isMobile ? 'text-sm' : 'text-base'}`}>Raffle Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2">{getCurrencyLabel('prize')}</label>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
        </div>
        <TokenGatedSection
          formData={formData}
          handleChange={handleChange}
          required={true}
          useFormDataEnabled={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { isMobile } = useMobileBreakpoints();
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
    minHolderTokenBalance: '',
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

  // Show toast when whitelist status changes
  useEffect(() => {
    if (formData.tokenAddress && !checkingWhitelist && whitelistStatus !== null) {
      if (whitelistStatus) {
        toast.success("This token is approved");
      } else {
        toast.error("This token is not approved");
      }
    }
  }, [formData.tokenAddress, checkingWhitelist, whitelistStatus]);

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
        nativePrizeAmount: ethers.BigNumber.from(0),
        revealType: 0,
        unrevealedBaseURI: '',
        revealTime: 0,
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : ethers.BigNumber.from(0),
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
        toast.success('Your raffle was created successfully!');
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
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-5 w-5" />
        <h3 className={`font-semibold ${isMobile ? 'text-lg' : 'text-xl'}`}>ERC20 Token Giveaway</h3>
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
            <div className="relative">
              <input
                type="text"
                value={formData.tokenAddress || ''}
                onChange={e => handleChange('tokenAddress', e.target.value)}
                className="w-full px-3 py-2.5 pr-10 text-base border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
              />
              {formData.tokenAddress && !checkingWhitelist && whitelistStatus === true && (
                <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
              )}
              {formData.tokenAddress && !checkingWhitelist && whitelistStatus === false && (
                <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-600" />
              )}
            </div>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={e => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
        </div>
        <TokenGatedSection
          formData={formData}
          handleChange={handleChange}
          required={true}
          useFormDataEnabled={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
  const { getCurrencyLabel } = useNativeCurrency();
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
    minHolderTokenBalance: '',
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
      // Preserve unrevealedBaseURI for Manual (1) and Scheduled (2). Only clear for Instant (0)
      if (revealType === 0) {
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
        collectionName: '',
        collectionSymbol: '',
        collectionBaseURI: formData.baseURI,
        creator: address,
        royaltyPercentage: formData.royaltyPercentage ? parseInt(formData.royaltyPercentage) * 100 : 0, // percent to bps
        royaltyRecipient: formData.royaltyRecipient,
        maxSupply: parseInt(formData.maxSupply || formData.winnersCount),
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        nativePrizeAmount: 0,
        // Reveal feature
        revealType: revealType,
        unrevealedBaseURI: unrevealedBaseURI,
        revealTime: revealTime,
        // 2. Add token-gated params
        holderTokenAddress: formData.tokenGatedEnabled ? formData.holderTokenAddress : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined ? ethers.utils.parseUnits(formData.minHolderTokenBalance, 18) : ethers.BigNumber.from(0),
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1') ? parseInt(formData.holderTokenId) : 0,
      };
      const tx = await contracts.raffleDeployer.connect(signer).createRaffle(params);
      await tx.wait();
      toast.success('Your raffle was created successfully!');
      setFormData({
        name: '',
        startTime: '',
        duration: '',
        ticketLimit: '',
        winnersCount: '',
        maxTicketsPerParticipant: '',
        customTicketPrice: '',
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
        minHolderTokenBalance: '',
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
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Gift className="h-5 w-5" />
        <h3 className="text-xl font-semibold">New ERC1155 Collection Raffle</h3>
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
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration)/60)} min<br/>
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration)/60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={e => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />

          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Ticket Limit
              {limits.minTicket && limits.maxTicket && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Ticket Limit Allowed: {limits.minTicket}<br/>
                      Maximum Ticket Limit Allowed: {limits.maxTicket}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.ticketLimit || ''}
              onChange={e => handleChange('ticketLimit', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Winner Count
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 10% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={e => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium mb-2 flex items-center gap-2">Max Tickets Per Participant
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Max Tickets Per Participant must not exceed 1% of your Ticket Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.maxTicketsPerParticipant || ''}
              onChange={(e) => handleChange('maxTicketsPerParticipant', e.target.value)}
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              required
            />


          </div>
          <div>
            <label className="block text-base font-medium mb-2">{getCurrencyLabel('ticket')}</label>
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
        <div className="bg-muted/20 border border-border rounded-xl p-4 mt-4 shadow-md">
          <h4 className="font-semibold text-base mb-4">NFT Collection Info</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <TokenGatedSection
          formData={formData}
          handleChange={handleChange}
          required={true}
          useFormDataEnabled={true}
        />
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            className="flex-1 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base h-12"
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
        const isWhite = await contracts.raffleManager.isCollectionApproved(addr);
        if (!cancelled) setStatus(isWhite);
      } catch (error) {
        console.warn('[useCollectionWhitelistStatus] Failed to check collection approval:', error.message);
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
