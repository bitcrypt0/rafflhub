/**
 * PrizeImageCard Component
 *
 * Displays NFT prize artwork with support for multiple gateway fallbacks
 * and flexible size variants for different layouts.
 *
 * Variants:
 * - 'default': Standard 256x256 display (original behavior)
 * - 'hero': Large showcase display for NFT layout (480px max)
 * - 'compact': Smaller display for sidebar use (192px)
 */

import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Card, CardContent } from '../ui/card';
import { useContract } from '../../contexts/ContractContext';
import { useCollabDetection } from '../../contexts/CollabDetectionContext';
import { Image, ImageOff, ExternalLink, Gift, Sparkles } from 'lucide-react';
import { constructMetadataURIs } from '../../utils/nftMetadataUtils';
import {
  isBytes32Hash,
  isZeroHash,
  resolveURIOrHash
} from '../../services/uriRegistryService';

// Gateway configurations for decentralized storage
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];
const IPNS_GATEWAYS = IPFS_GATEWAYS.map(g => g.replace('/ipfs/', '/ipns/'));
const ARWEAVE_GATEWAYS = ['https://arweave.net/'];

// Size configurations for different variants
const VARIANT_SIZES = {
  default: {
    containerClass: 'w-64 h-64',
    imageClass: 'w-64 h-64',
    maxWidth: '256px',
  },
  hero: {
    containerClass: 'w-full max-w-[480px] aspect-square',
    imageClass: 'w-full h-full max-w-[480px]',
    maxWidth: '480px',
  },
  compact: {
    containerClass: 'w-48 h-48',
    imageClass: 'w-48 h-48',
    maxWidth: '192px',
  },
};

