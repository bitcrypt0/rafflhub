import React, { useState, useEffect } from 'react';
import { Shield, Settings, DollarSign, Clock, Users, Package } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useContract } from '../../contexts/ContractContext';
import { ethers } from 'ethers';
import ConfigPanel from '../ConfigPanel';

const ConfigSection = ({ title, icon: Icon, children }) => (
  <div className="bg-card border border-border rounded-lg p-6">
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5" />
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    {children}
  </div>
);

const VRFConfiguration = () => {
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    subscriptionId: '',
    coordinator: '',
    keyHash: '',
    gasLimit: ''
  });

  useEffect(() => {
    const fetchVRF = async () => {
      console.log('VRF: Fetching VRF params...');
      console.log('VRF: contracts.raffleManager:', contracts.raffleManager);
      if (!contracts.raffleManager) {
        console.log('VRF: No raffleManager contract available');
        setError('RaffleManager contract not configured');
        setFetching(false);
        return;
      }
      try {
        console.log('VRF: Calling getVRFParams...');
        const [coordinator, subscriptionId, keyHash, gasLimit] = await contracts.raffleManager.getVRFParams();
        console.log('VRF: Received data:', { coordinator, subscriptionId, keyHash, gasLimit });
        setFormData({
          subscriptionId: subscriptionId.toString(),
          coordinator,
          keyHash,
          gasLimit: gasLimit.toString()
        });
        setError(null);
      } catch (e) {
        console.error('VRF: Error fetching VRF params:', e);
        setError('Failed to fetch VRF configuration. Please check contract address and network.');
      } finally {
        setFetching(false);
      }
    };
    fetchVRF();
  }, [contracts.raffleManager]);

  const handleSave = async () => {
    if (!contracts.raffleManager) {
      alert('RaffleManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransaction(
        contracts.raffleManager.setVRFParams,
        formData.coordinator,
        formData.keyHash,
        parseInt(formData.gasLimit)
      );

      if (result.success) {
        alert('VRF configuration saved successfully!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error saving VRF config:', error);
      alert('Error saving VRF config: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
  return (
    <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Please configure the contract addresses in the settings panel.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fetching && <div className="text-sm text-muted-foreground">Loading VRF configuration...</div>}
      <div>
        <label className="block text-sm font-medium mb-1">Subscription ID</label>
        <input
          type="text"
          value={formData.subscriptionId}
          onChange={(e) => setFormData(prev => ({ ...prev, subscriptionId: e.target.value }))}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter subscription ID"}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">VRF Coordinator</label>
        <input
          type="text"
          value={formData.coordinator}
          onChange={(e) => setFormData(prev => ({ ...prev, coordinator: e.target.value }))}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter coordinator address"}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Key Hash</label>
        <input
          type="text"
          value={formData.keyHash}
          onChange={(e) => setFormData(prev => ({ ...prev, keyHash: e.target.value }))}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter key hash"}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Gas Limit</label>
        <input
          type="number"
          value={formData.gasLimit}
          onChange={(e) => setFormData(prev => ({ ...prev, gasLimit: e.target.value }))}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter gas limit"}
        />
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save VRF Configuration'}
      </button>
    </div>
  );
};

const TicketLimitsConfiguration = () => {
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    minTickets: '',
    minNonPrized: '',
    maxTickets: '',
    maxPerParticipant: ''
  });

  useEffect(() => {
    const fetchLimits = async () => {
      console.log('Limits: Fetching ticket limits...');
      console.log('Limits: contracts.raffleManager:', contracts.raffleManager);
      if (!contracts.raffleManager) {
        console.log('Limits: No raffleManager contract available');
        setError('RaffleManager contract not configured');
        setFetching(false);
        return;
      }
      try {
        console.log('Limits: Calling getAllTicketLimits and getMaxTicketsPerParticipant...');
        const [limits, maxPerParticipant] = await Promise.all([
          contracts.raffleManager.getAllTicketLimits(),
          contracts.raffleManager.getMaxTicketsPerParticipant()
        ]);
        console.log('Limits: Received data:', { limits, maxPerParticipant });
        setFormData({
          minTickets: limits.minPrized?.toString?.() ?? '',
          minNonPrized: limits.minNonPrized?.toString?.() ?? '',
          maxTickets: limits.max?.toString?.() ?? '',
          maxPerParticipant: maxPerParticipant?.toString?.() ?? ''
        });
        setError(null);
      } catch (e) {
        console.error('Limits: Error fetching ticket limits:', e);
        setError('Failed to fetch ticket limits. Please check contract address and network.');
      } finally {
        setFetching(false);
      }
    };
    fetchLimits();
  }, [contracts.raffleManager]);

  const handleSave = async () => {
    if (!contracts.raffleManager) {
      alert('RaffleManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all([
        executeTransaction(
          contracts.raffleManager.setTicketLimits,
          parseInt(formData.minTickets),
          parseInt(formData.maxTickets)
        ),
        executeTransaction(
          contracts.raffleManager.setMinTicketLimitNonPrized,
          parseInt(formData.minNonPrized)
        ),
        executeTransaction(
          contracts.raffleManager.setMaxTicketsPerParticipant,
          parseInt(formData.maxPerParticipant)
        )
      ]);

      const allSuccess = results.every(result => result.success);
      if (allSuccess) {
        alert('Ticket limits saved successfully!');
      } else {
        const errors = results.filter(result => !result.success).map(result => result.error);
        throw new Error('Some transactions failed: ' + errors.join(', '));
      }
    } catch (error) {
      console.error('Error saving ticket limits:', error);
      alert('Error saving ticket limits: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
  return (
    <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Please configure the contract addresses in the settings panel.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fetching && <div className="text-sm text-muted-foreground">Loading ticket limits...</div>}
        <div>
        <label className="block text-sm font-medium mb-1">Min Tickets (Prized)</label>
          <input
            type="number"
            value={formData.minTickets}
            onChange={(e) => setFormData(prev => ({ ...prev, minTickets: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter minimum tickets"}
          />
        </div>
        <div>
        <label className="block text-sm font-medium mb-1">Min Tickets (Non-Prized)</label>
          <input
            type="number"
          value={formData.minNonPrized}
          onChange={(e) => setFormData(prev => ({ ...prev, minNonPrized: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter minimum non-prized tickets"}
          />
        </div>
        <div>
        <label className="block text-sm font-medium mb-1">Max Tickets</label>
          <input
            type="number"
          value={formData.maxTickets}
          onChange={(e) => setFormData(prev => ({ ...prev, maxTickets: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter maximum tickets"}
          />
        </div>
        <div>
        <label className="block text-sm font-medium mb-1">Max Tickets Per Participant</label>
          <input
            type="number"
            value={formData.maxPerParticipant}
            onChange={(e) => setFormData(prev => ({ ...prev, maxPerParticipant: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder={fetching ? "Loading..." : "Enter max tickets per participant"}
          />
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Ticket Limits'}
      </button>
    </div>
  );
};

const FeeConfiguration = () => {
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    protocolFee: '',
    creationFee: '',
    refundablePercentage: '',
    ticketPrice: ''
  });

  useEffect(() => {
    const fetchFees = async () => {
      console.log('Fees: Fetching fee configuration...');
      console.log('Fees: contracts.raffleManager:', contracts.raffleManager);
      if (!contracts.raffleManager) {
        console.log('Fees: No raffleManager contract available');
        setFetching(false);
        return;
      }
      try {
        console.log('Fees: Calling fee functions...');
        const [protocolFee, creationFee, refundable, ticketPrice] = await Promise.all([
          contracts.raffleManager.protocolFeePercentage(),
          contracts.raffleManager.creationFeePercentage(),
          contracts.raffleManager.refundablePercentage(),
          contracts.raffleManager.globalTicketPrice()
        ]);
        console.log('Fees: Received data:', { protocolFee, creationFee, refundable, ticketPrice });
        setFormData({
          protocolFee: protocolFee ? (Number(protocolFee) / 100).toString() : '',
          creationFee: creationFee ? (Number(creationFee) / 100).toString() : '',
          refundablePercentage: refundable ? (Number(refundable) / 100).toString() : '',
          ticketPrice: ethers.utils.formatEther(ticketPrice ?? 0)
        });
      } catch (e) {
        console.error('Fees: Error fetching fee configuration:', e);
      } finally {
        setFetching(false);
      }
    };
    fetchFees();
  }, [contracts.raffleManager]);

  const handleSave = async () => {
    if (!contracts.raffleManager) {
      alert('RaffleManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all([
        executeTransaction(
          contracts.raffleManager.setProtocolFee,
          Math.round(parseFloat(formData.protocolFee) * 100)
        ),
        executeTransaction(
          contracts.raffleManager.setCreationFeePercentage,
          Math.round(parseFloat(formData.creationFee) * 100)
        ),
        executeTransaction(
          contracts.raffleManager.setRefundablePercentage,
          Math.round(parseFloat(formData.refundablePercentage) * 100)
        ),
        executeTransaction(
          contracts.raffleManager.setGlobalTicketPrice,
          ethers.utils.parseEther(formData.ticketPrice)
        )
      ]);

      const allSuccessful = results.every(result => result.success);
      if (allSuccessful) {
        alert('Fee configuration saved successfully!');
      } else {
        throw new Error('Some transactions failed');
      }
    } catch (error) {
      console.error('Error saving fee config:', error);
      alert('Error saving fee config: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {fetching && <div className="text-sm text-muted-foreground">Loading fee configuration...</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Protocol Fee (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={formData.protocolFee}
            onChange={(e) => setFormData(prev => ({ ...prev, protocolFee: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
            placeholder={fetching ? "Loading..." : "Enter protocol fee"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Creation Fee (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={formData.creationFee}
            onChange={(e) => setFormData(prev => ({ ...prev, creationFee: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
            placeholder={fetching ? "Loading..." : "Enter creation fee"}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Refundable Percentage (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={formData.refundablePercentage}
            onChange={(e) => setFormData(prev => ({ ...prev, refundablePercentage: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
            placeholder={fetching ? "Loading..." : "Enter refundable percentage"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Global Ticket Price (ETH)</label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={formData.ticketPrice}
            onChange={(e) => setFormData(prev => ({ ...prev, ticketPrice: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
            placeholder={fetching ? "Loading..." : "Enter ticket price"}
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Fee Configuration'}
      </button>
    </div>
  );
};

const DurationConfiguration = () => {
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    minDuration: '',
    maxDuration: ''
  });

  useEffect(() => {
    const fetchDurations = async () => {
      console.log('Duration: Fetching duration limits...');
      console.log('Duration: contracts.raffleManager:', contracts.raffleManager);
      if (!contracts.raffleManager) {
        console.log('Duration: No raffleManager contract available');
        setFetching(false);
        return;
      }
      try {
        console.log('Duration: Calling getDurationLimits...');
        const [min, max] = await contracts.raffleManager.getDurationLimits();
        console.log('Duration: Received data:', { min, max });
        setFormData({
          minDuration: Math.floor(Number(min) / 60).toString(),
          maxDuration: Math.floor(Number(max) / 60).toString()
        });
      } catch (e) {
        console.error('Duration: Error fetching duration limits:', e);
      } finally {
        setFetching(false);
      }
    };
    fetchDurations();
  }, [contracts.raffleManager]);

  const handleSave = async () => {
    if (!contracts.raffleManager) {
      alert('RaffleManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransaction(
        contracts.raffleManager.setDurationLimits,
        parseInt(formData.minDuration) * 60,
        parseInt(formData.maxDuration) * 60
      );

      if (result.success) {
        alert('Duration limits saved successfully!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error saving duration limits:', error);
      alert('Error saving duration limits: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {fetching && <div className="text-sm text-muted-foreground">Loading duration limits...</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Min Duration (minutes)</label>
          <input
            type="number"
            min="1"
            value={formData.minDuration}
            onChange={(e) => setFormData(prev => ({ ...prev, minDuration: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
            placeholder={fetching ? "Loading..." : "Enter min duration"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max Duration (minutes)</label>
          <input
            type="number"
            min="1"
            value={formData.maxDuration}
            onChange={(e) => setFormData(prev => ({ ...prev, maxDuration: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
            placeholder={fetching ? "Loading..." : "Enter max duration"}
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Duration Limits'}
      </button>
    </div>
  );
};

const PrizedRafflesConfiguration = () => {
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState({prized: false, collections: false});
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    prizedRafflesEnabled: false,
    allowExistingCollections: false
  });

  useEffect(() => {
    const fetchSettings = async () => {
      console.log('Settings: Fetching prized raffles settings...');
      console.log('Settings: contracts.raffleManager:', contracts.raffleManager);
    if (!contracts.raffleManager) {
        console.log('Settings: No raffleManager contract available');
        setFetching(false);
      return;
    }
      try {
        console.log('Settings: Calling prizedRafflesEnabled and allowExistingCollections...');
        const [prizedEnabled, allowExisting] = await Promise.all([
          contracts.raffleManager.prizedRafflesEnabled(),
          contracts.raffleManager.allowExistingCollections()
        ]);
        console.log('Settings: Received data:', { prizedEnabled, allowExisting });
        setFormData({
          prizedRafflesEnabled: prizedEnabled,
          allowExistingCollections: allowExisting
        });
      } catch (e) {
        console.error('Settings: Error fetching prized raffles settings:', e);
      } finally {
        setFetching(false);
      }
    };
    fetchSettings();
  }, [contracts.raffleManager]);

  const handleTogglePrizedRaffles = async (checked) => {
    if (!contracts.raffleManager) return;
    setLoading(l => ({...l, prized: true}));
    try {
      const result = await executeTransaction(
          contracts.raffleManager.togglePrizedRaffles,
        checked
      );
      if (result.success) {
        setFormData(prev => ({ ...prev, prizedRafflesEnabled: checked }));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Error updating prized raffles: ' + error.message);
    } finally {
      setLoading(l => ({...l, prized: false}));
    }
  };

  const handleToggleAllowExistingCollections = async (checked) => {
    if (!contracts.raffleManager) return;
    setLoading(l => ({...l, collections: true}));
    try {
      const result = await executeTransaction(
        contracts.raffleManager.toggleAllowExistingCollections,
        checked
      );
      if (result.success) {
        setFormData(prev => ({ ...prev, allowExistingCollections: checked }));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Error updating allow existing collections: ' + error.message);
    } finally {
      setLoading(l => ({...l, collections: false}));
    }
  };

  return (
    <div className="space-y-4">
      {fetching && <div className="text-sm text-muted-foreground">Loading prized raffles settings...</div>}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="prizedRafflesEnabled"
            checked={formData.prizedRafflesEnabled}
            disabled={loading.prized || fetching}
            onChange={(e) => handleTogglePrizedRaffles(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="prizedRafflesEnabled" className="text-sm font-medium">
            Enable Prized Raffles
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowExistingCollections"
            checked={formData.allowExistingCollections}
            disabled={loading.collections || fetching}
            onChange={(e) => handleToggleAllowExistingCollections(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="allowExistingCollections" className="text-sm font-medium">
            Allow Existing Collections
          </label>
        </div>
      </div>
    </div>
  );
};

const ERC20PrizeWhitelistConfiguration = () => {
  const { contracts, executeTransaction } = useContract();
  const [tokenAddress, setTokenAddress] = useState('');
  const [isWhitelisted, setIsWhitelisted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  const checkWhitelist = async (address) => {
    if (!contracts.raffleManager || !address) return;
    setFetching(true);
    try {
      const result = await contracts.raffleManager.isERC20PrizeWhitelisted(address);
      setIsWhitelisted(result);
      setError(null);
    } catch (e) {
      setError('Failed to check whitelist status.');
      setIsWhitelisted(null);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (ethers.utils.isAddress(tokenAddress)) {
      checkWhitelist(tokenAddress);
    } else {
      setIsWhitelisted(null);
    }
    // eslint-disable-next-line
  }, [tokenAddress, contracts.raffleManager]);

  const handleToggle = async () => {
    if (!contracts.raffleManager || !ethers.utils.isAddress(tokenAddress)) return;
    setLoading(true);
    try {
      let txResult;
      if (isWhitelisted) {
        txResult = await executeTransaction(contracts.raffleManager.removeERC20Prize, tokenAddress);
      } else {
        txResult = await executeTransaction(contracts.raffleManager.addERC20Prize, tokenAddress);
      }
      if (txResult.success) {
        setIsWhitelisted(!isWhitelisted);
        setError(null);
      } else {
        throw new Error(txResult.error);
      }
    } catch (e) {
      setError('Transaction failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigSection title="ERC20 Prize Token Whitelist" icon={Package}>
      <div className="space-y-2">
        <label className="block text-sm font-medium mb-1">ERC20 Token Address</label>
        <input
          type="text"
          value={tokenAddress}
          onChange={e => setTokenAddress(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
          placeholder="0x..."
        />
        {fetching && <div className="text-sm text-muted-foreground">Checking whitelist status...</div>}
        {isWhitelisted !== null && !fetching && (
          <div className="text-sm">
            Status: {isWhitelisted ? (
              <span className="text-green-600">Whitelisted</span>
            ) : (
              <span className="text-red-600">Not Whitelisted</span>
            )}
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
      <button
          onClick={handleToggle}
          disabled={!ethers.utils.isAddress(tokenAddress) || loading || fetching}
          className={`w-full px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${isWhitelisted ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}`}
      >
          {loading ? (isWhitelisted ? 'Removing...' : 'Adding...') : (isWhitelisted ? 'Remove from Whitelist' : 'Add to Whitelist')}
      </button>
    </div>
    </ConfigSection>
  );
};

const AccessManagement = () => {
  const { contracts, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const { account } = useWallet();
  const [collectionData, setCollectionData] = useState({
    address: '',
    isInternal: false
  });
  const [operatorData, setOperatorData] = useState({
    address: ''
  });
  const [revenue, setRevenue] = useState('');
  const [fetchingRevenue, setFetchingRevenue] = useState(true);

  useEffect(() => {
    const fetchRevenue = async () => {
      console.log('Revenue: Fetching admin revenue...');
      console.log('Revenue: contracts.revenueManager:', contracts.revenueManager);
      if (!contracts.revenueManager) {
        console.log('Revenue: No revenueManager contract available');
        setFetchingRevenue(false);
        return;
      }
      try {
        console.log('Revenue: Calling adminRevenue...');
        const bal = await contracts.revenueManager.adminRevenue();
        console.log('Revenue: Received balance:', bal.toString());
        setRevenue(ethers.utils.formatEther(bal));
      } catch (e) {
        console.error('Revenue: Error fetching admin revenue:', e);
        setRevenue('0');
      } finally {
        setFetchingRevenue(false);
      }
    };
    fetchRevenue();
  }, [contracts.revenueManager]);

  const handleAddCollection = async () => {
    if (!contracts.raffleManager) {
      alert('RaffleManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransaction(
        contracts.raffleManager.addExternalCollection,
        collectionData.address
      );

      if (result.success) {
        alert('Collection added to whitelist!');
        setCollectionData({ address: '', isInternal: false });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error adding collection:', error);
      alert('Error adding collection: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOperator = async () => {
    if (!contracts.raffleManager) {
      alert('RaffleManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransaction(
        contracts.raffleManager.setOperator,
        operatorData.address,
        true
      );

      if (result.success) {
        alert('Operator added successfully!');
        setOperatorData({ address: '' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error adding operator:', error);
      alert('Error adding operator: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveOperator = async () => {
    if (!contracts.raffleManager) {
      alert('RaffleManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransaction(
        contracts.raffleManager.setOperator,
        operatorData.address,
        false
      );

      if (result.success) {
        alert('Operator removed successfully!');
        setOperatorData({ address: '' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error removing operator:', error);
      alert('Error removing operator: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRevenue = async () => {
    if (!contracts.revenueManager) {
      alert('RevenueManager contract not configured');
      return;
    }

    setLoading(true);
    try {
      const result = await executeTransaction(contracts.revenueManager.withdraw);

      if (result.success) {
        alert('Revenue withdrawn successfully!');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error withdrawing revenue:', error);
      alert('Error withdrawing revenue: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Whitelist Collections</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Collection Address</label>
            <input
              type="text"
              value={collectionData.address}
              onChange={(e) => setCollectionData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isInternal"
              checked={collectionData.isInternal}
              onChange={(e) => setCollectionData(prev => ({ ...prev, isInternal: e.target.checked }))}
              className="rounded border-border"
            />
            <label htmlFor="isInternal" className="text-sm">Is Internal Collection</label>
          </div>
          <button
            onClick={handleAddCollection}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Add Collection
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Operator Management</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Operator Address</label>
            <input
              type="text"
              value={operatorData.address}
              onChange={(e) => setOperatorData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddOperator}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={handleRemoveOperator}
              disabled={loading}
              className="flex-1 bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Management</h3>
        <div className="space-y-4">
          {fetchingRevenue && <div className="text-sm text-muted-foreground">Loading revenue...</div>}
          <div className="p-3 bg-muted rounded-md">
            <div className="text-sm text-muted-foreground">Available Revenue</div>
            <div className="text-lg font-semibold">{revenue ? `${revenue} ETH` : (fetchingRevenue ? 'Loading...' : '0 ETH')}</div>
          </div>
          <button
            onClick={handleWithdrawRevenue}
            disabled={loading || fetchingRevenue}
            className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Withdraw Revenue
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { account, connected } = useWallet();
  const { contracts, contractAddresses } = useContract();
  const [configOpen, setConfigOpen] = useState(false);

  // Check if contracts are properly configured
  const contractsConfigured = contracts.raffleManager && 
                             contracts.revenueManager && 
                             contractAddresses.raffleManager && 
                             contractAddresses.revenueManager;

  if (!connected) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
          <p className="text-muted-foreground">Please connect your wallet to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  if (!contractsConfigured) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Contract Configuration Required</h3>
            <p className="text-yellow-700 mb-4">
              The contract addresses are not properly configured. Please set up the contract addresses to use the admin dashboard.
            </p>
            <button
              onClick={() => setConfigOpen(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Configure Contracts
            </button>
        </div>
        </div>
        <ConfigPanel isOpen={configOpen} onClose={() => setConfigOpen(false)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Configure and manage the raffle protocol settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConfigSection title="VRF Configuration" icon={Settings}>
          <VRFConfiguration />
        </ConfigSection>

        <ConfigSection title="Ticket Limits" icon={Users}>
          <TicketLimitsConfiguration />
        </ConfigSection>

        <ConfigSection title="Fee Configuration" icon={DollarSign}>
          <FeeConfiguration />
        </ConfigSection>

        <ConfigSection title="Duration Limits" icon={Clock}>
          <DurationConfiguration />
        </ConfigSection>

        <ConfigSection title="Prized Raffles" icon={Package}>
          <PrizedRafflesConfiguration />
        </ConfigSection>

        <ConfigSection title="ERC20 Prize Token Whitelist" icon={Package}>
          <ERC20PrizeWhitelistConfiguration />
        </ConfigSection>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Access Management
        </h2>
        <AccessManagement />
      </div>

      <ConfigPanel isOpen={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
};

export default AdminDashboard;

