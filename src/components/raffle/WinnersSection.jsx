import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Clock, Trophy, Users, AlertCircle, CheckCircle, Trash2, ChevronDown } from 'lucide-react';
import { useContract } from '../../contexts/ContractContext';
import { useWallet } from '../../contexts/WalletContext';
import { useNativeCurrency } from '../../hooks/useNativeCurrency';
import { useRaffleEventListener } from '../../hooks/useRaffleService';
import { Button } from '../ui/button';

const POOL_STATE_LABELS = [
  'Pending',
  'Active',
  'Ended',
  'Drawing',
  'Completed',
  'Deleted',
  'AllPrizesClaimed',
  'Unengaged'
];

// Enhanced getExplorerLink: accepts optional chainId, prefers raffle/app context over window.ethereum
// Supports both address and transaction hash links
function getExplorerLink(addressOrTx, chainIdOverride, isTransaction = false) {
  let chainId = 1;
  if (typeof chainIdOverride === 'number') {
    chainId = chainIdOverride;
  } else if (window.ethereum && window.ethereum.chainId) {
    chainId = parseInt(window.ethereum.chainId, 16);
  }
  const explorerMap = {
    1: 'https://etherscan.io',
    5: 'https://goerli.etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    80001: 'https://mumbai.polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    420: 'https://goerli-optimism.etherscan.io',
    42161: 'https://arbiscan.io',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    43114: 'https://snowtrace.io',
    43113: 'https://testnet.snowtrace.io',
    8453: 'https://basescan.org',
    84531: 'https://goerli.basescan.org',
    84532: 'https://sepolia.basescan.org',
    11155420: 'https://sepolia-optimism.etherscan.io', // OP Sepolia
  };
  const baseUrl = explorerMap[chainId] || explorerMap[1];
  const path = isTransaction ? 'tx' : 'address';
  return `${baseUrl}/${path}/${addressOrTx}`;
}

