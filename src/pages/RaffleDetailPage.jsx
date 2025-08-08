import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Ticket, Clock, Trophy, Users, ArrowLeft, AlertCircle, CheckCircle, DollarSign, Trash2, Info, ChevronDown } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageContainer } from '../components/Layout';
import { contractABIs } from '../contracts/contractABIs';
import { toast } from '../components/ui/sonner';
import { PageLoading, ContentLoading } from '../components/ui/loading';
import { RaffleErrorDisplay } from '../components/ui/raffle-error-display';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { useRaffleStateManager, useRaffleEventListener } from '../hooks/useRaffleService';
import {
  batchContractCalls,
  safeContractCall,
  getPlatformConfig,
  getBrowserInfo,
  hasContractMethod,
  createSafeMethod
} from '../utils/contractCallUtils';
import { useErrorHandler } from '../utils/errorHandling';

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

// Utility to extract only the revert reason from contract errors
function extractRevertReason(error) {
  if (error?.reason) return error.reason;
  if (error?.data?.message) return error.data.message;
  const msg = error?.message || error?.data?.message || error?.toString() || '';
  const match = msg.match(/execution reverted:?\s*([^\n]*)/i);
  if (match && match[1]) return match[1].trim();
  return msg;
}

const TicketPurchaseSection = ({ raffle, onPurchase, timeRemaining, winners, shouldShowClaimPrize, prizeAlreadyClaimed, claimingPrize, handleClaimPrize, shouldShowClaimRefund, claimingRefund, handleClaimRefund, refundableAmount, isMintableERC721, showMintInput, setShowMintInput, mintWinnerAddress, setMintWinnerAddress, mintingToWinner, handleMintToWinner, isEscrowedPrize, isExternallyPrized, isPrized, isMobile, onStateChange }) => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const { formatTicketPrice, getCurrencySymbol } = useNativeCurrency();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userTickets, setUserTickets] = useState(0);
  const [winningChance, setWinningChance] = useState(null);
  const [activating, setActivating] = useState(false);
  const [usesCustomPrice, setUsesCustomPrice] = useState(null);
  const [endingRaffle, setEndingRaffle] = useState(false);
  const [requestingRandomness, setRequestingRandomness] = useState(false);

  useEffect(() => {
    fetchUserTickets();
  }, [raffle.address, address]);

  useEffect(() => {
    async function fetchUsesCustomPrice() {
      if (!raffle.address) return;
      try {
        const raffleContract = getContractInstance(raffle.address, 'raffle');
        if (!raffleContract) return;
        const result = await raffleContract.usesCustomPrice();
        setUsesCustomPrice(result);
      } catch (e) {
        setUsesCustomPrice(null);
      }
    }
    fetchUsesCustomPrice();
  }, [raffle.address, getContractInstance]);

  const fetchUserTickets = async () => {
    if (!raffle.address || !address) {
      setUserTickets(0);
      setWinningChance(null);
      return;
    }
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) return;
      const tickets = await raffleContract.ticketsPurchased(address);
      setUserTickets(tickets.toNumber ? tickets.toNumber() : Number(tickets));
      let totalTickets = 0;
      try {
        const participantsCount = await raffleContract.getParticipantsCount();
        totalTickets = participantsCount.toNumber();
      } catch (error) {
        let index = 0;
        while (true) {
          try {
            await raffleContract.participants(index);
            totalTickets++;
            index++;
          } catch {
            break;
          }
        }
      }
      if (totalTickets > 0 && tickets > 0) {
        setWinningChance(((tickets / totalTickets) * 100).toFixed(2));
      } else {
        setWinningChance(null);
      }
    } catch (e) {
      setUserTickets(0);
      setWinningChance(null);
    }
  };

  const handlePurchase = async () => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }
    setLoading(true);
    try {
      await onPurchase(quantity);
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setLoading(false);
    }
  };

  const canPurchaseTickets = () => {
    return raffle.state?.toLowerCase() === 'active';
  };

  const isRaffleEnded = () => {
    const now = Math.floor(Date.now() / 1000);
    const raffleEndTime = raffle.startTime + raffle.duration;
    return (raffle.state === 'Active' && now >= raffleEndTime) ||
           timeRemaining === 'Ended';
  };

  const handleActivateRaffle = async () => {
    setActivating(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) throw new Error('Failed to get raffle contract');
      const result = await executeTransaction(raffleContract.activate);
      if (result.success) {
        toast.success('Raffle activated successfully!');
        // Trigger state refresh instead of page reload
        if (onStateChange) {
          onStateChange();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.error(extractRevertReason(err));
    } finally {
      setActivating(false);
    }
  };
  
  const handleRequestRandomness = async () => {
    setRequestingRandomness(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) throw new Error('Failed to get raffle contract');
      const result = await executeTransaction(raffleContract.requestRandomWords);
      if (result.success) {
        toast.success('Randomness requested successfully!');
        // Trigger state refresh instead of page reload
        if (onStateChange) {
          onStateChange();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(extractRevertReason(error));
    } finally {
      setRequestingRandomness(false);
    }
  };

  const handleEndRaffle = async () => {
    setEndingRaffle(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) throw new Error('Failed to get raffle contract');
      const result = await executeTransaction(raffleContract.endRaffle);
      if (result.success) {
        toast.success('Raffle ended successfully!');
        // Trigger state refresh instead of page reload
        if (onStateChange) {
          onStateChange();
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.error(extractRevertReason(err));
    } finally {
      setEndingRaffle(false);
    }
  };

  // Prize claiming logic is now handled by parent component
  const canClaimPrize = () => shouldShowClaimPrize && !prizeAlreadyClaimed;

  const canClaimRefund = () => {
    return (
      raffle.isPrized &&
      (raffle.stateNum === 4 || raffle.stateNum === 7 || raffle.stateNum === 8) &&
      refundableAmount && refundableAmount.gt && refundableAmount.gt(0)
    );
  };

  const now = Math.floor(Date.now() / 1000);
  const canActivate = raffle && raffle.startTime ? now >= raffle.startTime : false;

  // Fix: Define maxPurchasable for ticket purchase logic
  const remainingTickets = raffle.ticketLimit - raffle.ticketsSold;
  const maxPurchasable = Math.min(
    remainingTickets,
    raffle.maxTicketsPerParticipant
  );

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Ticket className="h-5 w-5" />
        Purchase Tickets
      </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
            <span className="text-muted-foreground">Ticket Price{usesCustomPrice === true ? ' (set by Creator)' : usesCustomPrice === false ? ' (Protocol Ticket Fee)' : ''}:</span>
              <p className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{formatTicketPrice(raffle.ticketPrice || '0')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Remaining tickets:</span>
              <p className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{raffle.ticketLimit - raffle.ticketsSold}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Your tickets:</span>
            <p className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{userTickets || 0}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Winning Chance:</span>
            <p className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{winningChance !== null ? `${winningChance}%` : 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Max per user:</span>
              <p className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{raffle.maxTicketsPerParticipant}</p>
            </div>
            {canClaimRefund && refundableAmount && refundableAmount.gt && refundableAmount.gt(0) && (
              <div>
                <span className="text-muted-foreground">Your Refundable Amount:</span>
                <p className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{ethers.utils.formatEther(refundableAmount)} ETH</p>
              </div>
            )}
          <div></div>
          </div>

        {(raffle.stateNum === 4 || raffle.stateNum === 7 || raffle.stateNum === 8) ? (
          <>
            {/* Placeholder content to maintain card height on desktop - positioned close to action buttons */}
            <div className="hidden lg:block space-y-4">
              <div className="p-4 bg-muted/20 backdrop-blur-sm border border-border/20 rounded-lg">
                <div className="text-center text-muted-foreground">
                  <div className="text-sm font-medium mb-2">Your Participation Summary</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-muted-foreground">Tickets Purchased</span>
                      <span className="font-semibold text-base">{userTickets || 0}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">Total Spent</span>
                      <span className="font-semibold text-base">
                        {userTickets > 0 ? formatTicketPrice(ethers.BigNumber.from(raffle.ticketPrice).mul(userTickets)) : `0 ${getCurrencySymbol()}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-8"></div> {/* Spacer to maintain card height and position buttons */}
            </div>
            {(canClaimPrize() || canClaimRefund()) ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                {canClaimPrize() && (
                  <button
                    onClick={handleClaimPrize}
                    disabled={claimingPrize || !connected}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-6 py-3 rounded-lg hover:from-yellow-600 hover:to-orange-700 transition-colors disabled:opacity-50"
                  >
                    {claimingPrize
                      ? (isMintableERC721 && !isEscrowedPrize ? 'Minting...' : 'Claiming...')
                      : (isMintableERC721 && !isEscrowedPrize ? 'Mint Prize' : 'Claim Prize')}
                  </button>
                )}
                {canClaimRefund() && (
                  <button
                    onClick={handleClaimRefund}
                    disabled={claimingRefund || !connected}
                    className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-teal-700 transition-colors disabled:opacity-50"
                  >
                    {claimingRefund ? 'Claiming...' : 'Claim Refund'}
                  </button>
                )}
              </div>
            ) : (
              <button
                disabled
                className="w-full bg-muted text-muted-foreground px-6 py-3 rounded-lg opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
              >
                Raffle Ended
              </button>
            )}
          </>
        ) : (
          <>
            {/* Placeholder content to maintain card height on desktop for non-active states - positioned close to action buttons */}
            {!canPurchaseTickets() && (
              <div className="hidden lg:block space-y-4">
                <div className="p-4 bg-muted/20 backdrop-blur-sm border border-border/20 rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <div className="text-sm font-medium mb-2">Your Participation Summary</div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="block text-muted-foreground">Tickets Purchased</span>
                        <span className="font-semibold text-base">{userTickets || 0}</span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Total Spent</span>
                        <span className="font-semibold text-base">
                          {userTickets > 0 ? formatTicketPrice(ethers.BigNumber.from(raffle.ticketPrice).mul(userTickets)) : `0 ${getCurrencySymbol()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-8"></div> {/* Spacer to maintain card height and position buttons */}
              </div>
            )}
            {raffle.state?.toLowerCase() === 'pending' && canActivate ? (
              <button
                onClick={handleActivateRaffle}
                disabled={activating}
                className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-green-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {activating ? 'Activating...' : 'Activate Raffle'}
              </button>
            ) : raffle.stateNum === 2 && (address?.toLowerCase() === raffle.creator.toLowerCase() || userTickets > 0) ? (
              <>
                <button
                  onClick={handleRequestRandomness}
                  disabled={requestingRandomness}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requestingRandomness ? 'Requesting...' : 'Request Randomness'}
                </button>
                <p className="text-muted-foreground mt-4 text-center text-sm">
                      The raffle has ended. {address?.toLowerCase() === raffle.creator.toLowerCase() ? 'As the creator' : 'As a participant'}, you can request the randomness to initiate winner selection.
                </p>
              </>
            ) : (raffle.state === 'Completed' || raffle.stateNum === 4 || raffle.stateNum === 7) ? (
              <button
                disabled
                className="w-full bg-muted text-muted-foreground px-6 py-3 rounded-lg opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
              >
                Raffle Ended
              </button>
            ) : isRaffleEnded() ? (
              <button
                onClick={handleEndRaffle}
                disabled={endingRaffle}
                    className="w-full bg-gradient-to-r from-red-500 to-red-700 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-red-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {endingRaffle ? 'Ending...' : 'End Raffle'}
              </button>
            ) : maxPurchasable <= 0 ? (
              <button
                disabled
                className="w-full bg-muted text-muted-foreground px-6 py-3 rounded-lg opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
              >
                Raffle Ended
              </button>
            ) : userTickets >= raffle.maxTicketsPerParticipant ? (
              <button
                disabled
                className="w-full bg-muted text-muted-foreground px-6 py-3 rounded-lg opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
              >
                Limit Reached
              </button>
        ) : (
            <>
              {/* Show quantity and cost inputs only when tickets can be purchased */}
              {canPurchaseTickets() ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={raffle.maxTicketsPerParticipant}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(raffle.maxTicketsPerParticipant, parseInt(e.target.value) || 1)))}
                      className="w-full px-3 py-2.5 border border-border rounded-md bg-background"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum: {raffle.maxTicketsPerParticipant} tickets
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 backdrop-blur-sm border border-border/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total Cost:</span>
                      <span className={`font-bold ${isMobile ? 'text-base' : 'text-lg'}`}>{formatTicketPrice(ethers.BigNumber.from(raffle.ticketPrice).mul(quantity))}</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Spacer to maintain card height when tickets can't be purchased */
                <div className="hidden lg:block h-32"></div>
              )}
              <button
                onClick={handlePurchase}
                disabled={loading || !connected || !canPurchaseTickets()}
                className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                <Ticket className="h-4 w-4" />
                {loading ? 'Processing...' : `Purchase ${quantity} Ticket${quantity > 1 ? 's' : ''}`}
              </button>
              </>
            )}
            {!connected && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">
                  Please connect your wallet to purchase tickets.
                </p>
              </div>
            )}
          </>
        )}

          {!connected && (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                Please connect your wallet to purchase tickets.
              </p>
            </div>
          )}
        </div>
    </div>
  );
};

