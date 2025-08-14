import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { toast } from '../components/ui/sonner';
import { getTicketsSoldCount } from '../utils/contractCallUtils';
import { handleError } from '../utils/errorHandling';
import { APP_CONFIG } from '../constants';

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

  // Adaptive querying helpers to support strict RPCs
  const isRangeOrLimitError = (error) => {
    const msg = ((error?.message || '') + ' ' + (error?.data?.message || '')).toLowerCase();
    return (
      msg.includes('block range') ||
      msg.includes('range too large') ||
      msg.includes('range exceeded') ||
      msg.includes('too many blocks') ||
      msg.includes('exceed') ||
      msg.includes('limit') ||
      msg.includes('overflow') ||
      msg.includes('50000') || msg.includes('10000') || msg.includes('5000')
    );
  };

  const queryFilterAdaptive = async (contract, filter, fromBlock, toBlock, initialChunk = (APP_CONFIG?.profileBlockRangeLimit || 50000), minChunk = 2000) => {
    const results = [];
    const totalSpan = toBlock - fromBlock;
    let chunk = Math.min(initialChunk, Math.max(minChunk, totalSpan));
    let start = fromBlock;

    while (start <= toBlock) {
      const end = Math.min(start + chunk, toBlock);
      try {
        const part = await contract.queryFilter(filter, start, end);
        if (part && part.length) results.push(...part);
        start = end + 1;
      } catch (err) {
        if (isRangeOrLimitError(err)) {
          if (chunk > minChunk) {
            // Halve the chunk and retry without advancing start
            chunk = Math.max(minChunk, Math.floor(chunk / 2));
            console.warn(`Adaptive queryFilter: reducing chunk to ${chunk} due to provider limits`);
            continue;
          } else {
            // Skip this segment silently
            console.warn(`Adaptive queryFilter: skipping segment ${start}-${end} (min chunk still failing)`);
            start = end + 1;
            continue;
          }
        }
        // Non-range errors bubble up
        throw err;
      }
    }
    return results;
  };

  const getLogsAdaptive = async (provider, baseFilter, fromBlock, toBlock, initialChunk = (APP_CONFIG?.profileBlockRangeLimit || 50000), minChunk = 2000) => {
    const results = [];
    const totalSpan = toBlock - fromBlock;
    let chunk = Math.min(initialChunk, Math.max(minChunk, totalSpan));
    let start = fromBlock;

    while (start <= toBlock) {
      const end = Math.min(start + chunk, toBlock);
      try {
        const part = await provider.getLogs({ ...baseFilter, fromBlock: start, toBlock: end });
        if (part && part.length) results.push(...part);
        start = end + 1;
      } catch (err) {
        if (isRangeOrLimitError(err)) {
          if (chunk > minChunk) {
            chunk = Math.max(minChunk, Math.floor(chunk / 2));
            console.warn(`Adaptive getLogs: reducing chunk to ${chunk} due to provider limits`);
            continue;
          } else {
            console.warn(`Adaptive getLogs: skipping segment ${start}-${end} (min chunk still failing)`);
            start = end + 1;
            continue;
          }
        }
        throw err;
      }
    }
    return results;
  };

  // Simple block timestamp cache to avoid repeated getBlock calls
  const blockTimestampCacheRef = useRef(new Map());
  const getBlockTimestampMs = async (blockNumber) => {
    const cache = blockTimestampCacheRef.current;
    if (cache.has(blockNumber)) return cache.get(blockNumber);
    const block = await provider.getBlock(blockNumber);
    const tsMs = (block?.timestamp || 0) * 1000;
    cache.set(blockNumber, tsMs);
    return tsMs;
  };

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
      let totalRevenueWithdrawn = ethers.BigNumber.from(0);

      console.log('Mobile: Available contracts:', {
        raffleDeployer: !!stableContracts.raffleDeployer,
        raffleManager: !!stableContracts.raffleManager,
        revenueManager: !!stableContracts.revenueManager
      });

      const currentBlock = await provider.getBlockNumber();
      const rangeLimit = APP_CONFIG.profileBlockRangeLimit || 50000;
      const fromBlock = Math.max(0, currentBlock - rangeLimit);
      const toBlock = currentBlock;
      console.log('Profile: Fetching activity from block', fromBlock, 'to', toBlock, `(${toBlock - fromBlock} blocks)`);

      // 1. Fetch RaffleCreated events from RaffleDeployer (same as desktop)
      if (stableContracts.raffleDeployer) {
        try {
          const raffleCreatedFilter = stableContracts.raffleDeployer.filters.RaffleCreated(null, stableAddress);
          const raffleCreatedEvents = await queryFilterAdaptive(stableContracts.raffleDeployer, raffleCreatedFilter, fromBlock, toBlock);

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
          const raffleRegisteredEvents = await queryFilterAdaptive(stableContracts.raffleManager, raffleRegisteredFilter, fromBlock, toBlock);

          console.log('Mobile: Found', raffleRegisteredEvents.length, 'registered raffles');

          for (const event of raffleRegisteredEvents) {
            const raffleAddress = event.args.raffle;
            const raffleContract = getContractInstance(raffleAddress, 'raffle');

            if (!raffleContract) continue;

            try {
              // Fetch ticket purchases for this raffle
              const ticketsPurchasedFilter = raffleContract.filters.TicketsPurchased(stableAddress);
              const ticketEvents = await raffleContract.queryFilter(ticketsPurchasedFilter, fromBlock, toBlock);

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

              // Enhanced prize tracking for all prize types
              await trackAllPrizeTypes(raffleContract, raffleAddress, fromBlock);

              async function trackAllPrizeTypes(contract, address, fromBlock) {
                try {
                  // 1. Track NFT Prize Claims (PrizeClaimed events)
                  const prizeClaimedFilter = contract.filters.PrizeClaimed(stableAddress);
                  const prizeEvents = await queryFilterAdaptive(contract, prizeClaimedFilter, fromBlock, toBlock);

                  for (const prizeEvent of prizeEvents) {
                    const block = await provider.getBlock(prizeEvent.blockNumber);
                    try {
                      const nameResult = await executeCall(contract.name, 'name');
                      const raffleName = nameResult.success && nameResult.result ? nameResult.result : `Raffle ${address.slice(0, 8)}...`;

                      activities.push({
                        id: `nft-prize-${prizeEvent.transactionHash}`,
                        type: 'prize_claimed',
                        prizeType: 'NFT',
                        raffleAddress: address,
                        raffleName,
                        tokenId: prizeEvent.args.tokenId ? prizeEvent.args.tokenId.toString() : 'N/A',
                        timestamp: block.timestamp * 1000,
                        blockNumber: prizeEvent.blockNumber,
                        transactionHash: prizeEvent.transactionHash
                      });

                      totalPrizesWon++;
                    } catch (error) {
                      console.error('Mobile: Error processing NFT prize event:', error);
                    }
                  }

                  // 2. Track Native Currency Prize Claims (Transfer events to user)
                  try {
                    // Use ultra-conservative block range for getLogs (much more restrictive than queryFilter)
                    // Look for Transfer events from raffle contract to user (native currency prizes)
                    const transferFilter = {
                      address: address,
                      topics: [
                        ethers.utils.id("Transfer(address,uint256)"), // Native currency transfer signature
                        null,
                        ethers.utils.hexZeroPad(stableAddress, 32)
                      ]
                    };

                    const transferEvents = await getLogsAdaptive(provider, transferFilter, fromBlock, toBlock).catch(error => {
                      // Silently handle getLogs errors for prize tracking
                      const errorMessage = (error.message || '').toLowerCase();
                      if (errorMessage.includes('block range') || errorMessage.includes('too large') || errorMessage.includes('limit')) {
                        console.warn('Mobile: getLogs block range error for native currency prizes, skipping:', errorMessage);
                        return []; // Return empty array to continue processing
                      }
                      throw error; // Re-throw non-block-range errors
                    });

                    for (const transferEvent of transferEvents) {
                      const block = await provider.getBlock(transferEvent.blockNumber);
                      try {
                        const nameResult = await executeCall(contract.name, 'name');
                        const raffleName = nameResult.success && nameResult.result ? nameResult.result : `Raffle ${address.slice(0, 8)}...`;

                        activities.push({
                          id: `native-prize-${transferEvent.transactionHash}`,
                          type: 'prize_claimed',
                          prizeType: 'Native Currency',
                          raffleAddress: address,
                          raffleName,
                          amount: transferEvent.data ? ethers.utils.formatEther(transferEvent.data) : 'Unknown',
                          timestamp: block.timestamp * 1000,
                          blockNumber: transferEvent.blockNumber,
                          transactionHash: transferEvent.transactionHash
                        });

                        totalPrizesWon++;
                      } catch (error) {
                        console.error('Mobile: Error processing native currency prize event:', error);
                      }
                    }
                  } catch (error) {
                    console.log('Mobile: Native currency prize tracking not available for this raffle');
                  }

                  // 3. Track ERC20 Prize Claims
                  try {
                    // Use ultra-conservative block range for getLogs (same as native currency)
                    // Check if raffle has ERC20 prizes
                    const erc20PrizeToken = await executeCall(contract.erc20PrizeToken, 'erc20PrizeToken');
                    if (erc20PrizeToken.success && erc20PrizeToken.result !== ethers.constants.AddressZero) {
                      // Look for ERC20 Transfer events from raffle to user
                      const erc20TransferFilter = {
                        address: erc20PrizeToken.result,
                        topics: [
                          ethers.utils.id("Transfer(address,address,uint256)"),
                          ethers.utils.hexZeroPad(address, 32), // from raffle
                          ethers.utils.hexZeroPad(stableAddress, 32) // to user
                        ]
                      };

                      const erc20Events = await getLogsAdaptive(provider, erc20TransferFilter, fromBlock, toBlock).catch(error => {
                        // Silently handle getLogs errors for ERC20 prize tracking
                        const errorMessage = (error.message || '').toLowerCase();
                        if (errorMessage.includes('block range') || errorMessage.includes('too large') || errorMessage.includes('limit')) {
                          console.warn('Mobile: getLogs block range error for ERC20 prizes, skipping:', errorMessage);
                          return []; // Return empty array to continue processing
                        }
                        throw error; // Re-throw non-block-range errors
                      });

                      for (const erc20Event of erc20Events) {
                        const block = await provider.getBlock(erc20Event.blockNumber);
                        try {
                          const nameResult = await executeCall(contract.name, 'name');
                          const raffleName = nameResult.success && nameResult.result ? nameResult.result : `Raffle ${address.slice(0, 8)}...`;

                          activities.push({
                            id: `erc20-prize-${erc20Event.transactionHash}`,
                            type: 'prize_claimed',
                            prizeType: 'ERC20 Token',
                            raffleAddress: address,
                            raffleName,
                            amount: erc20Event.data ? ethers.utils.formatUnits(erc20Event.data, 18) : 'Unknown',
                            timestamp: block.timestamp * 1000,
                            blockNumber: erc20Event.blockNumber,
                            transactionHash: erc20Event.transactionHash
                          });

                          totalPrizesWon++;
                        } catch (error) {
                          console.error('Mobile: Error processing ERC20 prize event:', error);
                        }
                      }
                    }
                  } catch (error) {
                    console.log('Mobile: ERC20 prize tracking not available for this raffle');
                  }

                } catch (error) {
                  console.error('Mobile: Error in comprehensive prize tracking:', error);
                }
              }

              // Fetch refund claims for this raffle
              const refundClaimedFilter = raffleContract.filters.RefundClaimed(stableAddress);
              const refundClaimedEvents = await queryFilterAdaptive(raffleContract, refundClaimedFilter, fromBlock, toBlock);
              for (const refundEvent of refundClaimedEvents) {
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
              const fullRefundEvents = await queryFilterAdaptive(raffleContract, fullRefundFilter, fromBlock, toBlock);
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

              // Fetch creator revenue withdrawals for this raffle
              const revenueWithdrawnFilter = raffleContract.filters.RevenueWithdrawn(stableAddress);
              const revenueWithdrawnEvents = await queryFilterAdaptive(raffleContract, revenueWithdrawnFilter, fromBlock, toBlock);
              for (const revenueEvent of revenueWithdrawnEvents) {
                const block = await provider.getBlock(revenueEvent.blockNumber);
                try {
                  const nameResult = await executeCall(raffleContract.name, 'name');
                  const raffleName = nameResult.success && nameResult.result ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;

                  activities.push({
                    id: `revenue-withdrawn-${revenueEvent.transactionHash}`,
                    type: 'revenue_withdrawn',
                    raffleAddress,
                    raffleName,
                    amount: ethers.utils.formatEther(revenueEvent.args.amount),
                    timestamp: block.timestamp * 1000,
                    blockNumber: revenueEvent.blockNumber,
                    transactionHash: revenueEvent.transactionHash
                  });

                  // Accumulate the actual ETH amount withdrawn
                  totalRevenueWithdrawn = totalRevenueWithdrawn.add ?
                    totalRevenueWithdrawn.add(revenueEvent.args.amount) :
                    ethers.BigNumber.from(totalRevenueWithdrawn).add(revenueEvent.args.amount);
                } catch (error) {
                  console.error('Mobile: Error processing revenue withdrawal event:', error);
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
          const adminWithdrawnEvents = await queryFilterAdaptive(stableContracts.revenueManager, adminWithdrawnFilter, fromBlock, toBlock);

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
        totalRefundsClaimed,
        totalRevenueWithdrawn
      }));

    } catch (error) {
      // Enhanced block range error detection with comprehensive patterns
      const errorMessage = (error.message || error.toString() || '').toLowerCase();
      const errorData = error.data ? (error.data.message || error.data.toString() || '').toLowerCase() : '';
      const fullErrorText = `${errorMessage} ${errorData}`;

      const isBlockRangeError = fullErrorText.includes('block range') ||
                               fullErrorText.includes('too large') ||
                               fullErrorText.includes('exceed') ||
                               fullErrorText.includes('limit') ||
                               fullErrorText.includes('range too large') ||
                               fullErrorText.includes('maximum') ||
                               fullErrorText.includes('query returned more than') ||
                               fullErrorText.includes('block range limit') ||
                               fullErrorText.includes('too many blocks') ||
                               fullErrorText.includes('range exceeded') ||
                               errorMessage.includes('10000') || // Common block limit
                               errorMessage.includes('5000') ||   // Another common limit
                               errorMessage.includes('50000');    // New 50k limit

      if (isBlockRangeError) {
        console.warn('Mobile: Block range error detected (enhanced detection), suppressing toast:', errorMessage);
        // Don't show toast for block range errors, just log them
        return;
      }

      handleError(error, {
        context: { operation: 'fetchOnChainActivity', isReadOnly: true },
        fallbackMessage: 'Failed to load activity data'
      });
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
        const rangeLimit = APP_CONFIG.profileBlockRangeLimit || 50000;
        const fromBlock = Math.max(0, currentBlock - rangeLimit);
        const toBlock = currentBlock;
        console.log('Profile: Fetching created raffles from RaffleDeployer from block', fromBlock, 'to', toBlock, `(${toBlock - fromBlock} blocks)`);

        const raffleCreatedFilter = stableContracts.raffleDeployer.filters.RaffleCreated(null, stableAddress);
        const raffleCreatedEvents = await queryFilterAdaptive(stableContracts.raffleDeployer, raffleCreatedFilter, fromBlock, toBlock);

        console.log('Mobile: Found', raffleCreatedEvents.length, 'created raffles for address:', stableAddress);

        for (const event of raffleCreatedEvents) {
          try {
            const raffleAddress = event.args.raffle;
            const raffleContract = getContractInstance(raffleAddress, 'raffle');

            if (!raffleContract) continue;

            // Use correct executeCall format
            const [nameResult, ticketPriceResult, ticketLimitResult, startTimeResult, durationResult, stateResult, winnersCountResult, usesCustomPriceResult] = await Promise.all([
              executeCall(raffleContract.name, 'name'),
              executeCall(raffleContract.ticketPrice, 'ticketPrice'),
              executeCall(raffleContract.ticketLimit, 'ticketLimit'),
              executeCall(raffleContract.startTime, 'startTime'),
              executeCall(raffleContract.duration, 'duration'),
              executeCall(raffleContract.state, 'state'),
              executeCall(raffleContract.winnersCount, 'winnersCount'),
              executeCall(raffleContract.usesCustomPrice, 'usesCustomPrice')
            ]);

            const name = nameResult.success ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
            const ticketPrice = ticketPriceResult.success ? ticketPriceResult.result : ethers.BigNumber.from(0);
            const ticketLimit = ticketLimitResult.success ? ticketLimitResult.result : ethers.BigNumber.from(0);
            const startTime = startTimeResult.success ? startTimeResult.result : ethers.BigNumber.from(0);
            const duration = durationResult.success ? durationResult.result : ethers.BigNumber.from(0);
            const state = stateResult.success ? stateResult.result : 0;
            const winnersCountBn = winnersCountResult.success ? winnersCountResult.result : ethers.BigNumber.from(0);
            const usesCustomPrice = usesCustomPriceResult.success ? !!usesCustomPriceResult.result : false;

            // Use fallback approach for tickets sold count (same as RaffleDetailPage)
            const ticketsSoldCount = await getTicketsSoldCount(raffleContract);
            const ticketsSold = ethers.BigNumber.from(ticketsSoldCount);

            // Calculate end time and revenue
            const endTime = new Date((startTime.add(duration)).toNumber() * 1000);
            let revenueWei = ethers.BigNumber.from(0);
            if (usesCustomPrice && ticketPrice.mul) {
              // Creator revenue = winnersCount * ticketPrice when usesCustomPrice is true
              revenueWei = ticketPrice.mul(winnersCountBn);
            } else {
              revenueWei = ethers.BigNumber.from(0);
            }

            raffles.push({
              address: raffleAddress,
              name,
              ticketPrice: ethers.utils.formatEther(ticketPrice),
              maxTickets: ticketLimit.toString(),
              ticketsSold: ticketsSold.toString(),
              endTime: endTime,
              state: mapRaffleState(state),
              stateNum: state, // Add the numeric state for proper badge display
              revenue: ethers.utils.formatEther(revenueWei),
              usesCustomPrice
            });
          } catch (error) {
            console.error(`Mobile: Error processing created raffle ${raffleAddress}:`, error);
          }
        }
      } else {
        console.log('Mobile: raffleDeployer contract not available');
      }

      setCreatedRaffles(raffles);

      // Update activity stats with created raffles count
      setActivityStats(prev => ({
        ...prev,
        totalRafflesCreated: raffles.length
      }));
    } catch (error) {
      // Enhanced block range error detection for fetchCreatedRaffles
      const errorMessage = (error.message || error.toString() || '').toLowerCase();
      const errorData = error.data ? (error.data.message || error.data.toString() || '').toLowerCase() : '';
      const fullErrorText = `${errorMessage} ${errorData}`;

      const isBlockRangeError = fullErrorText.includes('block range') ||
                               fullErrorText.includes('too large') ||
                               fullErrorText.includes('exceed') ||
                               fullErrorText.includes('limit') ||
                               fullErrorText.includes('range too large') ||
                               fullErrorText.includes('maximum') ||
                               fullErrorText.includes('query returned more than') ||
                               fullErrorText.includes('block range limit') ||
                               fullErrorText.includes('too many blocks') ||
                               fullErrorText.includes('range exceeded') ||
                               errorMessage.includes('10000') ||
                               errorMessage.includes('5000') ||
                               errorMessage.includes('50000');

      if (isBlockRangeError) {
        console.warn('Mobile: Block range error in fetchCreatedRaffles (enhanced detection), suppressing toast:', errorMessage);
        // Don't show toast for block range errors, just log them
        return;
      }

      handleError(error, {
        context: { operation: 'fetchCreatedRaffles', isReadOnly: true },
        fallbackMessage: 'Failed to load created raffles'
      });
    }
  }, [stableConnected, stableAddress, provider, stableContracts.raffleDeployer, executeCall, getContractInstance, mapRaffleState]);

  // Fetch purchased tickets using TicketsPurchased events (same approach as Activity tab)
  const fetchPurchasedTickets = useCallback(async () => {
    if (!stableConnected || !stableAddress || !provider) {
      console.log('Missing requirements for fetchPurchasedTickets:', { stableConnected, stableAddress: !!stableAddress, provider: !!provider });
      return;
    }

    try {
      const tickets = [];

      if (stableContracts.raffleManager) {
        const currentBlock = await provider.getBlockNumber();
        const rangeLimit = APP_CONFIG.profileBlockRangeLimit || 50000;
        const fromBlock = Math.max(0, currentBlock - rangeLimit);
        const toBlock = currentBlock;
        console.log('Profile: Fetching purchased tickets using TicketsPurchased events from block', fromBlock, 'to', toBlock, `(${toBlock - fromBlock} blocks)`);

        const raffleRegisteredFilter = stableContracts.raffleManager.filters.RaffleRegistered();
        const raffleRegisteredEvents = await queryFilterAdaptive(stableContracts.raffleManager, raffleRegisteredFilter, fromBlock, toBlock);

        console.log('Checking', raffleRegisteredEvents.length, 'registered raffles for TicketsPurchased events');

        // Group ticket purchases by raffle address
        const ticketsByRaffle = new Map();

        for (const event of raffleRegisteredEvents) {
          try {
            const raffleAddress = event.args.raffle;
            console.log(`Checking raffle ${raffleAddress} for ticket purchases...`);

            const raffleContract = getContractInstance(raffleAddress, 'raffle');

            if (!raffleContract) {
              console.log(`No contract instance for raffle ${raffleAddress}`);
              continue;
            }

            // Fetch TicketsPurchased events for this user in this raffle (exact same as Activity tab)
            const ticketsPurchasedFilter = raffleContract.filters.TicketsPurchased(stableAddress);
            const ticketEvents = await queryFilterAdaptive(raffleContract, ticketsPurchasedFilter, fromBlock, toBlock);

            console.log(`Raffle ${raffleAddress}: Found ${ticketEvents.length} TicketsPurchased events`);

            if (ticketEvents.length > 0) {
              // Process each ticket event to aggregate data (similar to Activity tab approach)
              let totalTickets = 0;
              let totalCost = ethers.BigNumber.from(0);
              let earliestPurchase = null;
              let raffleName = `Raffle ${raffleAddress.slice(0, 8)}...`;
              let ticketPrice = ethers.BigNumber.from(0);

              for (const ticketEvent of ticketEvents) {
                const block = await provider.getBlock(ticketEvent.blockNumber);
                try {
                  // Get raffle details for each event (same as Activity tab)
                  const nameResult = await executeCall(raffleContract.name, 'name');
                  const ticketPriceResult = await executeCall(raffleContract.ticketPrice, 'ticketPrice');

                  raffleName = nameResult.success ? nameResult.result : `Raffle ${raffleAddress.slice(0, 8)}...`;
                  ticketPrice = ticketPriceResult.success ? ticketPriceResult.result : ethers.BigNumber.from(0);

                  const quantity = ticketEvent.args.quantity.toNumber();
                  const cost = ticketPrice.mul ? ticketPrice.mul(ticketEvent.args.quantity) : ethers.BigNumber.from(0);

                  totalTickets += quantity;
                  totalCost = totalCost.add(cost);

                  // Track earliest purchase time
                  if (!earliestPurchase || block.timestamp < earliestPurchase) {
                    earliestPurchase = block.timestamp;
                  }

                  console.log(`Ticket event: ${quantity} tickets, ${ethers.utils.formatEther(cost)} ETH`);
                } catch (error) {
                  console.error('Error processing individual ticket event:', error);
                }
              }

              if (totalTickets > 0) {
                // Get additional raffle details
                const [stateResult, startTimeResult, durationResult] = await Promise.all([
                  executeCall(raffleContract.state, 'state'),
                  executeCall(raffleContract.startTime, 'startTime'),
                  executeCall(raffleContract.duration, 'duration')
                ]);

                const state = stateResult.success ? stateResult.result : 0;
                const startTime = startTimeResult.success ? startTimeResult.result : ethers.BigNumber.from(0);
                const duration = durationResult.success ? durationResult.result : ethers.BigNumber.from(0);
                const endTime = new Date((startTime.add(duration)).toNumber() * 1000);

                const ticketData = {
                  id: raffleAddress, // Required for React key
                  address: raffleAddress,
                  raffleName: raffleName, // Expected by desktop display
                  name: raffleName,
                  ticketCount: totalTickets,
                  ticketPrice: ethers.utils.formatEther(ticketPrice),
                  totalSpent: ethers.utils.formatEther(totalCost),
                  state: mapRaffleState(state),
                  endTime: endTime,
                  purchaseTime: earliestPurchase || startTime.toNumber(),
                  canClaimPrize: false,
                  canClaimRefund: false,
                  tickets: Array.from({length: totalTickets}, (_, i) => i.toString())
                };

                console.log(`Adding ticket data for ${raffleName}:`, ticketData);
                tickets.push(ticketData);
              }
            }
          } catch (error) {
            console.error(`Error processing TicketsPurchased events for raffle ${event.args.raffle}:`, error);
          }
        }
      } else {
        console.log('raffleManager contract not available');
      }

      console.log('Setting purchased tickets:', tickets.length, 'tickets found using TicketsPurchased events');
      setPurchasedTickets(tickets);
    } catch (error) {
      // Enhanced block range error detection for fetchPurchasedTickets
      const errorMessage = (error.message || error.toString() || '').toLowerCase();
      const errorData = error.data ? (error.data.message || error.data.toString() || '').toLowerCase() : '';
      const fullErrorText = `${errorMessage} ${errorData}`;

      const isBlockRangeError = fullErrorText.includes('block range') ||
                               fullErrorText.includes('too large') ||
                               fullErrorText.includes('exceed') ||
                               fullErrorText.includes('limit') ||
                               fullErrorText.includes('range too large') ||
                               fullErrorText.includes('maximum') ||
                               fullErrorText.includes('query returned more than') ||
                               fullErrorText.includes('block range limit') ||
                               fullErrorText.includes('too many blocks') ||
                               fullErrorText.includes('range exceeded') ||
                               errorMessage.includes('10000') ||
                               errorMessage.includes('5000') ||
                               errorMessage.includes('50000');

      if (isBlockRangeError) {
        console.warn('Mobile: Block range error in fetchPurchasedTickets (enhanced detection), suppressing toast:', errorMessage);
        // Don't show toast for block range errors, just log them
        return;
      }

      handleError(error, {
        context: { operation: 'fetchPurchasedTickets', isReadOnly: true },
        fallbackMessage: 'Failed to load purchased tickets'
      });
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
