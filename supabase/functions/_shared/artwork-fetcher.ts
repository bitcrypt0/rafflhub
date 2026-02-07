/**
 * Artwork Fetcher Utility
 * Fetches and resolves NFT artwork URLs for prize collections
 * Used by indexers to cache artwork URLs in the database
 */

import { ethers } from 'https://esm.sh/ethers@5.7.2';

// Gateway configurations
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];
const IPNS_GATEWAYS = IPFS_GATEWAYS.map(g => g.replace('/ipfs/', '/ipns/'));
const ARWEAVE_GATEWAYS = ['https://arweave.net/'];

// NFT Collection ABIs for fetching URIs
const ERC721_URI_ABI = [
  'function unrevealedBaseURI() view returns (string)',
  'function tokenURI(uint256) view returns (string)',
];

const ERC1155_URI_ABI = [
  'function unrevealedURI() view returns (string)',
  'function uri(uint256) view returns (string)',
  'function tokenURI(uint256) view returns (string)',
];

/**
 * Convert decentralized URIs to HTTP URLs
 */
function convertToHTTP(uri: string): string[] {
  if (!uri) return [];

  // IPFS
  if (uri.startsWith('ipfs://')) {
    let hash = uri.replace('ipfs://', '');
    if (hash.startsWith('ipfs/')) hash = hash.slice('ipfs/'.length);
    return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
  }

  // IPNS
  if (uri.startsWith('ipns://')) {
    let name = uri.replace('ipns://', '');
    if (name.startsWith('ipns/')) name = name.slice('ipns/'.length);
    return IPNS_GATEWAYS.map(gateway => `${gateway}${name}`);
  }

  // Arweave
  if (uri.startsWith('ar://')) {
    const id = uri.replace('ar://', '');
    return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
  }

  // Try to parse as URL and extract IPFS/IPNS/Arweave
  try {
    const u = new URL(uri);
    const parts = u.pathname.split('/').filter(Boolean);

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

    if (u.hostname.endsWith('arweave.net')) {
      const id = parts.join('/');
      return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`);
    }
  } catch (_) {
    // Not a URL
  }

  return [uri];
}

/**
 * Extract image URL from metadata JSON
 */
function extractImageURL(metadata: any): string | null {
  const mediaFields = ['image', 'image_url', 'imageUrl', 'animation_url', 'media', 'artwork'];
  
  for (const field of mediaFields) {
    if (metadata[field]) {
      const urls = convertToHTTP(String(metadata[field]));
      return urls[0] || null; // Return first URL
    }
  }
  
  return null;
}

/**
 * Construct metadata URI variants
 */
function constructMetadataURIs(baseUri: string, tokenId: number, standard: number): string[] {
  const variants: string[] = [];
  
  // Direct URI
  variants.push(baseUri);
  
  // With token ID replacement for ERC1155
  if (standard === 1) {
    const hexId = tokenId.toString(16).padStart(64, '0');
    variants.push(baseUri.replace('{id}', hexId));
    variants.push(baseUri.replace('{id}', tokenId.toString()));
  }
  
  // Append token ID for ERC721
  if (standard === 0) {
    if (!baseUri.endsWith('/')) {
      variants.push(`${baseUri}/${tokenId}`);
    }
    variants.push(`${baseUri}${tokenId}`);
  }
  
  // With .json extension
  variants.push(`${baseUri}.json`);
  if (standard === 0) {
    variants.push(`${baseUri}/${tokenId}.json`);
    variants.push(`${baseUri}${tokenId}.json`);
  }
  
  return variants;
}

/**
 * Fetch metadata with timeout
 */
async function fetchWithTimeout(url: string, timeout = 8000): Promise<Response> {
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
}

/**
 * Fetch metadata with fallback through multiple URIs
 */
async function fetchMetadataWithFallback(uriVariants: string[]): Promise<string | null> {
  for (const uri of uriVariants) {
    try {
      const response = await fetchWithTimeout(uri, 5000); // 5s timeout for indexer
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        // Direct image
        if (contentType?.startsWith('image/') || uri.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
          return uri;
        }
        
        // Try to parse as JSON
        try {
          const text = await response.text();
          const metadata = JSON.parse(text);
          if (metadata && typeof metadata === 'object') {
            const imageUrl = extractImageURL(metadata);
            if (imageUrl) return imageUrl;
          }
        } catch (_) {
          // Not JSON, might still be an image
          if (uri.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
            return uri;
          }
        }
      }
    } catch (_) {
      continue;
    }
  }
  
  return null;
}

/**
 * Check if a string is a bytes32 hash
 */
function isBytes32Hash(str: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(str);
}

/**
 * Check if a hash is zero
 */
function isZeroHash(hash: string): boolean {
  return hash === '0x0000000000000000000000000000000000000000000000000000000000000000';
}

/**
 * Fetch artwork URL for a prize NFT
 * @param provider - Ethers provider
 * @param prizeCollection - Prize collection address
 * @param prizeTokenId - Prize token ID
 * @param standard - NFT standard (0=ERC721, 1=ERC1155)
 * @param isEscrowedPrize - Whether the prize is escrowed
 * @returns Artwork URL or null
 */
export async function fetchPrizeArtworkURL(
  provider: ethers.providers.Provider,
  prizeCollection: string,
  prizeTokenId: number,
  standard: number,
  isEscrowedPrize: boolean
): Promise<string | null> {
  try {
    const isMintable = !isEscrowedPrize;
    let baseUri: string | null = null;
    
    if (standard === 0) {
      // ERC721
      const contract = new ethers.Contract(prizeCollection, ERC721_URI_ABI, provider);
      
      if (isMintable) {
        // Try unrevealedBaseURI for mintable NFTs
        try {
          baseUri = await contract.unrevealedBaseURI();
          if (baseUri && isBytes32Hash(baseUri)) {
            baseUri = null; // Skip hash-based URIs (requires registry lookup)
          }
        } catch (_) {
          // Method doesn't exist
        }
      } else {
        // Try tokenURI for escrowed NFTs
        try {
          baseUri = await contract.tokenURI(prizeTokenId);
        } catch (_) {
          // Method doesn't exist
        }
      }
    } else if (standard === 1) {
      // ERC1155
      const contract = new ethers.Contract(prizeCollection, ERC1155_URI_ABI, provider);
      
      if (isMintable) {
        // Try unrevealedURI for mintable NFTs
        try {
          baseUri = await contract.unrevealedURI();
          if (baseUri && isBytes32Hash(baseUri)) {
            baseUri = null; // Skip hash-based URIs
          }
        } catch (_) {
          // Try tokenURI as fallback
          try {
            baseUri = await contract.tokenURI(prizeTokenId);
          } catch (_) {
            // Method doesn't exist
          }
        }
      } else {
        // Try uri() for escrowed NFTs
        try {
          baseUri = await contract.uri(prizeTokenId);
        } catch (_) {
          // Method doesn't exist
        }
      }
    }
    
    if (!baseUri || baseUri.trim() === '' || isBytes32Hash(baseUri)) {
      return null;
    }
    
    // Construct URI variants
    const uriVariants = constructMetadataURIs(baseUri, prizeTokenId, standard);
    
    // Convert all to HTTP URLs
    const allUrls: string[] = [];
    for (const variant of uriVariants) {
      allUrls.push(...convertToHTTP(variant));
    }
    
    // Fetch metadata and extract image URL
    const artworkUrl = await fetchMetadataWithFallback(allUrls);
    return artworkUrl;
  } catch (error) {
    console.warn(`Failed to fetch artwork for ${prizeCollection}:`, error);
    return null;
  }
}
