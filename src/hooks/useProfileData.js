import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from '../components/ui/sonner';

/**
 * Shared data hook for ProfilePage (both desktop and mobile)
 * Extracts all data fetching logic to be reused across implementations
 */
export const useProfileData = () => {
  const { connected, address, provider, chainId } = useWallet();
  const { contracts, getContractInstance, executeTransaction, executeCall } = useContract();

  // Memoize stable values to prevent unnecessary re-renders
  const stableConnected = useMemo(() => connected, [connected]);
  const stableAddress = useMemo(() => address, [address]);
  const stableContracts = useMemo(() => contracts, [contracts]);

  // State management
  const [loading, setLoading] = useState(true);
  const [userActivity, setUserActivity] = useState([]);
  const [createdRaffles, setCreatedRaffles] = useState([]);
  const [purchasedTickets, setPurchasedTickets] = useState([]);
  const [activityStats, setActivityStats] = useState({
    totalTicketsPurchased: 0,
    totalRafflesCreated: 0,
    totalPrizesWon: 0,
    totalRevenueWithdrawn: '0',
    totalRefundsClaimed: 0
  });

  // Revenue modal state (shared between implementations)
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState(null);

  // Helper function to extract revert reason
  const extractRevertReason = useCallback((error) => {
    if (error?.reason) return error.reason;
    if (error?.data?.message) return error.data.message;
    if (error?.message) {
      const match = error.message.match(/revert (.+)/);
      if (match) return match[1];
      return error.message;
    }
    return 'Transaction failed';
  }, []);

  // Map raffle state numbers to readable strings
  const mapRaffleState = useCallback((stateNum) => {
    switch (stateNum) {
      case 0: return 'pending';
      case 1: return 'active';
      case 2: return 'drawing';
      case 3: return 'completed';
      case 4: return 'allPrizesClaimed';
      case 5: return 'ended';
      default: return 'unknown';
    }
  }, []);

  // Fetch on-chain activity
  const fetchOnChainActivity = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider || !stableContracts.raffleFactory) {
      return;
    }

    try {
      const activities = [];
      let totalTicketsPurchased = 0;
      let totalPrizesWon = 0;
      let totalRefundsClaimed = 0;

      // Get all raffle addresses
      const raffleCount = await executeCall(stableContracts.raffleFactory, 'getRaffleCount', []);
      const raffleCountNum = parseInt(raffleCount.toString());

      for (let i = 0; i < Math.min(raffleCountNum, 50); i++) {
        try {
          const raffleAddress = await executeCall(stableContracts.raffleFactory, 'raffles', [i]);
          const raffleContract = getContractInstance('raffle', raffleAddress);

          if (!raffleContract) continue;

          // Get raffle details
          const [name, ticketPrice, ticketLimit, startTime, duration, state] = await Promise.all([
            executeCall(raffleContract, 'name', []).catch(() => `Raffle ${i + 1}`),
            executeCall(raffleContract, 'ticketPrice', []).catch(() => ethers.BigNumber.from(0)),
            executeCall(raffleContract, 'ticketLimit', []).catch(() => ethers.BigNumber.from(0)),
            executeCall(raffleContract, 'startTime', []).catch(() => ethers.BigNumber.from(0)),
            executeCall(raffleContract, 'duration', []).catch(() => ethers.BigNumber.from(0)),
            executeCall(raffleContract, 'state', []).catch(() => 0)
          ]);

          // Calculate end time
          const endTime = startTime.add(duration);

          // Check if user has tickets
          const userTicketCount = await executeCall(raffleContract, 'ticketsPurchased', [stableAddress]).catch(() => ethers.BigNumber.from(0));

          if (userTicketCount.gt(0)) {
            totalTicketsPurchased += userTicketCount.toNumber();
            
            activities.push({
              id: `tickets-${raffleAddress}`,
              type: 'ticket_purchase',
              raffleAddress,
              raffleName: name,
              ticketCount: userTicketCount.toNumber(),
              amount: ethers.utils.formatEther(ticketPrice.mul(userTicketCount)),
              timestamp: Date.now() - (i * 86400000), // Mock timestamp
              state: mapRaffleState(state)
            });

            // Check if user won (if raffle is completed)
            if (state >= 3) {
              try {
                const isWinner = await executeCall(raffleContract, 'isWinner', [stableAddress]).catch(() => false);
                if (isWinner) {
                  totalPrizesWon++;
                  activities.push({
                    id: `win-${raffleAddress}`,
                    type: 'prize_won',
                    raffleAddress,
                    raffleName: name,
                    timestamp: Date.now() - (i * 86400000) + 3600000,
                    state: mapRaffleState(state)
                  });
                }
              } catch (error) {
                console.log('Error checking winners:', error);
              }
            }
          }
        } catch (error) {
          console.log(`Error processing raffle ${i}:`, error);
        }
      }

      // Sort activities by timestamp (newest first)
      activities.sort((a, b) => b.timestamp - a.timestamp);

      setUserActivity(activities);
      setActivityStats(prev => ({
        ...prev,
        totalTicketsPurchased,
        totalPrizesWon,
        totalRefundsClaimed
      }));

    } catch (error) {
      console.error('Error fetching on-chain activity:', error);
      toast.error('Failed to load activity data');
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleFactory, executeCall, getContractInstance, mapRaffleState]);

  // Fetch created raffles
  const fetchCreatedRaffles = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider || !stableContracts.raffleFactory) {
      return;
    }

    try {
      const raffles = [];
      const raffleCount = await executeCall(stableContracts.raffleFactory, 'getRaffleCount', []);
      const raffleCountNum = parseInt(raffleCount.toString());

      for (let i = 0; i < Math.min(raffleCountNum, 50); i++) {
        try {
          const raffleAddress = await executeCall(stableContracts.raffleFactory, 'raffles', [i]);
          const raffleContract = getContractInstance('raffle', raffleAddress);

          if (!raffleContract) continue;

          const creator = await executeCall(raffleContract, 'creator', []).catch(() => '');
          
          if (creator.toLowerCase() === stableAddress.toLowerCase()) {
            const [name, ticketPrice, ticketLimit, participantsCount, startTime, duration, state] = await Promise.all([
              executeCall(raffleContract, 'name', []).catch(() => `Raffle ${i + 1}`),
              executeCall(raffleContract, 'ticketPrice', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'ticketLimit', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'getParticipantsCount', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'startTime', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'duration', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'state', []).catch(() => 0)
            ]);

            // Calculate end time and tickets sold
            const endTime = new Date((startTime.add(duration)).toNumber() * 1000);
            const ticketsSold = participantsCount;

            raffles.push({
              address: raffleAddress,
              name,
              ticketPrice: ethers.utils.formatEther(ticketPrice),
              maxTickets: ticketLimit.toString(),
              ticketsSold: ticketsSold.toString(),
              endTime: endTime,
              state: mapRaffleState(state),
              revenue: ethers.utils.formatEther(ticketPrice.mul(ticketsSold))
            });
          }
        } catch (error) {
          console.log(`Error processing created raffle ${i}:`, error);
        }
      }

      setCreatedRaffles(raffles);
    } catch (error) {
      console.error('Error fetching created raffles:', error);
      toast.error('Failed to load created raffles');
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleFactory, executeCall, getContractInstance, mapRaffleState]);

  // Fetch purchased tickets
  const fetchPurchasedTickets = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider || !stableContracts.raffleFactory) {
      return;
    }

    try {
      const tickets = [];
      const raffleCount = await executeCall(stableContracts.raffleFactory, 'getRaffleCount', []);
      const raffleCountNum = parseInt(raffleCount.toString());

      for (let i = 0; i < Math.min(raffleCountNum, 50); i++) {
        try {
          const raffleAddress = await executeCall(stableContracts.raffleFactory, 'raffles', [i]);
          const raffleContract = getContractInstance('raffle', raffleAddress);

          if (!raffleContract) continue;

          const userTicketCount = await executeCall(raffleContract, 'ticketsPurchased', [stableAddress]).catch(() => ethers.BigNumber.from(0));

          if (userTicketCount.gt(0)) {
            const [name, ticketPrice, state, startTime, duration] = await Promise.all([
              executeCall(raffleContract, 'name', []).catch(() => `Raffle ${i + 1}`),
              executeCall(raffleContract, 'ticketPrice', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'state', []).catch(() => 0),
              executeCall(raffleContract, 'startTime', []).catch(() => ethers.BigNumber.from(0)),
              executeCall(raffleContract, 'duration', []).catch(() => ethers.BigNumber.from(0))
            ]);

            // Calculate end time
            const endTime = new Date((startTime.add(duration)).toNumber() * 1000);

            tickets.push({
              raffleAddress,
              raffleName: name,
              ticketCount: userTicketCount.toNumber(),
              ticketPrice: ethers.utils.formatEther(ticketPrice),
              totalSpent: ethers.utils.formatEther(ticketPrice.mul(userTicketCount)),
              state: mapRaffleState(state),
              endTime: endTime,
              tickets: Array.from({length: userTicketCount.toNumber()}, (_, i) => i.toString())
            });
          }
        } catch (error) {
          console.log(`Error processing purchased tickets ${i}:`, error);
        }
      }

      setPurchasedTickets(tickets);
    } catch (error) {
      console.error('Error fetching purchased tickets:', error);
      toast.error('Failed to load purchased tickets');
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleFactory, executeCall, getContractInstance, mapRaffleState]);

  // Load data when wallet connects, reset when disconnects
  useEffect(() => {
    if (stableConnected && stableAddress) {
      const loadAllData = async () => {
        setLoading(true);
        try {
          await Promise.all([
            fetchOnChainActivity(),
            fetchCreatedRaffles(),
            fetchPurchasedTickets()
          ]);
        } catch (error) {
          console.error('Error loading profile data:', error);
        } finally {
          setLoading(false);
        }
      };
      loadAllData();
    } else {
      // Reset state when wallet disconnects
      setUserActivity([]);
      setCreatedRaffles([]);
      setPurchasedTickets([]);
      setLoading(false);
      setShowRevenueModal(false);
      setSelectedRaffle(null);
      setActivityStats({
        totalTicketsPurchased: 0,
        totalRafflesCreated: 0,
        totalPrizesWon: 0,
        totalRevenueWithdrawn: '0',
        totalRefundsClaimed: 0
      });
    }
  }, [stableConnected, stableAddress, fetchOnChainActivity, fetchCreatedRaffles, fetchPurchasedTickets]);

  // Revenue withdrawal function
  const withdrawRevenue = useCallback(async (raffleAddress) => {
    if (!raffleAddress || !stableConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const raffleContract = getContractInstance('raffle', raffleAddress);
      if (!raffleContract) {
        toast.error('Invalid raffle contract');
        return;
      }

      await executeTransaction(raffleContract, 'withdrawRevenue', []);
      toast.success('Revenue withdrawn successfully!');
      
      // Refresh data
      fetchCreatedRaffles();
      setShowRevenueModal(false);
      setSelectedRaffle(null);
    } catch (error) {
      console.error('Error withdrawing revenue:', error);
      toast.error(extractRevertReason(error));
    }
  }, [stableConnected, getContractInstance, executeTransaction, fetchCreatedRaffles, extractRevertReason]);

  // Claim refund function
  const claimRefund = useCallback(async (raffleAddress) => {
    if (!raffleAddress || !stableConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const raffleContract = getContractInstance('raffle', raffleAddress);
      if (!raffleContract) {
        toast.error('Invalid raffle contract');
        return;
      }

      await executeTransaction(raffleContract, 'claimRefund', []);
      toast.success('Refund claimed successfully!');
      
      // Refresh data
      fetchPurchasedTickets();
      fetchOnChainActivity();
    } catch (error) {
      console.error('Error claiming refund:', error);
      toast.error(extractRevertReason(error));
    }
  }, [stableConnected, getContractInstance, executeTransaction, fetchPurchasedTickets, fetchOnChainActivity, extractRevertReason]);

  return {
    // Data
    userActivity,
    createdRaffles,
    purchasedTickets,
    activityStats,
    loading,
    
    // Revenue modal state
    showRevenueModal,
    setShowRevenueModal,
    selectedRaffle,
    setSelectedRaffle,
    
    // Functions
    fetchOnChainActivity,
    fetchCreatedRaffles,
    fetchPurchasedTickets,
    withdrawRevenue,
    claimRefund,
    extractRevertReason,
    mapRaffleState,
    
    // Computed values
    creatorStats: {
      totalRaffles: createdRaffles.length,
      activeRaffles: createdRaffles.filter(r => r.state === 'active').length,
      totalRevenue: createdRaffles.reduce((sum, r) => sum + (parseFloat(r.revenue) || 0), 0).toFixed(4),
      monthlyRevenue: '0.0000', // TODO: Calculate monthly revenue
      totalParticipants: createdRaffles.reduce((sum, r) => sum + parseInt(r.ticketsSold || 0), 0),
      uniqueParticipants: createdRaffles.reduce((sum, r) => sum + parseInt(r.ticketsSold || 0), 0), // Simplified
      successRate: createdRaffles.length > 0 ? 
        Math.round((createdRaffles.filter(r => r.state === 'completed' || r.state === 'allPrizesClaimed').length / createdRaffles.length) * 100) : 0
    }
  };
};
