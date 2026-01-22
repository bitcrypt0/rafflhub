import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { contractABIs } from '../../../contracts/contractABIs'

/**
 * Shared hooks for raffle form functionality
 * Extracted from CreateRafflePage.jsx for reusability
 */

// IPFS gateways for decentralized URIs
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
]

const IPNS_GATEWAYS = IPFS_GATEWAYS.map(g => g.replace('/ipfs/', '/ipns/'))

const ARWEAVE_GATEWAYS = [
  'https://arweave.net/'
]

// Convert decentralized URIs to HTTP URLs
export const convertDecentralizedToHTTP = (uri) => {
  if (!uri) return []

  // IPFS (ipfs://)
  if (uri.startsWith('ipfs://')) {
    let hash = uri.replace('ipfs://', '')
    if (hash.startsWith('ipfs/')) hash = hash.slice('ipfs/'.length)
    return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`)
  }

  // IPNS (ipns://)
  if (uri.startsWith('ipns://')) {
    let name = uri.replace('ipns://', '')
    if (name.startsWith('ipns/')) name = name.slice('ipns/'.length)
    return IPNS_GATEWAYS.map(gateway => `${gateway}${name}`)
  }

  // Arweave (ar://)
  if (uri.startsWith('ar://')) {
    const id = uri.replace('ar://', '')
    return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`)
  }

  // If HTTP(s) to a known IPFS/IPNS/Arweave gateway, normalize and fan out
  try {
    const u = new URL(uri)
    let pathname = u.pathname.replace(/\/ipfs\/ipfs\//, '/ipfs/')
    const parts = pathname.split('/').filter(Boolean)

    const ipfsIndex = parts.indexOf('ipfs')
    if (ipfsIndex !== -1 && parts[ipfsIndex + 1]) {
      const hashAndRest = parts.slice(ipfsIndex + 1).join('/')
      return IPFS_GATEWAYS.map(gateway => `${gateway}${hashAndRest}`)
    }

    const ipnsIndex = parts.indexOf('ipns')
    if (ipnsIndex !== -1 && parts[ipnsIndex + 1]) {
      const nameAndRest = parts.slice(ipnsIndex + 1).join('/')
      return IPNS_GATEWAYS.map(gateway => `${gateway}${nameAndRest}`)
    }

    if (u.hostname.endsWith('arweave.net') || u.hostname === 'arweave.net') {
      const id = parts.join('/')
      return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`)
    }
  } catch (_) {
    // not a URL, fall through
  }

  return [uri]
}

// Extract image URL from metadata
export const extractImageURL = (metadata) => {
  const mediaFields = [
    'image',
    'image_url',
    'imageUrl',
    'animation_url',
    'animationUrl',
    'media',
    'artwork'
  ]

  for (const field of mediaFields) {
    if (metadata[field]) {
      const raw = metadata[field]
      if (typeof raw === 'string') {
        if (raw.startsWith('ipfs://') || raw.startsWith('ar://')) {
          return convertDecentralizedToHTTP(raw)
        }
        return [raw]
      }
    }
  }

  return null
}

// Simplified metadata URI construction
export const constructMetadataURIs = (baseUri) => {
  const uriVariants = []
  const hadTrailingSlash = /\/$/.test(baseUri)
  const cleanBaseUri = baseUri.replace(/\/$/, '')

  const alreadyContainsTokenId = baseUri.match(/\/(?:[0-9]+)(?:\.json)?$/)

  if (alreadyContainsTokenId) {
    uriVariants.push(baseUri)
    if (!baseUri.includes('.json')) {
      uriVariants.push(`${baseUri}.json`)
    }
    const root = cleanBaseUri.replace(/\/(?:[0-9]+)(?:\.json)?$/, '')
    if (root && root !== cleanBaseUri) {
      uriVariants.push(root)
      uriVariants.push(`${root}/`)
      uriVariants.push(`${root}.json`)
      uriVariants.push(`${root}/index.json`)
      uriVariants.push(`${root}/metadata.json`)
    }
  } else {
    uriVariants.push(baseUri)
    if (hadTrailingSlash) {
      uriVariants.push(cleanBaseUri)
    }
    if (!baseUri.includes('.json')) {
      uriVariants.push(`${baseUri}.json`)
      uriVariants.push(`${cleanBaseUri}.json`)
    }
    uriVariants.push(`${baseUri}index.json`)
    uriVariants.push(`${baseUri}metadata.json`)
    if (hadTrailingSlash) {
      uriVariants.push(`${cleanBaseUri}/index.json`)
      uriVariants.push(`${cleanBaseUri}/metadata.json`)
    }
  }

  return [...new Set(uriVariants)]
}

/**
 * Hook to fetch raffle limits from ProtocolManager
 */
export function useRaffleLimits(contracts, isPrized) {
  const [limits, setLimits] = useState({
    minSlot: undefined,
    maxSlot: undefined,
    minDuration: undefined,
    maxDuration: undefined,
    maxTicketsPerParticipant: undefined,
  })

  useEffect(() => {
    if (!contracts?.protocolManager) return

    async function fetchLimits() {
      try {
        const [slotLimits, durationLimits, maxSlots] = await Promise.all([
          contracts.protocolManager.getAllSlotLimits(),
          contracts.protocolManager.getDurationLimits(),
          contracts.protocolManager.getMaxSlotsPerAddress()
        ])

        if (isPrized) {
          setLimits({
            minSlot: slotLimits.minPrized?.toString(),
            maxSlot: slotLimits.max?.toString(),
            minDuration: durationLimits[0]?.toString(),
            maxDuration: durationLimits[1]?.toString(),
            maxTicketsPerParticipant: maxSlots.max?.toString(),
          })
        } else {
          setLimits({
            minSlot: slotLimits.minNonPrized?.toString(),
            maxSlot: slotLimits.max?.toString(),
            minDuration: durationLimits[0]?.toString(),
            maxDuration: durationLimits[1]?.toString(),
            maxTicketsPerParticipant: maxSlots.max?.toString(),
          })
        }
      } catch (e) {
        // fallback: do nothing
      }
    }

    fetchLimits()
  }, [contracts, isPrized])

  return limits
}

/**
 * Hook to check collection whitelist status
 */
export function useCollectionWhitelistStatus(address, contracts) {
  const [status, setStatus] = useState(null) // null | true | false
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check(addr) {
      if (!contracts?.protocolManager || !addr || addr.length !== 42) {
        setStatus(null)
        return
      }
      setChecking(true)
      try {
        const isWhite = await contracts.protocolManager.isCollectionApproved(addr)
        if (!cancelled) setStatus(isWhite)
      } catch (error) {
        console.warn('[useCollectionWhitelistStatus] Failed to check collection approval:', error.message)
        if (!cancelled) setStatus(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check(address)
    return () => { cancelled = true }
  }, [address, contracts])

  return { status, checking }
}

/**
 * Hook to check internal collection status
 */
export function useCollectionInternalStatus(address, contracts) {
  const [status, setStatus] = useState(null) // null | true | false
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check(addr) {
      if (!contracts?.protocolManager || !addr || addr.length !== 42) {
        setStatus(null)
        return
      }
      setChecking(true)
      try {
        const isInternal = await contracts.protocolManager.isInternalCollection(addr)
        if (!cancelled) setStatus(isInternal)
      } catch (error) {
        console.warn('[useCollectionInternalStatus] Failed to check internal collection:', error.message)
        if (!cancelled) setStatus(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check(address)
    return () => { cancelled = true }
  }, [address, contracts])

  return { status, checking }
}

/**
 * Hook to fetch artwork from collection URI
 */
export function useCollectionArtwork(collectionAddress, provider, contractABI = 'erc721Prize') {
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const queryCollectionURIs = async () => {
      if (!collectionAddress || !ethers.utils.isAddress(collectionAddress) || !provider) {
        setBackgroundImage(null)
        setImageLoading(false)
        return
      }

      try {
        const contract = new ethers.Contract(
          collectionAddress,
          contractABIs[contractABI],
          provider
        )

        let unrevealedBaseURI = null

        // Try to get unrevealedBaseURI/unrevealedURI
        try {
          if (contractABI === 'erc721Prize') {
            unrevealedBaseURI = await contract.unrevealedBaseURI()
          } else if (contractABI === 'erc1155Prize') {
            unrevealedBaseURI = await contract.getUnrevealedURI()
          }
        } catch (error) {
          // URI might not exist
        }

        // Only use unrevealedBaseURI
        if (unrevealedBaseURI && unrevealedBaseURI.trim() !== '') {
          await fetchArtworkFromURI(unrevealedBaseURI, setBackgroundImage, setImageLoading)
        } else {
          setBackgroundImage(null)
          setImageLoading(false)
        }
      } catch (error) {
        console.error('Error querying collection URIs:', error)
        setBackgroundImage(null)
        setImageLoading(false)
      }
    }

    queryCollectionURIs()
  }, [collectionAddress, provider, contractABI])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
    setImageLoading(false)
  }, [])

  const handleImageError = useCallback(() => {
    setImageLoading(false)
    setBackgroundImage(null)
  }, [])

  return {
    backgroundImage,
    imageLoading,
    imageLoaded,
    handleImageLoad,
    handleImageError
  }
}

// Fetch artwork from URI
async function fetchArtworkFromURI(uri, setBackgroundImage, setImageLoading) {
  if (!uri) return null

  setImageLoading(true)

  try {
    const uriVariants = constructMetadataURIs(uri)
    const allUrls = []
    for (const variant of uriVariants) {
      const converted = convertDecentralizedToHTTP(variant)
      allUrls.push(...converted)
    }

    for (const url of allUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json, text/plain, */*'
          }
        })

        if (response.ok) {
          const contentType = response.headers.get('content-type')

          try {
            const text = await response.text()
            const metadata = JSON.parse(text)

            if (metadata && typeof metadata === 'object') {
              const imageUrl = extractImageURL(metadata)

              if (imageUrl && imageUrl.length > 0) {
                const finalUrl = imageUrl[0]

                if (finalUrl.startsWith('ipfs://') || finalUrl.startsWith('ar://')) {
                  const converted = convertDecentralizedToHTTP(finalUrl)
                  if (converted.length > 0) {
                    setBackgroundImage(converted[0])
                    return converted[0]
                  }
                }

                setBackgroundImage(finalUrl)
                return finalUrl
              }
            }
          } catch (jsonError) {
            if (
              contentType?.startsWith('image/') ||
              url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)
            ) {
              setBackgroundImage(url)
              return url
            }
          }
        }
      } catch (error) {
        continue
      }
    }
  } catch (error) {
    console.error('Error fetching artwork:', error)
  } finally {
    setImageLoading(false)
  }

  return null
}

/**
 * Utility function for token approval check
 */
export async function checkTokenApproval(signer, tokenAddress, prizeType, spender, amount, tokenId) {
  try {
    const userAddress = await signer.getAddress()
    let contract

    if (prizeType === 'erc20') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc20, signer)
      const requiredAmount = ethers.BigNumber.from(amount || '0')
      try {
        const allowance = await contract.allowance(userAddress, spender)
        return allowance.gte(requiredAmount)
      } catch (error) {
        // Try event-based fallback
        const provider = signer.provider
        if (provider) {
          try {
            const currentBlock = await provider.getBlockNumber()
            const fromBlock = Math.max(0, currentBlock - 10000)
            const filter = contract.filters.Approval(userAddress, spender)
            const logs = await contract.queryFilter(filter, fromBlock, currentBlock)
            for (const log of logs) {
              const approvalAmount = ethers.BigNumber.from(log.data)
              if (approvalAmount.gte(requiredAmount)) {
                return true
              }
            }
          } catch (error) {
            // fallback failed, ignore
          }
        }
        return false
      }
    } else if (prizeType === 'erc721') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc721Prize, signer)
      // Check if collection is approved for all first
      try {
        const isApprovedForAll = await contract.isApprovedForAll(userAddress, spender)
        if (isApprovedForAll) {
          return true
        }
      } catch (error) {
        // isApprovedForAll not supported, continue
      }
      // Fallback to individual token approval check
      const approved = await contract.getApproved(tokenId)
      return approved && approved.toLowerCase() === spender.toLowerCase()
    } else if (prizeType === 'erc1155') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc1155Prize, signer)
      return await contract.isApprovedForAll(userAddress, spender)
    }
    return false
  } catch (error) {
    return false
  }
}

/**
 * Utility function for token approval
 */
export async function approveToken({ signer, tokenAddress, prizeType, spender, amount, tokenId }) {
  try {
    // Check for existing approval
    const isAlreadyApproved = await checkTokenApproval(signer, tokenAddress, prizeType, spender, amount, tokenId)
    if (isAlreadyApproved) {
      return { success: true, alreadyApproved: true }
    }

    let contract, tx
    if (prizeType === 'erc20') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc20, signer)
      const approvalAmount = ethers.constants.MaxUint256
      tx = await contract.approve(spender, approvalAmount)
    } else if (prizeType === 'erc721') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc721Prize, signer)
      try {
        tx = await contract.setApprovalForAll(spender, true)
      } catch (setApprovalError) {
        if (setApprovalError.code === 4001) {
          throw setApprovalError
        }
        console.log('setApprovalForAll failed, falling back to individual approval:', setApprovalError.message)
        tx = await contract.approve(spender, tokenId)
      }
    } else if (prizeType === 'erc1155') {
      contract = new ethers.Contract(tokenAddress, contractABIs.erc1155Prize, signer)
      tx = await contract.setApprovalForAll(spender, true)
    }

    await tx.wait()
    await new Promise(res => setTimeout(res, 2000))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Utility to extract only the revert reason from contract errors
 */
export function extractRevertReason(error) {
  if (error?.reason) return error.reason
  if (error?.data?.message) return error.data.message
  const msg = error?.message || error?.data?.message || error?.toString() || ''
  const match = msg.match(/execution reverted:?\s*([^\n]*)/i)
  if (match && match[1]) return match[1].trim()
  return msg
}
