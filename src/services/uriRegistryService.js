/**
 * URI Registry Service
 * 
 * Provides hash-based URI resolution for NFT metadata.
 * Supports multiple resolution strategies:
 * 1. Local storage cache (for testing/development)
 * 2. Event-based resolution from blockchain events
 * 3. Future: Off-chain database mapping
 * 
 * URIs are stored as hashes (bytes32) in smart contracts for gas optimization.
 * This service resolves those hashes back to full URI strings.
 */

import { ethers } from 'ethers'

// Storage keys
const STORAGE_KEY = 'fairpad_uri_registry'
const COLLECTION_URIS_KEY = 'fairpad_collection_uris'

/**
 * Compute keccak256 hash of a URI string
 * @param {string} uri - The URI string to hash
 * @returns {string} The bytes32 hash
 */
export function computeURIHash(uri) {
  if (!uri || uri.trim() === '') {
    return ethers.constants.HashZero
  }
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(uri))
}

/**
 * Check if a value is a bytes32 hash (66 chars starting with 0x)
 * @param {string} value - The value to check
 * @returns {boolean} True if it's a valid bytes32 hash
 */
export function isBytes32Hash(value) {
  if (!value || typeof value !== 'string') return false
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

/**
 * Check if a hash is the zero hash
 * @param {string} hash - The hash to check
 * @returns {boolean} True if it's the zero hash
 */
export function isZeroHash(hash) {
  return hash === ethers.constants.HashZero || 
         hash === '0x0000000000000000000000000000000000000000000000000000000000000000'
}

// ============================================================================
// LOCAL STORAGE REGISTRY (for testing/development)
// ============================================================================

/**
 * Get the URI registry from localStorage
 * @returns {Object} The registry object { hash: uri }
 */
function getRegistry() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.warn('[URIRegistry] Failed to read from localStorage:', error)
    return {}
  }
}

/**
 * Save the URI registry to localStorage
 * @param {Object} registry - The registry object to save
 */
function saveRegistry(registry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry))
  } catch (error) {
    console.warn('[URIRegistry] Failed to save to localStorage:', error)
  }
}

/**
 * Register a URI and its hash in local storage
 * @param {string} uri - The URI string
 * @returns {string} The computed hash
 */
export function registerURI(uri) {
  if (!uri || uri.trim() === '') {
    return ethers.constants.HashZero
  }
  
  const hash = computeURIHash(uri)
  const registry = getRegistry()
  
  // Only store if not already registered
  if (!registry[hash]) {
    registry[hash] = uri
    saveRegistry(registry)
    console.log('[URIRegistry] Registered URI:', { hash: hash.slice(0, 10) + '...', uri: uri.slice(0, 50) + '...' })
  }
  
  return hash
}

/**
 * Resolve a hash to its URI from local storage
 * @param {string} hash - The bytes32 hash
 * @returns {string|null} The URI or null if not found
 */
export function resolveURIFromStorage(hash) {
  if (!hash || isZeroHash(hash)) return null
  
  const registry = getRegistry()
  return registry[hash] || null
}

/**
 * Batch register multiple URIs
 * @param {Array<string>} uris - Array of URI strings
 * @returns {Array<{uri: string, hash: string}>} Array of registered URIs with their hashes
 */
export function batchRegisterURIs(uris) {
  const results = []
  const registry = getRegistry()
  let updated = false
  
  for (const uri of uris) {
    if (uri && uri.trim() !== '') {
      const hash = computeURIHash(uri)
      if (!registry[hash]) {
        registry[hash] = uri
        updated = true
      }
      results.push({ uri, hash })
    }
  }
  
  if (updated) {
    saveRegistry(registry)
  }
  
  return results
}

// ============================================================================
// COLLECTION-SPECIFIC URI STORAGE
// ============================================================================

/**
 * Get collection URIs storage
 * @returns {Object} The collection URIs object { collectionAddress: { dropURI, unrevealedURI } }
 */
