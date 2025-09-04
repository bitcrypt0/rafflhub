import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useCollabDetection } from '../contexts/CollabDetectionContext';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/Layout';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { useRaffleService } from '../hooks/useRaffleService';
import { NetworkError, LoadingError } from '../components/ui/error-boundary';
import { PageLoading, ContentLoading, CardSkeleton } from '../components/ui/loading';
import { RaffleErrorDisplay } from '../components/ui/raffle-error-display';
import { getTicketsSoldCount } from '../utils/contractCallUtils';
import FilterSidebar from '../components/FilterSidebar';
import FilterToggleButton from '../components/FilterToggleButton';
import FilteredRaffleGrid from '../components/FilteredRaffleGrid';
import { useRaffleFilters } from '../hooks/useRaffleFilters';
import { SUPPORTED_NETWORKS } from '../networks';
import { useRaffleSummaries } from '../hooks/useRaffleSummaries';

import { useWinnerCount, getDynamicPrizeLabel } from '../hooks/useWinnerCount';

const RAFFLE_STATE_LABELS = [
  'Pending',
  'Active',
  'Ended',
  'Drawing',
  'Completed',
  'Deleted',
  'Activation Failed',
  'Prizes Claimed',
  'Unengaged'
];

const RaffleCard = ({ raffle }) => {
  const navigate = useNavigate();
  const { chainId } = useWallet();
  const [timeLabel, setTimeLabel] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [erc20Symbol, setErc20Symbol] = useState('');
  const { getContractInstance } = useContract();
  const { updateCollabStatus, setCollabLoading, getCollabStatus } = useCollabDetection();
  const { formatTicketPrice, formatPrizeAmount, getCurrencySymbol } = useNativeCurrency();
  const [ticketsSold, setTicketsSold] = useState(null);
  const { winnerCount } = useWinnerCount(raffle.address, raffle.stateNum);
  const [collectionName, setCollectionName] = useState(null);
  const [collectionSymbol, setCollectionSymbol] = useState(null);
  const [directContractValues, setDirectContractValues] = useState(null);

  useEffect(() => {
    let interval;
    function updateTimer() {
      const now = Math.floor(Date.now() / 1000);
      let label = '';
      let seconds = 0;
      if (raffle.stateNum === 2 || raffle.stateNum === 3 || raffle.stateNum === 4 || raffle.stateNum === 5 || raffle.stateNum === 6 || raffle.stateNum === 7 || raffle.stateNum === 8) {
        // Ended or terminal states
        label = 'Duration';
        const actual = raffle.actualDuration && (raffle.actualDuration.toNumber ? raffle.actualDuration.toNumber() : Number(raffle.actualDuration));
        seconds = actual && actual > 0 ? actual : raffle.duration;
        setTimeLabel(label);
        setTimeRemaining(formatDuration(seconds));
        return;
      }
      if (now < raffle.startTime) {
        label = 'Starts In';
        seconds = raffle.startTime - now;
      } else {
        label = 'Ends In';
        seconds = (raffle.startTime + raffle.duration) - now;
      }
      setTimeLabel(label);
      setTimeRemaining(seconds > 0 ? formatTime(seconds) : 'Ended');
    }
    function formatTime(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      let formatted = '';
      if (days > 0) formatted += `${days}d `;
      if (hours > 0 || days > 0) formatted += `${hours}h `;
      if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m `;
      formatted += `${secs}s`;
      return formatted.trim();
    }
    function formatDuration(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      let formatted = '';
      if (days > 0) formatted += `${days}d `;
      if (hours > 0 || days > 0) formatted += `${hours}h `;
      if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m`;
      if (!formatted) formatted = '0m';
      return formatted.trim();
    }
    updateTimer();
    interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [raffle]);

  // ERC20 symbol lookup - optimized to reduce RPC calls
  useEffect(() => {
    let isMounted = true;
    const fetchSymbol = async () => {
      if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero) {
        // Use a static cache to avoid redundant lookups
        if (!window.__erc20SymbolCache) window.__erc20SymbolCache = {};
        if (window.__erc20SymbolCache[raffle.erc20PrizeToken]) {
          setErc20Symbol(window.__erc20SymbolCache[raffle.erc20PrizeToken]);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
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
    };
    fetchSymbol();
    return () => { isMounted = false; };
  }, [raffle.erc20PrizeToken]);

  // Fetch tickets sold using the same logic as RaffleDetailPage
  useEffect(() => {
    let isMounted = true;
    async function fetchTicketsSold() {
      try {
        const raffleContract = getContractInstance && getContractInstance(raffle.address, 'raffle');
        if (!raffleContract) {
          if (isMounted) setTicketsSold(null);
          return;
        }
        // Use the same fallback approach as RaffleDetailPage and ProfilePage
        const count = await getTicketsSoldCount(raffleContract);
        if (isMounted) setTicketsSold(count);
      } catch (e) {
        if (isMounted) setTicketsSold(null);
      }
    }
    fetchTicketsSold();
    // Only refetch if address changes
  }, [raffle.address, getContractInstance]);

  // Direct contract query for NFT prizes to get accurate values
  useEffect(() => {
    async function fetchDirectContractValues() {
      // Only fetch for NFT prizes
      if (!raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        return;
      }

      try {
        const raffleContract = getContractInstance(raffle.address, 'raffle');
        if (!raffleContract) {
          return;
        }

        // Fetch values directly like RaffleDetailPage does
        const [isExternallyPrizedDirect, usesCustomPriceDirect, isEscrowedPrizeDirect] = await Promise.all([
          raffleContract.isExternallyPrized().catch(() => null),
          raffleContract.usesCustomPrice().catch(() => null),
          raffleContract.isEscrowedPrize().catch(() => null)
        ]);

        const directValues = {
          isExternallyPrized: isExternallyPrizedDirect,
          usesCustomPrice: usesCustomPriceDirect,
          isEscrowedPrize: isEscrowedPrizeDirect
        };

        setDirectContractValues(directValues);
      } catch (error) {
        // Silently handle errors
      }
    }

    fetchDirectContractValues();
  }, [raffle.address, raffle.prizeCollection, getContractInstance]);

  // Fetch collection name and symbol for NFT prizes
  useEffect(() => {
    const fetchCollectionInfo = async () => {
      if (!raffle || !raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        setCollectionName(null);
        setCollectionSymbol(null);
        return;
      }

      try {
        let contract = null;
        let name = null;
        let symbol = null;

        if (typeof raffle.standard !== 'undefined') {
          // Use standard if available (like RaffleDetailPage)
          const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';

          contract = getContractInstance(raffle.prizeCollection, contractType);
          if (contract) {
            try {
              if (typeof contract.name === 'function') {
                name = await contract.name();
              }
            } catch (nameError) {
              name = null;
            }

            // Try to fetch symbol
            try {
              if (typeof contract.symbol === 'function') {
                symbol = await contract.symbol();
              }
            } catch (symbolError) {
              symbol = null;
            }
          }
        } else {
          // Fallback: Try both contract types if standard is undefined
          try {
            contract = getContractInstance(raffle.prizeCollection, 'erc721Prize');
            if (contract) {
              try {
                if (typeof contract.name === 'function') {
                  name = await contract.name();
                }
              } catch (nameError) {
                name = null;
              }
              try {
                if (typeof contract.symbol === 'function') {
                  symbol = await contract.symbol();
                }
              } catch (symbolError) {
                symbol = null;
              }
            }
          } catch (erc721Error) {
            try {
              contract = getContractInstance(raffle.prizeCollection, 'erc1155Prize');
              if (contract) {
                try {
                  if (typeof contract.name === 'function') {
                    name = await contract.name();
                  }
                } catch (nameError) {
                  name = null;
                }
                try {
                  if (typeof contract.symbol === 'function') {
                    symbol = await contract.symbol();
                  }
                } catch (symbolError) {
                  symbol = null;
                }
              }
            } catch (erc1155Error) {
              // Both failed, continue with null values
            }
          }
        }

        setCollectionName(name);
        setCollectionSymbol(symbol);
      } catch (error) {
        setCollectionName(null);
        setCollectionSymbol(null);
      }
    };

    fetchCollectionInfo();
  }, [raffle, getContractInstance]);

  // Check for collab status with holderTokenAddress
  useEffect(() => {
    let isMounted = true;
    const checkCollabStatus = async () => {
      // Check if we already have a result
      const existingResult = getCollabStatus(raffle.address);
      if (existingResult !== undefined) {
        return; // Already determined
      }

      // Set loading state
      setCollabLoading(raffle.address, true);

      // Check holderTokenAddress first (needed for both types)
      let hasHolderToken = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries && isMounted) {
        try {
          const raffleContract = getContractInstance(raffle.address, 'raffle');
          if (!raffleContract) {
            throw new Error('Failed to get contract instance');
          }

          const holderTokenAddr = await raffleContract.holderTokenAddress();
          hasHolderToken = holderTokenAddr && holderTokenAddr !== ethers.constants.AddressZero;
          break; // Success, exit retry loop

        } catch (error) {
          retryCount++;

          if (retryCount >= maxRetries) {
            // After max retries, assume no holder token
            hasHolderToken = false;
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      if (!isMounted) return;

      // Determine collab type based on priority logic
      let collabType;
      if (raffle.isExternallyPrized) {
        // NFT Collab takes precedence (regardless of holderTokenAddress)
        collabType = 'nft_collab';
      } else if (hasHolderToken) {
        // Whitelist Collab only if not externally prized
        collabType = 'whitelist_collab';
      } else {
        // Not a collab
        collabType = 'not_collab';
      }

      updateCollabStatus(raffle.address, collabType);
    };

    if (raffle.address && getContractInstance) {
      checkCollabStatus();
    } else {
      updateCollabStatus(raffle.address, 'not_collab');
    }

    return () => {
      isMounted = false;
    };
  }, [raffle, getContractInstance, getCollabStatus, setCollabLoading, updateCollabStatus]);

  const getStatusBadge = () => {
    // Get dynamic label for Prizes Claimed state based on winner count
    const getDynamicLabel = (stateNum) => {
      const dynamicLabel = getDynamicPrizeLabel(stateNum, winnerCount);
      if (dynamicLabel) {
        return dynamicLabel;
      }
      return RAFFLE_STATE_LABELS[stateNum] || 'Unknown';
    };

    const label = getDynamicLabel(raffle.stateNum);
    const colorMap = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Active': 'bg-green-100 text-green-800',
      'Ended': 'bg-red-100 text-red-800',
      'Drawing': 'bg-purple-100 text-purple-800',
      'Completed': 'bg-blue-100 text-blue-800',
      'Deleted': 'bg-gray-200 text-gray-800',
      'Activation Failed': 'bg-red-200 text-red-900',
      'Prizes Claimed': 'bg-blue-200 text-blue-900',
      'Prize Claimed': 'bg-blue-200 text-blue-900', // Same styling for singular
      'Unengaged': 'bg-gray-100 text-gray-800',
      'Unknown': 'bg-gray-100 text-gray-800'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[label] || colorMap['Unknown']}`}>{label}</span>;
  };

  // Enhanced NFT type detection based on correct understanding of contract flags
  const getEnhancedNFTType = () => {
    // Only for NFT prizes (ERC721/ERC1155)
    if (!raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
      return null;
    }

    // Use direct contract values if available, otherwise fall back to raffle service values
    const isExternallyPrized = (directContractValues && directContractValues.isExternallyPrized !== null)
      ? directContractValues.isExternallyPrized
      : raffle.isExternallyPrized;
    const usesCustomPrice = (directContractValues && directContractValues.usesCustomPrice !== null)
      ? directContractValues.usesCustomPrice === true
      : raffle.usesCustomPrice === true;
    const isEscrowedPrize = (directContractValues && directContractValues.isEscrowedPrize !== null)
      ? directContractValues.isEscrowedPrize === true
      : raffle.isEscrowedPrize === true;

    // Determine if this is a mintable NFT prize
    // Based on your clarification: isMintable should only be true for mintable ERC721/ERC1155 prizes
    // We need to infer this from the available data since there's no direct isMintable flag
    const isMintable = !isEscrowedPrize; // If not escrowed, then it's mintable



    // Apply the corrected logic based on your clarification
    if (isEscrowedPrize && usesCustomPrice) return 'Lucky NFT Sale';
    if (isEscrowedPrize && !usesCustomPrice) return 'NFT Giveaway';
    if (isMintable && !usesCustomPrice) return 'NFT Drop (Free Mint)';
    if (isMintable && usesCustomPrice) return 'NFT Drop (Paid Mint)';

    // Fallback for any edge cases
    return 'NFT Prize';
  };

  const getPrizeType = () => {
    // Synchronous priority: externally prized raffles are always NFT Collab
    if (raffle.isExternallyPrized) return 'NFT Collab';

    // Use async-determined collab status from context (fallback)
    const collabStatus = getCollabStatus(raffle.address);
    if (collabStatus === 'nft_collab') return 'NFT Collab';
    if (collabStatus === 'whitelist_collab') return 'Whitelist Collab';
    if (collabStatus === undefined) return 'Checking...'; // Still determining collab status

    // Continue with other prize types
    if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
      return `${getCurrencySymbol()} Giveaway`;
    }
    if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
      return 'Token Giveaway';
    }

    // Enhanced NFT type detection
    const enhancedNFTType = getEnhancedNFTType();
    if (enhancedNFTType) {
      return enhancedNFTType;
    }

    return raffle.isPrized ? 'Token Giveaway' : 'Whitelist';
  };

  const getPrizeAmount = () => {
    if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) return formatPrizeAmount(raffle.nativePrizeAmount);
    if (raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) return `${ethers.utils.formatUnits(raffle.erc20PrizeAmount, 18)} ${erc20Symbol || 'TOKEN'}`;
    return null;
  };

  const handleViewRaffle = () => {
    const currentChainId = raffle.chainId || chainId;
    const slug = currentChainId && SUPPORTED_NETWORKS[currentChainId] ? SUPPORTED_NETWORKS[currentChainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (currentChainId || '');
    const path = slug ? `/${slug}/raffle/${raffle.address}` : `/raffle/${raffle.address}`;
    navigate(path);
  };

  return (
    <div className="landing-raffle-card bg-card/80 text-foreground backdrop-blur-sm border border-border/50 rounded-xl p-4 sm:p-6 shadow-lg hover:shadow-xl hover:border-border/80 transition-all duration-300 flex flex-col h-full group w-full max-w-full">
      <div className="flex items-center justify-between mb-4 min-w-0">
        <h3 className="text-base sm:text-lg font-semibold truncate flex-1 mr-2 min-w-0">{raffle.name}</h3>
        <div className="flex-shrink-0">
          {getStatusBadge()}
        </div>
      </div>

      <div className="space-y-2 mb-4 min-w-0">
        <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
          <span className="text-muted-foreground flex-shrink-0">Creator:</span>
          <span className="font-mono truncate ml-2">{raffle.creator?.slice(0, 10)}...</span>
        </div>
        <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
          <span className="text-muted-foreground flex-shrink-0">Ticket Fee:</span>
          <span className="truncate ml-2">{formatTicketPrice(raffle.ticketPrice || '0')}</span>
        </div>
        <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
          <span className="text-muted-foreground flex-shrink-0">Tickets Sold:</span>
          <span className="truncate ml-2">{ticketsSold !== null ? `${ticketsSold} / ${raffle.ticketLimit}` : 'Loading...'}</span>
        </div>
        <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
          <span className="text-muted-foreground flex-shrink-0">Winners:</span>
          <span className="truncate ml-2">{raffle.winnersCount}</span>
        </div>
        <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
          <span className="text-muted-foreground flex-shrink-0">{timeLabel}:</span>
          <span className="truncate ml-2">{timeRemaining}</span>
        </div>
        {/* Hide Type until full raffle data is available to avoid misleading placeholder */}
        {!raffle.isSummary && (
          <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
            <span className="text-muted-foreground flex-shrink-0">Type:</span>
            <span className="px-2 py-1 rounded-full text-xs sm:text-sm bg-muted/20 truncate ml-2">{getPrizeType()}</span>
          </div>
        )}
        {(() => {
          const prizeType = getPrizeType();
          const isNFTPrize = raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero;

          if (!isNFTPrize) return null;

          // Determine if this is escrowed or mintable based on the corrected logic
          const isEscrowedPrize = (directContractValues && directContractValues.isEscrowedPrize !== null)
            ? directContractValues.isEscrowedPrize === true
            : raffle.isEscrowedPrize === true;
          const isMintable = !isEscrowedPrize;

          if (isEscrowedPrize) {
            // For escrowed NFT prizes: show 'Prize ID' with symbol + token ID (e.g., "BAYC #23")
            const prizeId = (raffle.prizeTokenId !== undefined && raffle.prizeTokenId !== null)
              ? `#${raffle.prizeTokenId}`
              : '#Unknown';
            const displayValue = collectionSymbol
              ? `${collectionSymbol} ${prizeId}` // Use symbol if available (e.g., "BAYC #23")
              : collectionName
                ? `${collectionName} ${prizeId}` // Fall back to name if no symbol
                : `${raffle.prizeCollection?.slice(0, 10)}... ${prizeId}`; // Fall back to address



            return (
              <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
                <span className="text-muted-foreground flex-shrink-0">Prize Token ID:</span>
                <span className={`truncate ml-2 ${collectionSymbol || collectionName ? '' : 'font-mono'}`}>
                  {displayValue}
                </span>
              </div>
            );
          } else if (isMintable) {
            // For mintable NFT prizes: show 'Prize Collection' with collection name or address
            // Fix: If we have a collection name, it's likely ERC721 (even if standard is undefined)
            // ERC1155 collections often don't have names, so if we got a name, prefer showing it
            const hasCollectionName = collectionName && collectionName.trim() !== '';
            const isLikelyERC721 = raffle.standard === 0 || (raffle.standard === undefined && hasCollectionName);
            const isDefinitelyERC1155 = raffle.standard === 1;

            const displayValue = isDefinitelyERC1155
              ? `${raffle.prizeCollection?.slice(0, 10)}...` // ERC1155: always use address
              : (hasCollectionName
                  ? collectionName // ERC721 or likely ERC721: use name if available
                  : `${raffle.prizeCollection?.slice(0, 10)}...`); // Fallback to address



            return (
              <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
                <span className="text-muted-foreground flex-shrink-0">Prize Collection:</span>
                <span className={`truncate ml-2 ${hasCollectionName && !isDefinitelyERC1155 ? '' : 'font-mono'}`}>
                  {displayValue}
                </span>
              </div>
            );
          }

          return null;
        })()}
        {(() => {
          const prizeType = getPrizeType();
          const isEscrowedNFT = raffle.prizeCollection &&
                               raffle.prizeCollection !== ethers.constants.AddressZero &&
                               raffle.isExternallyPrized === false;

          // Hide Prize Amount for escrowed NFT prizes
          if (isEscrowedNFT) {
            return null;
          }

          // Show Prize Amount for Token Giveaways and other giveaways
          if (prizeType === 'Token Giveaway' || prizeType.includes('Giveaway')) {
            return (
              <div className="flex justify-between items-center text-xs sm:text-sm min-w-0">
                <span className="text-muted-foreground flex-shrink-0">Prize Amount:</span>
                <span className="truncate ml-2">{getPrizeAmount()}</span>
              </div>
            );
          }

          return null;
        })()}
      </div>

      <Button
        onClick={handleViewRaffle}
        className="w-full mt-auto group-hover:scale-[1.02] transition-transform duration-200 bg-[#614E41] text-white hover:bg-[#4a3a30] border-0 text-sm sm:text-base py-2 sm:py-3"
      >
        Visit Raffle Page
      </Button>
    </div>
  );
};