// Enhanced Winner Card Component with improved styling
const WinnerCard = ({ winner, index, raffle, connectedAddress, onToggleExpand, isExpanded, stats, onLoadStats, collectionName, isEscrowedPrize, winnerSelectionTx }) => {
  const isCurrentUser = connectedAddress && winner.address.toLowerCase() === connectedAddress.toLowerCase();
  const { formatPrizeAmount } = useNativeCurrency();
  const [erc20Symbol, setErc20Symbol] = React.useState('TOKEN');
  const [actualAmountPerWinner, setActualAmountPerWinner] = React.useState(null);
  const [collectionSymbol, setCollectionSymbol] = React.useState(null);
  const { getContractInstance } = useContract();
  
  // Use the winner's specific batch transaction hash if available, otherwise fallback to the global one
  const winnerTxHash = winner.batchTxHash || winnerSelectionTx;

  // Fetch ERC20 token symbol if needed
  React.useEffect(() => {
    let isMounted = true;
    async function fetchERC20Symbol() {
      if (!raffle.erc20PrizeToken || raffle.erc20PrizeToken === ethers.constants.AddressZero) return;

      try {
        // Use global cache to avoid repeated calls
        if (!window.__erc20SymbolCache) window.__erc20SymbolCache = {};
        if (window.__erc20SymbolCache[raffle.erc20PrizeToken]) {
          if (isMounted) setErc20Symbol(window.__erc20SymbolCache[raffle.erc20PrizeToken]);
          return;
        }

        const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
        const erc20Abi = ["function symbol() view returns (string)"];
        const contract = new ethers.Contract(raffle.erc20PrizeToken, erc20Abi, provider);
        const symbol = await contract.symbol();

        if (isMounted) {
          setErc20Symbol(symbol);
          window.__erc20SymbolCache[raffle.erc20PrizeToken] = symbol;
        }
      } catch (error) {

        if (isMounted) setErc20Symbol('TOKEN');
      }
    }

    fetchERC20Symbol();
    return () => { isMounted = false; };
  }, [raffle.erc20PrizeToken]);

  // Fetch actual amountPerWinner from contract for all prize types
  React.useEffect(() => {
    let isMounted = true;

    const fetchAmountPerWinner = async () => {
      if (!raffle.isPrized) {
        if (isMounted) setActualAmountPerWinner(null);
        return;
      }

      try {
        const poolContract = getContractInstance(raffle.address, 'pool');
        if (!poolContract) {
          console.warn('Failed to get pool contract instance');
          if (isMounted) setActualAmountPerWinner(raffle.amountPerWinner || 1);
          return;
        }

        // Try to call amountPerWinner() function from contract
        const contractAmountPerWinner = await poolContract.amountPerWinner();
        const amount = contractAmountPerWinner.toNumber ? contractAmountPerWinner.toNumber() : Number(contractAmountPerWinner);

        if (isMounted) {
          setActualAmountPerWinner(amount);
          console.log(`✅ Successfully fetched amountPerWinner from contract ${raffle.address}:`, amount);
        }
      } catch (error) {
        console.warn(`❌ Failed to fetch amountPerWinner from contract ${raffle.address}, using fallback:`, error.message);
        // Fallback to raffle data or default value
        if (isMounted) {
          const fallbackAmount = raffle.amountPerWinner || 1;
          setActualAmountPerWinner(fallbackAmount);
          console.log(`📋 Using fallback amountPerWinner for ${raffle.address}:`, fallbackAmount);
        }
      }
    };

    fetchAmountPerWinner();
    return () => { isMounted = false; };
  }, [raffle.address, raffle.isPrized, raffle.amountPerWinner, getContractInstance]);

  // Fetch collection symbol for NFT prizes (similar to RaffleCard)
  React.useEffect(() => {
    const fetchCollectionSymbol = async () => {
      if (!raffle || !raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        setCollectionSymbol(null);
        return;
      }

      try {
        let contract = null;
        let symbol = null;

        if (typeof raffle.standard !== 'undefined') {
          // Use standard if available (like RaffleCard)
          const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';

          contract = getContractInstance(raffle.prizeCollection, contractType);
          if (contract) {
            try {
              if (typeof contract.symbol === 'function') {
                symbol = await contract.symbol();
              }
            } catch (symbolError) {
              symbol = null;
            }
          }
        } else {
          // Fallback: try both ERC721 and ERC1155 (like RaffleCard)
          try {
            contract = getContractInstance(raffle.prizeCollection, 'erc721Prize');
            if (contract && typeof contract.symbol === 'function') {
              symbol = await contract.symbol();
            }
          } catch (erc721Error) {
            try {
              contract = getContractInstance(raffle.prizeCollection, 'erc1155Prize');
              if (contract && typeof contract.symbol === 'function') {
                symbol = await contract.symbol();
              }
            } catch (erc1155Error) {
              // Both failed, continue with null symbol
            }
          }
        }

        setCollectionSymbol(symbol);
        if (symbol) {
          console.log(`✅ Successfully fetched collection symbol for ${raffle.prizeCollection}:`, symbol);
        }
      } catch (error) {
        console.warn('Failed to fetch collection symbol:', error);
        setCollectionSymbol(null);
      }
    };

    fetchCollectionSymbol();
  }, [raffle, getContractInstance]);

  const formatAddress = (address) => {
    return address; // Display full address instead of truncated
  };

  const getPrizeInfo = () => {
    if (!raffle.isPrized) return 'No Prize';

    // Show loading state while fetching amountPerWinner from contract
    if (actualAmountPerWinner === null && raffle.isPrized) {
      return 'Loading prize info...';
    }

    // Use actualAmountPerWinner from contract if available, otherwise fallback to raffle data
    const amountPerWinner = actualAmountPerWinner !== null ? actualAmountPerWinner : (raffle.amountPerWinner || 1);

    // Calculate actualWinnersCount based on contract formula:
    // bool isTokenGated = holderData.holderTokenAddress != address(0);
    // uint256 actualWinnersCount = isTokenGated && winnersSelected < _winnersCount ? winnersSelected : _winnersCount;
    const isTokenGated = raffle.holderTokenAddress && raffle.holderTokenAddress !== ethers.constants.AddressZero;
    const winnersSelected = raffle.winnersSelected || 0;
    const winnersCount = raffle.winnersCount || 1;
    const actualWinnersCount = (isTokenGated && winnersSelected < winnersCount && winnersSelected > 0) 
      ? winnersSelected 
      : winnersCount;

    // winsToClaim for this winner (typically 1, but could be more if winner won multiple times)
    const winsToClaim = winner.claimedWins || 1;

    // Native Prize - Calculate using contract formula:
    // totalPrize = (prizeData.nativePrizeAmount / actualWinnersCount) * winsToClaim
    if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
      // Calculate prize per winner, then multiply by winsToClaim
      const prizePerWinner = raffle.nativePrizeAmount.div(actualWinnersCount);
      const totalPrize = prizePerWinner.mul(winsToClaim);

      const result = formatPrizeAmount(totalPrize);
      return result;
    }

    // ERC20 Prize - Calculate using contract formula:
    // totalPrize = (prizeData.erc20PrizeAmount * winsToClaim) / actualWinnersCount
    if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero &&
        raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
      // Calculate: (erc20PrizeAmount * winsToClaim) / actualWinnersCount
      const totalPrize = raffle.erc20PrizeAmount.mul(winsToClaim).div(actualWinnersCount);

      const formattedAmount = ethers.utils.formatUnits(totalPrize, 18);
      const result = `${formattedAmount} ${erc20Symbol}`;
      return result;
    }

    // NFT Prizes (ERC721/ERC1155) - Use amountPerWinner from contract
    if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
      if (raffle.standard === 0) {
        // ERC721: Different display logic for escrowed vs mintable
        // Use isEscrowedPrize prop passed from parent component

        if (isEscrowedPrize) {
          // For escrowed ERC721 prizes: show symbol + token ID (e.g., "BAYC #23") - NO amount
          const tokenId = raffle.prizeTokenId?.toString ? raffle.prizeTokenId.toString() : raffle.prizeTokenId;
          const prizeId = (tokenId !== undefined && tokenId !== null && tokenId !== '0')
            ? `#${tokenId}`
            : '#Unknown';

          let result;
          if (collectionSymbol) {
            result = `${collectionSymbol} ${prizeId}`; // Use symbol if available (e.g., "BAYC #23")
          } else if (collectionName) {
            result = `${collectionName} ${prizeId}`; // Fall back to name if no symbol
          } else {
            result = `ERC721 NFT ${prizeId}`; // Final fallback
          }

          return result;
        } else {
          // For mintable ERC721 prizes: show amount + symbol (e.g., "1 BAYC")
          const displayName = collectionSymbol || collectionName || 'ERC721 NFT';
          const totalAmount = amountPerWinner * winsToClaim;
          const result = `${totalAmount} ${displayName}`;

          return result;
        }
      }
      if (raffle.standard === 1) {
        // ERC1155: Use amountPerWinner from contract (variable amount per winner)
        const name = collectionName || 'ERC1155 Token';
        const totalAmount = amountPerWinner * winsToClaim;
        return `${totalAmount} ${name}`;
      }
    }

    return 'Prize Available';
  };

  const getClaimStatus = () => {
    if (!raffle.isPrized) return {
      text: 'No Prize',
      color: 'text-muted-foreground',
      icon: '—',
      bgColor: 'bg-muted/20'
    };
    if (winner.prizeClaimed) return {
      text: 'Claimed',
      color: 'text-green-700',
      icon: 'green-dot',
      bgColor: 'bg-green-100'
    };
    return {
      text: 'Unclaimed',
      color: 'text-orange-700',
      icon: '⏳',
      bgColor: 'bg-orange-100'
    };
  };

  const claimStatus = getClaimStatus();

  return (
    <div className={`detail-beige-card text-foreground bg-card border-2 rounded-xl transition-all duration-200 hover:shadow-md ${
      isCurrentUser ? 'border-yellow-400 winner-card-highlight' : 'border-[#614E41]'
    }`}>
      <div className="px-2 py-3 sm:px-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex-shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${isCurrentUser ? 'bg-yellow-400' : 'bg-primary'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm font-medium break-all" title={winner.address}>
                {formatAddress(winner.address)}
              </div>
              {isCurrentUser && (
                <div className="text-xs winner-text-highlight font-medium mt-0.5">
                  Your Address
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={() => onToggleExpand(winner, index)}
            variant="tertiary"
            size="icon"
            className="winner-card-expand flex-shrink-0"
            title={isExpanded ? "Hide details" : "View details"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isCurrentUser ? 'text-yellow-400' : 'text-primary'}`} />
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-border">
            {stats ? (
              stats.error ? (
                <div className="text-center py-4">
                  <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
                  <div className="text-red-500 text-sm font-medium">{stats.error}</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Participation Details, Prize & Claim Status</div>
                  
                  {/* Prize and Claim Status - moved from always visible */}
                  {raffle.isPrized && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3 text-sm p-3 bg-muted/30 rounded-lg">
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground text-xs uppercase tracking-wide">Prize</span>
                        <div className="font-medium">{getPrizeInfo()}</div>
                      </div>
                      <div className="space-y-0.5 sm:text-right">
                        <span className="text-muted-foreground text-xs tracking-wide block">Status</span>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${claimStatus.bgColor} ${claimStatus.color}`}>
                          {claimStatus.icon === 'green-dot' ? (
                            <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400"></div>
                          ) : (
                            <span>{claimStatus.icon}</span>
                          )}
                          <span>{claimStatus.text}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Participation Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Slots Purchased</span>
                      <div className="font-semibold text-base">{stats.ticketsPurchased}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Winning Slots</span>
                      <div className="font-semibold text-base text-green-600 flex items-center gap-2">
                        {stats.winningTickets}
                        {winnerTxHash && (
                          <a
                            href={getExplorerLink(winnerTxHash, raffle.chainId, true)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center"
                            title="View winner selection transaction on block explorer"
                          >
                            <img
                              src="/images/etherscan logos/etherscan-logo-circle.svg"
                              alt="Etherscan"
                              width="16"
                              height="16"
                              className="opacity-80 hover:opacity-100 transition-opacity"
                            />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Losing Slots</span>
                      <div className="font-semibold text-base text-red-600">{stats.losingTickets}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Win Rate</span>
                      <div className="font-semibold text-base">
                        {stats.ticketsPurchased > 0
                          ? `${((stats.winningTickets / stats.ticketsPurchased) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto mb-2"></div>
                <div className="text-sm text-muted-foreground">Loading participation details...</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const WinnersSection = React.memo(({ raffle, isMintableERC721, isEscrowedPrize, isMobile, onWinnerCountChange, onWinnersSelectedChange }) => {
  const { getContractInstance, executeTransaction } = useContract();
  const { address: connectedAddress } = useWallet();
  const { formatPrizeAmount } = useNativeCurrency();
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedWinner, setExpandedWinner] = useState(null);
  const [winnerStats, setWinnerStats] = useState({});
  const [winnerSelectionTx, setWinnerSelectionTx] = useState(null);
  const [winnerTxMap, setWinnerTxMap] = useState({}); // Maps winner address to their batch transaction hash
  const [collectionName, setCollectionName] = useState(null);
  const [collectionSymbol, setCollectionSymbol] = useState(null);
  const [erc20Symbol, setErc20Symbol] = useState('TOKEN');
  const [lastWinnersUpdate, setLastWinnersUpdate] = useState(null);
  const [winnersSelectedCount, setWinnersSelectedCount] = useState(raffle?.winnersSelected || 0);

  // Fetch historical winner selection transaction for completed raffles
  const fetchWinnerSelectionTx = useCallback(async () => {
    console.log('fetchWinnerSelectionTx called:', { raffle: !!raffle, winnerSelectionTx, stateNum: raffle?.stateNum });
    if (!raffle || winnerSelectionTx) return;
    
    // Only fetch for completed raffles
    const isCompleted = raffle.stateNum === 4 || raffle.stateNum === 6;
    console.log('Is raffle completed?', isCompleted);
    if (!isCompleted) return;
    
    try {
      const poolContract = getContractInstance && getContractInstance(raffle.address, 'pool');
      console.log('Pool contract:', !!poolContract);
      if (!poolContract) return;
      
      // Try to get transaction from block explorer API instead
      console.log('Fetching from block explorer...');
      
      // Get the latest block number and search backwards
      const provider = poolContract.provider;
      const latestBlock = await provider.getBlockNumber();
      
      // Search last 10000 blocks for WinnersSelected events (same as pool metadata service)
      const fromBlock = Math.max(0, latestBlock - 10000);
      console.log(`Searching blocks ${fromBlock} to ${latestBlock}`);
      
      const filter = poolContract.filters.WinnersSelected();
      const events = await poolContract.queryFilter(filter, fromBlock, latestBlock);
      console.log('Events found:', events?.length || 0);
      
      if (events && events.length > 0) {
        // Build winner-to-transaction mapping from all events
        const txMap = {};
        
        // Process events in order (oldest first)
        for (const event of events) {
          if (event.args && event.args.winners) {
            // Map each winner address to this transaction hash
            event.args.winners.forEach(winnerAddress => {
              const normalizedAddress = winnerAddress.toLowerCase();
              if (!txMap[normalizedAddress]) {
                txMap[normalizedAddress] = event.transactionHash;
              }
            });
          }
        }
        
        // Set the mapping
        setWinnerTxMap(txMap);
        
        // Also set the latest transaction for backward compatibility
        const latestEvent = events[events.length - 1];
        console.log('Historical WinnersSelected event:', latestEvent);
        console.log('Transaction hash:', latestEvent.transactionHash);
        console.log('Winner-to-Tx mapping:', txMap);
        setWinnerSelectionTx(latestEvent.transactionHash);
      } else {
        console.log('No WinnersSelected events found in last 10000 blocks');
        // Fallback: try to get from the transaction that changed state to Completed
        try {
          const stateChangeFilter = poolContract.filters.StateChanged(3, 4); // Drawing -> Completed
          const stateChangeEvents = await poolContract.queryFilter(stateChangeFilter, fromBlock, latestBlock);
          if (stateChangeEvents && stateChangeEvents.length > 0) {
            const latestStateChange = stateChangeEvents[stateChangeEvents.length - 1];
            console.log('Using state change transaction:', latestStateChange.transactionHash);
            setWinnerSelectionTx(latestStateChange.transactionHash);
          }
        } catch (fallbackError) {
          console.warn('Fallback also failed:', fallbackError);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch historical WinnersSelected event:', error);
      // Final fallback: use a block explorer API call
      try {
        const chainId = raffle.chainId || 84532; // Default to Base Sepolia
        const explorerUrl = chainId === 84532 
          ? 'https://api-sepolia.basescan.org/api'
          : 'https://api.etherscan.io/api';
        
        const response = await fetch(
          `${explorerUrl}?module=logs&action=getLogs&address=${raffle.address}&topic0=0x${ethers.utils.id('WinnersSelected(address[])').slice(2)}&apikey=YourApiKeyToken`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === '1' && data.result.length > 0) {
            const txHash = data.result[0].transactionHash;
            console.log('Found transaction via explorer API:', txHash);
            setWinnerSelectionTx(txHash);
          }
        }
      } catch (apiError) {
        console.warn('Explorer API fallback failed:', apiError);
      }
    }
  }, [raffle, winnerSelectionTx, getContractInstance]);

  // WinnersSection is primarily for display - claim logic is handled by parent component

  // Event listener for real-time winner updates
  // Stop listening for winner selection events after raffle is completed
  const isRaffleCompleted = raffle?.stateNum === 4 || raffle?.stateNum === 6; // Completed or AllPrizesClaimed (6)
  const shouldListenForWinners = !!raffle && !isRaffleCompleted;

  const { isListening, eventHistory } = useRaffleEventListener(raffle?.address, {
    onWinnersSelected: (winners, event) => {
      console.log('WinnersSelected event:', event);
      console.log('Event transactionHash:', event?.transactionHash);
      console.log('Event log:', event?.log);
      console.log('Event log transactionHash:', event?.log?.transactionHash);
      setWinnerSelectionTx(event?.transactionHash || event?.log?.transactionHash);
      setLastWinnersUpdate(Date.now());
      // Trigger immediate winners refetch - no delay needed with enhanced event handling
      fetchWinners();

      // Additional resilience: Retry fetch after delay to handle RPC issues
      setTimeout(() => {
        fetchWinners();
      }, 5000); // 5 second delay
    },
    onStateChange: (newState, blockNumber) => {

      if (newState === 4 || newState === 6) {
        setLastWinnersUpdate(Date.now());
        setTimeout(() => {
          fetchWinners();
        }, 1000);

        // Additional fetch for RPC resilience
        setTimeout(() => {

          fetchWinners();
        }, 6000);
      }
    },
    onPrizeClaimed: (winner, tokenId, event) => {

      // Refresh winners to update claim status
      setTimeout(() => {
        fetchWinners();
      }, 1000);
    },
    onRpcError: (error) => {
      // Log RPC errors for debugging but rely on auto-refresh timer instead
      console.warn('WinnersSection RPC error:', error);
    },
    enablePolling: true,
    pollingInterval: raffle?.stateNum === 3 ? 8000 : 12000, // Faster polling during Drawing state
    autoStart: shouldListenForWinners, // Stop listening after completion
    raffleState: raffle?.stateNum || null,
    enableStateConditionalListening: true,
    stopOnCompletion: true // New flag to stop winner selection listening after completion
  });

  // For now, we'll skip the transaction hash fetching due to RPC limitations
  // The transaction link feature can be implemented later when we have better RPC support
  useEffect(() => {
    // Set to null for now - we can implement this feature later
    setWinnerSelectionTx(null);
  }, [raffle]);

  // Fetch collection name and symbol for NFT prizes
  useEffect(() => {
    const fetchCollectionInfo = async () => {
      if (!raffle || !raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        setCollectionName(null);
        setCollectionSymbol(null);
        return;
      }

      try {
        const contract = getContractInstance(raffle.prizeCollection, raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize');
        const name = await contract.name();
        setCollectionName(name);
        
        // Try to fetch symbol
        try {
          if (typeof contract.symbol === 'function') {
            const symbol = await contract.symbol();
            setCollectionSymbol(symbol);
          }
        } catch (symbolError) {
          setCollectionSymbol(null);
        }
      } catch (error) {
        setCollectionName(null);
        setCollectionSymbol(null);
      }
    };

    fetchCollectionInfo();
  }, [raffle, getContractInstance]);

  // Fetch ERC20 token symbol if needed
  useEffect(() => {
    const fetchERC20Symbol = async () => {
      if (!raffle?.erc20PrizeToken || raffle.erc20PrizeToken === ethers.constants.AddressZero) {
        return;
      }

      try {
        // Use global cache to avoid repeated calls
        if (!window.__erc20SymbolCache) window.__erc20SymbolCache = {};
        if (window.__erc20SymbolCache[raffle.erc20PrizeToken]) {
          setErc20Symbol(window.__erc20SymbolCache[raffle.erc20PrizeToken]);
          return;
        }

        const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
        const erc20Abi = ["function symbol() view returns (string)"];
        const contract = new ethers.Contract(raffle.erc20PrizeToken, erc20Abi, provider);
        const symbol = await contract.symbol();

        setErc20Symbol(symbol);
        window.__erc20SymbolCache[raffle.erc20PrizeToken] = symbol;
      } catch (error) {
        setErc20Symbol('TOKEN');
      }
    };

    fetchERC20Symbol();
  }, [raffle?.erc20PrizeToken]);

  // Extract fetchWinners function so it can be called by event listeners
  const fetchWinners = useCallback(async () => {
    // Enhanced logic: Try to fetch winners even if state hasn't transitioned yet
    // This handles the case where WinnersSelected event was emitted but state is still "Drawing"
    if (!raffle) {
      setWinners([]);
      onWinnerCountChange?.(0);
      return;
    }

    const allowedStates = [3, 4, 6];
    if (!allowedStates.includes(raffle.stateNum)) {
      setWinners([]);
      onWinnerCountChange?.(0);
      return;
    }

    setLoading(true);
    try {
      const poolContract = getContractInstance && getContractInstance(raffle.address, 'pool');
      if (!poolContract) {
        setWinners([]);
        onWinnerCountChange?.(0);
        setLoading(false);
        return;
      }

      const winnersCount = await poolContract.winnersCount();
      const count = winnersCount.toNumber ? winnersCount.toNumber() : Number(winnersCount);

      if (count === 0) {
        setWinners([]);
        onWinnerCountChange?.(0);
        setLoading(false);
        return;
      }

      const winnersArray = [];
      for (let i = 0; i < count; i++) {
          try {
            const winnerAddress = await poolContract.winners(i);

            if (winnerAddress === ethers.constants.AddressZero || winnerAddress === '0x0000000000000000000000000000000000000000') {
              continue;
            }

            const claimedWins = await poolContract.claimedWins(winnerAddress);
            const prizeClaimed = await poolContract.prizeClaimed(winnerAddress);

            winnersArray.push({
              address: winnerAddress,
              index: i,
              claimedWins: claimedWins.toNumber ? claimedWins.toNumber() : Number(claimedWins),
              prizeClaimed: prizeClaimed && (prizeClaimed.toNumber ? prizeClaimed.toNumber() > 0 : Number(prizeClaimed) > 0),
              batchTxHash: winnerTxMap[winnerAddress.toLowerCase()] || winnerSelectionTx // Use specific batch tx or fallback to latest
            });
          } catch (error) {
            continue;
          }
      }
      setWinners(winnersArray);
      onWinnerCountChange?.(winnersArray.length);
    } catch (error) {
      setWinners([]);
      onWinnerCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [raffle, getContractInstance, winnerTxMap, winnerSelectionTx, onWinnerCountChange]);

  // Update winners with batch transaction hashes when winnerTxMap changes
  useEffect(() => {
    if (Object.keys(winnerTxMap).length > 0 && winners.length > 0) {
      setWinners(prevWinners => 
        prevWinners.map(winner => ({
          ...winner,
          batchTxHash: winnerTxMap[winner.address.toLowerCase()] || winnerSelectionTx
        }))
      );
    }
  }, [winnerTxMap, winnerSelectionTx, winners.length]);

  // Initial fetch and dependency-based refetch
  useEffect(() => {
    fetchWinners();
  }, [fetchWinners, lastWinnersUpdate]);

  // Fetch historical winner selection transaction for completed raffles
  useEffect(() => {
    fetchWinnerSelectionTx();
  }, [fetchWinnerSelectionTx]);

  // Sync winnersSelectedCount with raffle prop when it changes
  useEffect(() => {
    if (raffle?.winnersSelected !== undefined) {
      setWinnersSelectedCount(raffle.winnersSelected);
    }
  }, [raffle?.winnersSelected]);

  // Polling mechanism for Drawing state - checks for new winners every 15 seconds
  useEffect(() => {
    if (!raffle || raffle.stateNum !== 3) return; // Only poll during Drawing state

    console.log('🎯 WinnersSection: Starting winner polling for Drawing state');

    let lastWinnersCount = winnersSelectedCount;

    const pollingInterval = setInterval(async () => {
      try {
        const poolContract = getContractInstance && getContractInstance(raffle.address, 'pool');
        if (!poolContract) return;

        // Check current winners count on contract
        const winnersSelectedOnChain = await poolContract.winnersSelected();
        const currentCount = winnersSelectedOnChain.toNumber ? winnersSelectedOnChain.toNumber() : Number(winnersSelectedOnChain);

        console.log(`🔍 Polling: ${currentCount} winners on-chain, ${lastWinnersCount} in local state`);

        // If new winners detected, fetch the updated list and update count
        if (currentCount > lastWinnersCount) {
          console.log(`✨ New winners detected! Fetching updated list...`);
          setWinnersSelectedCount(currentCount);
          onWinnersSelectedChange?.(currentCount);
          await fetchWinners();
          lastWinnersCount = currentCount;
        }
      } catch (error) {
        console.warn('Winner polling error:', error);
      }
    }, 15000); // Poll every 15 seconds

    return () => {
      console.log('🎯 WinnersSection: Stopping winner polling');
      clearInterval(pollingInterval);
    };
  }, [raffle, raffle?.stateNum, winnersSelectedCount, getContractInstance, fetchWinners, onWinnersSelectedChange]);

  // Debug logging removed - state management simplified

  // Prize claiming is handled by the parent component

  // Refund claiming is handled by the parent component

  const getPrizeTypeDescription = () => {
    if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
      return formatPrizeAmount(raffle.nativePrizeAmount);
    } else if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
      return `${ethers.utils.formatUnits(raffle.erc20PrizeAmount, 18)} ERC20 tokens`;
    } else if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
      return raffle.standard === 0 ? 'ERC721 NFT' : 'ERC1155 NFT';
    }
    return 'prize';
  };

  const getStateDisplay = () => {
    const label = POOL_STATE_LABELS[raffle.stateNum] || 'Unknown';
    switch (label) {
      case 'Pending':
        return (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Raffle Pending</h3>
            <p className="text-muted-foreground">Winners will be announced after the raffle ends and drawing is complete.</p>
          </div>
        );
      case 'Active':
        return (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Raffle Active</h3>
            <p className="text-muted-foreground">Raffle is currently active. Winners will be announced after it ends.</p>
          </div>
        );
      case 'Ended':
        return (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Raffle Ended</h3>
            <p className="text-muted-foreground">Raffle has ended. Waiting for winner selection to begin.</p>
          </div>
        );
      case 'Drawing':
        return (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Drawing in Progress</h3>
                <p className="text-muted-foreground">Loading winners...</p>
              </div>
            ) : winners.length > 0 ? (
              <>
                <div className="max-h-96 overflow-y-auto pr-2">
                  <div className="space-y-3 pb-4">
                    {winners.map((winner, i) => (
                      <WinnerCard
                        key={winner.index}
                        winner={winner}
                        index={i}
                        raffle={raffle}
                        connectedAddress={connectedAddress}
                        onToggleExpand={handleToggleExpand}
                        isExpanded={expandedWinner === i}
                        stats={winnerStats[winner.address]}
                        onLoadStats={handleToggleExpand}
                        collectionName={collectionName}
                        isEscrowedPrize={isEscrowedPrize}
                        winnerSelectionTx={winnerSelectionTx}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Drawing in Progress</h3>
                <p className="text-muted-foreground">Winners are being selected. Please wait...</p>
              </div>
            )}
          </div>
        );
      case 'Completed':
      case 'Prizes Claimed':
      case 'AllPrizesClaimed':
        return (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading winners...</p>
              </div>
            ) : winners.length > 0 ? (
              <>
                <div className="max-h-96 overflow-y-auto pr-2">
                  <div className="space-y-3 pb-4">
                    {winners.map((winner, i) => (
                      <WinnerCard
                        key={winner.index}
                        winner={winner}
                        index={i}
                        raffle={raffle}
                        connectedAddress={connectedAddress}
                        onToggleExpand={handleToggleExpand}
                        isExpanded={expandedWinner === i}
                        stats={winnerStats[winner.address]}
                        onLoadStats={handleToggleExpand}
                        collectionName={collectionName}
                        isEscrowedPrize={isEscrowedPrize}
                        winnerSelectionTx={winnerSelectionTx}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No winners data available.</p>
              </div>
            )}
          </div>
        );
      case 'Deleted':
        return (
          <div className="text-center py-8">
            <Trash2 className="h-12 w-12 text-foreground/60 mx-auto mb-4" />
            <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Raffle Deleted</h3>
            <p className="text-muted-foreground">This raffle has been deleted and is no longer active.</p>
          </div>
        );
      case 'Activation Failed':
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Activation Failed</h3>
            <p className="text-muted-foreground">Raffle activation failed. Please contact support or try again.</p>
          </div>
        );
      case 'Unengaged':
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2">Unengaged Raffle</h3>
            <p className="text-muted-foreground">This raffle had fewer participants than the required number of winners before its duration elapsed.</p>
          </div>
        );
      default:
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Unknown raffle state.</p>
          </div>
        );
    }
  };

  const handleToggleExpand = async (winner, index) => {
    if (expandedWinner === index) {
      setExpandedWinner(null);
      return;
    }

    setExpandedWinner(index);

    // Load stats if not already loaded
    if (!winnerStats[winner.address]) {
      try {
        const poolContract = getContractInstance(raffle.address, 'pool');
        const slotsPurchased = await poolContract.slotsPurchased(winner.address);
        const winningSlots = await poolContract.winsPerAddress(winner.address);
        const prizeClaimed = await poolContract.prizeClaimed(winner.address);

        const purchasedCount = slotsPurchased.toNumber ? slotsPurchased.toNumber() : Number(slotsPurchased);
        const winningCount = winningSlots.toNumber ? winningSlots.toNumber() : Number(winningSlots);
        const claimedCount = prizeClaimed.toNumber ? prizeClaimed.toNumber() : Number(prizeClaimed);

        setWinnerStats(prev => ({
          ...prev,
          [winner.address]: {
            ticketsPurchased: purchasedCount,
            winningTickets: winningCount,
            losingTickets: purchasedCount - winningCount,
            prizeClaimed: claimedCount > 0
          }
        }));
      } catch (e) {
        setWinnerStats(prev => ({
          ...prev,
          [winner.address]: { error: 'Failed to fetch stats' }
        }));
      }
    }
  };

  // Table-based row layout for winners (matching screenshot design)
  const renderWinnersTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (winners.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No winners yet</p>
        </div>
      );
    }

    // Use the winner's specific batch transaction hash if available
    const getWinnerTxHash = (winner) => winner.batchTxHash || winnerSelectionTx;

    // Calculate prize display for each winner using contract formula
    const getWinnerPrizeDisplay = (winner) => {
      if (!raffle.isPrized) return '—';

      // Calculate actualWinnersCount based on contract formula
      const isTokenGated = raffle.holderTokenAddress && raffle.holderTokenAddress !== ethers.constants.AddressZero;
      const winnersSelected = raffle.winnersSelected || 0;
      const winnersCount = raffle.winnersCount || 1;
      const actualWinnersCount = (isTokenGated && winnersSelected < winnersCount && winnersSelected > 0) 
        ? winnersSelected 
        : winnersCount;

      // winsToClaim for this winner (typically 1)
      const winsToClaim = winner.claimedWins || 1;

      // Native Prize: (nativePrizeAmount / actualWinnersCount) * winsToClaim
      if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
        const prizePerWinner = raffle.nativePrizeAmount.div(actualWinnersCount);
        const totalPrize = prizePerWinner.mul(winsToClaim);
        return formatPrizeAmount(totalPrize);
      }

      // ERC20 Prize: (erc20PrizeAmount * winsToClaim) / actualWinnersCount
      if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero &&
          raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
        const totalPrize = raffle.erc20PrizeAmount.mul(winsToClaim).div(actualWinnersCount);
        const formattedAmount = ethers.utils.formatUnits(totalPrize, 18);
        return `${formattedAmount} ${erc20Symbol}`;
      }

      // NFT Prizes
      if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
        const amountPerWinner = raffle.amountPerWinner || 1;
        
        if (raffle.standard === 0) {
          // ERC721
          if (isEscrowedPrize) {
            // Escrowed: show symbol + token ID
            const tokenId = raffle.prizeTokenId?.toString ? raffle.prizeTokenId.toString() : raffle.prizeTokenId;
            const prizeId = (tokenId !== undefined && tokenId !== null && tokenId !== '0') ? `#${tokenId}` : '';
            const displayName = collectionSymbol || collectionName || 'NFT';
            return `${displayName} ${prizeId}`.trim();
          } else {
            // Mintable: show amount + symbol
            const displayName = collectionSymbol || collectionName || 'NFT';
            const totalAmount = amountPerWinner * winsToClaim;
            return `${totalAmount} ${displayName}`;
          }
        }
        
        if (raffle.standard === 1) {
          // ERC1155
          const displayName = collectionSymbol || collectionName || 'Token';
          const totalAmount = amountPerWinner * winsToClaim;
          return `${totalAmount} ${displayName}`;
        }
      }

      return '—';
    };

    return (
      <div className="w-full">
        {/* Table Header - conditionally show Prize/Status columns only for prized pools (hidden on mobile) */}
        <div className={`flex md:grid gap-2 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50 bg-muted/20 ${
          raffle.isPrized ? 'md:grid-cols-12' : 'md:grid-cols-12'
        }`}>
          <div className="md:col-span-1">#</div>
          <div className={raffle.isPrized ? 'md:col-span-5' : 'md:col-span-11'}>Winner</div>
          {raffle.isPrized && (
            <>
              <div className="hidden md:block md:col-span-3 text-center">Prize</div>
              <div className="hidden md:block md:col-span-3 text-right">Status</div>
            </>
          )}
        </div>
        
        {/* Table Rows */}
        <div className="divide-y divide-border/30">
          {winners.map((winner, i) => {
            const isCurrentUser = connectedAddress && winner.address.toLowerCase() === connectedAddress.toLowerCase();
            const claimStatus = winner.prizeClaimed 
              ? { text: 'Claimed', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' }
              : { text: 'Unclaimed', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' };
            const winnerTxHash = getWinnerTxHash(winner);
            
            return (
              <div 
                key={winner.index}
                className={`flex md:grid gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors ${
                  raffle.isPrized ? 'md:grid-cols-12' : 'md:grid-cols-12'
                } ${isCurrentUser ? 'bg-yellow-500/10 border-l-2 border-l-yellow-400' : ''}`}
              >
                {/* Rank */}
                <div className="md:col-span-1 text-sm font-medium text-muted-foreground">
                  {i + 1}
                </div>
                
                {/* Winner Address with Etherscan link */}
                <div className={`flex items-center gap-2 min-w-0 ${raffle.isPrized ? 'md:col-span-5' : 'md:col-span-11'}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCurrentUser ? 'bg-yellow-400' : 'bg-primary'}`} />
                  <span className="font-mono text-sm truncate" title={winner.address}>
                    {winner.address.slice(0, 6)}...{winner.address.slice(-4)}
                  </span>
                  {/* Etherscan logo for VRF callback transaction */}
                  {winnerTxHash && (
                    <a
                      href={getExplorerLink(winnerTxHash, raffle.chainId, true)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center flex-shrink-0"
                      title="View winner selection transaction on block explorer"
                    >
                      <img
                        src="/images/etherscan logos/etherscan-logo-circle.svg"
                        alt="Etherscan"
                        width="16"
                        height="16"
                        className="opacity-70 hover:opacity-100 transition-opacity"
                      />
                    </a>
                  )}
                  {isCurrentUser && (
                    <span className="text-[10px] font-medium text-yellow-800 bg-yellow-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      You
                    </span>
                  )}
                </div>
                
                {/* Prize Info - only for prized pools, hidden on mobile */}
                {raffle.isPrized && (
                  <div className="hidden md:block md:col-span-3 text-center text-sm font-medium">
                    <span className="text-foreground">
                      {getWinnerPrizeDisplay(winner)}
                    </span>
                  </div>
                )}
                
                {/* Claim Status - only for prized pools, hidden on mobile */}
                {raffle.isPrized && (
                  <div className="hidden md:flex md:col-span-3 justify-end">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${claimStatus.bg} ${claimStatus.color}`}>
                      {winner.prizeClaimed && <CheckCircle className="h-3 w-3" />}
                      {claimStatus.text}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Get state-specific content for non-completed states
  const getStateContent = () => {
    const label = POOL_STATE_LABELS[raffle.stateNum] || 'Unknown';
    
    switch (label) {
      case 'Pending':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-10 w-10 text-yellow-500 mb-3" />
            <h4 className="font-medium text-foreground mb-1">Raffle Pending</h4>
            <p className="text-sm text-muted-foreground max-w-xs">Winners will be announced after the raffle ends.</p>
          </div>
        );
      case 'Active':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-green-500 mb-3" />
            <h4 className="font-medium text-foreground mb-1">Raffle Active</h4>
            <p className="text-sm text-muted-foreground max-w-xs">Winners will be announced after it ends.</p>
          </div>
        );
      case 'Ended':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-10 w-10 text-red-500 mb-3" />
            <h4 className="font-medium text-foreground mb-1">Raffle Ended</h4>
            <p className="text-sm text-muted-foreground max-w-xs">Waiting for winner selection to begin.</p>
          </div>
        );
      case 'Drawing':
        return (
          <div className="h-full flex flex-col">
            {/* Progress bar for drawing state */}
            {winners.length > 0 && (
              <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${Math.min((winnersSelectedCount / raffle.winnersCount) * 100, 100)}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                    {winnersSelectedCount}/{raffle.winnersCount}
                  </span>
                </div>
              </div>
            )}
            {renderWinnersTable()}
          </div>
        );
      case 'Completed':
      case 'Prizes Claimed':
      case 'AllPrizesClaimed':
        return renderWinnersTable();
      case 'Deleted':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trash2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <h4 className="font-medium text-foreground mb-1">Raffle Deleted</h4>
            <p className="text-sm text-muted-foreground max-w-xs">This raffle has been deleted.</p>
          </div>
        );
      case 'Unengaged':
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <h4 className="font-medium text-foreground mb-1">Unengaged Raffle</h4>
            <p className="text-sm text-muted-foreground max-w-xs">Not enough participants before duration elapsed.</p>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Unknown raffle state.</p>
          </div>
        );
    }
  };

  return (
    <div className="winners-section-content h-full flex flex-col">
      {getStateContent()}
    </div>
  );
});

WinnersSection.displayName = 'WinnersSection';

export default WinnersSection;