const PrizeImageCard = ({ raffle, isMintableERC721 }) => {
  const { getContractInstance } = useContract();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchSource, setFetchSource] = useState(null); // Track successful source for debugging

  // Multiple IPFS gateways for resilience
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.infura.io/ipfs/'
  ];

  // Classify URI format for appropriate processing
  const classifyURI = (uri) => {
    if (uri.includes('.json')) return 'explicit_json';
    if (uri.match(/\/\d+$/)) return 'numeric_endpoint';
    if (uri.includes('{id}')) return 'template_format';
    if (uri.endsWith('/')) return 'base_directory';
    return 'unknown_format';
  };

  // Generate multiple URI variants prioritizing extensionless formats
  const constructMetadataURIs = (baseUri, tokenId) => {
    const uriVariants = [];
    const cleanBaseUri = baseUri.replace(/\/$/, ''); // Remove trailing slash

    // Check if the URI already contains the token ID (like tokenURI responses)
    const tokenIdStr = tokenId.toString();
    const alreadyContainsTokenId = baseUri.includes(`/${tokenIdStr}`) || baseUri.endsWith(`/${tokenIdStr}`) || baseUri.endsWith(tokenIdStr);

    if (alreadyContainsTokenId) {
      console.log('[PrizeImageCard] URI already contains token ID, using as-is and with extensions');
      // Priority 1: Original URI as-is (for tokenURI responses)
      uriVariants.push(baseUri);

      // Priority 2: Add .json extension if not present
      if (!baseUri.includes('.json')) {
        uriVariants.push(`${baseUri}.json`);
      }
    } else {
      console.log('[PrizeImageCard] URI does not contain token ID, constructing variants');
      // Priority 1: No extension (as requested)
      uriVariants.push(`${cleanBaseUri}/${tokenId}`);
      uriVariants.push(`${cleanBaseUri}${tokenId}`);

      // Priority 2: Common formats
      uriVariants.push(`${cleanBaseUri}/${tokenId}.json`);
      uriVariants.push(`${cleanBaseUri}${tokenId}.json`);

      // Priority 3: Template formats
      if (baseUri.includes('{id}')) {
        const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
        uriVariants.push(baseUri.replace('{id}', tokenId));
        uriVariants.push(baseUri.replace('{id}', hexId));
      }

      // Priority 4: Original URI as-is
      uriVariants.push(baseUri);
    }

    return [...new Set(uriVariants)]; // Remove duplicates
  };

  // Convert IPFS URIs to multiple gateway variants
  const convertIPFStoHTTP = (ipfsUri) => {
    if (!ipfsUri.startsWith('ipfs://')) return [ipfsUri];

    const hash = ipfsUri.replace('ipfs://', '');
    return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
  };

  // Extract image URL from metadata with flexible field support
  const extractImageURL = (metadata) => {
    const imageFields = [
      'image',
      'image_url',
      'imageUrl',
      'animation_url',
      'animationUrl',
      'media',
      'artwork'
    ];

    for (const field of imageFields) {
      if (metadata[field]) {
        let imageUrl = metadata[field];

        // Convert IPFS image URLs to HTTP
        if (imageUrl.startsWith('ipfs://')) {
          imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
        }

        return imageUrl;
      }
    }

    return null;
  };

  // Enhanced fetch with timeout and error handling
  const fetchWithTimeout = async (url, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Cascading fetch strategy with fallback
  const fetchMetadataWithFallback = async (uriVariants) => {
    for (const uri of uriVariants) {
      try {
        console.log(`[PrizeImageCard] Attempting to fetch metadata from: ${uri}`);

        const response = await fetchWithTimeout(uri);

        if (response.ok) {
          const contentType = response.headers.get('content-type');

          // Try to parse as JSON
          try {
            const metadata = await response.json();
            if (metadata && typeof metadata === 'object') {
              const imageUrl = extractImageURL(metadata);
              if (imageUrl) {
                console.log(`[PrizeImageCard] ✅ Successfully fetched from: ${uri}`);
                return { metadata, imageUrl, sourceUri: uri };
              }
            }
          } catch (jsonError) {
            // If JSON parsing fails, try as plain text (might be direct image URL)
            if (contentType?.startsWith('image/') || uri.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
              console.log(`[PrizeImageCard] ✅ Direct image URL found: ${uri}`);
              return { metadata: { image: uri }, imageUrl: uri, sourceUri: uri };
            }
          }
        }
      } catch (error) {
        console.warn(`[PrizeImageCard] ❌ Failed to fetch from ${uri}:`, error.message);
        continue; // Try next variant
      }
    }

    throw new Error('All metadata fetch attempts failed');
  };

  // Main fetch function with enhanced logic
  useEffect(() => {
    async function fetchPrizeImageEnhanced() {
      console.log('[PrizeImageCard] Starting fetch for raffle:', {
        isPrized: raffle.isPrized,
        standard: raffle.standard,
        prizeCollection: raffle.prizeCollection,
        prizeTokenId: raffle.prizeTokenId,
        isExternallyPrized: raffle.isExternallyPrized,
        isMintableERC721: isMintableERC721
      });

      // Check if we should attempt to fetch (same logic as render condition)
      const shouldFetch = raffle.isPrized ||
        (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) ||
        (raffle.standard !== undefined && raffle.prizeTokenId !== undefined);

      if (!shouldFetch) {
        console.log('[PrizeImageCard] No prize information available, skipping fetch');
        return;
      }

      setLoading(true);
      setImageUrl(null);
      setFetchSource(null);

      try {
        // Step 1: Get base URI from contract
        let baseUri = null;
        const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';
        const contract = getContractInstance(raffle.prizeCollection, contractType);
        // Fix the mintable logic:
        // - Mintable: isExternallyPrized === true (prize minted from collection)
        // - Escrowed: isExternallyPrized === false (prize held by raffle contract)
        // - If undefined, we need to determine based on available data
        let isMintable;
        if (raffle.isExternallyPrized === true) {
          isMintable = true; // Definitely mintable
        } else if (raffle.isExternallyPrized === false) {
          isMintable = false; // Definitely escrowed
        } else {
          // isExternallyPrized is undefined - try to determine from other data
          // If we have a prizeTokenId, it's likely escrowed (specific token)
          // If no prizeTokenId or prizeTokenId is 0, it's likely mintable
          const hasSpecificTokenId = raffle.prizeTokenId &&
            (raffle.prizeTokenId.toString() !== '0' && raffle.prizeTokenId !== 0);
          isMintable = !hasSpecificTokenId;
          console.log('[PrizeImageCard] isExternallyPrized is undefined, inferring from tokenId:', {
            prizeTokenId: raffle.prizeTokenId,
            hasSpecificTokenId,
            inferredMintable: isMintable
          });
        }

        console.log('[PrizeImageCard] Contract and mintable status:', {
          contract: !!contract,
          contractAddress: raffle.prizeCollection,
          contractType,
          isMintable,
          isMintableERC721,
          isExternallyPrized: raffle.isExternallyPrized,
          correctedLogic: 'isMintable = isExternallyPrized === true'
        });

        if (!contract) {
          console.error('[PrizeImageCard] Failed to get contract instance for:', {
            address: raffle.prizeCollection,
            type: contractType
          });
          setImageUrl(null);
          setLoading(false);
          return;
        }

        if (raffle.standard === 0) {
          // ERC721 Prize Logic
          console.log('[PrizeImageCard] Processing ERC721 prize, isMintable:', isMintable);

          if (isMintable) {
            console.log('[PrizeImageCard] Attempting to fetch unrevealedBaseURI for mintable ERC721');
            try {
              baseUri = await contract.unrevealedBaseURI();
              console.log('[PrizeImageCard] unrevealedBaseURI result:', baseUri);
              if (!baseUri || baseUri.trim() === '') {
                console.log('[PrizeImageCard] Empty unrevealedBaseURI, trying tokenURI as fallback');
                // Fallback to tokenURI if unrevealedBaseURI is empty
                try {
                  baseUri = await contract.tokenURI(raffle.prizeTokenId);
                  console.log('[PrizeImageCard] Fallback tokenURI result:', baseUri);
                } catch (fallbackError) {
                  console.log('[PrizeImageCard] Fallback tokenURI also failed:', fallbackError);
                  setImageUrl(null);
                  setLoading(false);
                  return;
                }
              }
            } catch (error) {
              console.log('[PrizeImageCard] No unrevealedBaseURI found for mintable ERC721, trying tokenURI:', error);
              // Fallback to tokenURI
              try {
                baseUri = await contract.tokenURI(raffle.prizeTokenId);
                console.log('[PrizeImageCard] Fallback tokenURI result:', baseUri);
              } catch (fallbackError) {
                console.error('[PrizeImageCard] Both unrevealedBaseURI and tokenURI failed:', fallbackError);
                setImageUrl(null);
                setLoading(false);
                return;
              }
            }
          } else {
            console.log('[PrizeImageCard] Attempting to fetch tokenURI for escrowed ERC721, tokenId:', raffle.prizeTokenId);
            try {
              baseUri = await contract.tokenURI(raffle.prizeTokenId);
              console.log('[PrizeImageCard] tokenURI result:', baseUri);
            } catch (error) {
              console.error('[PrizeImageCard] Error fetching tokenURI for escrowed ERC721:', error);
              setImageUrl(null);
              setLoading(false);
              return;
            }
          }
        } else if (raffle.standard === 1) {
          // ERC1155 Prize Logic
          console.log('[PrizeImageCard] Processing ERC1155 prize, isMintable:', isMintable);

          if (isMintable) {
            console.log('[PrizeImageCard] Attempting to fetch URIs for mintable ERC1155');
            let unrevealedUri = null;
            let tokenUri = null;

            try {
              unrevealedUri = await contract.unrevealedURI();
              console.log('[PrizeImageCard] unrevealedURI result for ERC1155:', unrevealedUri);
            } catch (error) {
              console.log('[PrizeImageCard] No unrevealedURI found for ERC1155:', error);
            }

            try {
              tokenUri = await contract.tokenURI(raffle.prizeTokenId);
              console.log('[PrizeImageCard] tokenURI result for ERC1155:', tokenUri);
            } catch (error) {
              console.log('[PrizeImageCard] No tokenURI found for ERC1155:', error);
            }

            // Prefer tokenURI if both exist, otherwise use unrevealedURI
            if (tokenUri && tokenUri.trim() !== '') {
              baseUri = tokenUri;
              console.log('[PrizeImageCard] Using tokenURI for mintable ERC1155:', baseUri);
            } else if (unrevealedUri && unrevealedUri.trim() !== '') {
              baseUri = unrevealedUri;
              console.log('[PrizeImageCard] Using unrevealedURI for mintable ERC1155:', baseUri);
            } else {
              console.log('[PrizeImageCard] No valid URI found for mintable ERC1155, trying uri() as fallback');
              // Fallback to uri() method
              try {
                baseUri = await contract.uri(raffle.prizeTokenId);
                console.log('[PrizeImageCard] Fallback uri() result for ERC1155:', baseUri);
              } catch (fallbackError) {
                console.error('[PrizeImageCard] All URI methods failed for mintable ERC1155:', fallbackError);
                setImageUrl(null);
                setLoading(false);
                return;
              }
            }
          } else {
            console.log('[PrizeImageCard] Attempting to fetch uri for escrowed ERC1155, tokenId:', raffle.prizeTokenId);
            try {
              baseUri = await contract.uri(raffle.prizeTokenId);
              console.log('[PrizeImageCard] uri result for escrowed ERC1155:', baseUri);
            } catch (error) {
              console.error('[PrizeImageCard] Error fetching uri for escrowed ERC1155:', error);
              setImageUrl(null);
              setLoading(false);
              return;
            }
          }
        } else {
          setImageUrl(null);
          setLoading(false);
          return;
        }

        if (!baseUri || baseUri.trim() === '') {
          console.log('[PrizeImageCard] Empty baseUri, stopping fetch');
          setImageUrl(null);
          setLoading(false);
          return;
        }

        console.log('[PrizeImageCard] Successfully obtained baseUri:', baseUri);

        // Test with the specific URI you provided for debugging
        if (raffle.prizeTokenId === '23' || raffle.prizeTokenId === 23) {
          console.log('[PrizeImageCard] DEBUG: Testing with token ID 23, expected URI: ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/23');
          console.log('[PrizeImageCard] DEBUG: Actual baseUri received:', baseUri);
          console.log('[PrizeImageCard] DEBUG: URI match:', baseUri === 'ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/23');
        }

        // Step 2: Generate URI variants
        const uriVariants = constructMetadataURIs(baseUri, raffle.prizeTokenId);
        console.log('[PrizeImageCard] Generated URI variants:', uriVariants);

        // Step 3: Convert IPFS URIs to multiple gateways
        const allURIs = [];
        for (const variant of uriVariants) {
          if (variant.startsWith('ipfs://')) {
            allURIs.push(...convertIPFStoHTTP(variant));
          } else {
            allURIs.push(variant);
          }
        }

        console.log(`[PrizeImageCard] Generated ${allURIs.length} total URI variants for token ${raffle.prizeTokenId}:`, allURIs);

        // Step 4: Attempt fetch with cascading fallback
        const result = await fetchMetadataWithFallback(allURIs);

        console.log('[PrizeImageCard] Fetch successful:', result);
        setImageUrl(result.imageUrl);
        setFetchSource(result.sourceUri);

      } catch (error) {
        console.error('[PrizeImageCard] All fetch attempts failed:', error);
        setImageUrl(null);
        setFetchSource(null);
      }

      setLoading(false);
    }

    // Trigger fetch if we have prize information
    const shouldFetch = raffle.isPrized ||
      (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) ||
      (raffle.standard !== undefined && raffle.prizeTokenId !== undefined);

    if (shouldFetch) fetchPrizeImageEnhanced();
  }, [raffle, getContractInstance, isMintableERC721]);

  // Check if we should render the component
  const shouldRender = raffle.isPrized ||
    (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) ||
    (raffle.standard !== undefined && raffle.prizeTokenId !== undefined);

  if (!shouldRender) {
    console.log('[PrizeImageCard] Not rendering: no prize information available', {
      isPrized: raffle.isPrized,
      prizeCollection: raffle.prizeCollection,
      standard: raffle.standard,
      prizeTokenId: raffle.prizeTokenId
    });
    return null;
  }

  // Log render decision for debugging
  console.log('[PrizeImageCard] Rendering component:', {
    isPrized: raffle.isPrized,
    prizeCollection: raffle.prizeCollection,
    hasStandard: raffle.standard !== undefined,
    hasTokenId: raffle.prizeTokenId !== undefined
  });

  // Show loading state
  if (loading) {
    return (
      <Card className="h-full flex flex-col items-center justify-center">
        <CardContent className="flex flex-col items-center justify-center">
          <div className="w-64 h-64 flex items-center justify-center border rounded-lg bg-muted/30">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading prize image...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no image URL after loading
  if (!imageUrl) {
    console.log('[PrizeImageCard] Not rendering: no imageUrl after loading completed');
    return null;
  }

  return (
    <Card className="h-full flex flex-col items-center justify-center">
      <CardContent className="flex flex-col items-center justify-center">
        <img
          src={imageUrl}
          alt="Prize Art"
          className="w-64 h-64 object-contain rounded-lg border"
          style={{ background: '#fff' }}
          onError={(e) => {
            console.error('[PrizeImageCard] Image failed to load:', imageUrl);
            setImageUrl(null);
          }}
        />
      </CardContent>
    </Card>
  );
};

// Enhanced Winner Card Component with improved styling
const WinnerCard = ({ winner, index, raffle, connectedAddress, onToggleExpand, isExpanded, stats, onLoadStats, collectionName }) => {
  const isCurrentUser = connectedAddress && winner.address.toLowerCase() === connectedAddress.toLowerCase();
  const { formatPrizeAmount } = useNativeCurrency();
  const [erc20Symbol, setErc20Symbol] = React.useState('TOKEN');

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
        console.error('Error fetching ERC20 symbol:', error);
        if (isMounted) setErc20Symbol('TOKEN');
      }
    }

    fetchERC20Symbol();
    return () => { isMounted = false; };
  }, [raffle.erc20PrizeToken]);

  const formatAddress = (address) => {
    return address; // Display full address instead of truncated
  };

  const getPrizeInfo = () => {
    if (!raffle.isPrized) return 'No Prize';

    const winnersCount = raffle.winnersCount || 1; // Fallback to 1 to avoid division by zero

    // Native Prize - Divide total amount by number of winners
    if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
      const prizePerWinner = raffle.nativePrizeAmount.div(winnersCount);
      return formatPrizeAmount(prizePerWinner);
    }

    // ERC20 Prize - Divide total amount by number of winners
    if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero &&
        raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
      const prizePerWinner = raffle.erc20PrizeAmount.div(winnersCount);
      return `${ethers.utils.formatUnits(prizePerWinner, 18)} ${erc20Symbol}`;
    }

    // NFT Prizes (ERC721/ERC1155)
    if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
      if (raffle.standard === 0) {
        // ERC721: Each winner gets exactly 1 NFT (amountPerWinner should be 1)
        const amount = raffle.amountPerWinner || 1;
        const name = collectionName || 'ERC721 NFT';
        return `${amount} ${name}`;
      }
      if (raffle.standard === 1) {
        // ERC1155: Use amountPerWinner as specified in the contract
        const amount = raffle.amountPerWinner || 1;
        const name = collectionName || 'ERC1155 Token';
        return `${amount} ${name}`;
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
      color: 'text-green-600 dark:text-green-400',
      icon: 'green-dot',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    };
    return {
      text: 'Unclaimed',
      color: 'text-orange-600 dark:text-orange-400',
      icon: '⏳',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    };
  };

  const claimStatus = getClaimStatus();

  return (
    <div className={`bg-card border-2 rounded-xl transition-all duration-200 hover:shadow-md ${
      isCurrentUser ? 'border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10' : 'border-border hover:border-border/80'
    }`}>
      <div className="p-3">
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
                <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mt-0.5">
                  Your Address
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => onToggleExpand(winner, index)}
            className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
            title={isExpanded ? "Hide details" : "View details"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Only show prize information and claim status for prized raffles */}
        {raffle.isPrized && (
          <div className="flex flex-col sm:flex-row sm:justify-between gap-3 text-sm">
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
                  <div className="text-sm font-medium text-muted-foreground mb-2">Participation Details</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Tickets Purchased</span>
                      <div className="font-semibold text-base">{stats.ticketsPurchased}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Winning Tickets</span>
                      <div className="font-semibold text-base text-green-600">{stats.winningTickets}</div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">Losing Tickets</span>
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

const WinnersSection = ({ raffle, isMintableERC721, isMobile }) => {
  const { getContractInstance, executeTransaction } = useContract();
  const { address: connectedAddress } = useWallet();
  const { formatPrizeAmount } = useNativeCurrency();
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedWinner, setExpandedWinner] = useState(null);
  const [winnerStats, setWinnerStats] = useState({});
  const [winnerSelectionTx, setWinnerSelectionTx] = useState(null);
  const [collectionName, setCollectionName] = useState(null);
  const [lastWinnersUpdate, setLastWinnersUpdate] = useState(null);

  // WinnersSection is primarily for display - claim logic is handled by parent component

  // Event listener for real-time winner updates with intelligent auto-refresh
  // Stop listening for winner selection events after raffle is completed
  const isRaffleCompleted = raffle?.stateNum === 4 || raffle?.stateNum === 7; // Completed or Prizes Claimed
  const shouldListenForWinners = !!raffle && !isRaffleCompleted;

  const { isListening, eventHistory } = useRaffleEventListener(raffle?.address, {
    onWinnersSelected: (winners, event) => {
      console.log('🏆 WinnersSection: Winners selected event received:', winners);
      setWinnerSelectionTx(event?.transactionHash);
      setLastWinnersUpdate(Date.now());
      // Trigger immediate winners refetch - no delay needed with enhanced event handling
      console.log('🔄 Triggering immediate winners fetch due to WinnersSelected event');
      fetchWinners();

      // Additional resilience: Retry fetch after delay to handle RPC issues
      setTimeout(() => {
        console.log('🔄 WinnersSection: Additional winners fetch for RPC resilience');
        fetchWinners();
      }, 5000); // 5 second delay
    },
    onStateChange: (newState, blockNumber) => {
      console.log('🔄 WinnersSection: Raffle state changed:', newState, 'at block:', blockNumber);
      // If state changed to completed (4) or prizes claimed (7), fetch winners
      if (newState === 4 || newState === 7) {
        setLastWinnersUpdate(Date.now());
        setTimeout(() => {
          fetchWinners();
        }, 1000);

        // Additional fetch for RPC resilience
        setTimeout(() => {
          console.log('🔄 WinnersSection: Additional state change fetch for RPC resilience');
          fetchWinners();
        }, 6000);
      }
    },
    onPrizeClaimed: (winner, tokenId, event) => {
      console.log('🎁 WinnersSection: Prize claimed event received:', winner, tokenId);
      // Refresh winners to update claim status
      setTimeout(() => {
        fetchWinners();
      }, 1000);
    },
    onRpcError: (error) => {
      // WinnersSection specific RPC error handling
      if (raffle?.stateNum === 2) { // Drawing state
        console.warn('🚨 WinnersSection: RPC error detected during Drawing state:', error);
        // Trigger additional winner fetch attempt
        setTimeout(() => {
          console.log('🔄 WinnersSection: Auto-refresh winners due to RPC error');
          fetchWinners();
        }, 3000);
      }
    },
    enablePolling: true,
    pollingInterval: raffle?.stateNum === 2 ? 8000 : 12000, // Faster polling during Drawing state
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

  // Fetch collection name for NFT prizes
  useEffect(() => {
    const fetchCollectionName = async () => {
      if (!raffle || !raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        setCollectionName(null);
        return;
      }

      try {
        const contract = getContractInstance(raffle.prizeCollection, raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize');
        const name = await contract.name();
        setCollectionName(name);
      } catch (error) {
        console.warn('Failed to fetch collection name:', error);
        setCollectionName(null);
      }
    };

    fetchCollectionName();
  }, [raffle, getContractInstance]);

  // Extract fetchWinners function so it can be called by event listeners
  const fetchWinners = useCallback(async () => {
    console.log('🔍 Fetching winners for raffle state:', raffle?.stateNum, raffle?.state);

    // Enhanced logic: Try to fetch winners even if state hasn't transitioned yet
    // This handles the case where WinnersSelected event was emitted but state is still "Drawing"
    if (!raffle) {
      console.log('❌ No raffle data available, skipping winners fetch');
      setWinners([]);
      return;
    }

    // Allow fetching winners for states: Drawing (2), Completed (4), Prizes Claimed (7)
    // This is more robust than only checking for completed states
    const allowedStates = [2, 4, 7]; // Drawing, Completed, Prizes Claimed
    if (!allowedStates.includes(raffle.stateNum)) {
      console.log(`❌ Raffle state ${raffle.stateNum} not suitable for winners fetch, skipping`);
      setWinners([]);
      return;
    }

    setLoading(true);
    try {
      const raffleContract = getContractInstance && getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) {
        setWinners([]);
        setLoading(false);
        return;
      }

      const winnersCount = await raffleContract.winnersCount();
      const count = winnersCount.toNumber ? winnersCount.toNumber() : Number(winnersCount);

      console.log('🏆 Winners count from contract:', count);

      if (count === 0) {
        console.log('📭 No winners found yet - this is normal for Drawing state');
        setWinners([]);
        setLoading(false);
        return;
      }

      const winnersArray = [];
      for (let i = 0; i < count; i++) {
          try {
            const winnerAddress = await raffleContract.winners(i);
            console.log(`Winner at index ${i}:`, winnerAddress);

            if (winnerAddress === ethers.constants.AddressZero || winnerAddress === '0x0000000000000000000000000000000000000000') {
              console.log(`Skipping zero address at index ${i}`);
              continue;
            }

            const claimedWins = await raffleContract.claimedWins(winnerAddress);
            const prizeClaimed = await raffleContract.prizeClaimed(winnerAddress);

            winnersArray.push({
              address: winnerAddress,
              index: i,
              claimedWins: claimedWins.toNumber ? claimedWins.toNumber() : Number(claimedWins),
              prizeClaimed: prizeClaimed
            });
          } catch (error) {
            console.warn(`Error fetching winner at index ${i}:`, error);
            continue;
          }
      }
      console.log('Final winners array:', winnersArray);
      setWinners(winnersArray);
    } catch (error) {
      console.error('Error fetching winners:', error);
      setWinners([]);
    } finally {
      setLoading(false);
    }
  }, [raffle, getContractInstance]);

  // Initial fetch and dependency-based refetch
  useEffect(() => {
    fetchWinners();
  }, [fetchWinners, lastWinnersUpdate]);

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
    const label = RAFFLE_STATE_LABELS[raffle.stateNum] || 'Unknown';
    switch (label) {
      case 'Pending':
        return (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Raffle Pending</h3>
            <p className="text-muted-foreground">Winners will be announced after the raffle ends and drawing is complete.</p>
          </div>
        );
      case 'Active':
        return (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Raffle Active</h3>
            <p className="text-muted-foreground">Raffle is currently active. Winners will be announced after it ends.</p>
          </div>
        );
      case 'Ended':
        return (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Raffle Ended</h3>
            <p className="text-muted-foreground">Raffle has ended. Waiting for winner selection.</p>
          </div>
        );
      case 'Drawing':
        return (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Drawing in Progress</h3>
            <p className="text-muted-foreground">Winners are being selected. Please wait...</p>
          </div>
        );
      case 'Completed':
      case 'Prizes Claimed':
        return (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading winners...</p>
              </div>
            ) : winners.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    {winners.length} winner{winners.length !== 1 ? 's' : ''} selected
                  </div>
                </div>
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
            <Trash2 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Raffle Deleted</h3>
            <p className="text-muted-foreground">This raffle has been deleted and is no longer active.</p>
          </div>
        );
      case 'Activation Failed':
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Activation Failed</h3>
            <p className="text-muted-foreground">Raffle activation failed. Please contact support or try again.</p>
          </div>
        );
      case 'Unengaged':
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unengaged Raffle</h3>
            <p className="text-muted-foreground">This raffle did not receive enough engagement and was closed.</p>
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
        const raffleContract = getContractInstance(raffle.address, 'raffle');
        const ticketsPurchased = await raffleContract.ticketsPurchased(winner.address);
        const winningTickets = await raffleContract.winsPerAddress(winner.address);
        const prizeClaimed = await raffleContract.prizeClaimed(winner.address);

        const purchasedCount = ticketsPurchased.toNumber ? ticketsPurchased.toNumber() : Number(ticketsPurchased);
        const winningCount = winningTickets.toNumber ? winningTickets.toNumber() : Number(winningTickets);

        setWinnerStats(prev => ({
          ...prev,
          [winner.address]: {
            ticketsPurchased: purchasedCount,
            winningTickets: winningCount,
            losingTickets: purchasedCount - winningCount,
            prizeClaimed: !!prizeClaimed
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

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5" />
        Winners
        {winnerSelectionTx && (
          <a
            href={getExplorerLink(winnerSelectionTx)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline flex items-center gap-1 ml-2"
            title="View winner selection transaction"
          >
            <Trophy className="h-4 w-4" />
            Transaction
          </a>
        )}
        {isListening && (
          <div className={`w-2 h-2 rounded-full animate-pulse ml-2 ${
            winners.length > 0
              ? 'bg-green-500'
              : 'bg-orange-500'
          }`} title={
            winners.length > 0
              ? 'Real-time updates active - Winners displayed'
              : 'Real-time updates active - Waiting for winners'
          }></div>
        )}
      </h3>
      <div className="overflow-y-auto">
        {getStateDisplay()}
      </div>
    </div>
  );
};

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

function ERC20PrizeAmount({ token, amount }) {
  const [symbol, setSymbol] = React.useState('TOKEN');
  React.useEffect(() => {
    let isMounted = true;
    async function fetchSymbol() {
      try {
        if (!window.__erc20SymbolCache) window.__erc20SymbolCache = {};
        if (window.__erc20SymbolCache[token]) {
          setSymbol(window.__erc20SymbolCache[token]);
          return;
        }
        const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
        const erc20Abi = ["function symbol() view returns (string)"];
        const contract = new ethers.Contract(token, erc20Abi, provider);
        const sym = await contract.symbol();
        if (isMounted) {
          setSymbol(sym);
          window.__erc20SymbolCache[token] = sym;
        }
      } catch {
        if (isMounted) setSymbol('TOKEN');
      }
    }
    fetchSymbol();
    return () => { isMounted = false; };
  }, [token]);
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">Prize Amount:</span>
      <span>{ethers.utils.formatUnits(amount, 18)} {symbol}</span>
    </div>
  );
}

function getRefundability(raffle) {
  if (!raffle) return { label: 'Non-Refundable', refundable: false, reason: 'Unknown' };
  if (raffle.state === 'Deleted') {
    return { label: 'All Tickets Refundable', refundable: true, reason: 'Raffle was deleted before ending. All tickets are refundable.' };
  }
  if (raffle.isPrized && raffle.winnersCount === 1 && raffle.standard !== undefined && (raffle.standard === 0 || raffle.standard === 1)) {
    return { label: 'Tickets Refundable if Deleted', refundable: false, reason: 'Single-winner NFT raffles are not refundable unless deleted before ending.' };
  }
  return { label: 'Non-winning Tickets Refundable', refundable: true, reason: 'This raffle supports refunds for non-winning tickets.' };
}

// Enhanced getExplorerLink: accepts optional chainId, prefers raffle/app context over window.ethereum
function getExplorerLink(address, chainIdOverride) {
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
  return `${baseUrl}/address/${address}`;
}

// PrizeTypes.Standard enum mapping
const PRIZE_TYPE_OPTIONS = [
  { label: 'ERC721', value: 0 },
  { label: 'ERC1155', value: 1 },
];

const RaffleDetailPage = () => {
  const { raffleAddress } = useParams();
  const navigate = useNavigate();
  const { connected, address, provider, isInitialized, isReconnecting } = useWallet();
  const { getContractInstance, executeTransaction, isContractsReady } = useContract();
  const { isMobile } = useMobileBreakpoints();
  const { formatTicketPrice, formatPrizeAmount, getCurrencySymbol } = useNativeCurrency();
  const { refreshTrigger, triggerRefresh } = useRaffleStateManager();
  const { handleError } = useErrorHandler();

  // State declarations first
  const [raffle, setRaffle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isEscrowedPrize, setIsEscrowedPrize] = useState(false);
  const [withdrawingPrize, setWithdrawingPrize] = useState(false);
  const [raffleCollectionName, setRaffleCollectionName] = useState(null);
  const [deletingRaffle, setDeletingRaffle] = useState(false);
  const [is1155Approved, setIs1155Approved] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [approving, setApproving] = useState(false);

  // Auto-refresh state for RPC issue detection
  const [rpcIssueDetected, setRpcIssueDetected] = useState(false);
  const [lastDrawingStateTime, setLastDrawingStateTime] = useState(null);
  const [autoRefreshCount, setAutoRefreshCount] = useState(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [isERC20Approved, setIsERC20Approved] = useState(false);
  const [checkingERC20Approval, setCheckingERC20Approval] = useState(false);
  const [approvingERC20, setApprovingERC20] = useState(false);
  const [isERC721Approved, setIsERC721Approved] = useState(false);
  const [checkingERC721Approval, setCheckingERC721Approval] = useState(false);
  const [approvingERC721, setApprovingERC721] = useState(false);
  const [isRefundable, setIsRefundable] = useState(null);
  const [isExternallyPrized, setIsExternallyPrized] = useState(false);

  const [showMintInput, setShowMintInput] = useState(false);
  const [mintWinnerAddress, setMintWinnerAddress] = useState("");
  const [mintingToWinner, setMintingToWinner] = useState(false);
  const handleMintToWinner = async () => {
    setMintingToWinner(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) throw new Error('Failed to get raffle contract');
      if (!mintWinnerAddress || mintWinnerAddress.length !== 42) throw new Error('Please enter a valid address');
      const result = await executeTransaction(() => raffleContract.mintToWinner(mintWinnerAddress));
      if (result.success) {
        toast.success('mintToWinner() executed successfully!');
        window.location.reload();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.error(extractRevertReason(err));
    } finally {
      setMintingToWinner(false);
    }
  };

  const [showAssignPrizeInput, setShowAssignPrizeInput] = useState(false);
  const assignPrizeRef = useRef(null);
  const [assignPrizeAddress, setAssignPrizeAddress] = useState("");
  const [assignPrizeStandard, setAssignPrizeStandard] = useState(0);
  const [assignPrizeTokenId, setAssignPrizeTokenId] = useState("");
  const [assignPrizeAmountPerWinner, setAssignPrizeAmountPerWinner] = useState("");
  const [assigningPrize, setAssigningPrize] = useState(false);
  const handleAssignPrize = async () => {
    setAssigningPrize(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) throw new Error('Failed to get raffle contract');
      if (!assignPrizeAddress || assignPrizeAddress.length !== 42) throw new Error('Please enter a valid address');
      let tokenId = assignPrizeTokenId;
      let amountPerWinner = assignPrizeAmountPerWinner;
      if (assignPrizeStandard === 0) { // ERC721
        tokenId = 0;
        amountPerWinner = 1;
      } else {
        if (tokenId === "" || amountPerWinner === "") throw new Error('Token ID and Amount Per Winner are required');
      }
      const result = await executeTransaction(() =>
        raffleContract.setExternalPrize(
          assignPrizeAddress,
          assignPrizeStandard,
          tokenId,
          amountPerWinner
        )
      );
      if (result.success) {
        toast.success('Prize assigned successfully!');
        window.location.reload();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.error(extractRevertReason(err));
    } finally {
      setAssigningPrize(false);
    }
  };

  // Click-away logic for Assign Prize area
  useEffect(() => {
    if (!showAssignPrizeInput) return;
    function handleClickOutside(event) {
      if (assignPrizeRef.current && !assignPrizeRef.current.contains(event.target)) {
        setShowAssignPrizeInput(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAssignPrizeInput]);

  // Memoize stable values to prevent unnecessary re-renders
  const stableConnected = useMemo(() => connected, [connected]);
  const stableAddress = useMemo(() => address, [address]);
  const stableRaffleAddress = useMemo(() => raffleAddress, [raffleAddress]);

  // Event listener for raffle state changes with intelligent auto-refresh for RPC issues
  // Stop listening for winner selection events after raffle is completed
  const isMainRaffleCompleted = raffle?.stateNum === 4 || raffle?.stateNum === 7; // Completed or Prizes Claimed
  const shouldMainListenForWinners = !!raffle && !isMainRaffleCompleted;

  const { isListening: isMainListening, eventHistory: mainEventHistory } = useRaffleEventListener(raffleAddress, {
    onWinnersSelected: (winners, event) => {
      console.log('🏆 Main page: Winners selected event received:', winners);
      toast.success(`Winners have been selected! ${winners.length} winner${winners.length !== 1 ? 's' : ''} chosen.`);

      // Reset auto-refresh monitoring since event was successfully received
      setRpcIssueDetected(false);
      setAutoRefreshCount(0);
      setLastDrawingStateTime(null);

      // Trigger immediate refresh to update all components
      console.log('🔄 Main page: Triggering immediate refresh due to WinnersSelected event');
      triggerRefresh();

      // Additional resilience: Force refresh after delay to handle RPC issues
      setTimeout(() => {
        console.log('🔄 Main page: Additional refresh after WinnersSelected for RPC resilience');
        triggerRefresh();
      }, 5000); // 5 second delay
    },
    onStateChange: (newState, blockNumber) => {
      console.log('🔄 Main page: Raffle state changed to:', newState, 'at block:', blockNumber);

      // Reset auto-refresh monitoring when state changes successfully
      if (newState !== 2) { // Not Drawing state
        setRpcIssueDetected(false);
        setAutoRefreshCount(0);
        setLastDrawingStateTime(null);
      }

      // Trigger refresh when state changes
      triggerRefresh();
    },
    onPrizeClaimed: (winner, tokenId, event) => {
      console.log('🎁 Main page: Prize claimed by:', winner);
      toast.success(`Prize claimed by ${winner.slice(0, 6)}...${winner.slice(-4)}!`);
      // Trigger refresh to update claim status
      triggerRefresh();
    },
    onTicketsPurchased: (participant, quantity, event) => {
      console.log('🎫 Main page: Tickets purchased:', participant, quantity.toString());
      // Only show notification if it's not the current user (to avoid duplicate notifications)
      if (participant.toLowerCase() !== address?.toLowerCase()) {
        toast.info(`${quantity.toString()} ticket${quantity.toString() !== '1' ? 's' : ''} purchased by ${participant.slice(0, 6)}...${participant.slice(-4)}`);
      }
      // Trigger refresh to update ticket counts
      triggerRefresh();
    },
    onRpcError: (error) => {
      // Detect RPC issues during Drawing state only (not after completion)
      if (raffle?.stateNum === 2 && !rpcIssueDetected && !isMainRaffleCompleted) {
        console.warn('🚨 RPC error detected during Drawing state:', error);
        setRpcIssueDetected(true);

        // Trigger immediate auto-refresh on RPC error
        if (autoRefreshCount < 3) {
          console.log('🔄 Triggering auto-refresh due to RPC error');
          setIsAutoRefreshing(true);
          setAutoRefreshCount(prev => prev + 1);

          toast.info('Connection issue detected, auto-refreshing...', {
            duration: 3000
          });

          setTimeout(() => {
            triggerRefresh();
            setIsAutoRefreshing(false);
          }, 2000);
        }
      }
    },
    enablePolling: true,
    pollingInterval: raffle?.stateNum === 2 ? 10000 : 15000, // Faster polling during Drawing state
    autoStart: shouldMainListenForWinners, // Stop listening for winners after completion
    raffleState: raffle?.stateNum || null,
    enableStateConditionalListening: true,
    stopOnCompletion: true // New flag to stop winner selection listening after completion
  });

  // Memoized fetch function to prevent recreation on every render
  const fetchRaffleData = useCallback(async () => {
      setLoading(true);
      setError(null); // Clear previous errors
      try {
        if (!stableRaffleAddress) {
          throw new Error('No raffle address provided');
        }

        // Wait for wallet initialization and contract context to be ready
        if (!isInitialized || isReconnecting) {
          throw new Error('Wallet is initializing, please wait...');
        }

        if (!getContractInstance) {
          throw new Error('Contract context not ready');
        }

        // Get browser-specific configuration
        const platformConfig = getPlatformConfig();
        const browserInfo = getBrowserInfo();

        console.log(`🌐 Loading raffle on ${browserInfo.name} ${browserInfo.version} (Mobile: ${platformConfig.isMobile})`);

        // Create contract instance with improved error handling
        const raffleContract = getContractInstance(stableRaffleAddress, 'raffle');
        if (!raffleContract) {
          throw new Error('Failed to create contract instance - no signer/provider available');
        }

        // Test contract connectivity with safe call
        const connectivityTest = await safeContractCall(
          () => raffleContract.name(),
          'name',
          {
            timeout: platformConfig.timeout,
            retries: platformConfig.retries,
            required: true
          }
        );

        if (!connectivityTest.success) {
          throw new Error(`Contract connectivity test failed: ${connectivityTest.error}`);
        }
        // Define contract calls with fallback values for robust execution
        const contractCalls = [
          { method: () => raffleContract.name(), name: 'name', required: true, fallback: 'Unknown Raffle' },
          { method: () => raffleContract.creator(), name: 'creator', required: true, fallback: ethers.constants.AddressZero },
          { method: () => raffleContract.startTime(), name: 'startTime', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.duration(), name: 'duration', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.ticketPrice(), name: 'ticketPrice', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.ticketLimit(), name: 'ticketLimit', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.winnersCount(), name: 'winnersCount', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.maxTicketsPerParticipant(), name: 'maxTicketsPerParticipant', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.isPrized(), name: 'isPrized', required: true, fallback: false },
          { method: () => raffleContract.prizeCollection(), name: 'prizeCollection', required: true, fallback: ethers.constants.AddressZero },
          { method: () => raffleContract.prizeTokenId(), name: 'prizeTokenId', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.standard(), name: 'standard', required: true, fallback: ethers.BigNumber.from(0) },
          { method: () => raffleContract.state(), name: 'state', required: true, fallback: ethers.BigNumber.from(0) },
          { method: createSafeMethod(raffleContract, 'erc20PrizeToken', ethers.constants.AddressZero), name: 'erc20PrizeToken', required: false, fallback: ethers.constants.AddressZero },
          { method: createSafeMethod(raffleContract, 'erc20PrizeAmount', ethers.BigNumber.from(0)), name: 'erc20PrizeAmount', required: false, fallback: ethers.BigNumber.from(0) },
          { method: createSafeMethod(raffleContract, 'nativePrizeAmount', ethers.BigNumber.from(0)), name: 'nativePrizeAmount', required: false, fallback: ethers.BigNumber.from(0) },
          { method: createSafeMethod(raffleContract, 'usesCustomPrice', false), name: 'usesCustomPrice', required: false, fallback: false },
          { method: createSafeMethod(raffleContract, 'isRefundable', false), name: 'isRefundable', required: false, fallback: false },
          { method: createSafeMethod(raffleContract, 'isExternallyPrized', false), name: 'isExternallyPrized', required: false, fallback: false },
          { method: createSafeMethod(raffleContract, 'amountPerWinner', ethers.BigNumber.from(1)), name: 'amountPerWinner', required: false, fallback: ethers.BigNumber.from(1) }
        ];

        // Execute contract calls using browser-optimized batch processing
        const [
          name, creator, startTime, duration, ticketPrice, ticketLimit, winnersCount, maxTicketsPerParticipant, isPrizedContract, prizeCollection, prizeTokenId, standard, stateNum, erc20PrizeToken, erc20PrizeAmount, nativePrizeAmount, usesCustomPrice, isRefundableFlag, isExternallyPrizedFlag, amountPerWinner
        ] = await batchContractCalls(contractCalls, {
          timeout: platformConfig.timeout,
          useSequential: platformConfig.useSequential,
          batchSize: platformConfig.batchSize,
          delayBetweenCalls: platformConfig.delayBetweenCalls
        });

        let ticketsSold = 0;
        try {
          const participantsCount = await raffleContract.getParticipantsCount();
          ticketsSold = participantsCount.toNumber();
        } catch (error) {
          let index = 0;
          while (true) {
            try {
              await raffleContract.participants(index);
              ticketsSold++;
              index++;
            } catch {
              break;
            }
          }
        }

        let userTickets = 0;
        let userTicketsRemaining = maxTicketsPerParticipant.toNumber();
        
        if (connected && address) {
          try {
            const userTicketCount = await raffleContract.ticketsPurchased(address);
            userTickets = userTicketCount.toNumber();
            userTicketsRemaining = Math.max(0, maxTicketsPerParticipant.toNumber() - userTickets);
          } catch (error) {
            console.warn('Could not fetch user ticket data:', error);
            let index = 0;
            while (index < ticketsSold) {
              try {
                const participant = await raffleContract.participants(index);
                if (participant.toLowerCase() === address.toLowerCase()) {
                  userTickets++;
                }
                index++;
              } catch {
                break;
              }
            }
            userTicketsRemaining = Math.max(0, maxTicketsPerParticipant.toNumber() - userTickets);
          }
        }

        const isPrized = !!isPrizedContract;

        const raffleData = {
          address: raffleAddress,
          name,
          creator,
          startTime: startTime.toNumber(),
          duration: duration.toNumber(),
          ticketPrice,
          ticketLimit: ticketLimit.toNumber(),
          ticketsSold,
          winnersCount: winnersCount.toNumber(),
          maxTicketsPerParticipant: maxTicketsPerParticipant.toNumber(),
          isPrized,
          prizeCollection: !!isPrized ? prizeCollection : null,
          stateNum: stateNum,
          state: RAFFLE_STATE_LABELS[stateNum] || 'Unknown',
          erc20PrizeToken,
          erc20PrizeAmount,
          nativePrizeAmount,
          usesCustomPrice,
          standard,
          prizeTokenId,
          amountPerWinner: amountPerWinner ? (amountPerWinner.toNumber ? amountPerWinner.toNumber() : Number(amountPerWinner)) : 1,
        };
        
        setRaffle(raffleData);
        setIsRefundable(isRefundableFlag);
        setIsExternallyPrized(isExternallyPrizedFlag);
        // If externally prized, re-query prizeCollection
        let updatedPrizeCollection = prizeCollection;
        if (isExternallyPrizedFlag) {
          try {
            updatedPrizeCollection = await raffleContract.prizeCollection();
          } catch (e) {
            // fallback: keep previous value
          }
        }
        // Update raffle state with latest prizeCollection
        setRaffle({
          ...raffleData,
          prizeCollection: updatedPrizeCollection
        });
      } catch (error) {
        console.error('Error fetching raffle data:', error);

        // Don't immediately navigate away on mobile - show error state instead
        const errorMessage = handleError(error, {
          context: { operation: 'fetchRaffleData', isReadOnly: true },
          fallbackMessage: 'Failed to load raffle data'
        });

        // Set error state instead of navigating away immediately
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
  }, [stableRaffleAddress, getContractInstance, stableConnected, stableAddress, isInitialized, isReconnecting, refreshTrigger]);

  // Effect to trigger fetchRaffleData when dependencies change
  useEffect(() => {
    if (stableRaffleAddress && getContractInstance && isInitialized && !isReconnecting) {
      fetchRaffleData();
    }
  }, [fetchRaffleData, stableRaffleAddress, getContractInstance, isInitialized, isReconnecting, refreshTrigger]);

  // Fetch collection name for raffle detail section
  useEffect(() => {
    const fetchRaffleCollectionName = async () => {
      if (!raffle || !raffle.prizeCollection || raffle.prizeCollection === ethers.constants.AddressZero) {
        setRaffleCollectionName(null);
        return;
      }

      try {
        const contract = getContractInstance(raffle.prizeCollection, raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize');
        const name = await contract.name();
        setRaffleCollectionName(name);
      } catch (error) {
        console.warn('Failed to fetch raffle collection name:', error);
        setRaffleCollectionName(null);
      }
    };

    fetchRaffleCollectionName();
  }, [raffle, getContractInstance]);

  // Memoize format functions to prevent recreation
  const formatTime = useCallback((seconds) => {
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
  }, []);

  const formatDuration = useCallback((seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let formatted = '';
    if (days > 0) formatted += `${days}d `;
    if (hours > 0 || days > 0) formatted += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m`;
    if (!formatted) formatted = '0m';
    return formatted.trim();
  }, []);

  const updateTimer = useCallback(() => {
    if (!raffle) return;
    const now = Math.floor(Date.now() / 1000);
    let label = '';
    let seconds = 0;
    if ([2,3,4,5,6,7,8].includes(raffle.stateNum)) {
      label = 'Duration';
      seconds = raffle.duration;
      setTimeLabel(label);
      setTimeValue(formatDuration(seconds));
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
    setTimeValue(seconds > 0 ? formatTime(seconds) : 'Ended');
  }, [raffle, formatTime, formatDuration]);

  // Timer effect with memoized dependencies
  useEffect(() => {
    if (!raffle) return;
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer]);

  useEffect(() => {
    async function fetchEscrowedPrizeFlag() {
      if (raffleAddress && getContractInstance) {
        try {
          const contract = getContractInstance(raffleAddress, 'raffle');
          if (contract) {
            const flag = await contract.isEscrowedPrize();
            setIsEscrowedPrize(flag);
          }
        } catch (e) {
          setIsEscrowedPrize(false);
        }
      }
    }
    fetchEscrowedPrizeFlag();
  }, [raffleAddress, getContractInstance]);

  useEffect(() => {
    const checkApproval = async () => {
      if (
        raffle &&
        raffle.standard === 1 &&
        raffle.prizeCollection &&
        address &&
        address.toLowerCase() === raffle.creator.toLowerCase()
      ) {
        setCheckingApproval(true);
        try {
          const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
          const signer = provider.getSigner();
          const erc1155 = new ethers.Contract(
            raffle.prizeCollection,
            contractABIs.erc1155Prize,
            signer
          );
          const approved = await erc1155.isApprovedForAll(address, raffle.address);
          setIs1155Approved(approved);
        } catch (e) {
          setIs1155Approved(false);
        } finally {
          setCheckingApproval(false);
        }
      }
    };
    checkApproval();
  }, [raffle, address]);

  const handleApprove1155 = async () => {
    if (!raffle || !raffle.prizeCollection || !address) return;
    setApproving(true);
    try {
      const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
      const signer = provider.getSigner();
      const erc1155 = new ethers.Contract(
        raffle.prizeCollection,
        contractABIs.erc1155Prize,
        signer
      );
      const tx = await erc1155.setApprovalForAll(raffle.address, true);
      await tx.wait();
      setIs1155Approved(true);
      toast.success('Approval successful! You can now deposit the prize.');
    } catch (e) {
      toast.error(extractRevertReason(e));
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    const checkERC20Approval = async () => {
      if (
        raffle &&
        raffle.erc20PrizeToken &&
        raffle.erc20PrizeToken !== ethers.constants.AddressZero &&
        raffle.erc20PrizeAmount &&
        address &&
        address.toLowerCase() === raffle.creator.toLowerCase()
      ) {
        setCheckingERC20Approval(true);
        try {
          const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
          const signer = provider.getSigner();
          const erc20 = new ethers.Contract(
            raffle.erc20PrizeToken,
            contractABIs.erc20,
            signer
          );
          const allowance = await erc20.allowance(address, raffle.address);
          setIsERC20Approved(allowance.gte(raffle.erc20PrizeAmount));
        } catch (e) {
          setIsERC20Approved(false);
        } finally {
          setCheckingERC20Approval(false);
        }
      }
    };
    checkERC20Approval();
  }, [raffle, address]);

  const handleApproveERC20 = async () => {
    if (!raffle || !raffle.erc20PrizeToken || !raffle.erc20PrizeAmount || !address) return;
    setApprovingERC20(true);
    try {
      const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
      const signer = provider.getSigner();
      const erc20 = new ethers.Contract(
        raffle.erc20PrizeToken,
        contractABIs.erc20,
        signer
      );
      const tx = await erc20.approve(raffle.address, ethers.constants.MaxUint256);
      await tx.wait();
      setIsERC20Approved(true);
      toast.success('ERC20 approval successful! You can now deposit the prize.');
    } catch (e) {
      toast.error(extractRevertReason(e));
    } finally {
      setApprovingERC20(false);
    }
  };

  useEffect(() => {
    const checkERC721Approval = async () => {
      if (
        raffle &&
        raffle.standard === 0 &&
        raffle.prizeCollection &&
        typeof raffle.prizeTokenId !== 'undefined' &&
        address &&
        address.toLowerCase() === raffle.creator.toLowerCase()
      ) {
        setCheckingERC721Approval(true);
        try {
          const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
          const signer = provider.getSigner();
          const erc721 = new ethers.Contract(
            raffle.prizeCollection,
            contractABIs.erc721Prize,
            signer
          );
          const approvedAddress = await erc721.getApproved(raffle.prizeTokenId);
          if (approvedAddress && approvedAddress.toLowerCase() === raffle.address.toLowerCase()) {
            setIsERC721Approved(true);
          } else {
            const isAll = await erc721.isApprovedForAll(address, raffle.address);
            setIsERC721Approved(isAll);
          }
        } catch (e) {
          setIsERC721Approved(false);
        } finally {
          setCheckingERC721Approval(false);
        }
      }
    };
    checkERC721Approval();
  }, [raffle, address]);

  const handleApproveERC721 = async () => {
    if (!raffle || !raffle.prizeCollection || typeof raffle.prizeTokenId === 'undefined' || !address) return;
    setApprovingERC721(true);
    try {
      const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : ethers.getDefaultProvider();
      const signer = provider.getSigner();
      const erc721 = new ethers.Contract(
        raffle.prizeCollection,
        contractABIs.erc721Prize,
        signer
      );
      const tx = await erc721.approve(raffle.address, raffle.prizeTokenId);
      await tx.wait();
      setIsERC721Approved(true);
      toast.success('ERC721 approval successful! You can now deposit the prize.');
    } catch (e) {
      toast.error(extractRevertReason(e));
    } finally {
      setApprovingERC721(false);
    }
  };

  const handlePurchaseTickets = async (quantity) => {
    if (!connected || !raffle) {
      throw new Error('Wallet not connected or raffle not loaded');
    }

    const raffleContract = getContractInstance(raffle.address, 'raffle');
    if (!raffleContract) {
      throw new Error('Failed to get raffle contract');
    }

    const totalCost = ethers.BigNumber.from(raffle.ticketPrice).mul(quantity);
    
    const result = await executeTransaction(
      raffleContract.purchaseTickets,
      quantity,
      { value: totalCost }
    );

    if (result.success) {
      toast.success(`Successfully purchased ${quantity} ticket${quantity > 1 ? 's' : ''}!`);
      // Trigger state refresh instead of page reload
      triggerRefresh();
    } else {
      throw new Error(result.error);
    }
  };

  const handleDeleteRaffle = async () => {
    if (!raffle || !getContractInstance) return;
    
    console.log('Attempting to delete raffle:', {
      address: raffle.address,
      state: raffle.state,
      stateNum: raffle.stateNum,
      creator: raffle.creator,
      userAddress: address,
      isCreator: address?.toLowerCase() === raffle.creator.toLowerCase(),
      prizeCollection: raffle.prizeCollection,
      usesCustomPrice: raffle.usesCustomPrice,
      canDelete: canDelete()
    });
    
    setDeletingRaffle(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) {
        throw new Error('Contract instance not available');
      }

      const tx = await raffleContract.deleteRaffle();
      await tx.wait();
      
      toast.success('Raffle deleted successfully!');
        navigate('/');
    } catch (error) {
      console.error('Error deleting raffle:', error);
      toast.error(extractRevertReason(error));
    } finally {
      setDeletingRaffle(false);
    }
  };

  const canDelete = () => {
    return (
      connected &&
           address?.toLowerCase() === raffle?.creator.toLowerCase() && 
      (raffle?.state === 'Pending' || raffle?.state === 'Active') &&
      (isRefundable === true || raffle?.usesCustomPrice === true)
    );
  };

  const getStatusBadge = () => {
    if (!raffle) return null;
    const label = RAFFLE_STATE_LABELS[raffle.stateNum] || 'Unknown';
    const colorMap = {
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Active': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'Ended': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'Drawing': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'Completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Deleted': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'Activation Failed': 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300',
      'Prizes Claimed': 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300',
      'Unengaged': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'Unknown': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorMap[label] || colorMap['Unknown']}`}>{label}</span>;
  };

  async function handleWithdrawPrize() {
    setWithdrawingPrize(true);
    try {
      const contract = getContractInstance(raffleAddress, 'raffle');
      const tx = await contract.withdrawEscrowedPrize();
      await tx.wait();
      toast.success('Prize withdrawn successfully!');
    } catch (e) {
      toast.error(extractRevertReason(e));
    } finally {
      setWithdrawingPrize(false);
    }
  }

  useEffect(() => {
    console.log('RAFFLE:', raffle);
    console.log('isEscrowedPrize:', isEscrowedPrize);
    console.log('is1155Approved:', is1155Approved);
    console.log('checkingApproval:', checkingApproval);
  }, [raffle, isEscrowedPrize, is1155Approved, checkingApproval]);

  const now = Math.floor(Date.now() / 1000);
  const canActivate = raffle && raffle.startTime ? now >= raffle.startTime : false;

  const [timeLabel, setTimeLabel] = useState('');
  const [timeValue, setTimeValue] = useState('');

  // Winner-related state for claim/refund functionality
  const [claimingPrize, setClaimingPrize] = useState(false);
  const [claimingRefund, setClaimingRefund] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [eligibleForRefund, setEligibleForRefund] = useState(false);
  const [refundClaimed, setRefundClaimed] = useState(false);
  const [refundableAmount, setRefundableAmount] = useState(null);
  const [winnerData, setWinnerData] = useState(null);

  // Check winner status when raffle data changes
  useEffect(() => {
    const checkWinnerStatus = async () => {
      if (!raffle || !address || (raffle.stateNum !== 4 && raffle.stateNum !== 7)) {
        setIsWinner(false);
        setEligibleForRefund(false);
        setRefundableAmount(null);
        setWinnerData(null);
        return;
      }

      try {
        const raffleContract = getContractInstance && getContractInstance(raffle.address, 'raffle');
        if (!raffleContract) return;

        // Check if user is a winner
        const winnersCount = await raffleContract.winnersCount();
        const count = winnersCount.toNumber ? winnersCount.toNumber() : Number(winnersCount);

        let userIsWinner = false;
        let userWinnerData = null;

        for (let i = 0; i < count; i++) {
          try {
            const winnerAddress = await raffleContract.winners(i);
            if (winnerAddress.toLowerCase() === address.toLowerCase()) {
              const claimedWins = await raffleContract.claimedWins(winnerAddress);
              const prizeClaimed = await raffleContract.prizeClaimed(winnerAddress);
              userIsWinner = true;
              userWinnerData = {
                address: winnerAddress,
                index: i,
                claimedWins: claimedWins.toNumber ? claimedWins.toNumber() : Number(claimedWins),
                prizeClaimed: !!prizeClaimed
              };
              break;
            }
          } catch (error) {
            continue;
          }
        }

        setIsWinner(userIsWinner);
        setWinnerData(userWinnerData);

        // Check refund eligibility
        if (raffle.isPrized) {
          try {
            const refundable = await raffleContract.getRefundableAmount(address);
            setRefundableAmount(refundable);
            setEligibleForRefund(refundable && refundable.gt && refundable.gt(0));
          } catch (e) {
            setRefundableAmount(null);
            setEligibleForRefund(false);
          }
        }
      } catch (error) {
        setIsWinner(false);
        setEligibleForRefund(false);
        setRefundableAmount(null);
        setWinnerData(null);
      }
    };

    checkWinnerStatus();
  }, [raffle, getContractInstance, address]);

  // Auto-refresh logic for RPC issue detection during Drawing state
  useEffect(() => {
    if (!raffle) return;

    // Track when raffle enters Drawing state
    if (raffle.stateNum === 2) { // Drawing state
      if (!lastDrawingStateTime) {
        setLastDrawingStateTime(Date.now());
        console.log('🎯 Raffle entered Drawing state, starting auto-refresh monitoring');
      }
    } else {
      // Reset when leaving Drawing state
      if (lastDrawingStateTime) {
        setLastDrawingStateTime(null);
        setAutoRefreshCount(0);
        setRpcIssueDetected(false);
        console.log('🎯 Raffle left Drawing state, stopping auto-refresh monitoring');
      }
    }
  }, [raffle?.stateNum, lastDrawingStateTime]);

  // Auto-refresh timer for Drawing state
  useEffect(() => {
    if (!lastDrawingStateTime || raffle?.stateNum !== 2) return;

    const autoRefreshInterval = setInterval(() => {
      const timeInDrawing = Date.now() - lastDrawingStateTime;
      const maxDrawingTime = 120000; // 2 minutes
      const refreshInterval = 30000; // 30 seconds

      // If raffle has been in Drawing state for too long, trigger auto-refresh
      if (timeInDrawing > maxDrawingTime && autoRefreshCount < 5) {
        console.log(`🔄 Auto-refresh triggered: Raffle in Drawing state for ${Math.round(timeInDrawing / 1000)}s`);
        setRpcIssueDetected(true);
        setIsAutoRefreshing(true);
        setAutoRefreshCount(prev => prev + 1);

        // Show user notification
        toast.info(`Auto-refreshing raffle data... (${autoRefreshCount + 1}/5)`, {
          duration: 3000
        });

        // Trigger refresh
        triggerRefresh();

        // Reset auto-refresh flag after delay
        setTimeout(() => {
          setIsAutoRefreshing(false);
        }, 5000);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(autoRefreshInterval);
  }, [lastDrawingStateTime, raffle?.stateNum, autoRefreshCount, triggerRefresh]);

  const shouldShowClaimPrize = !!winnerData && raffle?.isPrized && (raffle?.stateNum === 4 || raffle?.stateNum === 7);
  const prizeAlreadyClaimed = winnerData && winnerData.prizeClaimed;
  const shouldShowClaimRefund =
    raffle?.isPrized &&
    (raffle?.stateNum === 4 || raffle?.stateNum === 7) &&
    eligibleForRefund &&
    refundableAmount && refundableAmount.gt && refundableAmount.gt(0);

  const handleClaimPrize = async () => {
    if (!address || !raffle || !getContractInstance) {
      toast.error('Please connect your wallet to claim your prize');
      return;
    }
    if (!isWinner || !winnerData) {
      toast.error('You are not a winner of this raffle');
      return;
    }
    if (winnerData.prizeClaimed) {
      toast.error('You have already claimed your prize');
      return;
    }
    setClaimingPrize(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) throw new Error('Failed to get raffle contract');
      const result = await executeTransaction(raffleContract.claimPrize);
      if (result.success) {
        let prizeType = 'prize';
        if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {
          prizeType = formatPrizeAmount(raffle.nativePrizeAmount);
        } else if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {
          prizeType = `${ethers.utils.formatUnits(raffle.erc20PrizeAmount, 18)} ERC20 tokens`;
        } else if (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) {
          prizeType = raffle.standard === 0 ? 'ERC721 NFT' : 'ERC1155 NFT';
        }
        toast.success(`Successfully claimed your ${prizeType}!`);
        window.location.reload();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(extractRevertReason(error));
    } finally {
      setClaimingPrize(false);
    }
  };

  const handleClaimRefund = async () => {
    if (!address || !raffle || !getContractInstance) {
      toast.error('Please connect your wallet to claim your refund');
      return;
    }
    setClaimingRefund(true);
    try {
      const raffleContract = getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) throw new Error('Failed to get raffle contract');
      const result = await executeTransaction(raffleContract.claimRefund);
      if (result.success) {
        toast.success('Successfully claimed your refund!');
        // Trigger state refresh instead of page reload
        triggerRefresh();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error(extractRevertReason(error));
    } finally {
      setClaimingRefund(false);
    }
  };

  if (loading || isReconnecting) {
    return (
      <PageContainer>
        <ContentLoading
          message={isReconnecting ? "Reconnecting wallet..." : "Loading raffle details..."}
          isMobile={isMobile}
        />
      </PageContainer>
    );
  }

  // Show error state with retry option
  if (error && !loading && !isReconnecting) {
    const isWalletError = error.toLowerCase().includes('wallet') ||
                         error.toLowerCase().includes('signer') ||
                         error.toLowerCase().includes('initializing');
    return (
      <PageContainer variant="wide" className="py-8">
        <div className="text-center py-16">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className={isMobile ? "text-lg font-semibold mb-2" : "text-2xl font-semibold mb-2"}>
            {isWalletError ? "Wallet Connection Issue" : "Failed to Load Raffle"}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            {isWalletError ?
              "Please ensure your wallet is connected and try again." :
              error
            }
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={fetchRaffleData}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-muted text-muted-foreground px-4 py-2 rounded-md hover:bg-muted/80 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!raffle) {
    return (
      <PageContainer variant="wide" className="py-8">
        <div className="text-center py-16">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className={isMobile ? "text-lg font-semibold mb-2" : "text-2xl font-semibold mb-2"}>Raffle Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The raffle you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </PageContainer>
    );
  }

  // Determine if this is a mintable ERC721 prize (vs escrowed)
  // For escrowed prizes: isExternallyPrized should be false (prize is held by raffle contract)
  // For mintable prizes: isExternallyPrized should be true (prize is minted from collection)
  const isMintableERC721 = (
    raffle &&
    raffle.prizeCollection &&
    raffle.prizeCollection !== ethers.constants.AddressZero &&
    raffle.standard === 0 &&
    raffle.isExternallyPrized === true // Only mintable if externally prized
  );

  // Log the determination for debugging
  console.log('[RaffleDetailPage] Prize type determination:', {
    prizeCollection: raffle?.prizeCollection,
    standard: raffle?.standard,
    isExternallyPrized: raffle?.isExternallyPrized,
    isMintableERC721,
    isEscrowed: raffle?.isExternallyPrized === false
  });

  return (
    <PageContainer variant="wide" className="py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Raffles
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className={isMobile ? "text-xl font-bold mb-2" : "text-3xl font-bold mb-2"}>{raffle.name}</h1>
            <p className="text-muted-foreground">
              Created by {raffle.creator.slice(0, 10)}...{raffle.creator.slice(-8)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}

            {/* Auto-refresh indicator */}
            {(isAutoRefreshing || (raffle?.stateNum === 2 && rpcIssueDetected)) && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></div>
                {isMobile ? 'Auto-refreshing...' : 'Auto-refreshing data...'}
              </div>
            )}

            {canDelete() && (
                <Button
                onClick={handleDeleteRaffle}
                className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-600 text-white px-4 py-2 rounded-md hover:from-red-600 hover:to-pink-700 transition-colors text-sm font-medium"
                title={raffle.ticketsSold > 0 ? "Delete raffle (refunds will be processed automatically)" : "Delete this raffle"}
                  disabled={deletingRaffle}
              >
                <Trash2 className="h-4 w-4" />
                  {deletingRaffle ? 'Deleting...' : 'Delete Raffle'}
                </Button>
            )}
            {connected &&
              address?.toLowerCase() === raffle.creator.toLowerCase() &&
              ((raffle.isPrized || isMintableERC721) || (!raffle.isPrized && isExternallyPrized)) &&
              raffle.prizeCollection &&
              raffle.prizeCollection !== ethers.constants.AddressZero &&
              (!raffle.erc20PrizeAmount || raffle.erc20PrizeAmount.isZero?.() || raffle.erc20PrizeAmount === '0') &&
              (!raffle.nativePrizeAmount || raffle.nativePrizeAmount.isZero?.() || raffle.nativePrizeAmount === '0') &&
              !isEscrowedPrize && (
              <div className="flex flex-col gap-2">
                {!showMintInput ? (
              <Button
                    onClick={() => setShowMintInput(true)}
                className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Mint to Winner
              </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Enter winner address"
                      value={mintWinnerAddress}
                      onChange={e => setMintWinnerAddress(e.target.value)}
                      className="px-3 py-2.5 border border-border rounded-md bg-background w-72 font-mono"
                      disabled={mintingToWinner}
                    />
                    <Button
                      onClick={handleMintToWinner}
                      disabled={mintingToWinner || !mintWinnerAddress || mintWinnerAddress.length !== 42}
                      className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-orange-600 hover:to-red-700 transition-colors disabled:opacity-50"
                    >
                      {mintingToWinner ? 'Minting...' : 'Submit'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowMintInput(false)}
                      disabled={mintingToWinner}
                      className="ml-2"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
            {connected &&
              address?.toLowerCase() === raffle.creator.toLowerCase() &&
              isEscrowedPrize &&
              raffle.standard === 1 &&
              (
                <Button
                  onClick={handleWithdrawPrize}
                  className="ml-2 bg-warning text-warning-foreground hover:bg-warning/90"
                  disabled={withdrawingPrize}
                >
                  {withdrawingPrize ? 'Withdrawing...' : 'Withdraw Prize'}
                </Button>
              )
            }
            {!raffle.isPrized &&
              raffle.stateNum === 0 &&
              connected &&
              address?.toLowerCase() === raffle.creator.toLowerCase() && (
                <div className="flex flex-col gap-2">
                  {!showAssignPrizeInput ? (
                    <Button
                      onClick={() => setShowAssignPrizeInput(true)}
                      className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      Assign Prize
                    </Button>
                  ) : (
                    <div ref={assignPrizeRef} className="flex flex-col sm:flex-row gap-2 items-center bg-background p-2 rounded-md relative z-10">
                      <input
                        type="text"
                        placeholder="Prize collection address"
                        value={assignPrizeAddress}
                        onChange={e => setAssignPrizeAddress(e.target.value)}
                        className="px-3 py-2.5 border border-border rounded-md bg-background w-56 font-mono"
                        disabled={assigningPrize}
                      />
                      <select
                        value={assignPrizeStandard}
                        onChange={e => setAssignPrizeStandard(Number(e.target.value))}
                        className="px-3 py-2.5 border border-border rounded-md bg-black text-white"
                        disabled={assigningPrize}
                      >
                        {PRIZE_TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Prize Token ID"
                        value={assignPrizeStandard === 0 ? 0 : assignPrizeTokenId}
                        onChange={e => setAssignPrizeTokenId(e.target.value)}
                        className="px-3 py-2.5 border border-border rounded-md bg-background w-32"
                        disabled={assigningPrize || assignPrizeStandard === 0}
                      />
                      <input
                        type="number"
                        placeholder="Amount Per Winner"
                        value={assignPrizeStandard === 0 ? 1 : assignPrizeAmountPerWinner}
                        onChange={e => setAssignPrizeAmountPerWinner(e.target.value)}
                        className="px-3 py-2.5 border border-border rounded-md bg-background w-32"
                        disabled={assigningPrize || assignPrizeStandard === 0}
                      />
                      <Button
                        onClick={handleAssignPrize}
                        disabled={assigningPrize || !assignPrizeAddress || assignPrizeAddress.length !== 42 || (assignPrizeStandard !== 0 && (assignPrizeTokenId === "" || assignPrizeAmountPerWinner === ""))}
                        className="bg-gradient-to-r from-green-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-blue-700 transition-colors disabled:opacity-50"
                      >
                        {assigningPrize ? 'Assigning...' : 'Submit'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAssignPrizeInput(false)}
                        disabled={assigningPrize}
                        className="ml-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
            )}
          </div>
        </div>
        
        {canDelete() && raffle.ticketsSold > 0 && (
          <div className="mt-4 p-4 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg">
            <p className="text-sm text-blue-800">
              ℹ️ As the raffle creator, you can delete this raffle. Deletion will automatically process refunds for all {raffle.ticketsSold} sold tickets.
            </p>
          </div>
        )}
      </div>

      <div className="mb-8 p-6 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 text-center items-center">
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{raffle.ticketsSold}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tickets Sold</p>
          </div>
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{raffle.ticketLimit}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Tickets</p>
          </div>
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{raffle.winnersCount}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Winners</p>
          </div>
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{timeValue}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{timeLabel}</p>
          </div>
          <div className="flex justify-center lg:justify-end items-center h-full w-full">
            {isRefundable && raffle && raffle.standard !== 2 && raffle.standard !== 3 && (() => {
              const { refundable, reason, label } = getRefundability(raffle);
              return (
                <span className={`px-3 py-1 rounded-full font-semibold ${refundable ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'} text-xs`}
                  title={reason}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {label}
                  <Info className="inline-block ml-1 h-4 w-4 text-gray-400 align-middle" title={reason} />
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Perfect 2x2 Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Row: TicketPurchaseSection and WinnersSection */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TicketPurchaseSection
            raffle={raffle}
            onPurchase={handlePurchaseTickets}
            timeRemaining={timeRemaining}
            winners={[]} // Empty array since winner logic is handled by parent component
            shouldShowClaimPrize={shouldShowClaimPrize}
            prizeAlreadyClaimed={prizeAlreadyClaimed}
            claimingPrize={claimingPrize}
            handleClaimPrize={handleClaimPrize}
            shouldShowClaimRefund={shouldShowClaimRefund}
            claimingRefund={claimingRefund}
            handleClaimRefund={handleClaimRefund}
            refundableAmount={refundableAmount}
            isMintableERC721={isMintableERC721}
            showMintInput={showMintInput}
            setShowMintInput={setShowMintInput}
            mintWinnerAddress={mintWinnerAddress}
            setMintWinnerAddress={setMintWinnerAddress}
            mintingToWinner={mintingToWinner}
            handleMintToWinner={handleMintToWinner}
            isEscrowedPrize={isEscrowedPrize}
            isExternallyPrized={isExternallyPrized}
            isPrized={raffle.isPrized}
            isMobile={isMobile}
            onStateChange={triggerRefresh}
          />

          <WinnersSection raffle={raffle} isMintableERC721={isMintableERC721} isMobile={isMobile} />
        </div>

        {/* Bottom Row: Raffle Details and PrizeImageCard */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg h-full">
            <h3 className={`font-semibold mb-4 ${isMobile ? 'text-base' : 'text-lg'}`}>Raffle Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Contract Address:</span>
                <span className="font-mono">
                  {isMobile ? `${raffle.address.slice(0, 12)}...` : `${raffle.address.slice(0, 10)}...${raffle.address.slice(-8)}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Start Time:</span>
                <span>{new Date(raffle.startTime * 1000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                <span>{formatDuration(raffle.duration)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Ticket Price:</span>
                <span>{formatTicketPrice(raffle.ticketPrice)}</span>
              </div>
                  {raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Prize Amount:</span>
                      <span>{formatPrizeAmount(raffle.nativePrizeAmount)}</span>
                    </div>
                  )}
                  {raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0) && (
                    <ERC20PrizeAmount token={raffle.erc20PrizeToken} amount={raffle.erc20PrizeAmount} />
                  )}
              {raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero && (
                <>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Prize Collection:</span>
                    <a
                      href={getExplorerLink(raffle.prizeCollection, raffle.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200"
                      title={raffle.prizeCollection}
                    >
                      {raffleCollectionName || `${raffle.prizeCollection.slice(0, 10)}...${raffle.prizeCollection.slice(-8)}`}
                    </a>
                </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      {isEscrowedPrize ? 'Prize Type:' : 'Collection Type:'}
                    </span>
                    <span className="font-semibold">
                      {(() => {
                        if (typeof isEscrowedPrize === 'boolean' && typeof raffle.standard !== 'undefined') {
                          if (!isEscrowedPrize && raffle.standard === 0) return 'Mintable ERC721';
                          if (!isEscrowedPrize && raffle.standard === 1) return 'Mintable ERC1155';
                          if (isEscrowedPrize && raffle.standard === 0) return 'Escrowed ERC721';
                          if (isEscrowedPrize && raffle.standard === 1) return 'Escrowed ERC1155';
                        }
                        return 'Unknown';
                      })()}
                    </span>
                  </div>

                  {/* Prize Token ID for escrowed ERC721 and ERC1155 prizes */}
                  {isEscrowedPrize && raffle.prizeTokenId && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Prize Token ID:</span>
                      <span className="font-mono font-semibold">
                        {raffle.prizeTokenId.toString ? raffle.prizeTokenId.toString() : raffle.prizeTokenId}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <PrizeImageCard raffle={raffle} isMintableERC721={isMintableERC721} />
        </div>
      </div>
    </PageContainer>
  );
};

export default RaffleDetailPage;