const LandingPage = () => {
  const { connected } = useWallet();
  const { isMobile } = useMobileBreakpoints();
  const { formatTicketPrice, formatPrizeAmount } = useNativeCurrency();
  const [page, setPage] = useState(1);

  // Use the new RaffleService hook (full dataset for filtering)
  const {
    raffles,
    loading,
    backgroundLoading,
    error,
    refreshRaffles
  } = useRaffleService({
    autoFetch: true,
    enablePolling: true,
    pollingInterval: 120000, // 2 minutes
    maxRaffles: null // fetch all for accurate filters
  });

  // Fast, minimal summaries for mobile-first paint
  const { summaries, loading: summariesLoading, totalAvailable } = useRaffleSummaries({ initialCount: 12 });

  // Use filter system
  const {
    filters,
    filteredRaffles,
    isFilterOpen,
    hasActiveFilters,
    updateFilters,
    clearFilters,
    toggleFilter,
    filteredCount


  } = useRaffleFilters(raffles);
  // Reset pagination when data source or filters change
  useEffect(() => {
    setPage(1);
  }, [isMobile, loading, raffles?.length, filteredRaffles?.length, summaries?.length, hasActiveFilters]);


  // Show wallet connection prompt if not connected
  if (!connected) {
    return (
      <PageContainer className="py-4">
        <div className={`text-center ${isMobile ? 'mb-6' : 'mb-4'}`}>
          <h1 className={`font-bold ${isMobile ? 'text-2xl mb-3' : 'text-4xl mb-4'}`}>
            Fairness and Transparency, On-Chain
          </h1>
          <p className={`text-muted-foreground max-w-2xl mx-auto ${isMobile ? 'text-base' : 'text-xl'}`}>
            Host and participate in decentralized, on-chain raffles where every draw is public, auditable, and powered by Chainlink's VRF. Everyone has a fair chance to win!
          </p>
        </div>

        <div className={`text-center ${isMobile ? 'py-8' : 'py-16'}`}>
          <Trophy className={`text-muted-foreground mx-auto mb-4 ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
          <h3 className={`font-semibold mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Connect Your Wallet</h3>
          <p className={`text-muted-foreground mb-6 ${isMobile ? 'text-sm' : 'text-base'}`}>
            Please connect your wallet to view and interact with raffles on the blockchain.
          </p>
        </div>
      </PageContainer>
    );
  }

  // Allow summaries path on mobile even when filters are active to avoid slow first-load UX
  const canUseSummariesForCurrentFilters = isMobile && (summaries?.length > 0) && (!raffles || raffles.length === 0 || loading);

  // When using summaries, apply only the filters we can with summary data (raffleState)
  let mobileFilteredSummaries = null;
  if (canUseSummariesForCurrentFilters) {
    if (!filters || !filters.raffleState || filters.raffleState.length === 0) {
      mobileFilteredSummaries = summaries;
    } else {
      const wanted = new Set(filters.raffleState.map(s => s.toLowerCase()));
      mobileFilteredSummaries = summaries.filter(s => {
        const label = RAFFLE_STATE_LABELS[s.stateNum]?.toLowerCase();
        return wanted.has(label);
      });
    }


  }



  // Show loading only when neither summaries (possibly filtered) nor full data are available
  const shouldShowLoading = !canUseSummariesForCurrentFilters && loading;
  if (shouldShowLoading) {
    return (
      <PageContainer>
        <ContentLoading
          message="Loading raffles from blockchain..."
          isMobile={isMobile}
        />
      </PageContainer>
    );
  }

  // Show error message (only when not using summaries path)
  if (!canUseSummariesForCurrentFilters && error) {
    return (
      <PageContainer className="py-8">
        <div className="mb-8 text-center">
          <h1 className={`font-bold ${isMobile ? 'text-2xl mb-3' : 'text-4xl mb-4'}`}>
            Fairness and Transparency, On-Chain
          </h1>
          <p className={`text-muted-foreground max-w-2xl mx-auto ${isMobile ? 'text-base' : 'text-xl'}`}>
            Host and participate in decentralized, on-chain raffles where every draw is public, auditable, and powered by Chainlink's VRF. Everyone has a fair chance to win!
          </p>
        </div>

        <RaffleErrorDisplay
          error={error}
          onRetry={refreshRaffles}
          isMobile={isMobile}
          showCreateButton={true}
        />
      </PageContainer>


    );
  }

  return (
    <>


      {/* Filter Sidebar (overlay when open) */}
      <FilterSidebar
        isOpen={isFilterOpen}
        onToggle={toggleFilter}
        filters={filters}
        onFiltersChange={updateFilters}
        raffleCount={filteredCount}
        allRaffles={raffles}
      />

      {/* Main content - full width */}



      <div className="min-h-screen" style={{ position: 'relative', zIndex: 1 }}>
        <PageContainer className="py-4">
          {/* Header */}
          <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
            <h1 className={`font-bold ${isMobile ? 'text-2xl mb-3' : 'text-4xl mb-4'}`}>
              Fairness and Transparency, On-Chain
            </h1>
            <p className={`text-muted-foreground max-w-2xl mx-auto ${isMobile ? 'text-base' : 'text-xl'}`}>
              Host and participate in decentralized, on-chain raffles where every draw is public, auditable, and powered by Chainlink's VRF. Everyone has a fair chance to win!
            </p>

          </div>

          {/* Filter toggle button */}



          <div className="mb-6 flex items-center">
            <FilterToggleButton
              onClick={toggleFilter}
              hasActiveFilters={hasActiveFilters}
            />
            <div className="ml-auto flex items-center gap-3">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear All Filters
                </Button>
              )}
              {/* Desktop top-right pagination (Prev, numbers, Next) aligned with Filter Raffles */}
              {!isMobile && (() => {
                const pageSize = 24;
                const totalList = filteredRaffles || [];
                const totalPages = Math.max(1, Math.ceil(totalList.length / pageSize));
                if (totalPages <= 1) return null;
                const currentPageSafe = Math.min(page, totalPages);
                const goPrev = () => setPage(p => Math.max(1, p - 1));
                const goNext = () => setPage(p => Math.min(totalPages, p + 1));
                const delta = 2;
                const left = Math.max(1, currentPageSafe - delta);
                const right = Math.min(totalPages, currentPageSafe + delta);
                const range = [];
                if (left > 1) { range.push(1); if (left > 2) range.push('...'); }
                for (let i = left; i <= right; i++) range.push(i);
                if (right < totalPages) { if (right < totalPages - 1) range.push('...'); range.push(totalPages); }
                return (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={goPrev}
                      disabled={currentPageSafe === 1}
                      className="px-3 py-2 rounded-md border border-border bg-background text-sm disabled:opacity-50"
                      aria-label="Previous page"
                    >
                      Prev
                    </button>
                    {range.map((item, idx) => item === '...'
                      ? <span key={`ellipsis-top-${idx}`} className="px-1 text-muted-foreground">…</span>
                      : (
                        <button
                          key={`page-top-${item}`}
                          onClick={() => setPage(item)}
                          className={`px-1 text-sm leading-none ${currentPageSafe === item ? 'font-semibold text-foreground' : 'text-foreground/80'} bg-transparent`}
                          aria-label={`Go to page ${item}`}
                        >{item}</button>
                      )
                    )}
                    <button
                      onClick={goNext}
                      disabled={currentPageSafe === totalPages}
                      className="px-3 py-2 rounded-md border border-border bg-background text-sm disabled:opacity-50"
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Grid: summaries for fast mobile first paint; if filters tapped early on mobile, use summary subset */}
          {(() => {
            const pageSize = isMobile ? 12 : 24;
            const usingSummaries = !!canUseSummariesForCurrentFilters;
            // While using summaries on mobile, use totalAvailable from the manager as totalCount if present
            const effectiveTotal = (isMobile && usingSummaries && typeof totalAvailable === 'number') ? totalAvailable : null;
            const totalList = usingSummaries ? (mobileFilteredSummaries || []) : (filteredRaffles || []);

            // Ensure newest-first order is preserved by assuming input is already sorted; do not mutate order
            const totalCount = totalList.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
            const currentPage = Math.min(page, totalPages);
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            const pageItems = totalList.slice(start, end);

            // Show pagination on mobile summaries as soon as 12+ items exist, regardless of full fetch state
            const shouldShowPagination = totalPages > 1 || (isMobile && usingSummaries && totalList.length >= pageSize);


            // Build a compact page range with ellipses
            const pageRange = (() => {
              const total = totalPages;
              const current = currentPage;
              const delta = isMobile ? 1 : 2; // neighbors to show
            {/* Desktop top-right page numbers aligned with Filter Raffles */}


              const range = [];
              const left = Math.max(1, current - delta);
              const right = Math.min(total, current + delta);
              if (left > 1) {
                range.push(1);
                if (left > 2) range.push('...');
              }
              for (let i = left; i <= right; i++) range.push(i);
              if (right < total) {
                if (right < total - 1) range.push('...');
                range.push(total);
              }
              return range;
            })();

            const handlePrev = () => setPage(p => Math.max(1, p - 1));
            const handleNext = () => setPage(p => Math.min(totalPages, p + 1));

            const showCount = !(isMobile && usingSummaries && (loading || (!raffles || raffles.length === 0))); // delay count on mobile summaries until full data fetched

            return (
              <div key={usingSummaries ? 'summaries' : 'full'}>
                <FilteredRaffleGrid
                  raffles={pageItems}
                  loading={usingSummaries ? false : loading}
                  error={usingSummaries ? null : error}
                  RaffleCardComponent={RaffleCard}
                  emptyMessage={
                    hasActiveFilters
                      ? "No raffles match your current filters. Try adjusting your filter criteria."
                      : "There are currently no raffles available on the blockchain. Check back later or create your own!"
                  }
                  totalCount={effectiveTotal ?? totalCount}
                  showCount={showCount}
                />

                {/* Pagination controls */}
                {shouldShowPagination && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    {/* Numbered page buttons: bottom (mobile+desktop) */}
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={handlePrev}
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded-md border border-border bg-background text-sm disabled:opacity-50"
                        aria-label="Previous page"
                      >
                        Prev
                      </button>
                      {pageRange.map((item, idx) => item === '...'
                        ? <span key={`ellipsis-bottom-${idx}`} className="px-1 text-muted-foreground">…</span>
                        : (
                          <button
                            key={`page-bottom-${item}`}
                            onClick={() => setPage(item)}
                            className={`px-1 text-sm leading-none ${currentPage === item ? 'font-semibold text-foreground' : 'text-foreground/80'} bg-transparent`}
                            aria-label={`Go to page ${item}`}
                          >{item}</button>

                        )
                      )}
                      <button
                        onClick={handleNext}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded-md border border-border bg-background text-sm disabled:opacity-50"
                        aria-label="Next page"
                      >
                        Next
                      </button>
                    </div>
                    {/* Page indicator */}
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {Math.max(1, totalPages)}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </PageContainer>
      </div>
    </>
  );
};

export { RaffleCard };
export default LandingPage;