const PrizeImageCard = ({
  raffle,
  isMintableERC721,
  isEscrowedPrize,
  variant = 'default',
  showFrame = true,
  className = '',
  collectionName = null,
}) => {
  const { getContractInstance } = useContract();
  const { getCollabStatus } = useCollabDetection();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchSource, setFetchSource] = useState(null);
  const [suppressRender, setSuppressRender] = useState(false);
  const [imageCandidates, setImageCandidates] = useState([]);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  
  // Track the last fetched collection to prevent re-fetching on raffle object updates
  const lastFetchedRef = useRef(null);

  const sizeConfig = VARIANT_SIZES[variant] || VARIANT_SIZES.default;

  // Convert decentralized URIs to HTTP
  const convertDecentralizedToHTTP = (uri) => {
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
    const mediaFields = [
      'image', 'image_url', 'imageUrl', 'animation_url',
      'animationUrl', 'media', 'artwork'
    ];

    const normalizeIpfs = (u) => {
      if (!u) return null;
      if (u.startsWith('ipfs://')) {
        let rest = u.slice('ipfs://'.length);
        if (rest.startsWith('ipfs/')) rest = rest.slice('ipfs/'.length);
        return IPFS_GATEWAYS.map(gateway => `${gateway}${rest}`);
      }
      if (u.startsWith('ipns://')) {
        let rest = u.slice('ipns://'.length);
        if (rest.startsWith('ipns/')) rest = rest.slice('ipns/'.length);
        return IPNS_GATEWAYS.map(gateway => `${gateway}${rest}`);
      }
      if (u.startsWith('ar://')) {
        const rest = u.slice('ar://'.length);
        return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${rest}`);
      }
      return [u];
    };

    for (const field of mediaFields) {
      if (metadata[field]) {
        const raw = metadata[field];
        const urls = normalizeIpfs(String(raw));
        return urls;
      }
    }

    return null;
  };

  // Handle media fallback
  const handleMediaError = () => {
    if (Array.isArray(imageCandidates) && imageCandidateIndex + 1 < imageCandidates.length) {
      setImageCandidateIndex(imageCandidateIndex + 1);
      setImageUrl(imageCandidates[imageCandidateIndex + 1]);
    } else {
      setImageUrl(null);
    }
  };

  // Fetch with timeout
  const fetchWithTimeout = async (url, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json, text/plain, */*' }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Cascading fetch with fallback
  const fetchMetadataWithFallback = async (uriVariants, timeoutMs = 10000) => {
    for (const uri of uriVariants) {
      try {
        if (uri.startsWith('data:')) {
          const [meta, payload] = uri.split(',', 2);
          const [, mime, encoding] = meta.match(/^data:([^;]+);([^,]+)$/) || [];
          if (mime?.includes('application/json') && encoding === 'base64') {
            const json = JSON.parse(atob(payload));
            const imageUrl = extractImageURL(json) || null;
            if (imageUrl) return { metadata: json, imageUrl, sourceUri: uri };
          } else if (mime?.startsWith('image/') || mime?.startsWith('video/')) {
            return { metadata: { image: uri }, imageUrl: uri, sourceUri: uri };
          }
          continue;
        }

        const response = await fetchWithTimeout(uri, timeoutMs);

        if (response.ok) {
          const contentType = response.headers.get('content-type');

          try {
            const text = await response.text();
            const metadata = JSON.parse(text);
            if (metadata && typeof metadata === 'object') {
              const imageUrl = extractImageURL(metadata);
              if (imageUrl) {
                return { metadata, imageUrl, sourceUri: uri };
              }
            }
          } catch (jsonError) {
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
        continue;
      }
    }

    throw new Error('All metadata fetch attempts failed');
  };

  // Main fetch effect
  useEffect(() => {
    let isMounted = true;

    async function fetchPrizeImageEnhanced() {
      const shouldFetch = raffle.isPrized ||
        (raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero) ||
        (raffle.standard !== undefined && raffle.prizeTokenId !== undefined);

      if (!shouldFetch) return;

      // Create a unique key based on collection, token ID, and standard only.
      // Deliberately exclude isEscrowedPrize: once artwork is fetched successfully,
      // it must be preserved even if isEscrowedPrize toggles from real-time updates.
      const fetchKey = `${raffle.prizeCollection}-${raffle.prizeTokenId}-${raffle.standard}`;
      
      // Skip if we've already successfully fetched for this exact collection/token
      if (lastFetchedRef.current === fetchKey && imageUrl) {
        return;
      }

      // Check if backend artwork URL is already available (pre-resolved)
      if (raffle._fromBackend && raffle._backendArtworkUrl) {
        if (!isMounted) return;
        setImageUrl(raffle._backendArtworkUrl);
        setImageCandidates([raffle._backendArtworkUrl]);
        setImageCandidateIndex(0);
        setFetchSource('backend');
        setLoading(false);
        lastFetchedRef.current = fetchKey;
        return;
      }

      // Only show loading state if we don't already have an image
      if (!imageUrl) {
        setLoading(true);
      }

      const isMintable = isEscrowedPrize ? false : true;

      try {
        let baseUri = null;

        // For mintable collections (both protocol-native and external), try backend first
        if (isMintable) {
          // Check if backend collection artwork is available
          const collectionArtwork = raffle._backendCollectionArtwork || raffle.collection_artwork;
          if (collectionArtwork) {
            // Priority: dropUri > unrevealedUri > baseUri
            if (collectionArtwork.dropUri && collectionArtwork.dropUri.trim() !== '') {
              baseUri = collectionArtwork.dropUri;
            } else if (collectionArtwork.unrevealedUri && collectionArtwork.unrevealedUri.trim() !== '') {
              baseUri = collectionArtwork.unrevealedUri;
            } else if (collectionArtwork.baseUri && collectionArtwork.baseUri.trim() !== '') {
              baseUri = collectionArtwork.baseUri;
            }
          }
          
          // If still no URI from backend, fall back to RPC
          if (!baseUri || baseUri.trim() === '' || isBytes32Hash(baseUri)) {
            const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';
            const contract = getContractInstance(raffle.prizeCollection, contractType);
            
            if (contract) {
              if (raffle.standard === 0) {
                // ERC721 - try unrevealedBaseURI
                try {
                  baseUri = await contract.unrevealedBaseURI();
                } catch (error) {}
                
                // Try hash-based resolution
                if (!baseUri || baseUri.trim() === '' || isBytes32Hash(baseUri)) {
                  let uriHash = null;
                  try {
                    if (typeof contract.unrevealedURIHash === 'function') {
                      uriHash = await contract.unrevealedURIHash();
                    }
                  } catch (e) {}

                  if (uriHash && !isZeroHash(uriHash)) {
                    const resolvedURI = await resolveURIOrHash(uriHash, {
                      collectionAddress: raffle.prizeCollection,
                      uriType: 'unrevealedURI'
                    });
                    if (resolvedURI) baseUri = resolvedURI;
                  }
                }
              } else if (raffle.standard === 1) {
                // ERC1155 - try unrevealedURI
                try {
                  baseUri = await contract.unrevealedURI();
                } catch (e) {}
                
                if (baseUri && isBytes32Hash(baseUri)) {
                  const resolvedURI = await resolveURIOrHash(baseUri, {
                    collectionAddress: raffle.prizeCollection,
                    uriType: 'unrevealedURI'
                  });
                  baseUri = resolvedURI || null;
                }
                
                // Try hash-based resolution
                if (!baseUri || baseUri.trim() === '') {
                  let uriHash = null;
                  try {
                    if (typeof contract.unrevealedURIHash === 'function') {
                      uriHash = await contract.unrevealedURIHash();
                    }
                  } catch (e) {}

                  if (uriHash && !isZeroHash(uriHash)) {
                    const resolvedURI = await resolveURIOrHash(uriHash, {
                      collectionAddress: raffle.prizeCollection,
                      uriType: 'unrevealedURI'
                    });
                    if (resolvedURI) baseUri = resolvedURI;
                  }
                }
                
                // Try tokenURI/uri() as last resort
                if (!baseUri || baseUri.trim() === '' || isBytes32Hash(baseUri)) {
                  try { baseUri = await contract.tokenURI(raffle.prizeTokenId); } catch (e) {}
                }
                if (!baseUri || baseUri.trim() === '' || isBytes32Hash(baseUri)) {
                  try { baseUri = await contract.uri(raffle.prizeTokenId); } catch (e) {}
                }
              }
            }
          }
          
          // If still no valid URI for mintable, suppress render
          if (!baseUri || baseUri.trim() === '' || isBytes32Hash(baseUri)) {
            if (!isMounted) return;
            setSuppressRender(true);
            setImageUrl(null);
            setLoading(false);
            return;
          }
        } else {
          // Escrowed prize - use tokenURI/uri() directly (no backend artwork for escrowed)
          const contractType = raffle.standard === 0 ? 'erc721Prize' : 'erc1155Prize';
          const contract = getContractInstance(raffle.prizeCollection, contractType);
          
          if (!contract) {
            if (!isMounted) return;
            setImageUrl(null);
            setLoading(false);
            return;
          }
          
          if (raffle.standard === 0) {
            try {
              baseUri = await contract.tokenURI(raffle.prizeTokenId);
            } catch (error) {
              if (!isMounted) return;
              setImageUrl(null);
              setLoading(false);
              return;
            }
          } else if (raffle.standard === 1) {
            try {
              baseUri = await contract.uri(raffle.prizeTokenId);
            } catch (error) {
              if (!isMounted) return;
              setImageUrl(null);
              setLoading(false);
              return;
            }
          } else {
            if (!isMounted) return;
            setImageUrl(null);
            setLoading(false);
            return;
          }
        }

        if (!baseUri || baseUri.trim() === '') {
          if (!isMounted) return;
          setImageUrl(null);
          setLoading(false);
          return;
        }

        const uriVariants = constructMetadataURIs(baseUri, raffle.prizeTokenId, raffle.standard);
        const allURIs = [];
        for (const variant of uriVariants) {
          allURIs.push(...convertDecentralizedToHTTP(variant));
        }

        const timeoutMs = (raffle.standard === 0 && !isEscrowedPrize) ? 5000 : 10000;
        const result = await fetchMetadataWithFallback(allURIs, timeoutMs);

        if (!isMounted) return;
        const imgCandidates = Array.isArray(result.imageUrl) ? result.imageUrl : [result.imageUrl];
        setImageCandidates(imgCandidates);
        setImageCandidateIndex(0);
        setImageUrl(imgCandidates[0]);
        setFetchSource(result.sourceUri);
        // Mark this collection/token as successfully fetched
        lastFetchedRef.current = fetchKey;
      } catch (error) {
        if (isMounted) {
          setImageUrl(null);
          setFetchSource(null);
        }
      }

      if (isMounted) setLoading(false);
    }

    const eligiblePrize = (
      raffle?.isPrized === true &&
      raffle?.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero &&
      (raffle?.standard === 0 || raffle?.standard === 1)
    );

    if (eligiblePrize) fetchPrizeImageEnhanced();

    return () => { isMounted = false; };
  }, [raffle?.prizeCollection, raffle?.prizeTokenId, raffle?.standard, raffle?.isPrized, raffle?._backendArtworkUrl, getContractInstance, isEscrowedPrize]);

  // Render conditions
  const shouldRender = (
    raffle?.isPrized === true &&
    raffle?.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero &&
    (raffle?.standard === 0 || raffle?.standard === 1)
  );

  if (!shouldRender) return null;

  // Hero variant styling
  const isHero = variant === 'hero';
  const cardClasses = isHero
    ? `nft-artwork-showcase ${className}`
    : `detail-beige-card h-full flex flex-col items-center justify-center text-foreground border border-border rounded-xl ${className}`;

  // Loading state
  if (loading) {
    return (
      <Card className={cardClasses}>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className={`${sizeConfig.containerClass} flex items-center justify-center border rounded-lg bg-muted/30`}>
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading prize media...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No image state
  if (!imageUrl) {
    if (isHero) {
      return (
        <div className={`${sizeConfig.containerClass} flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-xl bg-muted/20 ${className}`}>
          <ImageOff className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Artwork unavailable</p>
        </div>
      );
    }
    return null;
  }

  const isVideo = typeof imageUrl === 'string' && /\.(mp4|webm|ogg)$/i.test(imageUrl);

  // Determine badge type for hero variant
  // NFT Drop: mintable NFT (not escrowed)
  // NFT Collab Drop: detected by CollabDetectionContext OR raffle.isCollabPool
  const isMintable = !isEscrowedPrize;
  const isNFTDrop = isMintable && raffle?.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero;
  
  // Use CollabDetectionContext for accurate collab detection (same logic as FilterSidebar)
  // Fallback to raffle.isCollabPool when collabStatus is undefined (e.g., on RaffleDetailPage)
  const collabStatus = getCollabStatus(raffle?.address);
  const isCollabDrop = isNFTDrop && (
    collabStatus === 'nft_collab' || 
    (collabStatus === undefined && raffle?.isCollabPool === true) ||
    raffle?.isCollabPool === true
  );
  
  const showEscrowedBadge = isEscrowedPrize && (collectionName || raffle?.prizeTokenId !== undefined);
  const showNFTDropBadge = isNFTDrop && variant === 'hero';

  // Format token ID for display
  const formatTokenId = (tokenId) => {
    if (tokenId === undefined || tokenId === null) return '';
    const id = tokenId.toString ? tokenId.toString() : String(tokenId);
    return `#${id}`;
  };

  // Hero variant render
  if (isHero) {
    const mediaElement = isVideo ? (
      <video
        src={imageUrl}
        className={`${sizeConfig.imageClass} object-contain rounded-xl`}
        style={{ background: '#000' }}
        controls
        playsInline
        onError={handleMediaError}
      />
    ) : (
      <img
        src={imageUrl}
        alt="NFT Prize Artwork"
        className={`${sizeConfig.imageClass} object-contain rounded-xl`}
        style={{ background: 'transparent' }}
        onError={handleMediaError}
      />
    );

    // If no badges needed, return just the media element
    if (!showEscrowedBadge && !showNFTDropBadge) {
      return <div className={className}>{mediaElement}</div>;
    }

    // Render with badge overlay
    return (
      <div className={`relative ${className}`}>
        {mediaElement}
        
        {/* Escrowed NFT Badge - Collection Name + Token ID */}
        {showEscrowedBadge && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap bg-amber-100 text-amber-800">
              {collectionName || 'NFT'}{raffle?.prizeTokenId !== undefined ? ` ${formatTokenId(raffle.prizeTokenId)}` : ''}
            </span>
          </div>
        )}

        {/* NFT Drop Badge - Collab Drop Badge Only (Collection Name badge removed) */}
        {showNFTDropBadge && isCollabDrop && (
          <div className="absolute bottom-3 right-3">
            {/* Collab Drop Badge - Only for NFT Collab Drop pools */}
            <span className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap bg-blue-100 text-blue-800">
              Collab Drop
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default/compact variant render
  return (
    <Card className={cardClasses}>
      <CardContent className="flex flex-col items-center justify-center p-6">
        {isVideo ? (
          <video
            src={imageUrl}
            className={`${sizeConfig.imageClass} object-contain rounded-lg border`}
            style={{ background: '#000' }}
            controls
            playsInline
            onError={handleMediaError}
          />
        ) : (
          <img
            src={imageUrl}
            alt="Prize Art"
            className={`${sizeConfig.imageClass} object-contain rounded-lg border`}
            style={{ background: '#fff' }}
            onError={handleMediaError}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default PrizeImageCard;
