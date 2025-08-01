import React, { useState, useEffect } from 'react';
import { DollarSign, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from './ui/sonner';

const CreatorRevenueWithdrawalComponent = () => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const [loading, setLoading] = useState(false);
  const [raffleData, setRaffleData] = useState({
    address: '',
    revenueAmount: '0',
    isOwner: false,
    raffleState: 'unknown'
  });
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [createdRaffles, setCreatedRaffles] = useState([]);
  const [loadingRaffles, setLoadingRaffles] = useState(false);

  const handleChange = (field, value) => {
    setRaffleData(prev => ({ ...prev, [field]: value }));
  };

  const loadRaffleInfo = async (raffleAddress) => {
    if (!raffleAddress || !connected) {
      toast.error('Please enter a raffle address and connect your wallet');
      return;
    }

    setLoadingInfo(true);
    try {
      const contract = getContractInstance(raffleAddress, 'raffle');
      
      if (!contract) {
        throw new Error('Failed to create raffle contract instance');
      }

      // Get raffle information
      const [
        creator,
        totalRevenue,
        state
      ] = await Promise.all([
        contract.creator(),
        contract.totalCreatorRevenue(),
        contract.state()
      ]);

      const isCreator = creator.toLowerCase() === address.toLowerCase();
      
      // Map state number to readable state
      const stateNames = [
        'Pending',           // 0
        'Active',            // 1
        'Ended',             // 2
        'Drawing',           // 3
        'Completed',         // 4
        'Deleted',           // 5
        'ActivationFailed',  // 6
        'AllPrizesClaimed',  // 7
        'Unengaged'          // 8
      ];
      const stateName = stateNames[state] || 'Unknown';

      setRaffleData({
        address: raffleAddress,
        revenueAmount: ethers.utils.formatEther(totalRevenue),
        isCreator,
        raffleState: stateName,
        totalRevenue
      });

    } catch (error) {
      console.error('Error loading raffle info:', error);
      toast.error('Error loading raffle info: ' + error.message);
      setRaffleData({
        address: raffleAddress,
        revenueAmount: '0',
        isCreator: false,
        raffleState: 'error'
      });
    } finally {
      setLoadingInfo(false);
    }
  };

  const loadCreatedRaffles = async () => {
    if (!connected) return;

    setLoadingRaffles(true);
    try {
      // In a real implementation, you would query events or a subgraph
      // to get raffles created by the current user
      // For now, we'll show a placeholder message
      setCreatedRaffles([]);
    } catch (error) {
      console.error('Error loading created raffles:', error);
    } finally {
      setLoadingRaffles(false);
    }
  };

  const handleWithdrawRevenue = async () => {
    if (!connected || !raffleData.address) {
      toast.error('Please connect your wallet and load raffle info first');
      return;
    }

    if (!raffleData.isCreator) {
      toast.error('You are not the creator of this raffle');
      return;
    }

    if (parseFloat(raffleData.revenueAmount) <= 0) {
      toast.info('No revenue available for withdrawal');
      return;
    }

    // Check if raffle is in a valid state for withdrawal
    const validStates = ['Completed', 'AllPrizesClaimed', 'Ended'];
    if (!validStates.includes(raffleData.raffleState)) {
      toast.info(`Revenue can only be withdrawn from completed raffles. Current state: ${raffleData.raffleState}`);
      return;
    }

    setLoading(true);
    try {
      const contract = getContractInstance(raffleData.address, 'raffle');
      
      if (!contract) {
        throw new Error('Failed to create raffle contract instance');
      }

      const result = await executeTransaction(contract.withdrawCreatorRevenue);

      if (result.success) {
        toast.success(`Revenue withdrawn successfully! Transaction: ${result.hash}`);
        // Reload raffle info to show updated values
        await loadRaffleInfo(raffleData.address);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error withdrawing revenue:', error);
      toast.error('Error withdrawing revenue: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected) {
      loadCreatedRaffles();
    }
  }, [connected]);

  const getStateColor = (state) => {
    switch (state) {
      case 'Completed':
      case 'AllPrizesClaimed':
        return 'text-green-600';
      case 'Ended':
        return 'text-red-600';
      case 'Active':
        return 'text-blue-600';
      case 'Pending':
        return 'text-yellow-600';
      case 'Drawing':
        return 'text-purple-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const canWithdraw = raffleData.isCreator && 
                     parseFloat(raffleData.revenueAmount) > 0 && 
                     ['Completed', 'AllPrizesClaimed', 'Ended'].includes(raffleData.raffleState);

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="h-5 w-5" />
        <h3 className="font-semibold">Withdraw Creator Revenue</h3>
      </div>

      <div className="space-y-6">
        {/* Raffle Lookup Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Raffle Contract Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={raffleData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="flex-1 px-3 py-2.5 text-base border border-border rounded-lg bg-background"
                placeholder="0x..."
              />
              <button
                onClick={() => loadRaffleInfo(raffleData.address)}
                disabled={loadingInfo || !connected || !raffleData.address}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-md hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!connected ? "Please connect your wallet" : !raffleData.address ? "Please enter a raffle address" : "Load raffle information"}
              >
                <RefreshCw className={`h-4 w-4 ${loadingInfo ? 'animate-spin' : ''}`} />
                {loadingInfo ? 'Loading...' : 'Load Info'}
              </button>
            </div>
          </div>
        </div>

        {/* Raffle Info Display */}
        {raffleData.address && raffleData.raffleState !== 'unknown' && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-3">Raffle Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Address:</span>
                <div className="font-mono break-all">{raffleData.address}</div>
              </div>
              <div>
                <span className="text-muted-foreground">State:</span>
                <div className={`font-semibold ${getStateColor(raffleData.raffleState)}`}>
                  {raffleData.raffleState}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Creator Revenue:</span>
                <div className="font-semibold">
                  {raffleData.revenueAmount} ETH
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Your Role:</span>
                <div className="flex items-center gap-2">
                  {raffleData.isCreator && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Creator
                    </span>
                  )}
                  {raffleData.isOwner && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Owner
                    </span>
                  )}
                  {!raffleData.isCreator && !raffleData.isOwner && (
                    <span className="text-muted-foreground text-xs">No special role</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Status Messages */}
            {!raffleData.isCreator && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">
                  You are not the creator of this raffle and cannot withdraw revenue.
                </span>
              </div>
            )}

            {raffleData.isCreator && parseFloat(raffleData.revenueAmount) <= 0 && (
              <div className="mt-3 p-3 bg-yellow-50/80 dark:bg-yellow-900/20 backdrop-blur-sm border border-yellow-200/50 dark:border-yellow-700/50 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  No revenue available for withdrawal.
                </span>
              </div>
            )}

            {raffleData.isCreator && !['Completed', 'AllPrizesClaimed', 'Ended'].includes(raffleData.raffleState) && (
              <div className="mt-3 p-3 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Revenue can only be withdrawn from completed raffles.
                </span>
              </div>
            )}

            {canWithdraw && (
              <div className="mt-3 p-3 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm border border-green-200/50 dark:border-green-700/50 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Revenue is available for withdrawal!
                </span>
              </div>
            )}
          </div>
        )}

        {/* Withdrawal Button */}
        <div className="space-y-4">
          <button
            onClick={handleWithdrawRevenue}
            disabled={loading || !connected || !canWithdraw || !raffleData.address || raffleData.raffleState === 'unknown'}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            title={!connected ? "Please connect your wallet" : !raffleData.address ? "Please load raffle info first" : raffleData.raffleState === 'unknown' ? "Raffle state unknown" : !raffleData.isCreator ? "Only raffle creator can withdraw revenue" : !canWithdraw ? "Withdrawal not available - check raffle state and revenue amount" : `Withdraw ${raffleData.revenueAmount} ETH`}
          >
            <DollarSign className="h-4 w-4" />
            {loading ? 'Withdrawing...' : raffleData.address && raffleData.revenueAmount ? `Withdraw ${raffleData.revenueAmount} ETH` : 'Withdraw Revenue'}
          </button>

          {!canWithdraw && raffleData.isCreator && raffleData.address && (
            <p className="text-sm text-muted-foreground text-center">
              Withdrawal is not available at this time. Check the raffle state and revenue amount.
            </p>
          )}
        </div>

        {!connected && (
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-muted-foreground">
              Please connect your wallet to withdraw creator revenue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorRevenueWithdrawalComponent;

