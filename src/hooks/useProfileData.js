import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from '../components/ui/sonner';
import { getTicketsSoldCount } from '../utils/contractCallUtils';

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

  // Fetch on-chain activity (matches desktop implementation)
  const fetchOnChainActivity = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Mobile: Missing requirements:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const activities = [];
      let totalTicketsPurchased = 0;
      let totalPrizesWon = 0;
      let totalRefundsClaimed = 0;

      console.log('Mobile: Available contracts:', {
        raffleDeployer: !!stableContracts.raffleDeployer,
        raffleManager: !!stableContracts.raffleManager,
        revenueManager: !!stableContracts.revenueManager
      });

      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000); // Last 50k blocks

      console.log('Mobile: Fetching activity from block', fromBlock, 'to', currentBlock);

      // 1. Fetch RaffleCreated events from RaffleDeployer (same as desktop)
      if (stableContracts.raffleDeployer) {
        try {
          const raffleCreatedFilter = stableContracts.raffleDeployer.filters.RaffleCreated(null, stableAddress);
          const raffleCreatedEvents = await stableContracts.raffleDeployer.queryFilter(raffleCreatedFilter, fromBlock);

          console.log('Mobile: Found', raffleCreatedEvents.length, 'RaffleCreated events for address:', stableAddress);

          for (const event of raffleCreatedEvents) {
            const block = await provider.getBlock(event.blockNumber);
            try {
              const raffleContract = getContractInstance(event.args.raffle, 'raffle');
              let raffleName = `Raffle ${event.args.raffle.slice(0, 8)}...`;

              if (raffleContract) {
                const nameResult = await executeCall(raffleContract.name, 'name');
                if (nameResult.success && nameResult.result) {
                  raffleName = nameResult.result;
                }
              }

              activities.push({
                id: `created-${event.args.raffle}`,
                type: 'raffle_created',
                raffleAddress: event.args.raffle,
                raffleName,
                timestamp: block.timestamp * 1000,
                blockNumber: event.blockNumber
              });

              // Raffle created - no refund count increment needed
            } catch (error) {
              console.error('Mobile: Error processing RaffleCreated event:', error);
            }
          }
        } catch (error) {
          console.error('Mobile: Error fetching RaffleCreated events:', error);
        }
      }

      // 2. Fetch TicketsPurchased events from all raffles (same as desktop)
      if (stableContracts.raffleManager) {
        try {
          const raffleRegisteredFilter = stableContracts.raffleManager.filters.RaffleRegistered();
          const raffleRegisteredEvents = await stableContracts.raffleManager.queryFilter(raffleRegisteredFilter, fromBlock);

          console.log('Mobile: Found', raffleRegisteredEvents.length, 'registered raffles');

          for (const event of raffleRegisteredEvents) {
            const raffleAddress = event.args.raffle;
            const raffleContract = getContractInstance(raffleAddress, 'raffle');

            if (!raffleContract) continue;

            try {
              // Fetch ticket purchases for this raffle
              const ticketsPurchasedFilter = raffleContract.filters.TicketsPurchased(stableAddress);
              const ticketEvents = await raffleContract.queryFilter(ticketsPurchasedFilter, fromBlock);

              for (const ticketEvent of ticketEvents) {
                const block = await provider.getBlock(ticketEvent.blockNumber);
                try {
                  // Use correct executeCall format
                  const nameResult = await executeCall(raffleContract.name, 'name');
                  const ticketPriceResult = await executeCall(raffleContract.ticketPrice, 'ticketPrice');

                  const raffleName = nameResult.success ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
                  const ticketPrice = ticketPriceResult.success ? ticketPriceResult.result : ethers.BigNumber.from(0);

                  const quantity = ticketEvent.args.quantity.toNumber();
                  const totalCost = ticketPrice.mul ? ticketPrice.mul(ticketEvent.args.quantity) : ethers.BigNumber.from(0);

                  activities.push({
                    id: `ticket-${ticketEvent.transactionHash}`,
                    type: 'ticket_purchase',
                    raffleAddress,
                    raffleName,
                    quantity: quantity,
                    amount: ethers.utils.formatEther(totalCost),
                    timestamp: block.timestamp * 1000,
                    blockNumber: ticketEvent.blockNumber,
                    transactionHash: ticketEvent.transactionHash
                  });

                  totalTicketsPurchased += quantity;
                } catch (error) {
                  console.error('Mobile: Error processing ticket event:', error);
                }
              }

              // Fetch prize claims for this raffle
              const prizeClaimedFilter = raffleContract.filters.PrizeClaimed(stableAddress);
              const prizeEvents = await raffleContract.queryFilter(prizeClaimedFilter, fromBlock);

              for (const prizeEvent of prizeEvents) {
                const block = await provider.getBlock(prizeEvent.blockNumber);
                try {
                  const nameResult = await executeCall(raffleContract.name, 'name');
                  const raffleName = nameResult.success && nameResult.result ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;

                  activities.push({
                    id: `prize-${prizeEvent.transactionHash}`,
                    type: 'prize_claimed',
                    raffleAddress,
                    raffleName,
                    tokenId: prizeEvent.args.tokenId ? prizeEvent.args.tokenId.toString() : 'N/A',
                    timestamp: block.timestamp * 1000,
                    blockNumber: prizeEvent.blockNumber,
                    transactionHash: prizeEvent.transactionHash
                  });

                  totalPrizesWon++;
                } catch (error) {
                  console.error('Mobile: Error processing prize event:', error);
                }
              }

              // Fetch deletion refunds for this raffle
              const deletionRefundFilter = raffleContract.filters.DeletionRefund(stableAddress);
              const deletionRefundEvents = await raffleContract.queryFilter(deletionRefundFilter, fromBlock);
              for (const refundEvent of deletionRefundEvents) {
                const block = await provider.getBlock(refundEvent.blockNumber);
                try {
                  const nameResult = await executeCall(raffleContract.name, 'name');
                  const raffleName = nameResult.success && nameResult.result ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;

                  activities.push({
                    id: `refund-${refundEvent.transactionHash}`,
                    type: 'refund_claimed',
                    raffleAddress,
                    raffleName,
                    amount: ethers.utils.formatEther(refundEvent.args.amount),
                    timestamp: block.timestamp * 1000,
                    blockNumber: refundEvent.blockNumber,
                    transactionHash: refundEvent.transactionHash
                  });

                  totalRefundsClaimed++;
                } catch (error) {
                  console.error('Mobile: Error processing refund event:', error);
                }
              }

              // Fetch full refunds for deletion for this raffle
              const fullRefundFilter = raffleContract.filters.FullRefundForDeletion(stableAddress);
              const fullRefundEvents = await raffleContract.queryFilter(fullRefundFilter, fromBlock);
              for (const refundEvent of fullRefundEvents) {
                const block = await provider.getBlock(refundEvent.blockNumber);
                try {
                  const nameResult = await executeCall(raffleContract.name, 'name');
                  const raffleName = nameResult.success && nameResult.result ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;

                  activities.push({
                    id: `full-refund-${refundEvent.transactionHash}`,
                    type: 'refund_claimed',
                    raffleAddress,
                    raffleName,
                    amount: ethers.utils.formatEther(refundEvent.args.amount),
                    timestamp: block.timestamp * 1000,
                    blockNumber: refundEvent.blockNumber,
                    transactionHash: refundEvent.transactionHash
                  });

                  totalRefundsClaimed++;
                } catch (error) {
                  console.error('Mobile: Error processing full refund event:', error);
                }
              }
            } catch (error) {
              console.error('Mobile: Error processing raffle events:', error);
            }
          }
        } catch (error) {
          console.error('Mobile: Error fetching registered raffles:', error);
        }
      }

      // 3. Fetch AdminWithdrawn events from RevenueManager (same as desktop)
      if (stableContracts.revenueManager) {
        try {
          const adminWithdrawnFilter = stableContracts.revenueManager.filters.AdminWithdrawn(stableAddress);
          const adminWithdrawnEvents = await stableContracts.revenueManager.queryFilter(adminWithdrawnFilter, fromBlock);

          for (const event of adminWithdrawnEvents) {
            const block = await provider.getBlock(event.blockNumber);
            try {
              activities.push({
                id: `admin-${event.transactionHash}`,
                type: 'admin_withdrawn',
                amount: ethers.utils.formatEther(event.args.amount),
                timestamp: block.timestamp * 1000,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
              });
            } catch (error) {
              console.error('Mobile: Error processing admin withdrawal event:', error);
            }
          }
        } catch (error) {
          console.error('Mobile: Error fetching admin withdrawal events:', error);
        }
      }

      // Sort activities by timestamp (newest first)
      activities.sort((a, b) => b.timestamp - a.timestamp);

      console.log('Mobile: Total activities found:', activities.length);
      console.log('Mobile: Activity breakdown:', {
        totalTicketsPurchased,
        totalPrizesWon,
        totalRefundsClaimed,
        activitiesCount: activities.length
      });

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
  }, [stableConnected, stableAddress, provider, stableContracts.raffleDeployer, stableContracts.raffleManager, stableContracts.revenueManager, executeCall, getContractInstance, mapRaffleState]);

  // Fetch created raffles (matches desktop implementation)
  const fetchCreatedRaffles = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Mobile: Missing requirements for fetchCreatedRaffles:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const raffles = [];

      // Use same approach as desktop - get RaffleCreated events from raffleDeployer
      if (stableContracts.raffleDeployer) {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);

        console.log('Mobile: Fetching created raffles from RaffleDeployer');

        const raffleCreatedFilter = stableContracts.raffleDeployer.filters.RaffleCreated(null, stableAddress);
        const raffleCreatedEvents = await stableContracts.raffleDeployer.queryFilter(raffleCreatedFilter, fromBlock);

        console.log('Mobile: Found', raffleCreatedEvents.length, 'created raffles for address:', stableAddress);

        for (const event of raffleCreatedEvents) {
          try {
            const raffleAddress = event.args.raffle;
            const raffleContract = getContractInstance(raffleAddress, 'raffle');

            if (!raffleContract) continue;

            // Use correct executeCall format
            const [nameResult, ticketPriceResult, ticketLimitResult, startTimeResult, durationResult, stateResult] = await Promise.all([
              executeCall(raffleContract.name, 'name'),
              executeCall(raffleContract.ticketPrice, 'ticketPrice'),
              executeCall(raffleContract.ticketLimit, 'ticketLimit'),
              executeCall(raffleContract.startTime, 'startTime'),
              executeCall(raffleContract.duration, 'duration'),
              executeCall(raffleContract.state, 'state')
            ]);

            const name = nameResult.success ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
            const ticketPrice = ticketPriceResult.success ? ticketPriceResult.result : ethers.BigNumber.from(0);
            const ticketLimit = ticketLimitResult.success ? ticketLimitResult.result : ethers.BigNumber.from(0);
            const startTime = startTimeResult.success ? startTimeResult.result : ethers.BigNumber.from(0);
            const duration = durationResult.success ? durationResult.result : ethers.BigNumber.from(0);
            const state = stateResult.success ? stateResult.result : 0;

            // Use fallback approach for tickets sold count (same as RaffleDetailPage)
            const ticketsSoldCount = await getTicketsSoldCount(raffleContract);
            const ticketsSold = ethers.BigNumber.from(ticketsSoldCount);

            // Calculate end time and revenue
            const endTime = new Date((startTime.add(duration)).toNumber() * 1000);
            const revenue = ticketPrice.mul && ticketsSoldCount > 0 ? ticketPrice.mul(ticketsSold) : ethers.BigNumber.from(0);

            raffles.push({
              address: raffleAddress,
              name,
              ticketPrice: ethers.utils.formatEther(ticketPrice),
              maxTickets: ticketLimit.toString(),
              ticketsSold: ticketsSold.toString(),
              endTime: endTime,
              state: mapRaffleState(state),
              revenue: ethers.utils.formatEther(revenue)
            });
          } catch (error) {
            console.error(`Mobile: Error processing created raffle ${raffleAddress}:`, error);
          }
        }
      } else {
        console.log('Mobile: raffleDeployer contract not available');
      }

      setCreatedRaffles(raffles);
    } catch (error) {
      console.error('Error fetching created raffles:', error);
      toast.error('Failed to load created raffles');
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleDeployer, executeCall, getContractInstance, mapRaffleState]);

  // Fetch purchased tickets (matches desktop implementation)
  const fetchPurchasedTickets = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Mobile: Missing requirements for fetchPurchasedTickets:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const tickets = [];

      // Use same approach as desktop - get registered raffles and check each one
      if (stableContracts.raffleManager) {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000);

        console.log('Mobile: Fetching purchased tickets from registered raffles');

        const raffleRegisteredFilter = stableContracts.raffleManager.filters.RaffleRegistered();
        const raffleRegisteredEvents = await stableContracts.raffleManager.queryFilter(raffleRegisteredFilter, fromBlock);

        console.log('Mobile: Checking', raffleRegisteredEvents.length, 'registered raffles for user tickets');

        for (const event of raffleRegisteredEvents) {
          try {
            const raffleAddress = event.args.raffle;
            const raffleContract = getContractInstance(raffleAddress, 'raffle');

            if (!raffleContract) continue;

            // Use desktop approach for contract calls
            const userTicketCountResult = await executeCall(raffleContract.ticketsPurchased, stableAddress);
            const userTicketCount = userTicketCountResult.success ? userTicketCountResult.result : ethers.BigNumber.from(0);

            if (userTicketCount.gt(0)) {
              const [nameResult, ticketPriceResult, stateResult, startTimeResult, durationResult] = await Promise.all([
                executeCall(raffleContract.name, 'name'),
                executeCall(raffleContract.ticketPrice, 'ticketPrice'),
                executeCall(raffleContract.state, 'state'),
                executeCall(raffleContract.startTime, 'startTime'),
                executeCall(raffleContract.duration, 'duration')
              ]);

              const name = nameResult.success ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
              const ticketPrice = ticketPriceResult.success ? ticketPriceResult.result : ethers.BigNumber.from(0);
              const state = stateResult.success ? stateResult.result : 0;
              const startTime = startTimeResult.success ? startTimeResult.result : ethers.BigNumber.from(0);
              const duration = durationResult.success ? durationResult.result : ethers.BigNumber.from(0);

              // Calculate end time and total spent
              const endTime = new Date((startTime.add(duration)).toNumber() * 1000);
              const totalSpent = ticketPrice.mul ? ticketPrice.mul(userTicketCount) : ethers.BigNumber.from(0);

              tickets.push({
                address: raffleAddress,
                name,
                ticketCount: userTicketCount.toNumber(),
                ticketPrice: ethers.utils.formatEther(ticketPrice),
                totalSpent: ethers.utils.formatEther(totalSpent),
                state: mapRaffleState(state),
                endTime: endTime,
                tickets: Array.from({length: userTicketCount.toNumber()}, (_, i) => i.toString())
              });
            }
          } catch (error) {
            console.error(`Mobile: Error processing purchased tickets for raffle ${raffleAddress}:`, error);
          }
        }
      } else {
        console.log('Mobile: raffleManager contract not available');
      }

      setPurchasedTickets(tickets);
    } catch (error) {
      console.error('Error fetching purchased tickets:', error);
      toast.error('Failed to load purchased tickets');
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleManager, executeCall, getContractInstance, mapRaffleState]);

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
      const raffleContract = getContractInstance(raffleAddress, 'raffle');
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
      const raffleContract = getContractInstance(raffleAddress, 'raffle');
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
