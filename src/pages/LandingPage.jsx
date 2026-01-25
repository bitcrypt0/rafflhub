import React, { useState, useEffect } from 'react';
import { Trophy, Search, Filter, Shield, CheckCircle, Eye, LockKeyhole, Sparkles, Wallet, Clock, Users, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { useCollabDetection } from '../contexts/CollabDetectionContext';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PageContainer } from '../components/Layout';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { useRaffleService } from '../hooks/useRaffleService';
import { NetworkError, LoadingError } from '../components/ui/error-boundary';
import { PageLoading, ContentLoading, CardSkeleton, SkeletonCard } from '../components/ui/loading';
import { RaffleErrorDisplay } from '../components/ui/raffle-error-display';
import { getTicketsSoldCount } from '../utils/contractCallUtils';
import FilterSidebar from '../components/FilterSidebar';
import FilterToggleButton from '../components/FilterToggleButton';
import FilteredRaffleGrid from '../components/FilteredRaffleGrid';
import { useRaffleFilters } from '../hooks/useRaffleFilters';
import { SUPPORTED_NETWORKS } from '../networks';
import { useRaffleSummaries } from '../hooks/useRaffleSummaries';
import { Badge, StatusBadge } from '../components/ui/badge';
import { Progress, EnhancedProgress } from '../components/ui/progress';

import { useWinnerCount, getDynamicPrizeLabel } from '../hooks/useWinnerCount';
import { constructMetadataURIs } from '../utils/nftMetadataUtils';

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

