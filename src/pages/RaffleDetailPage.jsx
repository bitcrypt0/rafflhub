import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveChainIdFromSlug } from '../utils/urlNetworks';
import { Ticket, Clock, Trophy, Users, ArrowLeft, AlertCircle, CheckCircle, DollarSign, Trash2, Info, ChevronDown } from 'lucide-react';
import { SUPPORTED_NETWORKS } from '../networks';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { PageContainer } from '../components/Layout';
import { contractABIs } from '../contracts/contractABIs';
import { toast } from '../components/ui/sonner';
import { PageLoading, ContentLoading } from '../components/ui/loading';
import { RaffleErrorDisplay } from '../components/ui/raffle-error-display';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { useRaffleStateManager, useRaffleEventListener } from '../hooks/useRaffleService';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
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

const TicketPurchaseSection = React.memo(({ raffle, onPurchase, timeRemaining, winners, shouldShowClaimPrize, prizeAlreadyClaimed, claimingPrize, handleClaimPrize, shouldShowClaimRefund, claimingRefund, handleClaimRefund, refundableAmount, isMintableERC721, showMintInput, setShowMintInput, mintWinnerAddress, setMintWinnerAddress, mintingToWinner, handleMintToWinner, isEscrowedPrize, isExternallyPrized, isPrized, isMobile, onStateChange }) => {
  const { connected, address } = useWallet();
  const { getContractInstance, executeTransaction } = useContract();
  const { formatTicketPrice, getCurrencySymbol } = useNativeCurrency();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userTickets, setUserTickets] = useState(0);
  const [winningChance, setWinningChance] = useState(null);
  const [activating, setActivating] = useState(false);

  const [endingRaffle, setEndingRaffle] = useState(false);
  const [requestingRandomness, setRequestingRandomness] = useState(false);

  useEffect(() => {
    fetchUserTickets();
  }, [raffle.address, address]);



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
    const prizeFlag = (isPrized === true) || (isExternallyPrized === true) || raffle.isPrized || raffle.isExternallyPrized;
    const refundableState = [4, 5, 7, 8].includes(raffle.stateNum); // Completed, Deleted, Prizes Claimed, Unengaged
    return (
      prizeFlag &&
      refundableState &&
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
    <div className="detail-beige-card bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col min-h-[360px] sm:min-h-[380px] lg:min-h-[420px]">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Ticket className="h-5 w-5" />
        Purchase Tickets
      </h3>

        {/* Reserve flexible space so the action area can stick to bottom even when content above grows */}

        <div className="flex-1 flex flex-col h-full gap-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
            <span className="text-muted-foreground flex items-center gap-2">Ticket Fee:
              {typeof raffle.usesCustomPrice === 'boolean' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center cursor-help" aria-label="Ticket Fee info">
                      <Info className="h-3.5 w-3.5 opacity-70" tabIndex={0} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    {raffle.usesCustomPrice === true ? 'Set by Creator' : 'Protocol Ticket Fee'}
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
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
            {canClaimRefund() && refundableAmount && refundableAmount.gt && refundableAmount.gt(0) && (
              <div>
                <span className="text-muted-foreground">Your Refundable Amount:</span>
                <p className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>
                  {ethers.utils.formatEther(refundableAmount)} {getCurrencySymbol()}
                </p>
              </div>
            )}
          <div></div>
          </div>

        {(raffle.stateNum === 4 || raffle.stateNum === 5 || raffle.stateNum === 7 || raffle.stateNum === 8) ? (
          <>
            <div className="mt-auto">
              {(canClaimPrize() || canClaimRefund()) ? (
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  {canClaimPrize() && (
                    <button
                      onClick={handleClaimPrize}
                      disabled={claimingPrize || !connected}
                      className="w-full bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50"
                    >
                      {claimingPrize
                        ? (( (isMintableERC721 || (raffle?.standard === 1 && raffle?.isExternallyPrized === true)) && !isEscrowedPrize) ? 'Minting...' : 'Claiming...')
                        : (( (isMintableERC721 || (raffle?.standard === 1 && raffle?.isExternallyPrized === true)) && !isEscrowedPrize) ? 'Mint Prize' : 'Claim Prize')}
                    </button>
                  )}
                  {canClaimRefund() && (
                    <button
                      onClick={handleClaimRefund}
                      disabled={claimingRefund || !connected}
                      className="w-full bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50"
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
                  {raffle.state === 'Deleted' || raffle.stateNum === 5 ? 'Raffle Deleted' : 'Raffle Ended'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="mt-auto">
            {/* Removed non-active desktop placeholder; rely on min-height */}
            {raffle.state?.toLowerCase() === 'pending' && canActivate ? (
              <button
                onClick={handleActivateRaffle}
                disabled={activating}
                className="w-full bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {activating ? 'Activating...' : 'Activate Raffle'}
              </button>
            ) : raffle.state?.toLowerCase() === 'pending' && !canActivate ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">
                  Raffle will be available for activation at the scheduled start time.
                </p>
              </div>
            ) : raffle.stateNum === 2 && (address?.toLowerCase() === raffle.creator.toLowerCase() || userTickets > 0) ? (
              <>
                <button
                  onClick={handleRequestRandomness}
                  disabled={requestingRandomness}
                  className="w-full bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {requestingRandomness ? 'Requesting...' : 'Request Randomness'}
                </button>
                <p className="text-muted-foreground mt-4 text-center text-sm">
                      The raffle has ended. {address?.toLowerCase() === raffle.creator.toLowerCase() ? 'As the creator' : 'As a participant'}, you can request the randomness to initiate winner selection.
                </p>
              </>
            ) : (raffle.state === 'Completed' || raffle.stateNum === 4 || raffle.stateNum === 7 || raffle.state === 'Deleted' || raffle.stateNum === 5) ? (
              <button
                disabled
                className="w-full bg-muted text-muted-foreground px-6 py-3 rounded-lg opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
              >
                {raffle.state === 'Deleted' || raffle.stateNum === 5 ? 'Raffle Deleted' : 'Raffle Ended'}
              </button>
            ) : isRaffleEnded() ? (
              <button
                onClick={handleEndRaffle}
                disabled={endingRaffle}
                    className="w-full bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {endingRaffle ? 'Ending...' : 'End Raffle'}
              </button>
            ) : maxPurchasable <= 0 ? (
              <button
                disabled
                className="w-full bg-muted text-muted-foreground px-6 py-3 rounded-lg opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
              >
                {raffle.state === 'Deleted' || raffle.stateNum === 5 ? 'Raffle Deleted' : 'Raffle Ended'}
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
                    <Input
                      type="number"
                      min={1}
                      max={raffle.maxTicketsPerParticipant}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(raffle.maxTicketsPerParticipant, parseInt(e.target.value) || 1)))}
                      className="focus:outline-none focus:ring-0 focus-visible:ring-0"
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
              ) : null}
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
          </div>
        )}


        </div>
    </div>
  );
});

const PrizeImageCard = ({ raffle, isMintableERC721, isEscrowedPrize }) => {
  const { getContractInstance } = useContract();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchSource, setFetchSource] = useState(null); // Track successful source for debugging
  const [suppressRender, setSuppressRender] = useState(false); // For mintable ERC721 with no unrevealedBaseURI
  // Image gateway fallback state
  const [imageCandidates, setImageCandidates] = useState([]);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);

  // Multiple gateways for decentralized URIs
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
  ];
  const IPNS_GATEWAYS = IPFS_GATEWAYS.map(g => g.replace('/ipfs/', '/ipns/'));
  const ARWEAVE_GATEWAYS = [
    'https://arweave.net/'
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
  // For ERC1155, also include 64-hex {id} style even when baseUri lacks {id}, and consider root candidates
  // For ERC721, try baseUri/root earlier when tokenURI likely points to unrevealed or a shared resource
  const constructMetadataURIs = (baseUri, tokenId, standard, opts = {}) => {
    const uriVariants = [];
    const hadTrailingSlash = /\/$/.test(baseUri);
    const cleanBaseUri = baseUri.replace(/\/$/, ''); // Remove trailing slash

    // Be tolerant when tokenId is undefined/null for mintable/unrevealed cases
    const tokenIdStr = (tokenId !== undefined && tokenId !== null) ? tokenId.toString() : '0';
    const tokenIdBig = (tokenId !== undefined && tokenId !== null) ? BigInt(tokenId) : 0n;
    const hexIdLower = tokenIdBig.toString(16).padStart(64, '0');
    const hexIdUpper = hexIdLower.toUpperCase();
    const isERC1155 = standard === 1;
    const isERC721 = standard === 0;

    // Helper: add root candidates (with and without slash)
    const addRootCandidates = (uri) => {
      const candidates = [];
      const root = uri.replace(/\/?(?:[0-9]+|[a-fA-F0-9]{64})(?:\.json)?$/, '');
      if (root && root !== uri) {
        candidates.push(root);
        candidates.push(`${root}/`);
        // Common root index files
        candidates.push(`${root}/index.json`);
        candidates.push(`${root}/metadata.json`);
      }
      return candidates;
    };

    // Check if the URI already contains the token ID (like tokenURI responses)
    const alreadyContainsTokenId =
      baseUri.match(/\/(?:[0-9]+|[a-fA-F0-9]{64})(?:\.json)?$/) !== null;

    if (alreadyContainsTokenId) {
      // For ERC1155, try collection root early (helps unrevealed/shared)
      if (isERC1155 || opts.prioritizeRoot) {
        uriVariants.push(...addRootCandidates(baseUri));
      }

      // Priority 1: Original URI as-is (tokenURI)
      uriVariants.push(baseUri);

      // Priority 2 (ERC721 requirement): tokenURI + ".json" next
      if (!baseUri.includes('.json')) uriVariants.push(`${baseUri}.json`);

      // For ERC721, only consider root candidates AFTER trying tokenURI and tokenURI.json
      if (isERC721) {
        uriVariants.push(...addRootCandidates(baseUri));
      }

      // ERC1155-specific: also try hex-64 variants when the tokenId appears in the URL
      if (isERC1155) {
        const replaceDecimalWithHex = (uri, alsoJson = true) => {
          const out = [];
          if (uri.match(new RegExp(`/${tokenIdStr}(?:\\.json)?$`))) {
            out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdLower}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdLower}.json`));
            // Uppercase variant (rare)
            out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdUpper}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdUpper}.json`));
          }
          if (uri.match(new RegExp(`${tokenIdStr}(?:\\.json)?$`))) {
            out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdLower}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdLower}.json`));
            out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdUpper}`));
            if (alsoJson) out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdUpper}.json`));
          }
          return out;
        };
        uriVariants.push(...replaceDecimalWithHex(baseUri, true));
      }
    } else {
      if (isERC1155) {
        // Try base URI root early
        uriVariants.push(baseUri);
        if (hadTrailingSlash) uriVariants.push(cleanBaseUri + '/');
        // Add common root JSON filenames and baseUri.json (mirroring ERC721 robustness)
        uriVariants.push(`${cleanBaseUri}.json`);
        uriVariants.push(`${cleanBaseUri}/index.json`);
        uriVariants.push(`${cleanBaseUri}/metadata.json`);

        // Priority 1 (ERC1155): hex without extension first
        uriVariants.push(`${cleanBaseUri}/${hexIdLower}`);
        uriVariants.push(`${cleanBaseUri}${hexIdLower}`);
        // Priority 2 (ERC1155): hex.json
        uriVariants.push(`${cleanBaseUri}/${hexIdLower}.json`);
        uriVariants.push(`${cleanBaseUri}${hexIdLower}.json`);
        // Also try uppercase hex (rare)
        uriVariants.push(`${cleanBaseUri}/${hexIdUpper}`);
        uriVariants.push(`${cleanBaseUri}${hexIdUpper}`);
        uriVariants.push(`${cleanBaseUri}/${hexIdUpper}.json`);
        uriVariants.push(`${cleanBaseUri}${hexIdUpper}.json`);
        // Priority 3 (ERC1155): decimal without extension
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}`);
        // Priority 4 (ERC1155): decimal.json
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}.json`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}.json`);
      } else {
        // ERC721: try baseUri earlier (unrevealed/shared)
        uriVariants.push(baseUri);
        if (hadTrailingSlash) uriVariants.push(cleanBaseUri + '/');
        // Also try common root JSON filenames and baseUri.json
        uriVariants.push(`${cleanBaseUri}.json`);
        uriVariants.push(`${cleanBaseUri}/index.json`);
        uriVariants.push(`${cleanBaseUri}/metadata.json`);
        // Keep previous priority (extensionless decimal first)
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}`);
        uriVariants.push(`${cleanBaseUri}/${tokenIdStr}.json`);
        uriVariants.push(`${cleanBaseUri}${tokenIdStr}.json`);
      }

      // Template formats
      if (baseUri.includes('{id}')) {
        // Prefer hex first for ERC1155
        uriVariants.push(baseUri.replace('{id}', hexIdLower));
        uriVariants.push(baseUri.replace('{id}', tokenIdStr));
        // Upper hex variant (rare)
        uriVariants.push(baseUri.replace('{id}', hexIdUpper));
      }
    }

    return [...new Set(uriVariants)]; // Remove duplicates
  };

  // Convert decentralized URIs (ipfs/ipns/ar) and normalize common HTTP gateways to multiple gateway variants
  const convertDecentralizedToHTTP = (uri) => {
    if (!uri) return [];

    // IPFS (ipfs://)
    if (uri.startsWith('ipfs://')) {
      let hash = uri.replace('ipfs://', '');
      if (hash.startsWith('ipfs/')) hash = hash.slice('ipfs/'.length); // normalize ipfs://ipfs/
      return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
    }

    // IPNS (ipns://)
    if (uri.startsWith('ipns://')) {
      let name = uri.replace('ipns://', '');
      if (name.startsWith('ipns/')) name = name.slice('ipns/'.length);
      return IPNS_GATEWAYS.map(gateway => `${gateway}${name}`);
    }

    // Arweave (ar://)
    if (uri.startsWith('ar://')) {
      const id = uri.replace('ar://', '');
      return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
    }

    // If HTTP(s) to a known IPFS/IPNS/Arweave gateway, normalize and fan out
    try {
      const u = new URL(uri);
      // Fix accidental double ipfs segment in HTTP URLs (e.g., /ipfs/ipfs/<hash>)
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

      // Arweave gateway (e.g., arweave.net/<id>)
      if (u.hostname.endsWith('arweave.net') || u.hostname === 'arweave.net') {
        const id = parts.join('/');
        return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
      }
    } catch (_) {
      // not a URL, fall through
    }

    // Fallback: return as-is
    return [uri];
  };

  // Extract image URL from metadata with flexible field support
  const extractImageURL = (metadata) => {
    const mediaFields = [
      'image',
      'image_url',
      'imageUrl',
      'animation_url',
      'animationUrl',
      'media',
      'artwork'
    ];

    const normalizeIpfs = (u) => {
      if (!u) return null;
      if (u.startsWith('ipfs://')) {
        // Strip protocol and any leading 'ipfs/' segment
        let rest = u.slice('ipfs://'.length);
        if (rest.startsWith('ipfs/')) rest = rest.slice('ipfs/'.length);
        // Build multiple-gateway HTTP URLs as candidates
        const candidates = IPFS_GATEWAYS.map(gateway => `${gateway}${rest}`);
        return candidates; // Return array to support gateway fallback
      }
      if (u.startsWith('ipns://')) {
        let rest = u.slice('ipns://'.length);
        if (rest.startsWith('ipns/')) rest = rest.slice('ipns/'.length);
        const candidates = IPNS_GATEWAYS.map(gateway => `${gateway}${rest}`);
        return candidates;
      }
      if (u.startsWith('ar://')) {
        const rest = u.slice('ar://'.length);
        const candidates = ARWEAVE_GATEWAYS.map(gateway => `${gateway}${rest}`);
        return candidates;
      }
      return [u]; // Normalize to array
    };

    for (const field of mediaFields) {
      if (metadata[field]) {
        const raw = metadata[field];
        const urls = normalizeIpfs(String(raw)); // returns array
        return urls;
      }
    }

    return null;
  };

  // Handle media (image/video) fallback across multiple gateways
  const handleMediaError = () => {
    if (Array.isArray(imageCandidates) && imageCandidateIndex + 1 < imageCandidates.length) {
      setImageCandidateIndex(imageCandidateIndex + 1);
      setImageUrl(imageCandidates[imageCandidateIndex + 1]);
    } else {
      setImageUrl(null);
    }
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
  const fetchMetadataWithFallback = async (uriVariants, timeoutMs = 10000) => {
    for (const uri of uriVariants) {
      try {
        // Support data: URIs (on-chain metadata or direct images)
        if (uri.startsWith('data:')) {
          // Example: data:application/json;base64,eyJpbWFnZSI6ICJpcGZzOi8vLi4uIn0=
          const [meta, payload] = uri.split(',', 2);
          const [, mime, encoding] = meta.match(/^data:([^;]+);([^,]+)$/) || [];
          if (mime?.includes('application/json') && encoding === 'base64') {
            const json = JSON.parse(atob(payload));
            const imageUrl = extractImageURL(json) || null;
            if (imageUrl) return { metadata: json, imageUrl, sourceUri: uri };
          } else if (mime?.startsWith('image/') || mime?.startsWith('video/')) {
            // Direct media data URL (image/video)
            return { metadata: { image: uri }, imageUrl: uri, sourceUri: uri };
          }
          // If unsupported data URI, continue to next
          continue;
        }

        const response = await fetchWithTimeout(uri, timeoutMs);

        if (response.ok) {
          const contentType = response.headers.get('content-type');

          // Try to parse as JSON
          try {
            const text = await response.text();
            // Some gateways send text/plain; try JSON.parse regardless
            const metadata = JSON.parse(text);
            if (metadata && typeof metadata === 'object') {
              const imageUrl = extractImageURL(metadata);
              if (imageUrl) {
                return { metadata, imageUrl, sourceUri: uri };
              }
            }
          } catch (jsonError) {
            // If JSON parsing fails, check if response is an image or URL points to image
            if (
              contentType?.startsWith('image/') ||
              contentType?.startsWith('video/') ||
              uri.match(/\.(jpg|jpeg|png|gif|svg|webp|mp4|webm|ogg)$/i)
            ) {
              return { metadata: { image: uri }, imageUrl: uri, sourceUri: uri };
            }
          }
        }
      } catch (error) {
        continue; // Try next variant
      }
    }

    throw new Error('All metadata fetch attempts failed');
  };

  // Main fetch function with enhanced logic
  useEffect(() => {
    async function fetchPrizeImageEnhanced() {


      // Check if we should attempt to fetch (same logic as render condition)
      const shouldFetch = raffle.isPrized ||
        (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) ||
        (raffle.standard !== undefined && raffle.prizeTokenId !== undefined);

      if (!shouldFetch) {

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

        // Determine mintable vs escrowed using isEscrowedPrize flag only
        // Mintable when not escrowed; Escrowed when isEscrowedPrize is true
        const isMintable = isEscrowedPrize ? false : true;



        if (!contract) {

          setImageUrl(null);
          setLoading(false);
          return;
        }

        if (raffle.standard === 0) {
          // ERC721 Prize Logic
          if (isMintable) {
            try {
              baseUri = await contract.unrevealedBaseURI();
              // If empty/unavailable, suppress rendering per requirement
              if (!baseUri || baseUri.trim() === '') {
                setSuppressRender(true);
                setImageUrl(null);
                setLoading(false);
                return;
              }
            } catch (error) {
              // unrevealedBaseURI unavailable: suppress render
              setSuppressRender(true);
              setImageUrl(null);
              setLoading(false);
              return;
            }
          } else {
            try {
              baseUri = await contract.tokenURI(raffle.prizeTokenId);
            } catch (error) {
              setImageUrl(null);
              setLoading(false);
              return;
            }
          }
        } else if (raffle.standard === 1) {
          // ERC1155 Prize Logic
          if (isMintable) {
            let unrevealedUri = null;
            let tokenUri = null;
            let revealed = null;

            try {
              unrevealedUri = await contract.unrevealedURI();
            } catch (error) {
              // ignore
            }

            try {
              tokenUri = await contract.tokenURI(raffle.prizeTokenId);
            } catch (error) {
              // ignore
            }

            // Check reveal state to decide which URI to prefer
            try {
              revealed = await contract.isRevealed();
            } catch (error) {
              revealed = null; // Unknown; fall back to previous preference order
            }

            if (revealed === false) {
              // Pre-reveal: prefer unrevealedURI
              if (unrevealedUri && unrevealedUri.trim() !== '') {
                baseUri = unrevealedUri;
              } else if (tokenUri && tokenUri.trim() !== '') {
                baseUri = tokenUri;
              } else {
                // Fallback to uri() method
                try {
                  const tokenIdForCall = raffle?.prizeTokenId;
                  baseUri = await contract.uri(tokenIdForCall);
                } catch (fallbackError) {
                  setImageUrl(null);
                  setLoading(false);
                  return;
                }
              }
            } else if (revealed === true) {
              // Post-reveal: prefer tokenURI
              if (tokenUri && tokenUri.trim() !== '') {
                baseUri = tokenUri;
              } else {
                // Fallback to uri() method; if that fails, try unrevealedURI as last resort
                try {
                  baseUri = await contract.uri(raffle.prizeTokenId);
                } catch (fallbackError) {
                  if (unrevealedUri && unrevealedUri.trim() !== '') {
                    baseUri = unrevealedUri;
                  } else {
                    setImageUrl(null);
                    setLoading(false);
                    return;
                  }
                }
              }
            } else {
              // Unknown reveal state: keep prior behavior (prefer tokenURI)
              if (tokenUri && tokenUri.trim() !== '') {
                baseUri = tokenUri;
              } else if (unrevealedUri && unrevealedUri.trim() !== '') {
                baseUri = unrevealedUri;
              } else {
                try {
                  baseUri = await contract.uri(raffle.prizeTokenId);
                } catch (fallbackError) {
                  setImageUrl(null);
                  setLoading(false);
                  return;
                }
              }
            }
          } else {
            try {
              baseUri = await contract.uri(raffle.prizeTokenId);
            } catch (error) {
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

          setImageUrl(null);
          setLoading(false);
          return;
        }

        // Step 2: Generate URI variants (pass standard for ERC1155 hex logic)
        const uriVariants = constructMetadataURIs(baseUri, raffle.prizeTokenId, raffle.standard);

        // Step 3: Convert decentralized URIs (IPFS/IPNS/Arweave) and HTTP gateways to multiple gateways
        const allURIs = [];
        for (const variant of uriVariants) {
          allURIs.push(...convertDecentralizedToHTTP(variant));
        }

        // Step 4: Attempt fetch with cascading fallback
        // Optimization: use a shorter timeout for mintable ERC721 unrevealed URIs to reduce perceived latency
        const timeoutMs = (raffle.standard === 0 && isMintable) ? 5000 : 10000;
        const result = await fetchMetadataWithFallback(allURIs, timeoutMs);

        // Build media candidates for gateway fallback
        const imgCandidates = Array.isArray(result.imageUrl) ? result.imageUrl : [result.imageUrl];
        setImageCandidates(imgCandidates);
        setImageCandidateIndex(0);
        setImageUrl(imgCandidates[0]);
        setFetchSource(result.sourceUri);
        // Early exit if we resolved a root metadata; no further attempts needed

      } catch (error) {
        setImageUrl(null);
        setFetchSource(null);
      }

      setLoading(false);
    }

    // Trigger fetch only when all prize conditions are met (no dependency on isExternallyPrized)
    const eligiblePrize = (
      raffle?.isPrized === true &&
      raffle?.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero &&
      (raffle?.standard === 0 || raffle?.standard === 1)
    );

    if (eligiblePrize) fetchPrizeImageEnhanced();
  }, [raffle, getContractInstance, isEscrowedPrize]);

  // Render only when prize conditions are met (no dependency on isExternallyPrized)
  const shouldRender = (
    raffle?.isPrized === true &&
    raffle?.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero &&
    (raffle?.standard === 0 || raffle?.standard === 1)
  );

  if (!shouldRender) {
    return null;
  }

  // Show loading state
  if (loading) {
    return (
      <Card className="detail-beige-card h-full flex flex-col items-center justify-center text-foreground border border-border rounded-xl">
        <CardContent className="flex flex-col items-center justify-center">
          <div className="w-64 h-64 flex items-center justify-center border rounded-lg bg-muted/30">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading prize media...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no image URL after loading
  if (!imageUrl) {

    return null;
  }

  const isVideo = typeof imageUrl === 'string' && /\.(mp4|webm|ogg)$/i.test(imageUrl);

  return (
    <Card className="detail-beige-card h-full flex flex-col items-center justify-center text-foreground border border-border rounded-xl">
      <CardContent className="flex flex-col items-center justify-center">
        {isVideo ? (
          <video
            src={imageUrl}
            className="w-64 h-64 object-contain rounded-lg border"
            style={{ background: '#000' }}
            controls
            playsInline
            onError={handleMediaError}
          />
        ) : (
          <img
            src={imageUrl}
            alt="Prize Art"
            className="w-64 h-64 object-contain rounded-lg border"
            style={{ background: '#fff' }}
            onError={handleMediaError}
          />
        )}
      </CardContent>
    </Card>
  );
};

// Enhanced Winner Card Component with improved styling
const WinnerCard = ({ winner, index, raffle, connectedAddress, onToggleExpand, isExpanded, stats, onLoadStats, collectionName, isEscrowedPrize }) => {
  const isCurrentUser = connectedAddress && winner.address.toLowerCase() === connectedAddress.toLowerCase();
  const { formatPrizeAmount } = useNativeCurrency();
  const [erc20Symbol, setErc20Symbol] = React.useState('TOKEN');
  const [actualAmountPerWinner, setActualAmountPerWinner] = React.useState(null);
  const [collectionSymbol, setCollectionSymbol] = React.useState(null);
  const { getContractInstance } = useContract();

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
        const raffleContract = getContractInstance(raffle.address, 'raffle');
        if (!raffleContract) {
          console.warn('Failed to get raffle contract instance');
          if (isMounted) setActualAmountPerWinner(raffle.amountPerWinner || 1);
          return;
        }

        // Try to call amountPerWinner() function from contract
        const contractAmountPerWinner = await raffleContract.amountPerWinner();
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

    // Native Prize - Calculate from total amount divided by winners
    if (raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0)) {

      console.log(`🔍 Native Prize Debug:`, {
        totalPrizeAmount: raffle.nativePrizeAmount.toString(),
        winnersCount: raffle.winnersCount,
        amountPerWinnerFromContract: amountPerWinner,
        amountPerWinnerType: typeof amountPerWinner
      });

      // For native currency, always calculate from total amount divided by winners
      // This ensures accuracy regardless of what amountPerWinner() returns
      const winnersCount = raffle.winnersCount || 1;
      const prizePerWinner = raffle.nativePrizeAmount.div(winnersCount);

      console.log(`💰 Native calculation: ${raffle.nativePrizeAmount.toString()} / ${winnersCount} = ${prizePerWinner.toString()}`);

      const result = formatPrizeAmount(prizePerWinner);
      console.log(`💰 Native prize display: ${result} (prizePerWinner: ${prizePerWinner.toString()})`);
      return result;
    }

    // ERC20 Prize - Use amountPerWinner from contract
    if (raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero &&
        raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0)) {

      console.log(`🔍 ERC20 Prize Debug:`, {
        totalPrizeAmount: raffle.erc20PrizeAmount.toString(),
        winnersCount: raffle.winnersCount,
        amountPerWinnerFromContract: amountPerWinner,
        amountPerWinnerType: typeof amountPerWinner
      });

      // For ERC20 tokens, always calculate from total amount divided by winners
      // This ensures accuracy regardless of what amountPerWinner() returns
      const winnersCount = raffle.winnersCount || 1;
      const prizePerWinner = raffle.erc20PrizeAmount.div(winnersCount);

      console.log(`💰 ERC20 calculation: ${raffle.erc20PrizeAmount.toString()} / ${winnersCount} = ${prizePerWinner.toString()}`);

      const formattedAmount = ethers.utils.formatUnits(prizePerWinner, 18);
      const result = `${formattedAmount} ${erc20Symbol}`;
      console.log(`💰 ERC20 prize display: ${result} (prizePerWinner: ${prizePerWinner.toString()}, formatted: ${formattedAmount})`);
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

          console.log(`🔍 Escrowed ERC721 token ID debug:`, {
            rawTokenId: raffle.prizeTokenId,
            stringTokenId: tokenId,
            prizeId: prizeId,
            isEscrowedPrize: isEscrowedPrize
          });

          let result;
          if (collectionSymbol) {
            result = `${collectionSymbol} ${prizeId}`; // Use symbol if available (e.g., "BAYC #23")
          } else if (collectionName) {
            result = `${collectionName} ${prizeId}`; // Fall back to name if no symbol
          } else {
            result = `ERC721 NFT ${prizeId}`; // Final fallback
          }

          console.log(`🏆 Escrowed ERC721 prize display: ${result} (symbol: ${collectionSymbol}, name: ${collectionName}, tokenId: ${raffle.prizeTokenId})`);
          return result;
        } else {
          // For mintable ERC721 prizes: show amount + symbol (e.g., "1 BAYC")
          const displayName = collectionSymbol || collectionName || 'ERC721 NFT';
          const result = `${amountPerWinner} ${displayName}`;

          console.log(`🎨 Mintable ERC721 prize display: ${result} (symbol: ${collectionSymbol}, name: ${collectionName}, amount: ${amountPerWinner})`);
          return result;
        }
      }
      if (raffle.standard === 1) {
        // ERC1155: Use amountPerWinner from contract (variable amount per winner)
        const name = collectionName || 'ERC1155 Token';
        return `${amountPerWinner} ${name}`;
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
          <button
            onClick={() => onToggleExpand(winner, index)}
            className="winner-card-expand flex-shrink-0 p-1 sm:p-1.5 rounded-md hover:bg-transparent active:bg-transparent focus:bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-0"
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

const WinnersSection = React.memo(({ raffle, isMintableERC721, isEscrowedPrize, isMobile, onWinnerCountChange }) => {
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

  // Event listener for real-time winner updates
  // Stop listening for winner selection events after raffle is completed
  const isRaffleCompleted = raffle?.stateNum === 4 || raffle?.stateNum === 7; // Completed or Prizes Claimed
  const shouldListenForWinners = !!raffle && !isRaffleCompleted;

  const { isListening, eventHistory } = useRaffleEventListener(raffle?.address, {
    onWinnersSelected: (winners, event) => {
      setWinnerSelectionTx(event?.transactionHash);
      setLastWinnersUpdate(Date.now());
      // Trigger immediate winners refetch - no delay needed with enhanced event handling
      fetchWinners();

      // Additional resilience: Retry fetch after delay to handle RPC issues
      setTimeout(() => {
        fetchWinners();
      }, 5000); // 5 second delay
    },
    onStateChange: (newState, blockNumber) => {

      // If state changed to completed (4) or prizes claimed (7), fetch winners
      if (newState === 4 || newState === 7) {
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

        setCollectionName(null);
      }
    };

    fetchCollectionName();
  }, [raffle, getContractInstance]);

  // Extract fetchWinners function so it can be called by event listeners
  const fetchWinners = useCallback(async () => {
    // Enhanced logic: Try to fetch winners even if state hasn't transitioned yet
    // This handles the case where WinnersSelected event was emitted but state is still "Drawing"
    if (!raffle) {
      setWinners([]);
      onWinnerCountChange?.(0);
      return;
    }

    // Allow fetching winners for states: Drawing (2), Completed (4), Prizes Claimed (7)
    // This is more robust than only checking for completed states
    const allowedStates = [2, 4, 7]; // Drawing, Completed, Prizes Claimed
    if (!allowedStates.includes(raffle.stateNum)) {
      setWinners([]);
      onWinnerCountChange?.(0);
      return;
    }

    setLoading(true);
    try {
      const raffleContract = getContractInstance && getContractInstance(raffle.address, 'raffle');
      if (!raffleContract) {
        setWinners([]);
        onWinnerCountChange?.(0);
        setLoading(false);
        return;
      }

      const winnersCount = await raffleContract.winnersCount();
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
            const winnerAddress = await raffleContract.winners(i);

            if (winnerAddress === ethers.constants.AddressZero || winnerAddress === '0x0000000000000000000000000000000000000000') {
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
        // Quietly show any available winners without a loading spinner
        return (
          winners.length > 0 ? (
            <div className="space-y-4">
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
                      isEscrowedPrize={isEscrowedPrize}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Raffle Ended</h3>
              <p className="text-muted-foreground">Raffle has ended. Waiting for winner selection.</p>
            </div>
          )
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
                        isEscrowedPrize={isEscrowedPrize}
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
    <div className="detail-beige-card bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
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
        {isListening && raffle?.state?.toLowerCase() !== 'pending' && (
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
});

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
      <span className="text-foreground/80 dark:text-foreground">Prize Amount:</span>
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
  const params = useParams();
  const chainSlug = params.chainSlug;

  const navigate = useNavigate();
  const { connected, address, provider, isInitialized, isReconnecting } = useWallet();
  const { getContractInstance, executeTransaction, isContractsReady, contracts } = useContract();
  const { isMobile } = useMobileBreakpoints();
  const { formatTicketPrice, formatPrizeAmount, getCurrencySymbol } = useNativeCurrency();
  const makeSharePath = useCallback(() => {
    const currentChainId = provider?.network?.chainId;
    const nameSlug = currentChainId && SUPPORTED_NETWORKS[currentChainId]
      ? SUPPORTED_NETWORKS[currentChainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : (currentChainId || '');
    return `${nameSlug ? `/${nameSlug}` : ''}/raffle/${raffleAddress}`;
  }, [provider, raffleAddress]);

  const { refreshTrigger, triggerRefresh } = useRaffleStateManager();
  const { handleError } = useErrorHandler();

  // State declarations first
  const [raffle, setRaffle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isEscrowedPrize, setIsEscrowedPrize] = useState(false);
  const [withdrawingPrize, setWithdrawingPrize] = useState(false);
  const [updatingVrfStatus, setUpdatingVrfStatus] = useState(false);
  const [raffleCollectionName, setRaffleCollectionName] = useState(null);
  const [deletingRaffle, setDeletingRaffle] = useState(false);
  const [is1155Approved, setIs1155Approved] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [approving, setApproving] = useState(false);

  // Auto-refresh state for Drawing state monitoring
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
  // If URL includes a chain slug, gently ensure wallet is on the right network
  useEffect(() => {
    async function ensureNetworkFromUrl() {
      if (!chainSlug) return; // no slug provided, skip
      const targetChainId = resolveChainIdFromSlug(chainSlug);
      if (!targetChainId) return;
      // If wallet not connected yet, do nothing; switching will be prompted later when needed
      if (!connected || !window.ethereum) return;
      try {
        if (provider?.network?.chainId !== targetChainId) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${targetChainId.toString(16)}` }],
            });
          } catch (switchErr) {
            // If not added, try to add
            if (switchErr?.code === 4902 && SUPPORTED_NETWORKS[targetChainId]) {
              const net = SUPPORTED_NETWORKS[targetChainId];
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: `0x${targetChainId.toString(16)}`,
                  chainName: net.name,
                  rpcUrls: [net.rpcUrl],
                  blockExplorerUrls: [net.explorer],
                  nativeCurrency: net.nativeCurrency || { name: 'ETH', symbol: 'ETH', decimals: 18 },
                }],
              });
              // Try switching again
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${targetChainId.toString(16)}` }],
              });
            }
          }
        }
      } catch (e) {
        console.warn('Network switch via URL failed (non-fatal):', e);
      }
    }
    ensureNetworkFromUrl();
  }, [chainSlug, connected, provider]);


  const [showMintInput, setShowMintInput] = useState(false);
  const [mintWinnerAddress, setMintWinnerAddress] = useState("");
  const [mintingToWinner, setMintingToWinner] = useState(false);
  const mintWinnerRef = useRef(null);

  // Click-away logic for Mint to Winner UI
  useEffect(() => {
    if (!showMintInput) return;
    function handleClickOutside(event) {
      if (mintWinnerRef.current && !mintWinnerRef.current.contains(event.target)) {
        setShowMintInput(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMintInput]);
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
  const [assignSelectOpen, setAssignSelectOpen] = useState(false);

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

  // Click-away logic for Assign Prize area (single effect)
  useEffect(() => {
    if (!showAssignPrizeInput) return;
    function handleClickOutside(event) {
      // If select menu is open, do not treat outside click as a dismiss action
      if (assignSelectOpen) return;
      if (assignPrizeRef.current && !assignPrizeRef.current.contains(event.target)) {
        setShowAssignPrizeInput(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAssignPrizeInput, assignSelectOpen]);

  // Memoize stable values to prevent unnecessary re-renders
  const stableConnected = useMemo(() => connected, [connected]);
  const stableAddress = useMemo(() => address, [address]);
  const stableRaffleAddress = useMemo(() => raffleAddress, [raffleAddress]);

  const actualDurationDebounceRef = useRef(null);
  const fetchActualDurationImmediate = useCallback(async () => {
    try {
      const contract = getContractInstance(stableRaffleAddress || raffleAddress, 'raffle');
      if (!contract) return;
      const val = await contract.getActualRaffleDuration();
      const num = val?.toNumber ? val.toNumber() : Number(val);
      if (num && num > 0) {
        setRaffle(prev => (prev ? { ...prev, actualDuration: num } : prev));
      }
    } catch (_) {}
  }, [getContractInstance, stableRaffleAddress, raffleAddress]);

  // Event listener for raffle state changes
  // Stop listening for winner selection events after raffle is completed
  const isMainRaffleCompleted = raffle?.stateNum === 4 || raffle?.stateNum === 7; // Completed or Prizes Claimed
  const shouldMainListenForWinners = !!raffle && !isMainRaffleCompleted;

  const { isListening: isMainListening, eventHistory: mainEventHistory } = useRaffleEventListener(raffleAddress, {
    onWinnersSelected: (winners, event) => {
      toast.success(`Winners have been selected! ${winners.length} winner${winners.length !== 1 ? 's' : ''} chosen.`);

      // Reset auto-refresh monitoring since event was successfully received
      setAutoRefreshCount(0);
      setLastDrawingStateTime(null);

      // Trigger immediate refresh to update all components
      triggerRefresh();

      // Additional resilience: Force refresh after delay to handle RPC issues
      setTimeout(() => {
        triggerRefresh();
      }, 5000); // 5 second delay
    },
    onStateChange: (newState, blockNumber) => {
      // Reset auto-refresh monitoring when state changes successfully
      if (newState !== 3) { // Not Drawing state
        setAutoRefreshCount(0);
        setLastDrawingStateTime(null);
      }

      // If transitioning into an ended/terminal state, debounce a direct fetch of actualDuration
      if ([2,3,4,5,6,7,8].includes(newState)) {
        if (actualDurationDebounceRef.current) clearTimeout(actualDurationDebounceRef.current);
        actualDurationDebounceRef.current = setTimeout(() => {
          fetchActualDurationImmediate();
        }, 600); // small debounce
      }

      // Trigger refresh when state changes (to update other fields)
      triggerRefresh();
    },
    onPrizeClaimed: (winner, tokenId, event) => {

      toast.success(`Prize claimed by ${winner.slice(0, 6)}...${winner.slice(-4)}!`);
      // Trigger refresh to update claim status
      triggerRefresh();
    },
    onTicketsPurchased: (participant, quantity, event) => {

      // Only show notification if it's not the current user (to avoid duplicate notifications)
      if (participant.toLowerCase() !== address?.toLowerCase()) {
        toast.info(`${quantity.toString()} ticket${quantity.toString() !== '1' ? 's' : ''} purchased by ${participant.slice(0, 6)}...${participant.slice(-4)}`);
      }
      // Trigger refresh to update ticket counts
      triggerRefresh();
    },
    onRpcError: (error) => {
      // Log RPC errors for debugging but don't trigger auto-refresh
      console.warn('RPC error detected:', error);
    },
    enablePolling: true,
    pollingInterval: raffle?.stateNum === 3 ? 10000 : 15000, // Faster polling during Drawing state
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
          { method: createSafeMethod(raffleContract, 'amountPerWinner', ethers.BigNumber.from(1)), name: 'amountPerWinner', required: false, fallback: ethers.BigNumber.from(1) },
          // Conditionally fetch actual duration only when state is in ended/terminal states
          { method: async () => {
              try {
                const st = await raffleContract.state();
                // States: 0 Pending, 1 Active, 2 Ended, 3 Drawing, 4 Completed, 5 Deleted, 6 Activation Failed, 7 Prizes Claimed, 8 Unengaged
                if (typeof st === 'number' ? st >= 2 : (st.toNumber ? st.toNumber() >= 2 : Number(st) >= 2)) {
                  return await raffleContract.getActualRaffleDuration();
                }
              } catch (_) {}
              return ethers.BigNumber.from(0);
            }, name: 'actualDuration', required: false, fallback: ethers.BigNumber.from(0) },
          { method: createSafeMethod(raffleContract, 'getUniqueParticipantsCount', ethers.BigNumber.from(0)), name: 'uniqueParticipants', required: false, fallback: ethers.BigNumber.from(0) }
        ];

        // Execute contract calls using browser-optimized batch processing
        const [
          name, creator, startTime, duration, ticketPrice, ticketLimit, winnersCount, maxTicketsPerParticipant, isPrizedContract, prizeCollection, prizeTokenId, standard, stateNum, erc20PrizeToken, erc20PrizeAmount, nativePrizeAmount, usesCustomPrice, isRefundableFlag, isExternallyPrizedFlag, amountPerWinner, actualDurationValue, uniqueParticipantsValue
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

        const endedStates = [2,3,4,5,6,7,8];
        const actualDurationNumber = (endedStates.includes(stateNum) && actualDurationValue)
          ? (actualDurationValue.toNumber ? actualDurationValue.toNumber() : Number(actualDurationValue))
          : undefined;

        const raffleData = {
          address: raffleAddress,
          name,
          creator,
          startTime: startTime.toNumber(),
          duration: duration.toNumber(),
          actualDuration: actualDurationNumber,
          uniqueParticipants: (uniqueParticipantsValue?.toNumber ? uniqueParticipantsValue.toNumber() : Number(uniqueParticipantsValue)) || 0,
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
          amountPerWinner: amountPerWinner ? (amountPerWinner.toNumber ? amountPerWinner.toNumber() : Number(amountPerWinner)) : 1
        };

	        // Determine if this raffle is still a VRF consumer via RaffleManager (more reliable than checking subscription id)

	        console.log('[VRF Debug] Checking isVRFConsumer', {
	          chainSlug,
	          providerChainId: provider?.network?.chainId,
	          resolvedChainId: resolveChainIdFromSlug(chainSlug) || provider?.network?.chainId,
	          raffleAddress
	        });

	        let isVrfConsumer = false;
	        try {
	          const currentChainId = resolveChainIdFromSlug(chainSlug) || provider?.network?.chainId;
	          const managerAddr = currentChainId ? SUPPORTED_NETWORKS[currentChainId]?.contractAddresses?.raffleManager : undefined;
	          if (managerAddr) {
	            const managerContract = getContractInstance(managerAddr, 'raffleManager');


            // debug removed

	            console.log('[VRF Debug] Built manager contract?', { hasContract: !!managerContract });

            // debug removed


	            if (managerContract && managerContract.isVRFConsumer) {
	              isVrfConsumer = await managerContract.isVRFConsumer(raffleAddress);

	              console.log('[VRF Debug] manager.isVRFConsumer result', { isVrfConsumer });

	            }
	          }
	        } catch (_) {}

	        console.log('[VRF Debug] Setting raffle.isVrfConsumer', { isVrfConsumer: !!isVrfConsumer });

	        raffleData.isVrfConsumer = !!isVrfConsumer;


        setRaffle(raffleData);

	        // Fallback: if manager contract exists in context, prefer it directly (no address lookups)
	        try {
	          if (!isVrfConsumer && contracts?.raffleManager?.isVRFConsumer) {

	        // Fallback: if manager contract exists in context, prefer it directly (no address lookups)
	        try {
	          if (!isVrfConsumer && contracts?.raffleManager?.isVRFConsumer) {
	            console.log('[VRF Debug] Using context manager to check isVRFConsumer', { manager: contracts.raffleManager.address, raffleAddress });
	            isVrfConsumer = await contracts.raffleManager.isVRFConsumer(raffleAddress);
	            console.log('[VRF Debug] Context manager isVRFConsumer result', { isVrfConsumer });
	            raffleData.isVrfConsumer = !!isVrfConsumer;
	          }
	        } catch (err) {
	          console.warn('[VRF Debug] Context manager isVRFConsumer check failed', err);
	        }


        // Update raffle with final VRF consumer flag
        setRaffle(raffleData);

	        console.log('[VRF Debug] Final isVrfConsumer for raffle', { raffleAddress, isVrfConsumer: raffleData.isVrfConsumer });

        console.log('[VRF Debug] Final isVrfConsumer for raffle (post-set)', { raffleAddress, isVrfConsumer: raffleData.isVrfConsumer });


	            isVrfConsumer = await contracts.raffleManager.isVRFConsumer(raffleAddress);
	            raffleData.isVrfConsumer = !!isVrfConsumer;
	          }
	        } catch (_) {}

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
      // Show original duration when actual duration exceeds original; otherwise show actual if available
      const actual = raffle.actualDuration && (raffle.actualDuration.toNumber ? raffle.actualDuration.toNumber() : Number(raffle.actualDuration));
      const original = raffle.duration;
      const displaySeconds = actual && actual > 0
        ? (actual > original ? original : actual)
        : original;
      setTimeLabel(label);
      setTimeValue(formatDuration(displaySeconds));
      return;
    }
    if (now < raffle.startTime) {
      label = 'Starts In';
      seconds = raffle.startTime - now;
    } else {
      label = 'Remaining';
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

    // Get dynamic label for Prizes Claimed state based on winner count
    const getDynamicLabel = (stateNum) => {
      if (stateNum === 7) { // Prizes Claimed state
        return winnerCount === 1 ? 'Prize Claimed' : 'Prizes Claimed';
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
    return (
      <span className={`inline-flex max-w-[60vw] items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${colorMap[label] || colorMap['Unknown']}`}>
        {label}
      </span>
    );
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
  const [winnerCount, setWinnerCount] = useState(0);

  // Check winner status when raffle data changes
  useEffect(() => {
    const checkWinnerStatus = async () => {
      if (!raffle || !address || ![4,5,7,8].includes(raffle.stateNum)) {
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

  // Auto-refresh logic for Drawing state monitoring
  useEffect(() => {
    if (!raffle) return;

    // Track when raffle enters Drawing state
    if (raffle.stateNum === 3) { // Drawing state
      if (!lastDrawingStateTime) {
        setLastDrawingStateTime(Date.now());
        console.log('🎯 Raffle entered Drawing state - starting auto-refresh monitoring');
      }
    } else {
      // Reset when leaving Drawing state
      if (lastDrawingStateTime) {
        setLastDrawingStateTime(null);
        setAutoRefreshCount(0);
        console.log('🎯 Raffle left Drawing state - stopping auto-refresh monitoring');
      }
    }
  }, [raffle?.stateNum, lastDrawingStateTime]);

  // Auto-refresh timer for Drawing state - triggers every 15 seconds
  useEffect(() => {
    if (!lastDrawingStateTime || raffle?.stateNum !== 3) return;

    console.log('🔄 Starting auto-refresh timer for Drawing state (every 15 seconds)');

    const autoRefreshInterval = setInterval(() => {
      setIsAutoRefreshing(true);
      setAutoRefreshCount(prev => prev + 1);

      console.log(`🔄 Auto-refreshing raffle data in Drawing state (attempt ${autoRefreshCount + 1})`);

      // Show user notification every few attempts to avoid spam
      if ((autoRefreshCount + 1) % 4 === 1) { // Show notification every 4th attempt (every minute)
        toast.info('Checking for winner selection...', {
          duration: 2000
        });
      }

      // Trigger refresh
      triggerRefresh();

      // Reset auto-refresh flag after delay
      setTimeout(() => {
        setIsAutoRefreshing(false);
      }, 3000);
    }, 15000); // Refresh every 15 seconds

    return () => {
      console.log('🔄 Stopping auto-refresh timer for Drawing state');
      clearInterval(autoRefreshInterval);
    };
  }, [lastDrawingStateTime, raffle?.stateNum, autoRefreshCount, triggerRefresh]);

  const shouldShowClaimPrize = !!winnerData && (
    // Standard prized raffles: winners can claim in Completed (4) or Prizes Claimed (7)
    (raffle?.isPrized && (raffle?.stateNum === 4 || raffle?.stateNum === 7)) ||
    // Externally prized raffles (mintable assigned before Active): winners can mint in Completed (4)
    ((raffle?.isPrized === false) && ((isExternallyPrized === true) || (raffle?.isExternallyPrized === true)) && raffle?.stateNum === 4)
  );
  const prizeAlreadyClaimed = winnerData && winnerData.prizeClaimed;
  const shouldShowClaimRefund =
    (raffle?.isPrized || raffle?.isExternallyPrized) &&
    [4,5,7,8].includes(raffle?.stateNum) &&
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



  return (
    <PageContainer variant="wide" className="py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/app')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Raffles
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>

            <div className="flex items-center gap-2">
              <h1 className={isMobile ? "text-xl font-bold mb-2" : "text-3xl font-bold mb-2"}>{raffle.name}</h1>
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}${makeSharePath()}`;
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    toast.success('Share link copied to clipboard');
                  }).catch(() => {
                    toast.error('Failed to copy link');
                  });
                }}
                title="Copy share link"
                className="ml-2 p-1 rounded text-muted-foreground hover:text-foreground focus:outline-none active:outline-none hover:bg-transparent active:bg-transparent"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3.9 12a5 5 0 0 1 5-5h2v2h-2a3 3 0 0 0 0 6h2v2h-2a5 5 0 0 1-5-5zm7-1h2v2h-2v-2zm4.1-4a5 5 0 0 1 0 10h-2v-2h2a3 3 0 0 0 0-6h-2V7h2z" />
                </svg>
              </button>
            </div>
            <div className="mt-2">
              <p className="text-muted-foreground">
                Created by {raffle.creator.slice(0, 10)}...{raffle.creator.slice(-8)}
              </p>
            </div>

          </div>
          {/* On mobile, stack state badge and creator actions; on desktop, keep inline */}
          <div className="flex flex-col items-start sm:flex-row sm:items-center sm:gap-3 gap-2 w-full sm:w-auto">
            <div className="self-start sm:self-auto">{getStatusBadge()}</div>

            {/* Auto-refresh indicator */}
            {(isAutoRefreshing || (raffle?.stateNum === 3 && lastDrawingStateTime)) && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></div>
                {isMobile ? 'Checking for winners...' : 'Checking for winner selection...'}
              </div>
            )}

            {canDelete() && (
                <Button
                onClick={handleDeleteRaffle}
                className="flex items-center gap-2 bg-[#614E41] text-white px-4 py-2 rounded-md hover:bg-[#4a3a30] transition-colors text-sm font-medium"
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
              !isEscrowedPrize &&
              raffle.stateNum === 4 && (
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                {!showMintInput ? (
                  <Button
                    onClick={() => setShowMintInput(true)}
                    className="bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Mint to Winner
                  </Button>
                ) : (
                  <div ref={mintWinnerRef} className="flex flex-col sm:flex-row gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Enter winner address"
                      value={mintWinnerAddress}
                      onChange={e => setMintWinnerAddress(e.target.value)}
                      className="px-3 py-2.5 border-2 border-[#614E41] rounded-md bg-background w-72 font-mono focus:outline-none focus:ring-0"
                      disabled={mintingToWinner}
                    />
                    <Button
                      onClick={handleMintToWinner}
                      disabled={mintingToWinner || !mintWinnerAddress || mintWinnerAddress.length !== 42}
                      className="bg-[#614E41] text-white px-4 py-2 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50"
                    >
                      {mintingToWinner ? 'Minting...' : 'Submit'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowMintInput(false)}
                      disabled={mintingToWinner}
                      className="sm:ml-2 border-2 border-[#614E41]"
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
              raffle.stateNum === 8 && (
                <Button
                  onClick={handleWithdrawPrize}
                  className="sm:ml-2 bg-warning text-warning-foreground hover:bg-warning/90"
                  disabled={withdrawingPrize}
                >
                  {withdrawingPrize ? 'Withdrawing...' : 'Withdraw Prize'}
                </Button>
              )}

              {/* Update VRF Status - visible to all users, in terminal states */}
              {([4,5,6,7,8].includes(raffle.stateNum) && raffle?.isVrfConsumer === true) && (
                <Button
                  onClick={async () => {
                    try {
                      setUpdatingVrfStatus(true);
                      const contract = getContractInstance(raffle.address, 'raffle');
                      if (!contract) throw new Error('Failed to get raffle contract');
                      const result = await executeTransaction(contract.removeFromVRFSubscription);
                      if (result?.success) {
                        toast.success('VRF status updated successfully');
                        // Optimistically update local state so the button hides immediately
                        setRaffle((prev) => prev ? { ...prev, isVrfConsumer: false } : prev);
                        triggerRefresh?.();
                      } else if (result?.error) {
                        throw new Error(result.error);
                      }
                    } catch (err) {
                      toast.error(extractRevertReason(err));
                    } finally {
                      setUpdatingVrfStatus(false);
                    }
                  }}
                  disabled={updatingVrfStatus}
                  className="sm:ml-2 bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updatingVrfStatus ? 'Updating...' : 'Update VRF Status'}
                </Button>
              )}

            {!raffle.isPrized &&
              raffle.stateNum === 0 &&
              connected &&
              address?.toLowerCase() === raffle.creator.toLowerCase() && (
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  {!showAssignPrizeInput ? (
                    <Button
                      onClick={() => setShowAssignPrizeInput(true)}
                      className="bg-[#614E41] text-white px-6 py-3 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      Assign Prize
                    </Button>
                  ) : (
                    <div ref={assignPrizeRef} className="flex flex-col sm:flex-row gap-2 items-center bg-background p-2 rounded-md relative z-10 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Prize collection address"
                        value={assignPrizeAddress}
                        onChange={e => setAssignPrizeAddress(e.target.value)}
                        className="px-3 py-2.5 border-2 border-[#614E41] rounded-md bg-background w-full sm:w-56 font-mono focus:outline-none focus:ring-0"
                        disabled={assigningPrize}
                      />
                      <div className="w-full sm:w-auto" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <Select
                          value={String(assignPrizeStandard)}
                          onValueChange={v => setAssignPrizeStandard(Number(v))}
                          onOpenChange={(open) => setAssignSelectOpen(open)}
                        >
                          <SelectTrigger className="w-full px-3 py-2.5 text-base border-2 border-[#614E41] rounded-lg bg-background">
                            <SelectValue placeholder="Select Prize Standard" />
                          </SelectTrigger>
                          <SelectContent onMouseDown={e => e.stopPropagation()}>
                            <SelectItem value="0">ERC721</SelectItem>
                            <SelectItem value="1">ERC1155</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <input
                        type="number"
                        placeholder="Prize Token ID"
                        value={assignPrizeStandard === 0 ? 0 : assignPrizeTokenId}
                        onChange={e => setAssignPrizeTokenId(e.target.value)}
                        className="px-3 py-2.5 border-2 border-[#614E41] rounded-md bg-background w-full sm:w-32 focus:outline-none focus:ring-0"
                        disabled={assigningPrize || assignPrizeStandard === 0}
                      />
                      <input
                        type="number"
                        placeholder="Amount Per Winner"
                        value={assignPrizeStandard === 0 ? 1 : assignPrizeAmountPerWinner}
                        onChange={e => setAssignPrizeAmountPerWinner(e.target.value)}
                        className="px-3 py-2.5 border-2 border-[#614E41] rounded-md bg-background w-full sm:w-32 focus:outline-none focus:ring-0"
                        disabled={assigningPrize || assignPrizeStandard === 0}
                      />
                      <Button
                        onClick={handleAssignPrize}
                        disabled={assigningPrize || !assignPrizeAddress || assignPrizeAddress.length !== 42 || (assignPrizeStandard !== 0 && (assignPrizeTokenId === "" || assignPrizeAmountPerWinner === ""))}
                        className="bg-[#614E41] text-white px-4 py-2 rounded-lg hover:bg-[#4a3a30] transition-colors disabled:opacity-50"
                      >
                        {assigningPrize ? 'Assigning...' : 'Submit'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowAssignPrizeInput(false)}
                        disabled={assigningPrize}
                        className="sm:ml-2 border-2 border-[#614E41]"
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

      <div className="detail-beige-card mb-8 p-6 bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl shadow-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 text-center items-center">
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{raffle.ticketsSold}</p>
            <p className="text-sm text-foreground/70 dark:text-foreground/80">Tickets Sold</p>
          </div>
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{raffle.ticketLimit}</p>
            <p className="text-sm text-foreground/70 dark:text-foreground/80">Total Tickets</p>
          </div>
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{raffle.winnersCount}</p>
            <p className="text-sm text-foreground/70 dark:text-foreground/80">Winners</p>
          </div>
          <div>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{timeValue}</p>
            <p className="text-sm text-foreground/70 dark:text-foreground/80">{timeLabel}</p>
          </div>
          <div className="flex justify-center lg:justify-end items-center h-full w-full">
            {isRefundable && raffle && raffle.standard !== 2 && raffle.standard !== 3 && (() => {
              const { refundable, reason, label } = getRefundability(raffle);
              return (
                <span className={`px-3 py-1 rounded-full font-semibold ${refundable ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'} text-xs`}
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

          <WinnersSection
            raffle={raffle}
            isMintableERC721={isMintableERC721}
            isEscrowedPrize={isEscrowedPrize}
            isMobile={isMobile}
            onWinnerCountChange={setWinnerCount}
          />
        </div>

        {/* Bottom Row: Raffle Details and PrizeImageCard */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="detail-beige-card bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl p-6 shadow-lg h-full">
            <h3 className={`font-semibold mb-4 ${isMobile ? 'text-base' : 'text-lg'}`}>Raffle Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-foreground/80 dark:text-foreground">Contract Address:</span>
                <a
                  href={getExplorerLink(raffle.address, raffle.chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200"
                  title={raffle.address}
                >
                  {isMobile ? `${raffle.address.slice(0, 12)}...` : `${raffle.address.slice(0, 10)}...${raffle.address.slice(-8)}`}
                </a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground/80 dark:text-foreground">Start Time:</span>
                <span>{new Date(raffle.startTime * 1000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground/80 dark:text-foreground flex items-center gap-1">
                  Raffle Duration
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center cursor-help" aria-label="Raffle Duration info">
                        <Info className="h-3.5 w-3.5 opacity-70" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                      Shows the default duration until the raffle ends, then shows the actual duration taken.
                    </TooltipContent>
                  </Tooltip>
                </span>
                <span>
                  {(() => {
                    const ended = [2,3,4,5,6,7,8].includes(raffle.stateNum);
                    const actual = raffle?.actualDuration && (raffle.actualDuration.toNumber ? raffle.actualDuration.toNumber() : Number(raffle.actualDuration));
                    const original = raffle?.duration;
                    const displaySeconds = ended && actual && actual > 0
                      ? (actual > original ? original : actual)
                      : original;
                    return formatDuration(displaySeconds);
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground/80 dark:text-foreground">Ticket Fee:</span>
                <span>{formatTicketPrice(raffle.ticketPrice)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-foreground/80 dark:text-foreground">Total Participants:</span>
                <span>{Number(raffle.uniqueParticipants || 0).toLocaleString()}</span>
              </div>
                  {raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-foreground/80 dark:text-foreground">Prize Amount:</span>
                      <span>{formatPrizeAmount(raffle.nativePrizeAmount)}</span>
                    </div>
                  )}
                  {raffle.erc20PrizeToken && raffle.erc20PrizeToken !== ethers.constants.AddressZero && raffle.erc20PrizeAmount && raffle.erc20PrizeAmount.gt && raffle.erc20PrizeAmount.gt(0) && (
                    <ERC20PrizeAmount token={raffle.erc20PrizeToken} amount={raffle.erc20PrizeAmount} />
                  )}
              {raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero && (
                <>
                <div className="flex justify-between">
                  <span className="text-foreground/80 dark:text-foreground">Prize Collection:</span>
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
                    <span className="text-foreground/80 dark:text-foreground">
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
                  {isEscrowedPrize && raffle.prizeTokenId !== undefined && raffle.prizeTokenId !== null && (
                    <div className="flex justify-between">
                      <span className="text-foreground/80 dark:text-foreground">Prize Token ID:</span>
                      <span className="font-mono font-semibold">
                        {raffle.prizeTokenId.toString ? raffle.prizeTokenId.toString() : raffle.prizeTokenId}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <PrizeImageCard raffle={raffle} isMintableERC721={isMintableERC721} isEscrowedPrize={isEscrowedPrize} />
        </div>
      </div>
    </PageContainer>
  );
};

export default RaffleDetailPage;

