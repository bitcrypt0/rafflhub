import React, { useState, useEffect } from 'react';
import { ArrowLeft, DollarSign, Search, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../../contexts/WalletContext';
import { useContract } from '../../../contexts/ContractContext';
import { toast } from '../../../components/ui/sonner';
import { ethers } from 'ethers';
import { getTicketsSoldCount } from '../../../utils/contractCallUtils';

/**
 * Mobile-specific Revenue Withdrawal Page
 * Uses standard HTML inputs to avoid Android keyboard issues
 */
const MobileRevenuePage = () => {
  const navigate = useNavigate();
  const { connected, address } = useWallet();
  const { contracts, getContractInstance, executeTransaction, executeCall } = useContract();

  // Form state with standard HTML inputs
  const [formData, setFormData] = useState({
    raffleAddress: ''
  });

  const [loading, setLoading] = useState(false);
  const [raffleInfo, setRaffleInfo] = useState(null);
  const [createdRaffles, setCreatedRaffles] = useState([]);

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Fetch raffle information
  const fetchRaffleInfo = async (raffleAddress = formData.raffleAddress) => {
    if (!raffleAddress || !connected) {
      return;
    }

    try {
      setLoading(true);
      const contract = getContractInstance(raffleAddress, 'raffle');
      
      if (!contract) {
        toast.error('Invalid raffle address');
        return;
      }

      const [name, creator, ticketPrice, state, endTime] = await Promise.all([
        executeCall(contract, 'name', []).catch(() => 'Unknown Raffle'),
        executeCall(contract, 'creator', []).catch(() => ''),
        executeCall(contract, 'ticketPrice', []).catch(() => ethers.BigNumber.from(0)),
        executeCall(contract, 'state', []).catch(() => 0),
        executeCall(contract, 'endTime', []).catch(() => ethers.BigNumber.from(0))
      ]);

      // Use fallback approach for tickets sold count (same as RaffleDetailPage)
      const ticketsSoldCount = await getTicketsSoldCount(contract);
      const ticketsSold = ethers.BigNumber.from(ticketsSoldCount);
      const revenue = ticketPrice.mul(ticketsSold);
      const isCreator = creator.toLowerCase() === address.toLowerCase();

      setRaffleInfo({
        address: raffleAddress,
        name,
        creator,
        isCreator,
        ticketPrice: ethers.utils.formatEther(ticketPrice),
        ticketsSold: ticketsSold.toString(),
        revenue: ethers.utils.formatEther(revenue),
        state: mapRaffleState(state),
        endTime: new Date(endTime.toNumber() * 1000),
        canWithdraw: isCreator && (state === 3 || state === 4) // completed or allPrizesClaimed
      });

      toast.success('Raffle information loaded');
    } catch (error) {
      console.error('Error fetching raffle info:', error);
      toast.error('Failed to fetch raffle information');
    } finally {
      setLoading(false);
    }
  };

  // Map raffle state numbers to readable strings
  const mapRaffleState = (stateNum) => {
    switch (stateNum) {
      case 0: return 'pending';
      case 1: return 'active';
      case 2: return 'drawing';
      case 3: return 'completed';
      case 4: return 'allPrizesClaimed';
      case 5: return 'ended';
      default: return 'unknown';
    }
  };

  // Fetch user's created raffles
  const fetchCreatedRaffles = async () => {
    if (!connected || !contracts.raffleFactory) {
      return;
    }

    try {
      setLoading(true);
      const raffles = [];
      const raffleCount = await executeCall(contracts.raffleFactory, 'getRaffleCount', []);
      const raffleCountNum = parseInt(raffleCount.toString());

      for (let i = 0; i < Math.min(raffleCountNum, 20); i++) {
        try {
          const raffleAddress = await executeCall(contracts.raffleFactory, 'raffles', [i]);
          const raffleContract = getContractInstance(raffleAddress, 'raffle');

          if (!raffleContract) continue;

          const creator = await executeCall(raffleContract, 'creator', []).catch(() => '');
          
          if (creator.toLowerCase() === address.toLowerCase()) {
            const [name, ticketPrice, state] = await Promise.all([
              executeCall(raffleContract, 'name', []).catch(() => `Raffle ${i + 1}`),
              executeCall(raffleContract, 'ticketPrice', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'state', []).catch(() => 0)
            ]);

            // Use fallback approach for tickets sold count (same as RaffleDetailPage)
            const ticketsSoldCount = await getTicketsSoldCount(raffleContract);
            const ticketsSold = ethers.BigNumber.from(ticketsSoldCount);
            const revenue = ticketPrice.mul(ticketsSold);
            const canWithdraw = state === 3 || state === 4; // completed or allPrizesClaimed

            raffles.push({
              address: raffleAddress,
              name,
              revenue: ethers.utils.formatEther(revenue),
              state: mapRaffleState(state),
              stateNum: state, // Add the numeric state for proper badge display
              canWithdraw
            });
          }
        } catch (error) {
          console.log(`Error processing raffle ${i}:`, error);
        }
      }

      setCreatedRaffles(raffles);
    } catch (error) {
      console.error('Error fetching created raffles:', error);
      toast.error('Failed to load created raffles');
    } finally {
      setLoading(false);
    }
  };

  // Withdraw revenue
  const withdrawRevenue = async (raffleAddress = formData.raffleAddress) => {
    if (!raffleAddress || !connected) {
      toast.error('Please provide a raffle address');
      return;
    }

    try {
      setLoading(true);
      const contract = getContractInstance(raffleAddress, 'raffle');
      
      if (!contract) {
        toast.error('Invalid raffle address');
        return;
      }

      await executeTransaction(contract, 'withdrawRevenue', []);
      toast.success('Revenue withdrawn successfully!');
      
      // Refresh raffle info and created raffles
      fetchRaffleInfo(raffleAddress);
      fetchCreatedRaffles();
    } catch (error) {
      console.error('Error withdrawing revenue:', error);
      toast.error('Failed to withdraw revenue');
    } finally {
      setLoading(false);
    }
  };

  // Load created raffles on component mount
  useEffect(() => {
    if (connected) {
      fetchCreatedRaffles();
    }
  }, [connected]);

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
            <DollarSign className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Withdraw Revenue</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Your Created Raffles */}
        {createdRaffles.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Your Created Raffles
            </h2>
            
            <div className="space-y-3">
              {createdRaffles.map((raffle) => (
                <div
                  key={raffle.address}
                  className="bg-muted/50 border border-border rounded-lg p-3"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{raffle.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Revenue: {parseFloat(raffle.revenue).toFixed(4)} ETH
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      raffle.canWithdraw ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {raffle.state}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFormData({ raffleAddress: raffle.address });
                        fetchRaffleInfo(raffle.address);
                      }}
                      className="flex-1 text-xs bg-primary/10 text-primary px-3 py-2 rounded-md hover:bg-primary/20 transition-colors"
                    >
                      View Details
                    </button>
                    
                    {raffle.canWithdraw && parseFloat(raffle.revenue) > 0 && (
                      <button
                        onClick={() => withdrawRevenue(raffle.address)}
                        disabled={loading}
                        className="flex-1 text-xs bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Raffle Lookup */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-4 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Manual Raffle Lookup
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Raffle Address
              </label>
              <input
                type="text"
                value={formData.raffleAddress}
                onChange={(e) => handleInputChange('raffleAddress', e.target.value)}
                placeholder="0x..."
                className="w-full p-3 border border-border rounded-lg bg-background text-base"
                style={{ fontSize: '16px' }} // Prevent zoom on iOS
              />
            </div>
            
            <button
              onClick={() => fetchRaffleInfo()}
              disabled={loading || !formData.raffleAddress}
              className="w-full bg-primary text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Fetch Raffle Info'}
            </button>
          </div>
        </div>

        {/* Raffle Information */}
        {raffleInfo && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Raffle Information
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{raffleInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creator:</span>
                <span className="font-mono text-xs">{raffleInfo.creator.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You are creator:</span>
                <span className={`font-medium ${raffleInfo.isCreator ? 'text-green-600' : 'text-red-600'}`}>
                  {raffleInfo.isCreator ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">State:</span>
                <span className="font-medium">{raffleInfo.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tickets Sold:</span>
                <span className="font-medium">{raffleInfo.ticketsSold}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket Price:</span>
                <span className="font-medium">{parseFloat(raffleInfo.ticketPrice).toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Revenue:</span>
                <span className="font-bold text-green-600">{parseFloat(raffleInfo.revenue).toFixed(4)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Can Withdraw:</span>
                <span className={`font-medium ${raffleInfo.canWithdraw ? 'text-green-600' : 'text-red-600'}`}>
                  {raffleInfo.canWithdraw ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Withdraw Revenue */}
        {raffleInfo?.canWithdraw && parseFloat(raffleInfo.revenue) > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium mb-4">Withdraw Revenue</h2>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">
                You can withdraw <strong>{parseFloat(raffleInfo.revenue).toFixed(4)} ETH</strong> from this raffle.
              </p>
            </div>
            
            <button
              onClick={() => withdrawRevenue()}
              disabled={loading}
              className="w-full bg-green-600 text-white p-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Withdrawing...' : 'Withdraw Revenue'}
            </button>
          </div>
        )}

        {/* Access Denied */}
        {raffleInfo && !raffleInfo.isCreator && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 mb-1">Access Denied</h3>
                <p className="text-sm text-red-700">
                  Only the raffle creator can withdraw revenue from this raffle.
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
              <h3 className="font-medium text-blue-800 mb-1">Revenue Withdrawal</h3>
              <p className="text-sm text-blue-700">
                Revenue can only be withdrawn from completed raffles where all prizes have been distributed. 
                The revenue equals the total ticket sales (ticket price × tickets sold).
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

export default MobileRevenuePage;