const RaffleCard = ({ raffle }) => {
  const navigate = useNavigate();
  const { chainId } = useWallet();
  const [timeLabel, setTimeLabel] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [erc20Symbol, setErc20Symbol] = useState('');
  const { getContractInstance } = useContract();
  const { updateCollabStatus, setCollabLoading, getCollabStatus } = useCollabDetection();
  const { formatSlotFee, formatPrizeAmount, getCurrencySymbol } = useNativeCurrency();
  const [ticketsSold, setTicketsSold] = useState(null);
  const { winnerCount } = useWinnerCount(raffle.address, raffle.stateNum);
  const [collectionName, setCollectionName] = useState(null);
  const [collectionSymbol, setCollectionSymbol] = useState(null);
  const [directContractValues, setDirectContractValues] = useState(null);
  
  // NFT artwork state
  const [nftImageUrl, setNftImageUrl] = useState(null);
  const [nftImageLoading, setNftImageLoading] = useState(false);
  const [imageCandidates, setImageCandidates] = useState([]);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);

  useEffect(() => {
    let interval;
    function updateTimer() {
      const now = Math.floor(Date.now() / 1000);
      let label = '';
      let seconds = 0;
      if (raffle.stateNum === 2 || raffle.stateNum === 3 || raffle.stateNum === 4 || raffle.stateNum === 5 || raffle.stateNum === 6 || raffle.stateNum === 7) {
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
        const poolContract = getContractInstance && getContractInstance(raffle.address, 'pool');
        if (!poolContract) {
          if (isMounted) setTicketsSold(null);
          return;
        }
        // Use the same fallback approach as RaffleDetailPage and ProfilePage
        const count = await getTicketsSoldCount(poolContract);
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
        const poolContract = getContractInstance(raffle.address, 'pool');
        if (!poolContract) {
          return;
        }

        // Fetch values directly like RaffleDetailPage does
        const [isCollabPoolDirect, usesCustomFeeDirect, isEscrowedPrizeDirect] = await Promise.all([
          poolContract.isCollabPool().catch(() => null),
          poolContract.usesCustomFee().catch(() => null),
          poolContract.isEscrowedPrize().catch(() => null)
        ]);

        const directValues = {
          isCollabPool: isCollabPoolDirect,
          usesCustomFee: usesCustomFeeDirect,
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
          const poolContract = getContractInstance(raffle.address, 'pool');
          if (!poolContract) {
            throw new Error('Failed to get contract instance');
          }

          const holderTokenAddr = await poolContract.holderTokenAddress();
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
      if (raffle.isCollabPool) {
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

  // NFT artwork fetching for NFT Drop, NFT Giveaway, and Lucky NFT Sale pools
  useEffect(() => {
    let isMounted = true;
    
    // IPFS gateways for decentralized URIs
    const IPFS_GATEWAYS = [
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/'
    ];
    const IPNS_GATEWAYS = IPFS_GATEWAYS.map(g => g.replace('/ipfs/', '/ipns/'));
    const ARWEAVE_GATEWAYS = ['https://arweave.net/'];

    // Convert IPFS/decentralized URIs to HTTP (comprehensive version matching PrizeImageCard)
    const convertToHTTP = (uri) => {
      if (!uri) return [];

      if (uri.startsWith('ipfs://')) {
        let hash = uri.replace('ipfs://', '');
        if (hash.startsWith('ipfs/')) hash = hash.slice('ipfs/'.length);
        return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
      }

      if (uri.startsWith('ipns://')) {
        let name = uri.replace('ipns://', '');
        if (name.startsWith('ipns/')) name = name.slice('ipns/'.length);
        return IPNS_GATEWAYS.map(gateway => `${gateway}${name}`);
      }

      if (uri.startsWith('ar://')) {
        const id = uri.replace('ar://', '');
        return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
      }

      try {
        const u = new URL(uri);
        let pathname = u.pathname.replace(/\/ipfs\/ipfs\//, '/ipfs/');
        const parts = pathname.split('/').filter(Boolean);

        const ipfsIndex = parts.indexOf('ipfs');
        if (ipfsIndex !== -1 && parts[ipfsIndex + 1]) {
          const hashAndRest = parts.slice(ipfsIndex + 1).join('/');
          return IPFS_GATEWAYS.map(gateway => `${gateway}${hashAndRest}`);
        }

        const ipnsIndex = parts.indexOf('ipns');
        if (ipnsIndex !== -1 && parts[ipnsIndex + 1]) {
          const nameAndRest = parts.slice(ipnsIndex + 1).join('/');
          return IPNS_GATEWAYS.map(gateway => `${gateway}${nameAndRest}`);
        }

        if (u.hostname.endsWith('arweave.net') || u.hostname === 'arweave.net') {
          const id = parts.join('/');
          return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
        }
      } catch (_) {
        // not a URL, fall through
      }

      return [uri];
    };

    // Extract image URL from metadata
    const extractImageURL = (metadata) => {
      const mediaFields = ['image', 'image_url', 'imageUrl', 'animation_url', 'media', 'artwork'];
      for (const field of mediaFields) {
        if (metadata[field]) {
          const raw = metadata[field];
          return convertToHTTP(String(raw));
        }
      }
      return null;
    };

    // Fetch with timeout
    const fetchWithTimeout = async (url, timeout = 8000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    // Fetch metadata with fallback
    const fetchMetadataWithFallback = async (uriVariants) => {
      for (const uri of uriVariants) {
        try {
          const response = await fetchWithTimeout(uri);
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            // Check if it's an image directly
            if (contentType?.startsWith('image/') || contentType?.startsWith('video/') ||
                uri.match(/\.(jpg|jpeg|png|gif|svg|webp|mp4|webm)$/i)) {
              return { imageUrl: [uri] };
            }
            // Try to parse as JSON
            try {
              const text = await response.text();
              const metadata = JSON.parse(text);
              if (metadata && typeof metadata === 'object') {
                const imageUrl = extractImageURL(metadata);
                if (imageUrl) return { metadata, imageUrl };
              }
            } catch (jsonError) {
              // Not JSON, might be image
              if (uri.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
                return { imageUrl: [uri] };
              }
            }
          }
        } catch (error) {
          continue;
        }
      }
      return null;
    };

    async function fetchNFTArtwork() {
      // Only fetch for NFT prize pools
      if (!raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        return;
      }

      // Determine if escrowed or mintable
      const isEscrowedPrize = (directContractValues && directContractValues.isEscrowedPrize !== null)
        ? directContractValues.isEscrowedPrize === true
        : raffle.isEscrowedPrize === true;
      const isMintable = !isEscrowedPrize;

      // Skip NFT Collab pools (externally prized), but allow NFT Drop pools (mintable)
      // NFT Collab: isCollabPool=true AND isEscrowedPrize=true (external NFT)
      // NFT Drop: isCollabPool=true BUT isMintable=true (pool mints NFTs)
      if (raffle.isCollabPool && isEscrowedPrize) {
        return;
      }

      setNftImageLoading(true);

      try {
        const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';
        const contract = getContractInstance(raffle.prizeCollection, contractType);
        
        if (!contract) {
          setNftImageLoading(false);
          return;
        }

        let baseUri = null;

        if (raffle.standard === 0) {
          // ERC721
          if (isMintable) {
            // NFT Drop - use unrevealedBaseURI
            try {
              baseUri = await contract.unrevealedBaseURI();
              if (!baseUri || baseUri.trim() === '') {
                setNftImageLoading(false);
                return;
              }
            } catch (error) {
              setNftImageLoading(false);
              return;
            }
          } else {
            // NFT Giveaway or Lucky Sale - use tokenURI
            try {
              baseUri = await contract.tokenURI(raffle.prizeTokenId);
            } catch (error) {
              setNftImageLoading(false);
              return;
            }
          }
        } else if (raffle.standard === 1) {
          // ERC1155
          if (isMintable) {
            // Try unrevealedURI first, then tokenURI, then uri()
            try {
              baseUri = await contract.unrevealedURI();
            } catch (e) {}
            if (!baseUri || baseUri.trim() === '') {
              try {
                baseUri = await contract.tokenURI(raffle.prizeTokenId);
              } catch (e) {}
            }
            if (!baseUri || baseUri.trim() === '') {
              try {
                baseUri = await contract.uri(raffle.prizeTokenId);
              } catch (e) {}
            }
          } else {
            // Escrowed - use uri()
            try {
              baseUri = await contract.uri(raffle.prizeTokenId);
            } catch (error) {
              setNftImageLoading(false);
              return;
            }
          }
        }

        if (!baseUri || baseUri.trim() === '') {
          setNftImageLoading(false);
          return;
        }

        // Generate comprehensive URI variants using shared utility
        const uriVariants = constructMetadataURIs(baseUri, raffle.prizeTokenId, raffle.standard);
        
        // Convert all variants to HTTP URLs
        const allUrls = [];
        for (const variant of uriVariants) {
          const httpUrls = convertToHTTP(variant);
          allUrls.push(...httpUrls);
        }

        // Fetch metadata
        const result = await fetchMetadataWithFallback(allUrls);
        
        if (isMounted && result && result.imageUrl) {
          const imgCandidates = Array.isArray(result.imageUrl) ? result.imageUrl : [result.imageUrl];
          setImageCandidates(imgCandidates);
          setImageCandidateIndex(0);
          setNftImageUrl(imgCandidates[0]);
        }
      } catch (error) {
        // Silent fail
      }

      if (isMounted) {
        setNftImageLoading(false);
      }
    }

    // Only fetch if we have direct contract values (to know if escrowed)
    // Note: We removed the !raffle.isCollabPool check here because NFT Drop pools
    // can have isCollabPool=true, and we want to fetch their artwork
    if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero && 
        directContractValues !== null) {
      fetchNFTArtwork();
    }

    return () => { isMounted = false; };
  }, [raffle, getContractInstance, directContractValues]);

  // Handle image load error - try next gateway
  const handleNftImageError = () => {
    if (imageCandidateIndex + 1 < imageCandidates.length) {
      setImageCandidateIndex(imageCandidateIndex + 1);
      setNftImageUrl(imageCandidates[imageCandidateIndex + 1]);
    } else {
      setNftImageUrl(null);
    }
  };

  // Phase 3: Enhanced status badge using the new StatusBadge component
  const getStatusBadge = () => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = raffle.startTime + raffle.duration;
    const hasExpired = now >= endTime;
    
    const isLive = raffle.state?.toLowerCase() === 'pending' && 
                   raffle.startTime && 
                   now >= raffle.startTime && 
                   !hasExpired &&
                   (raffle.totalSlotsPurchased || 0) === 0;

    const getDynamicLabel = (stateNum) => {
      const dynamicLabel = getDynamicPrizeLabel(stateNum, winnerCount);
      if (dynamicLabel) return dynamicLabel;
      return POOL_STATE_LABELS[stateNum] || 'Unknown';
    };

    // If duration has expired but state is still pending/active, show 'Ended'
    const label = isLive ? 'Live' : (hasExpired && (raffle.stateNum === 0 || raffle.stateNum === 1) ? 'Ended' : getDynamicLabel(raffle.stateNum));
    
    // Map labels to StatusBadge variants
    const variantMap = {
      'Pending': 'pending',
      'Active': 'active',
      'Live': 'live',
      'Ended': 'ended',
      'Drawing': 'drawing',
      'Completed': 'completed',
      'Deleted': 'deleted',
      'Activation Failed': 'ended',
      'Prizes Claimed': 'completed',
      'Prize Claimed': 'completed',
      'Unengaged': 'secondary',
      'Unknown': 'secondary'
    };

    return <Badge variant={variantMap[label] || 'secondary'} size="default">{label}</Badge>;
  };

  // Phase 3: Get status gradient for top bar
  const getStatusGradient = () => {
    const now = Math.floor(Date.now() / 1000);
    const endTime = raffle.startTime + raffle.duration;
    const hasExpired = now >= endTime;
    
    const isLive = raffle.state?.toLowerCase() === 'pending' && 
                   raffle.startTime && 
                   now >= raffle.startTime && 
                   !hasExpired &&
                   (raffle.totalSlotsPurchased || 0) === 0;
    
    if (isLive) return 'bg-gradient-to-r from-green-500 to-green-400';
    
    // If duration has expired but state is still pending/active, show ended gradient
    if (hasExpired && (raffle.stateNum === 0 || raffle.stateNum === 1)) {
      return 'bg-gradient-to-r from-red-500 to-red-400'; // Ended gradient
    }
    
    const gradientMap = {
      0: 'bg-gradient-to-r from-yellow-500 to-yellow-400', // Pending
      1: 'bg-gradient-to-r from-green-500 to-green-400',   // Active
      2: 'bg-gradient-to-r from-red-500 to-red-400',       // Ended
      3: 'bg-gradient-to-r from-purple-500 to-pink-500',   // Drawing
      4: 'bg-gradient-to-r from-blue-500 to-blue-400',     // Completed
      5: 'bg-gradient-to-r from-gray-500 to-gray-400',     // Deleted
      6: 'bg-gradient-to-r from-blue-500 to-blue-400',     // AllPrizesClaimed
      7: 'bg-gradient-to-r from-gray-400 to-gray-300',     // Unengaged
    };
    return gradientMap[raffle.stateNum] || 'bg-gradient-to-r from-gray-400 to-gray-300';
  };

  // Enhanced NFT type detection based on correct understanding of contract flags
  const getEnhancedNFTType = () => {
    // Only for NFT prizes (ERC721/ERC1155)
    if (!raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
      return null;
    }

    // Use direct contract values if available, otherwise fall back to raffle service values
    const isCollabPool = (directContractValues && directContractValues.isCollabPool !== null)
      ? directContractValues.isCollabPool
      : raffle.isCollabPool;
    const usesCustomPrice = (directContractValues && directContractValues.usesCustomFee !== null)
         ? directContractValues.usesCustomFee === true
         : raffle.usesCustomFee === true;
    
    // For new contracts, isEscrowedPrize should always be available
    // Use direct contract values first, then fallback to raffle data
    const isEscrowedPrize = (directContractValues && directContractValues.isEscrowedPrize !== null && directContractValues.isEscrowedPrize !== undefined)
      ? directContractValues.isEscrowedPrize === true
      : raffle.isEscrowedPrize === true;

    // Determine if this is a mintable NFT prize
    // Only consider it mintable if we explicitly know it's not escrowed
    const isMintable = isEscrowedPrize === false;



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
    if (raffle.isCollabPool) return 'NFT Collab';

    // Use async-determined collab status from context (fallback)
    const collabStatus = getCollabStatus(raffle.address);
    if (collabStatus === 'nft_collab') return 'NFT Collab';
    if (collabStatus === undefined) return 'Checking...'; // Still determining collab status

    // Continue with other prize types - check these BEFORE whitelist collab
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

    // Only show 'Whitelist Collab' for NON-PRIZED pools with holderTokenAddress
    if (collabStatus === 'whitelist_collab' && !raffle.isPrized) {
      return 'Whitelist Collab';
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

  // Determine if this is an NFT pool that should show artwork
  // Note: NFT Drop pools can have isCollabPool=true, so we check for artwork availability instead
  const isNFTPool = raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero;
  const shouldShowArtworkLayout = isNFTPool && (nftImageUrl || nftImageLoading);

  // NFT Artwork Card Layout - for NFT Drop, NFT Giveaway, Lucky NFT Sale
  if (shouldShowArtworkLayout) {
    return (
      <div className="landing-raffle-card group relative bg-card/80 text-foreground backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:border-primary/30 hover:bg-card/90 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full w-full max-w-full cursor-pointer" onClick={handleViewRaffle}>
        {/* Status indicator bar at top */}
        <div className={`h-1 w-full ${getStatusGradient()}`} />
        
        {/* Hover overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* NFT Artwork Section - reduced height */}
        <div className="relative w-full h-40 bg-muted/30 overflow-hidden">
          {nftImageLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : nftImageUrl ? (
            <>
              <img
                src={nftImageUrl}
                alt={raffle.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={handleNftImageError}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <Trophy className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
          
          {/* Status badge overlay */}
          <div className="absolute top-2 right-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Info section below artwork - matching standard card styling */}
        <div className="p-4 sm:p-5 flex flex-col flex-1">
          {/* Pool Name - matching standard card font size */}
          <h3 className="font-display text-[length:var(--text-lg)] font-semibold truncate mb-4 group-hover:text-primary transition-colors duration-200">
            {raffle.name}
          </h3>

          {/* Stats row - matching standard card layout */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[length:var(--text-sm)] block">Slot Fee</span>
              <span className="font-medium text-[length:var(--text-sm)]">{formatSlotFee(raffle.slotFee || '0')}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[length:var(--text-sm)] block">Winners</span>
              <span className="font-medium text-[length:var(--text-sm)]">{raffle.winnersCount}</span>
            </div>
          </div>

          {/* Progress section - matching standard card */}
          <div className="relative mt-auto pt-3 border-t border-border/30 space-y-2">
            <div className="flex justify-between text-[length:var(--text-sm)]">
              <span className="text-muted-foreground">Progress (Slots Sold)</span>
              <span className="font-medium">
                {ticketsSold !== null ? `${ticketsSold} / ${raffle.slotLimit}` : '...'}
              </span>
            </div>
            {ticketsSold !== null && raffle.slotLimit && (
              <Progress 
                value={Math.min(100, (ticketsSold / raffle.slotLimit) * 100)} 
                size="default"
                variant="gradient"
                indicatorVariant="gradient"
                showShimmer
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard Card Layout - for non-NFT pools
  return (
    <div className="landing-raffle-card group relative bg-card/80 text-foreground backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:border-primary/30 hover:bg-card/90 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full w-full max-w-full cursor-pointer" onClick={handleViewRaffle}>
      {/* Phase 3: Status indicator bar at top */}
      <div className={`h-1 w-full ${getStatusGradient()}`} />
      
      {/* Hover overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header with name and status badge */}
        <div className="relative flex items-start justify-between mb-4 min-w-0 gap-2">
          <h3 className="font-display text-[length:var(--text-lg)] font-semibold truncate flex-1 min-w-0 group-hover:text-primary transition-colors duration-200">
            {raffle.name}
          </h3>
          <div className="flex-shrink-0">
            {getStatusBadge()}
          </div>
        </div>

        {/* Stats grid layout - consistent stacked format */}
        <div className="relative grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[length:var(--text-sm)] block">Slot Fee</span>
            <span className="font-medium text-[length:var(--text-sm)]">{formatSlotFee(raffle.slotFee || '0')}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[length:var(--text-sm)] block">Winners</span>
            <span className="font-medium text-[length:var(--text-sm)]">{raffle.winnersCount}</span>
          </div>
        </div>

        {/* Timer section - stacked format */}
        <div className="relative grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[length:var(--text-sm)] block">{timeLabel}</span>
            <span className="font-medium text-[length:var(--text-sm)]">{timeRemaining}</span>
          </div>
          {/* Pool Type - stacked format */}
          {!raffle.isSummary && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[length:var(--text-sm)] block">Pool Type</span>
              <span className="font-medium text-[length:var(--text-sm)] truncate block">{getPrizeType()}</span>
            </div>
          )}
        </div>

        {/* Additional info section - stacked format */}
        <div className="relative grid grid-cols-2 gap-3 mb-4 min-w-0">
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
              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[length:var(--text-sm)] block">Prize Token ID</span>
                <span className={`font-medium text-[length:var(--text-sm)] truncate block ${collectionSymbol || collectionName ? '' : 'font-mono'}`}>
                  {displayValue}
                </span>
              </div>
            );
          } else if (isMintable) {
            // For mintable NFT prizes: show 'Prize Collection' with collection name or address
            const hasCollectionName = collectionName && collectionName.trim() !== '';
            const isLikelyERC721 = raffle.standard === 0 || (raffle.standard === undefined && hasCollectionName);
            const isDefinitelyERC1155 = raffle.standard === 1;

            const displayValue = isDefinitelyERC1155
              ? `${raffle.prizeCollection?.slice(0, 10)}...` // ERC1155: always use address
              : (hasCollectionName
                  ? collectionName // ERC721 or likely ERC721: use name if available
                  : `${raffle.prizeCollection?.slice(0, 10)}...`); // Fallback to address

            return (
              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[length:var(--text-sm)] block">Collection</span>
                <span className={`font-medium text-[length:var(--text-sm)] truncate block ${hasCollectionName && !isDefinitelyERC1155 ? '' : 'font-mono'}`}>
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
                               raffle.isCollabPool === false;

          // Hide Prize Amount for escrowed NFT prizes
          if (isEscrowedNFT) {
            return null;
          }

          // Show Prize Amount for Token Giveaways and other giveaways
          if (prizeType === 'Token Giveaway' || prizeType.includes('Giveaway')) {
            return (
              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[length:var(--text-sm)] block">Prize Amount</span>
                <span className="font-medium text-[length:var(--text-sm)] truncate block">{getPrizeAmount()}</span>
              </div>
            );
          }

          return null;
        })()}
        </div>

        {/* Progress section - moved to bottom */}
        <div className="relative mt-auto pt-3 border-t border-border/30 space-y-2">
          <div className="flex justify-between text-[length:var(--text-sm)]">
            <span className="text-muted-foreground">Progress (Slots Sold)</span>
            <span className="font-medium">
              {ticketsSold !== null ? `${ticketsSold} / ${raffle.slotLimit}` : '...'}
            </span>
          </div>
          {ticketsSold !== null && raffle.slotLimit && (
            <Progress 
              value={Math.min(100, (ticketsSold / raffle.slotLimit) * 100)} 
              size="default"
              variant="gradient"
              indicatorVariant="gradient"
              showShimmer
            />
          )}
        </div>
      </div>
    </div>
  );
};



const LandingPage = () => {
  const { connected } = useWallet();
  const { isMobile } = useMobileBreakpoints();
  const { formatSlotFee, formatPrizeAmount } = useNativeCurrency();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

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
  } = useRaffleFilters(raffles, searchQuery);

  // Clear all filters including search
  const handleClearAll = () => {
    clearFilters();
    setSearchQuery('');
  };
  // Reset pagination when data source or filters change
  useEffect(() => {
    setPage(1);
  }, [isMobile, loading, raffles?.length, filteredRaffles?.length, summaries?.length, hasActiveFilters, searchQuery]);


  // Show wallet connection prompt if not connected
  if (!connected) {
    return (
      <PageContainer className="pt-8 pb-4">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <h1 className="font-display text-[length:var(--text-4xl)] font-bold mb-4 leading-tight tracking-tighter">
            Fairness and Transparency,{' '}
            <span className="bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-x">
              On-Chain
            </span>
          </h1>
          <p className="font-body text-[length:var(--text-lg)] text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Dropr is a permissionless platform built to host decentralized, on-chain raffles. All draws are public and auditable.
          </p>

          {/* Trust Badges - Homepage hero style */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Shield className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">VRF Powered</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <CheckCircle className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fair Draws</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Eye className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fully Auditable</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <LockKeyhole className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Trustless</span>
            </div>
          </div>
        </div>

        {/* Connect Wallet Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-[length:var(--text-2xl)] font-bold mb-3 leading-tight">Connect Your Wallet</h3>
            <p className="font-body text-[length:var(--text-base)] text-muted-foreground mb-6">
              Connect your wallet to view and interact with raffles on the blockchain.
            </p>
          </div>
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
        const label = POOL_STATE_LABELS[s.stateNum]?.toLowerCase();
        return wanted.has(label);
      });
    }


  }



  // Show loading only when neither summaries (possibly filtered) nor full data are available
  const shouldShowLoading = !canUseSummariesForCurrentFilters && loading;
  if (shouldShowLoading) {
    return (
      <PageContainer className="pt-8 pb-4">
        {/* Header - consistent with main view */}
        <div className="text-center mb-12">
          <h1 className="font-display text-[length:var(--text-4xl)] font-bold mb-4 leading-tight tracking-tighter">
            Fairness and Transparency,{' '}
            <span className="bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-x">
              On-Chain
            </span>
          </h1>
          <p className="font-body text-[length:var(--text-lg)] text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Dropr is a permissionless platform built to host decentralized, on-chain raffles. All draws are public and auditable.
          </p>

          {/* Trust Badges - Homepage hero style */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Shield className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">VRF Powered</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <CheckCircle className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fair Draws</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Eye className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fully Auditable</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <LockKeyhole className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Trustless</span>
            </div>
          </div>
        </div>

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
      <PageContainer className="pt-8 pb-4">
        {/* Enhanced Header */}
        <div className="text-center mb-12">
          <h1 className="font-display text-[length:var(--text-4xl)] font-bold mb-4 leading-tight tracking-tighter">
            Fairness and Transparency,{' '}
            <span className="bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-x">
              On-Chain
            </span>
          </h1>
          <p className="font-body text-[length:var(--text-lg)] text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Dropr is a permissionless platform built to host decentralized, on-chain raffles. All draws are public and auditable.
          </p>

          {/* Trust Badges - Homepage hero style */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Shield className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">VRF Powered</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <CheckCircle className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fair Draws</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <Eye className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fully Auditable</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
            <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
              <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                <LockKeyhole className="h-3 w-3 text-primary" />
              </div>
              <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Trustless</span>
            </div>
          </div>
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
    <React.Fragment>
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
        <PageContainer className="pt-8 pb-4">
          {/* Header Section - consistent style across all states */}
          <div className="text-center mb-12">
            <h1 className="font-display text-[length:var(--text-4xl)] font-bold mb-4 leading-tight tracking-tighter">
              Fairness and Transparency,{' '}
              <span className="bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 bg-clip-text text-transparent bg-[length:200%_100%] animate-gradient-x">
                On-Chain
              </span>
            </h1>
            <p className="font-body text-[length:var(--text-lg)] text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
              Dropr is a permissionless platform built to host decentralized, on-chain raffles. All draws are public and auditable.
            </p>

            {/* Trust Badges - Homepage hero style */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
              <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
                <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                  <Shield className="h-3 w-3 text-primary" />
                </div>
                <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">VRF Powered</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
              <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
                <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                  <CheckCircle className="h-3 w-3 text-primary" />
                </div>
                <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fair Draws</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
              <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
                <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                  <Eye className="h-3 w-3 text-primary" />
                </div>
                <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Fully Auditable</span>
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-primary/40" />
              <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 hover:border-primary/40 hover:from-primary/10 hover:to-primary/20 transition-all duration-300 cursor-default">
                <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors">
                  <LockKeyhole className="h-3 w-3 text-primary" />
                </div>
                <span className="relative font-body text-[length:var(--text-xs)] font-medium text-foreground/80 group-hover:text-foreground transition-colors">Trustless</span>
              </div>
            </div>
          </div>

          {/* Phase 3: Enhanced Search and Filter Controls */}
          <div className="bg-card/40 backdrop-blur-md border border-border/30 rounded-xl p-4 mb-8 shadow-elevation-1">
            {/* Search Field with Filter Button */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="Search by pool name or contract address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  variant="filled"
                  className="pl-12 pr-4 h-12 text-[length:var(--text-base)] w-full rounded-lg focus:shadow-glow-primary"
                />
              </div>
              <FilterToggleButton
                onClick={toggleFilter}
                hasActiveFilters={hasActiveFilters}
              />
            </div>

            {/* Clear Filters and Pagination */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="font-body text-muted-foreground hover:text-foreground text-[length:var(--text-sm)]"
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
              {/* Desktop top-right pagination */}
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
                      ? <span key={`ellipsis-top-${idx}`} className="px-1 font-body text-muted-foreground">…</span>
                      : (
                        <button
                          key={`page-top-${item}`}
                          onClick={() => setPage(item)}
                          className={`px-1 font-body text-[length:var(--text-sm)] leading-none ${currentPageSafe === item ? 'font-semibold text-foreground' : 'text-foreground/80'} bg-transparent`}
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

          {/* Section Title */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary rounded-full" />
              <h2 className="font-display text-[length:var(--text-xl)] font-semibold text-foreground">
                {hasActiveFilters || searchQuery ? 'Filtered Raffles' : 'All Raffles'}
              </h2>
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
                    searchQuery && searchQuery.trim()
                      ? "No raffles found matching your search. Try a different search term."
                      : hasActiveFilters
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
    </React.Fragment>
  );
};

export { RaffleCard };
export default LandingPage;