function getCollectionURIs() {
  try {
    const stored = localStorage.getItem(COLLECTION_URIS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.warn('[URIRegistry] Failed to read collection URIs:', error)
    return {}
  }
}

/**
 * Save collection URIs storage
 * @param {Object} collectionURIs - The collection URIs object to save
 */
function saveCollectionURIs(collectionURIs) {
  try {
    localStorage.setItem(COLLECTION_URIS_KEY, JSON.stringify(collectionURIs))
  } catch (error) {
    console.warn('[URIRegistry] Failed to save collection URIs:', error)
  }
}

/**
 * Store URIs for a specific collection address
 * @param {string} collectionAddress - The collection contract address
 * @param {Object} uris - Object containing { dropURI, unrevealedURI, dropURIHash, unrevealedURIHash }
 */
export function storeCollectionURIs(collectionAddress, uris) {
  if (!collectionAddress || !ethers.utils.isAddress(collectionAddress)) {
    console.warn('[URIRegistry] Invalid collection address')
    return
  }
  
  const normalizedAddress = collectionAddress.toLowerCase()
  const collectionURIs = getCollectionURIs()
  
  collectionURIs[normalizedAddress] = {
    dropURI: uris.dropURI || '',
    unrevealedURI: uris.unrevealedURI || '',
    dropURIHash: uris.dropURIHash || computeURIHash(uris.dropURI || ''),
    unrevealedURIHash: uris.unrevealedURIHash || computeURIHash(uris.unrevealedURI || ''),
    timestamp: Date.now()
  }
  
  saveCollectionURIs(collectionURIs)
  
  // Also register in the global hash registry
  if (uris.dropURI) registerURI(uris.dropURI)
  if (uris.unrevealedURI) registerURI(uris.unrevealedURI)
  
  console.log('[URIRegistry] Stored collection URIs:', normalizedAddress)
}

/**
 * Get stored URIs for a collection
 * @param {string} collectionAddress - The collection contract address
 * @returns {Object|null} The stored URIs or null if not found
 */
export function getStoredCollectionURIs(collectionAddress) {
  if (!collectionAddress || !ethers.utils.isAddress(collectionAddress)) {
    return null
  }
  
  const normalizedAddress = collectionAddress.toLowerCase()
  const collectionURIs = getCollectionURIs()
  
  return collectionURIs[normalizedAddress] || null
}

// ============================================================================
// EVENT-BASED RESOLUTION
// ============================================================================

/**
 * Fetch URIs from CollectionURIsSet event for a specific collection
 * @param {string} collectionAddress - The collection contract address
 * @param {Object} nftFactoryContract - The NFTFactory contract instance
 * @param {Object} provider - The ethers provider
 * @returns {Promise<Object|null>} The URIs from events or null
 */
export async function resolveURIsFromEvents(collectionAddress, nftFactoryContract, provider) {
  if (!collectionAddress || !nftFactoryContract || !provider) {
    return null
  }
  
  try {
    // Get the CollectionURIsSet event filter
    const filter = nftFactoryContract.filters.CollectionURIsSet(collectionAddress)
    
    // Query events from the last 10000 blocks (adjust as needed)
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 10000)
    
    const events = await nftFactoryContract.queryFilter(filter, fromBlock, currentBlock)
    
    if (events.length > 0) {
      // Get the most recent event
      const latestEvent = events[events.length - 1]
      const { dropURI, unrevealedURI, dropURIHash, unrevealedURIHash } = latestEvent.args
      
      // Store in local cache for future use
      storeCollectionURIs(collectionAddress, {
        dropURI,
        unrevealedURI,
        dropURIHash,
        unrevealedURIHash
      })
      
      return {
        dropURI,
        unrevealedURI,
        dropURIHash,
        unrevealedURIHash,
        source: 'event'
      }
    }
    
    return null
  } catch (error) {
    console.warn('[URIRegistry] Failed to resolve URIs from events:', error)
    return null
  }
}

// ============================================================================
// UNIFIED RESOLUTION
// ============================================================================

/**
 * Resolve a URI from a hash using all available strategies
 * Priority: 1. Local storage, 2. Collection-specific storage, 3. Events
 * 
 * @param {string} hash - The bytes32 hash to resolve
 * @param {Object} options - Optional resolution options
 * @param {string} options.collectionAddress - Collection address for collection-specific lookup
 * @param {string} options.uriType - 'dropURI' or 'unrevealedURI' for collection lookup
 * @param {Object} options.nftFactoryContract - NFTFactory contract for event lookup
 * @param {Object} options.provider - Ethers provider for event lookup
 * @returns {Promise<string|null>} The resolved URI or null
 */
