import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gift,
  Image,
  Star,
  Info,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Link as LinkIcon,
  Package,
  Percent,
  User,
  FileText,
  Clock,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { useContract } from '../contexts/ContractContext'
import { toast } from '../components/ui/sonner'
import { ethers } from 'ethers'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog'
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints'
import { PageHero } from '../components/forms/PageHero'
import { FormSection } from '../components/forms/FormSection'
import { FormField } from '../components/forms/FormField'
import { AddressInput } from '../components/forms/AddressInput'
import { SummaryCard } from '../components/forms/SummaryCard'
import { CollectionPreviewCard, RevealTypeSelector } from '../components/forms/collection'

const DeployCollectionPageV2 = () => {
  const { connected, address, provider } = useWallet()
  const { contracts } = useContract()
  const { isMobile, isTablet } = useMobileBreakpoints()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [collectionType, setCollectionType] = useState('ERC721')
  const [showSummary, setShowSummary] = useState(false)
  const [deployedCollectionAddress, setDeployedCollectionAddress] = useState(null)

  // Artwork state
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Form state for ERC721
  const [erc721FormData, setErc721FormData] = useState({
    name: '',
    symbol: '',
    baseURI: '',
    dropURI: '',
    royaltyPercentage: '',
    royaltyRecipient: address || '',
    maxSupply: '',
    revealType: '0',
    unrevealedBaseURI: '',
    revealTime: '',
  })

  // Form state for ERC1155
  const [erc1155FormData, setErc1155FormData] = useState({
    name: '',
    symbol: '',
    baseURI: '',
    dropURI: '',
    royaltyPercentage: '',
    royaltyRecipient: address || '',
    maxSupply: '0',
    revealType: '0',
    unrevealedBaseURI: '',
    revealTime: '',
  })

  // Current form data based on collection type
  const currentFormData = collectionType === 'ERC721' ? erc721FormData : erc1155FormData
  const setCurrentFormData = collectionType === 'ERC721' ? setErc721FormData : setErc1155FormData

  useEffect(() => {
    if (address && !erc721FormData.royaltyRecipient) {
      setErc721FormData(prev => ({ ...prev, royaltyRecipient: address }))
      setErc1155FormData(prev => ({ ...prev, royaltyRecipient: address }))
    }
  }, [address])

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
  const convertDecentralizedToHTTP = useCallback((uri) => {
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

    // HTTP URLs - try to extract IPFS/IPNS/Arweave
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

      if (u.hostname.endsWith('arweave.net')) {
        const id = parts.join('/')
        return ARWEAVE_GATEWAYS.map(gateway => `${gateway}${id}`)
      }
    } catch {
      // not a URL
    }

    return [uri]
  }, [])

  // Extract image URL from metadata
  const extractImageURL = useCallback((metadata) => {
    const mediaFields = ['image', 'image_url', 'imageUrl', 'animation_url', 'animationUrl', 'media', 'artwork']

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
  }, [convertDecentralizedToHTTP])

  // Construct metadata URIs
  const constructMetadataURIs = useCallback((baseUri) => {
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
        uriVariants.push(root, `${root}/`, `${root}.json`, `${root}/.json`, `${root}/index.json`, `${root}/metadata.json`)
      }
    } else {
      uriVariants.push(baseUri)
      if (hadTrailingSlash) uriVariants.push(cleanBaseUri)
      if (!baseUri.includes('.json')) {
        uriVariants.push(`${baseUri}.json`, `${cleanBaseUri}.json`)
      }
      uriVariants.push(`${baseUri}index.json`, `${baseUri}metadata.json`)
      if (hadTrailingSlash) {
        uriVariants.push(`${cleanBaseUri}/index.json`, `${cleanBaseUri}/metadata.json`)
      }
    }

    return [...new Set(uriVariants)]
  }, [])

  // Fetch artwork from URI
  const fetchArtwork = useCallback(async (uri) => {
    if (!uri) return null

    setImageLoading(true)
    setImageError(false)

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
            headers: { 'Accept': 'application/json, text/plain, */*' }
          })

          if (response.ok) {
            const contentType = response.headers.get('content-type')

            try {
              const text = await response.text()
              const metadata = JSON.parse(text)

              if (metadata && typeof metadata === 'object') {
                const imageUrl = extractImageURL(metadata)
                if (imageUrl && imageUrl.length > 0) {
                  let finalUrl = imageUrl[0]
                  if (finalUrl.startsWith('ipfs://') || finalUrl.startsWith('ar://')) {
                    const converted = convertDecentralizedToHTTP(finalUrl)
                    if (converted.length > 0) finalUrl = converted[0]
                  }
                  setBackgroundImage(finalUrl)
                  setImageLoading(false)
                  return finalUrl
                }
              }
            } catch {
              if (contentType?.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
                setBackgroundImage(url)
                setImageLoading(false)
                return url
              }
            }
          }
        } catch {
          continue
        }
      }
    } catch (error) {
      console.error('Error fetching artwork:', error)
    }

    setImageLoading(false)
    return null
  }, [constructMetadataURIs, convertDecentralizedToHTTP, extractImageURL])

  // Handle Drop URI change
  useEffect(() => {
    const dropURI = currentFormData.dropURI
    const unrevealedURI = currentFormData.unrevealedBaseURI

    if (dropURI && dropURI.trim() !== '') {
      fetchArtwork(dropURI)
    } else if (unrevealedURI && unrevealedURI.trim() !== '') {
      fetchArtwork(unrevealedURI)
    } else {
      setBackgroundImage(null)
    }
  }, [currentFormData.dropURI, currentFormData.unrevealedBaseURI, fetchArtwork])

  const handleChange = (field, value) => {
    setCurrentFormData(prev => ({ ...prev, [field]: value }))
  }

  // Validation
  const validateForm = useMemo(() => {
    const errors = []
    const formData = currentFormData

    if (!formData.name?.trim()) errors.push('Collection name is required')
    if (!formData.symbol?.trim()) errors.push('Symbol is required')
    if (!formData.baseURI?.trim()) errors.push('Base URI is required')
    if (collectionType === 'ERC721' && !formData.maxSupply) errors.push('Max supply is required for ERC721')
    if (!formData.royaltyRecipient?.trim() || !ethers.utils.isAddress(formData.royaltyRecipient)) {
      errors.push('Valid royalty recipient address is required')
    }
    if ((formData.revealType === '1' || formData.revealType === '2') && !formData.unrevealedBaseURI?.trim()) {
      errors.push('Unrevealed Base URI is required for delayed reveal')
    }
    if (formData.revealType === '2' && !formData.revealTime) {
      errors.push('Reveal time is required for scheduled reveal')
    }

    return errors
  }, [currentFormData, collectionType])

  // Summary data
  const summaryData = useMemo(() => {
    const formData = currentFormData
    const revealLabels = { '0': 'Instant', '1': 'Manual', '2': 'Scheduled' }

    return [
      { label: 'Collection Name', value: formData.name || '—', icon: FileText },
      { label: 'Symbol', value: formData.symbol ? `$${formData.symbol.toUpperCase()}` : '—', icon: FileText },
      { label: 'Collection Type', value: collectionType, icon: collectionType === 'ERC721' ? Image : Star },
      { label: 'Max Supply', value: formData.maxSupply === '0' || !formData.maxSupply ? 'Unlimited' : formData.maxSupply, icon: Package },
      { label: 'Royalty', value: formData.royaltyPercentage ? `${formData.royaltyPercentage}%` : '0%', icon: Percent },
      { label: 'Royalty Recipient', value: formData.royaltyRecipient ? `${formData.royaltyRecipient.slice(0, 10)}...${formData.royaltyRecipient.slice(-8)}` : '—', icon: User },
      { label: 'Base URI', value: formData.baseURI ? `${formData.baseURI.slice(0, 30)}...` : '—', icon: LinkIcon, link: formData.baseURI },
      { label: 'Reveal Type', value: revealLabels[formData.revealType] || 'Instant', icon: Clock },
    ]
  }, [currentFormData, collectionType])

  const deployCollection = async () => {
    if (!connected || !contracts.nftFactory || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured')
      return
    }

    setLoading(true)
    try {
      const signer = provider.getSigner()
      const formData = currentFormData
      const isERC721 = collectionType === 'ERC721'
      const standard = isERC721 ? 0 : 1

      let revealType = parseInt(formData.revealType)
      let unrevealedBaseURI = formData.unrevealedBaseURI
      let revealTime = 0

      if (revealType === 2) {
        revealTime = Math.floor(new Date(formData.revealTime).getTime() / 1000)
      }

      if (revealType === 0) {
        unrevealedBaseURI = ''
        revealTime = 0
      }

      const tx = await contracts.nftFactory.connect(signer).deployCollection(
        standard,
        formData.name,
        formData.symbol,
        formData.baseURI,
        formData.dropURI || '',
        address,
        formData.royaltyPercentage ? parseInt(formData.royaltyPercentage) * 100 : 0,
        formData.royaltyRecipient,
        parseInt(formData.maxSupply || '0'),
        revealType,
        unrevealedBaseURI,
        revealTime
      )
      const receipt = await tx.wait()

      // Extract collection address from PrizeCollectionCreated event
      const collectionCreatedEvent = receipt.events.find(e => e.event === 'PrizeCollectionCreated')
      const collectionAddress = collectionCreatedEvent?.args?.collection || collectionCreatedEvent?.args?.[0]

      if (collectionAddress) {
        setDeployedCollectionAddress(collectionAddress)
        console.log('Collection deployed at:', collectionAddress)
      }

      toast.success(`${isERC721 ? 'ERC721' : 'ERC1155'} collection deployed successfully!`)
      setShowSummary(false)
    } catch (error) {
      console.error('Error deploying collection:', error)
      toast.error(error.message || 'Failed to deploy collection')
    } finally {
      setLoading(false)
    }
  }

  // Handle copying collection address to clipboard
  const handleCopyAddress = async () => {
    if (!deployedCollectionAddress) return

    try {
      await navigator.clipboard.writeText(deployedCollectionAddress)
      toast.success('Collection address copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy address')
    }
  }

  // Handle deploying another collection (reset form)
  const handleDeployAnother = () => {
    setDeployedCollectionAddress(null)
    const isERC721 = collectionType === 'ERC721'
    setCurrentFormData({
      name: '',
      symbol: '',
      baseURI: '',
      dropURI: '',
      royaltyPercentage: '',
      royaltyRecipient: address || '',
      maxSupply: isERC721 ? '' : '0',
      revealType: '0',
      unrevealedBaseURI: '',
      revealTime: '',
    })
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Gift className={`mx-auto mb-4 text-muted-foreground ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
          <h2 className={`font-bold mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>Connect Your Wallet</h2>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
            Please connect your wallet to deploy NFT collections.
          </p>
        </div>
      </div>
    )
  }

  const isDesktop = !isMobile && !isTablet

  // Show success state after collection deployment
  if (deployedCollectionAddress) {
    return (
      <div className="min-h-screen bg-background pb-6 relative">
        <div className={`${isMobile ? 'px-4' : 'container mx-auto px-8'} pt-8 pb-4 relative z-10`}>
          <div className="max-w-3xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h2 className="font-display text-2xl font-bold mb-2">Collection Deployed Successfully!</h2>
                  <p className="text-muted-foreground">
                    Your {collectionType} collection has been deployed to the blockchain.
                  </p>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Collection Address</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <p className="font-mono text-sm break-all">{deployedCollectionAddress}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyAddress}
                      className="shrink-0"
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="primary"
                    onClick={() => navigate('/create-raffle', {
                      state: {
                        fromDeployment: true,
                        collectionType: collectionType,
                        collectionAddress: deployedCollectionAddress
                      }
                    })}
                  >
                    Create Drop Event
                  </Button>
                  <Button variant="secondary" onClick={handleDeployAnother}>
                    Back
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6 relative">
      {/* Background Image Overlay */}
      {backgroundImage && (
        <div
          className="absolute inset-0 top-0 left-0 w-full h-1/3 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'blur(2px) brightness(1.1)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          }}
        />
      )}

      <div className={`${isMobile ? 'px-4' : 'container mx-auto px-8'} pt-8 pb-4 relative z-10`}>
        {/* Page Header - Centered like LandingPage */}
        <div className="text-center mb-12">
          <h1 className="font-display text-[length:var(--text-4xl)] font-bold mb-4 leading-tight tracking-tighter">
            Deploy NFT Collection
          </h1>
          <p className="font-body text-[length:var(--text-lg)] text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            This is where it all begins. Create the collection for your drop event below.
          </p>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className={`${isDesktop ? 'grid grid-cols-5 gap-8' : 'flex flex-col gap-6'} max-w-6xl mx-auto mt-8`}>
          {/* Form Column */}
          <div className={isDesktop ? 'col-span-3' : ''}>
            <Tabs value={collectionType} onValueChange={setCollectionType} className="w-full">
              <TabsList className={`w-full flex items-center justify-center gap-2 ${isMobile ? 'p-1.5 h-12 mb-6' : 'p-1 h-10 mb-6'} bg-muted/80 border border-border/50 shadow-sm rounded-xl`}>
                <TabsTrigger
                  value="ERC721"
                  className={`flex items-center gap-2 flex-1 data-[state=active]:bg-background data-[state=active]:border-primary/20 data-[state=active]:shadow-md transition-all rounded-lg ${isMobile ? 'h-9 text-sm' : 'h-[calc(100%-1px)]'}`}
                >
                  <Image className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                  <span className="font-medium">{isMobile ? 'ERC721' : 'ERC721 Collection'}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ERC1155"
                  className={`flex items-center gap-2 flex-1 data-[state=active]:bg-background data-[state=active]:border-primary/20 data-[state=active]:shadow-md transition-all rounded-lg ${isMobile ? 'h-9 text-sm' : 'h-[calc(100%-1px)]'}`}
                >
                  <Star className={`${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                  <span className="font-medium">{isMobile ? 'ERC1155' : 'ERC1155 Collection'}</span>
                </TabsTrigger>
              </TabsList>

              {/* Form Content - Shared between both types */}
              <TabsContent value={collectionType} forceMount className={collectionType !== collectionType ? 'hidden' : ''}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl overflow-hidden"
                >
                  {/* Basic Info Section */}
                  <FormSection
                    title="Basic Information"
                    icon={FileText}
                    defaultOpen={true}
                    variant="bordered"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        label="Collection Name"
                        required
                      >
                        <Input
                          type="text"
                          value={currentFormData.name}
                          onChange={e => handleChange('name', e.target.value)}
                          placeholder="My Awesome Collection"
                          required
                        />
                      </FormField>

                      <FormField
                        label="Symbol"
                        required
                        helperText="Short identifier (max 10 characters)"
                      >
                        <Input
                          type="text"
                          value={currentFormData.symbol}
                          onChange={e => handleChange('symbol', e.target.value.toUpperCase())}
                          placeholder="MAC"
                          maxLength={10}
                          className="uppercase"
                          required
                        />
                      </FormField>
                    </div>
                  </FormSection>

                  {/* URI Configuration Section */}
                  <FormSection
                    title="URI Configuration"
                    icon={LinkIcon}
                    defaultOpen={true}
                    variant="bordered"
                  >
                    <div className="space-y-4">
                      <FormField
                        label="Base URI"
                        required
                        helperText="Metadata endpoint for your NFTs (e.g., ipfs://..., https://api.example.com/)"
                      >
                        <Input
                          type="text"
                          value={currentFormData.baseURI}
                          onChange={e => handleChange('baseURI', e.target.value)}
                          placeholder="ipfs://QmXxx... or https://api.example.com/metadata/"
                          className="font-mono text-sm"
                          required
                        />
                      </FormField>

                      <FormField
                        label="Drop URI"
                        tooltip="Optional URI for your collection's drop page artwork. Used for preview."
                      >
                        <Input
                          type="text"
                          value={currentFormData.dropURI}
                          onChange={e => handleChange('dropURI', e.target.value)}
                          placeholder="ipfs://QmXxx... for preview artwork"
                          className="font-mono text-sm"
                        />
                      </FormField>
                    </div>
                  </FormSection>

                  {/* Supply & Royalties Section */}
                  <FormSection
                    title="Supply & Royalties"
                    icon={Package}
                    defaultOpen={true}
                    variant="bordered"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        label="Max Supply"
                        required={collectionType === 'ERC721'}
                        helperText={collectionType === 'ERC1155' ? 'Set to 0 for unlimited supply' : undefined}
                      >
                        <Input
                          type="number"
                          value={currentFormData.maxSupply}
                          onChange={e => handleChange('maxSupply', e.target.value)}
                          onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                          placeholder={collectionType === 'ERC1155' ? '0 (unlimited)' : '10000'}
                          min={collectionType === 'ERC1155' ? '0' : '1'}
                          required={collectionType === 'ERC721'}
                        />
                      </FormField>

                      <FormField
                        label="Royalty Percentage"
                        tooltip="Secondary sale royalty (e.g., 5 for 5%)"
                      >
                        <Input
                          type="number"
                          value={currentFormData.royaltyPercentage}
                          onChange={e => handleChange('royaltyPercentage', e.target.value)}
                          onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                          placeholder="5"
                          min="0"
                          max="10"
                          step="0.01"
                        />
                      </FormField>

                      <div className="md:col-span-2">
                        <FormField
                          label="Royalty Recipient"
                          required
                        >
                          <AddressInput
                            value={currentFormData.royaltyRecipient}
                            onChange={value => handleChange('royaltyRecipient', value)}
                            placeholder="0x..."
                            required
                          />
                        </FormField>
                      </div>
                    </div>
                  </FormSection>

                  {/* Reveal Settings Section */}
                  <FormSection
                    title="Reveal Settings"
                    icon={Clock}
                    defaultOpen={true}
                    variant="bordered"
                  >
                    <div className="space-y-4">
                      <Label className="block text-sm font-medium mb-3">Reveal Type</Label>
                      <RevealTypeSelector
                        value={currentFormData.revealType}
                        onValueChange={value => handleChange('revealType', value)}
                      />

                      <AnimatePresence>
                        {(currentFormData.revealType === '1' || currentFormData.revealType === '2') && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4 pt-4"
                          >
                            <FormField
                              label="Unrevealed Base URI"
                              required
                              helperText="Metadata to show before reveal (placeholder image)"
                            >
                              <Input
                                type="text"
                                value={currentFormData.unrevealedBaseURI}
                                onChange={e => handleChange('unrevealedBaseURI', e.target.value)}
                                placeholder="ipfs://QmXxx... for unrevealed metadata"
                                className="font-mono text-sm"
                                required
                              />
                            </FormField>

                            {currentFormData.revealType === '2' && (
                              <FormField
                                label="Reveal Time"
                                required
                              >
                                <Input
                                  type="datetime-local"
                                  value={currentFormData.revealTime}
                                  onChange={e => handleChange('revealTime', e.target.value)}
                                  required
                                />
                              </FormField>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </FormSection>

                  {/* Submit Button */}
                  <div className="p-6 border-t border-border/30 bg-muted/20">
                    <Button
                      type="button"
                      onClick={() => setShowSummary(true)}
                      disabled={loading || validateForm.length > 0}
                      variant="primary"
                      size="lg"
                      className="w-full text-base h-12"
                    >
                      Review & Deploy
                    </Button>
                    {validateForm.length > 0 && (
                      <div className="mt-3 text-sm text-destructive flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{validateForm[0]}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Column - Hidden on mobile, shows SummaryCard when reviewing */}
          {!isMobile && (
            <div className={isDesktop ? 'col-span-2' : ''}>
              {showSummary ? (
                <div className={isDesktop ? 'sticky top-24' : ''}>
                  <SummaryCard
                    title="Review Your Collection"
                    description={`Please review the details below before deploying your ${collectionType} collection.`}
                    data={summaryData}
                    errors={validateForm}
                    status={loading ? 'submitting' : 'preview'}
                    statusMessage={loading ? 'Deploying collection to the blockchain...' : undefined}
                    onSubmit={deployCollection}
                    onEdit={() => setShowSummary(false)}
                    onCancel={() => setShowSummary(false)}
                    submitLabel={loading ? 'Deploying...' : 'Deploy Collection'}
                    editLabel="Edit Details"
                    variant="elevated"
                  />
                </div>
              ) : (
                <CollectionPreviewCard
                  collectionType={collectionType}
                  formData={currentFormData}
                  artworkUrl={backgroundImage}
                  artworkLoading={imageLoading}
                  artworkError={imageError}
                  sticky={isDesktop}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeployCollectionPageV2
