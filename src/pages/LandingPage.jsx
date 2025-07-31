import React, { useState, useEffect } from 'react';
import { Ticket, Clock, Trophy, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/Layout';
import { categorizeRaffles } from '../utils/raffleUtils';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useRaffleService } from '../hooks/useRaffleService';
import { NetworkError, LoadingError } from '../components/ui/error-boundary';
import { PageLoading, CardSkeleton } from '../components/ui/loading';

const RAFFLE_STATE_LABELS = [
  'Pending',
  'Active',
  'Ended',
  'Drawing',
  'Completed',
  'Deleted',
  'Activation Failed',
  'All Prizes Claimed',
  'Unengaged'
];

const RaffleCard = ({ raffle }) => {
  const navigate = useNavigate();
  const [timeLabel, setTimeLabel] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [erc20Symbol, setErc20Symbol] = useState('');
  const { getContractInstance } = useContract();
  const [ticketsSold, setTicketsSold] = useState(null);
  const [collectionName, setCollectionName] = useState(null);

  useEffect(() => {
    let interval;
    function updateTimer() {
      const now = Math.floor(Date.now() / 1000);
      let label = '';
      let seconds = 0;
      if (raffle.stateNum === 2 || raffle.stateNum === 3 || raffle.stateNum === 4 || raffle.stateNum === 5 || raffle.stateNum === 6 || raffle.stateNum === 7 || raffle.stateNum === 8) {
        // Ended or completed or other terminal states
        label = 'Duration';
        seconds = raffle.duration;
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
          console.warn('Failed to fetch ERC20 symbol:', error);
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
        let count = 0;
        try {
          const participantsCount = await raffleContract.getParticipantsCount();
          count = participantsCount.toNumber();
        } catch (error) {
          // Fallback: count participants by iterating
          let index = 0;
          while (true) {
            try {
              await raffleContract.participants(index);
              count++;
              index++;
            } catch {
              break;
            }
          }
        }
        if (isMounted) setTicketsSold(count);
      } catch (e) {
        if (isMounted) setTicketsSold(null);
      }
    }
    fetchTicketsSold();
    // Only refetch if address changes
  }, [raffle.address, getContractInstance]);

  // Fetch collection name for NFT prizes
  useEffect(() => {
    const fetchCollectionName = async () => {
      if (!raffle || !raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        setCollectionName(null);
        return;
      }

      try {
        // Try both contract types if standard is undefined
        let contract = null;
        let name = null;

        if (typeof raffle.standard !== 'undefined') {
          // Use standard if available
          const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';
          contract = getContractInstance(raffle.prizeCollection, contractType);
          if (contract) {
            name = await contract.name();
          }
        } else {
          // Try ERC721 first, then ERC1155 if that fails
          try {
            contract = getContractInstance(raffle.prizeCollection, 'erc721Prize');
            if (contract) {
              name = await contract.name();
            }
          } catch (erc721Error) {
            try {
              contract = getContractInstance(raffle.prizeCollection, 'erc1155Prize');
              if (contract) {
                name = await contract.name();
              }
            } catch (erc1155Error) {
              console.warn('Failed to fetch collection name from both ERC721 and ERC1155:', erc721Error, erc1155Error);
            }
          }
        }

        setCollectionName(name);
      } catch (error) {
        console.warn('Failed to fetch collection name:', error);
        setCollectionName(null);
      }
    };

    fetchCollectionName();
  }, [raffle, getContractInstance]);

  const getStatusBadge = () => {
    const label = RAFFLE_STATE_LABELS[raffle.stateNum] || 'Unknown';
    const colorMap = {
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Active': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'Ended': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'Drawing': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'Completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Deleted': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'Activation Failed': 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300',
      'All Prizes Claimed': 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300',
      'Unengaged': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'Unknown': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[label] || colorMap['Unknown']}`}>{label}</span>;
  };

  const getPrizeType = () => {
    if (raffle.isExternallyPrized && raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) return 'Collab';
    if (raffle.ethPrizeAmount && raffle.ethPrizeAmount.gt && raffle.ethPrizeAmount.gt(0)) return 'ETH';
    if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) return 'ERC20';
    if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) return 'NFT Prize';
    return raffle.isPrized ? 'Token Giveaway' : 'Whitelist';
  };

  const getPrizeAmount = () => {
    if (raffle.ethPrizeAmount && raffle.ethPrizeAmount.gt && raffle.ethPrizeAmount.gt(0)) return `${ethers.utils.formatEther(raffle.ethPrizeAmount)} ETH`;
    if (raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) return `${ethers.utils.formatUnits(raffle.erc20PrizeAmount, 18)} ${erc20Symbol || 'TOKEN'}`;
    return null;
  };

  const handleViewRaffle = () => {
    navigate(`/raffle/${raffle.address}`);
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg hover:shadow-xl hover:border-border/80 transition-all duration-300 flex flex-col h-full group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold truncate flex-1 mr-2">{raffle.name}</h3>
        {getStatusBadge()}
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Creator:</span>
          <span className="font-mono">{raffle.creator?.slice(0, 10)}...</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Ticket Price:</span>
          <span>{ethers.utils.formatEther(raffle.ticketPrice || '0')} ETH</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tickets Sold:</span>
          <span>{ticketsSold !== null ? `${ticketsSold} / ${raffle.ticketLimit}` : 'Loading...'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Winners:</span>
          <span>{raffle.winnersCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{timeLabel}:</span>
          <span>{timeRemaining}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Type:</span>
          <span className={`px-2 py-1 rounded-full text-sm`}>{getPrizeType()}</span>
        </div>
        {(getPrizeType() === 'NFT Prize') && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Prize Collection:</span>
            <span className={collectionName ? '' : 'font-mono'}>
              {collectionName || `${raffle.prizeCollection?.slice(0, 10)}...`}
            </span>
          </div>
        )}
        {(getPrizeType() === 'ERC20' || getPrizeType() === 'ETH') && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Prize Amount:</span>
            <span>{getPrizeAmount()}</span>
          </div>
        )}
      </div>
      
      <Button
        onClick={handleViewRaffle}
        className="w-full mt-auto group-hover:scale-[1.02] transition-transform duration-200 bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 border-0"
      >
        Visit Raffle Page
      </Button>
    </div>
  );
};

const RaffleSection = ({ title, raffles, icon: Icon, stateKey }) => {
  const navigate = useNavigate();
  // Reverse for newest first
  const sortedRaffles = [...raffles].reverse();
  const displayedRaffles = sortedRaffles.slice(0, 4);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title} ({raffles.length})
        </h2>
        <button
          className="text-primary hover:text-primary/80 underline text-sm font-medium transition-colors"
          onClick={() => navigate(`/raffles/${stateKey}`)}
        >
          View all {title.toLowerCase()}
        </button>
      </div>
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
        {raffles.length === 0 ? (
          <div className="text-center py-8">
            <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No {title.toLowerCase()} at the moment</p>
          </div>
        ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 min-w-0">
        {displayedRaffles.map((raffle) => (
          <RaffleCard key={raffle.id} raffle={raffle} />
        ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LandingPage = () => {
  console.log('LandingPage component is rendering...'); // Debug log

  const { connected } = useWallet();
  const { isMobile } = useMobileBreakpoints();

  // Use the new RaffleService hook
  const {
    raffles,
    categorizedRaffles,
    loading,
    backgroundLoading,
    error,
    refreshRaffles
  } = useRaffleService({
    autoFetch: true,
    enablePolling: true,
    pollingInterval: 120000, // 2 minutes
    maxRaffles: isMobile ? 15 : 25 // Limit based on platform
  });


  // Extract categorized raffles from the service
  const { pending, active, ended, drawing, completed } = categorizedRaffles;

  // Show wallet connection prompt if not connected
  if (!connected) {
    return (
      <PageContainer className="py-4">
        <div className={`text-center ${isMobile ? 'mb-6' : 'mb-4'}`}>
          <h1 className={`font-bold ${isMobile ? 'text-2xl mb-3' : 'text-4xl mb-4'}`}>
            Fairness and Transparency, On-Chain
          </h1>
          <p className={`text-muted-foreground max-w-2xl mx-auto ${isMobile ? 'text-base' : 'text-xl'}`}>
            Rafflhub hosts decentralized raffles where every draw is public, auditable, and powered by Chainlink VRF. Enter for your chance to win!
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

  if (loading) {
    return (
      <PageLoading
        message="Loading raffles from blockchain..."
        isMobile={isMobile}
      />
    );
  }

  // Show error message if there's an error
  if (error) {
    return (
      <PageContainer className="py-8">
        <div className="mb-8 text-center">
          <h1 className={`font-bold ${isMobile ? 'text-2xl mb-3' : 'text-4xl mb-4'}`}>
            Fairness and Transparency, On-Chain
          </h1>
          <p className={`text-muted-foreground max-w-2xl mx-auto ${isMobile ? 'text-base' : 'text-xl'}`}>
            Rafflhub hosts decentralized raffles where every draw is public, auditable, and powered by Chainlink VRF. Enter for your chance to win!
          </p>
        </div>

        <NetworkError
          error={{ message: error }}
          onRetry={refreshRaffles}
          isMobile={isMobile}
        />
      </PageContainer>
    );
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
          background: `radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.08) 0%, transparent 60%),
                      radial-gradient(circle at 80% 20%, hsl(var(--accent) / 0.06) 0%, transparent 60%),
                      radial-gradient(circle at 60% 80%, hsl(var(--secondary) / 0.05) 0%, transparent 60%),
                      linear-gradient(120deg, hsl(var(--primary) / 0.03) 0%, hsl(var(--accent) / 0.03) 100%)`
        }}
        aria-hidden="true"
      />
      <PageContainer className="py-4" style={{ position: 'relative', zIndex: 1 }}>
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-bold mb-4">Fairness and Transparency, On-Chain</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Rafflhub hosts decentralized raffles where every draw is public, auditable, and powered by Chainlink VRF. Enter for your chance to win!
        </p>
      </div>

      <div className="mt-12">
        <RaffleSection title="Active Raffles" raffles={active} icon={Clock} stateKey="active" />
        <RaffleSection title="Pending Raffles" raffles={pending} icon={Users} stateKey="pending" />
        <RaffleSection title="Ended Raffles" raffles={ended} icon={Clock} stateKey="ended" />
        <RaffleSection title="Drawing Phase" raffles={drawing} icon={Trophy} stateKey="drawing" />
        <RaffleSection title="Completed Raffles" raffles={completed} icon={Ticket} stateKey="completed" />
      </div>

      {raffles.length === 0 && !loading && !error && (
        <div className="text-center py-16">
          <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-2xl font-semibold mb-2">No Raffles Available</h3>
          <p className="text-muted-foreground">
            There are currently no raffles available on the blockchain. Check back later or create your own!
          </p>
        </div>
      )}
    </PageContainer>
    </>
  );
};

export { RaffleCard };
export default LandingPage;