export async function resolveURIOrHash(hash, options = {}) {
  // Return null for zero hash
  if (!hash || isZeroHash(hash)) {
    return null
  }
  
  // Strategy 1: Check global hash registry
  const fromStorage = resolveURIFromStorage(hash)
  if (fromStorage) {
    return fromStorage
  }
  
  // Strategy 2: Check collection-specific storage
  if (options.collectionAddress && options.uriType) {
    const collectionURIs = getStoredCollectionURIs(options.collectionAddress)
    if (collectionURIs) {
      const uri = collectionURIs[options.uriType]
      if (uri && computeURIHash(uri) === hash) {
        return uri
      }
    }
  }
  
  // Strategy 3: Try to resolve from events
  if (options.collectionAddress && options.nftFactoryContract && options.provider) {
    const eventURIs = await resolveURIsFromEvents(
      options.collectionAddress,
      options.nftFactoryContract,
      options.provider
    )
    
    if (eventURIs) {
      // Check if the requested hash matches any of the event URIs
      if (options.uriType === 'dropURI' && eventURIs.dropURIHash === hash) {
        return eventURIs.dropURI
      }
      if (options.uriType === 'unrevealedURI' && eventURIs.unrevealedURIHash === hash) {
        return eventURIs.unrevealedURI
      }
      // Also check by computing hash
      if (eventURIs.dropURI && computeURIHash(eventURIs.dropURI) === hash) {
        return eventURIs.dropURI
      }
      if (eventURIs.unrevealedURI && computeURIHash(eventURIs.unrevealedURI) === hash) {
        return eventURIs.unrevealedURI
      }
    }
  }
  
  return null
}

/**
 * Get the unrevealed URI for a collection, trying multiple resolution strategies
 * @param {string} collectionAddress - The collection contract address
 * @param {Object} contract - The collection contract instance
 * @param {Object} options - Resolution options (nftFactoryContract, provider)
 * @returns {Promise<string|null>} The unrevealed URI or null
 */
export async function getUnrevealedURI(collectionAddress, contract, options = {}) {
  // Strategy 1: Try to get URI string directly from contract
  try {
    // Try unrevealedBaseURI (ERC721)
    if (typeof contract.unrevealedBaseURI === 'function') {
      const uri = await contract.unrevealedBaseURI()
      if (uri && uri.trim() !== '' && !isBytes32Hash(uri)) {
        return uri
      }
    }
  } catch (e) {}
  
  try {
    // Try getUnrevealedURI (ERC1155)
    if (typeof contract.getUnrevealedURI === 'function') {
      const uri = await contract.getUnrevealedURI()
      if (uri && uri.trim() !== '' && !isBytes32Hash(uri)) {
        return uri
      }
    }
  } catch (e) {}
  
  try {
    // Try unrevealedURI
    if (typeof contract.unrevealedURI === 'function') {
      const uri = await contract.unrevealedURI()
      if (uri && uri.trim() !== '' && !isBytes32Hash(uri)) {
        return uri
      }
    }
  } catch (e) {}
  
  // Strategy 2: Try to get hash and resolve it
  try {
    if (typeof contract.unrevealedURIHash === 'function') {
      const hash = await contract.unrevealedURIHash()
      if (hash && !isZeroHash(hash)) {
        const resolved = await resolveURIOrHash(hash, {
          collectionAddress,
          uriType: 'unrevealedURI',
          ...options
        })
        if (resolved) return resolved
      }
    }
  } catch (e) {}
  
  // Strategy 3: Check local collection storage
  const storedURIs = getStoredCollectionURIs(collectionAddress)
  if (storedURIs?.unrevealedURI) {
    return storedURIs.unrevealedURI
  }
  
  return null
}

/**
 * Get the drop URI for a collection, trying multiple resolution strategies
 * @param {string} collectionAddress - The collection contract address
 * @param {Object} contract - The collection contract instance
 * @param {Object} options - Resolution options (nftFactoryContract, provider)
 * @returns {Promise<string|null>} The drop URI or null
 */
export async function getDropURI(collectionAddress, contract, options = {}) {
  // Strategy 1: Try to get URI string directly from contract
  try {
    if (typeof contract.dropURI === 'function') {
      const uri = await contract.dropURI()
      if (uri && uri.trim() !== '' && !isBytes32Hash(uri)) {
        return uri
      }
    }
  } catch (e) {}
  
  // Strategy 2: Try to get hash and resolve it
  try {
    if (typeof contract.dropURIHash === 'function') {
      const hash = await contract.dropURIHash()
      if (hash && !isZeroHash(hash)) {
        const resolved = await resolveURIOrHash(hash, {
          collectionAddress,
          uriType: 'dropURI',
          ...options
        })
        if (resolved) return resolved
      }
    }
  } catch (e) {}
  
  // Strategy 3: Check local collection storage
  const storedURIs = getStoredCollectionURIs(collectionAddress)
  if (storedURIs?.dropURI) {
    return storedURIs.dropURI
  }
  
  return null
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export default {
  computeURIHash,
  isBytes32Hash,
  isZeroHash,
  registerURI,
  resolveURIFromStorage,
  batchRegisterURIs,
  storeCollectionURIs,
  getStoredCollectionURIs,
  resolveURIsFromEvents,
  resolveURIOrHash,
  getUnrevealedURI,
  getDropURI
}
