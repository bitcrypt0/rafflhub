import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Info, FileText, Clock, Users, Shield, Share2, AlertCircle, Loader2, Check, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react'
import { ethers } from 'ethers'
import { useWallet } from '../../../contexts/WalletContext'
import { useContract } from '../../../contexts/ContractContext'
import { useNativeCurrency } from '../../../hooks/useNativeCurrency'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { toast } from '../../ui/sonner'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import { FormSection } from '../FormSection'
import { SummaryCard } from '../SummaryCard'
import TokenGatedSection from '../../TokenGatedSection'
import SocialMediaTaskSection from '../../SocialMediaTaskSection'
import PoolMetadataFields from '../../PoolMetadataFields'
import {
  useRaffleLimits,
  useCollectionArtwork,
  extractRevertReason
} from './useRaffleHooks'

/**
 * ERC721DropForm - Create an ERC721 NFT drop raffle
 * Winners receive NFTs from the specified collection
 */
function ERC721DropForm({ collectionAddress: externalCollectionAddress, setCollectionAddress: setExternalCollectionAddress, onReviewStateChange }) {
  const { connected, address, provider } = useWallet()
  const { contracts } = useContract()
  const { getCurrencyLabel } = useNativeCurrency()
  const limits = useRaffleLimits(contracts, true)
  const [loading, setLoading] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [createdRaffleAddress, setCreatedRaffleAddress] = useState(null)
  const [tokenGatedEnabled, setTokenGatedEnabled] = useState(false)
  const [socialEngagementEnabled, setSocialEngagementEnabled] = useState(false)

  const [sectionCompletion, setSectionCompletion] = useState({
    basic: false,
    timing: false,
    participation: false,
  })

  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    name: '',
    collection: externalCollectionAddress || '',
    startTime: '',
    duration: '',
    slotLimit: '',
    winnersCount: '',
    maxTicketsPerUser: '',
    slotFee: '',
    // Token-gated fields
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderTokenBalance: '',
    holderTokenId: '',
    // Social media fields
    socialEngagementRequired: false,
    socialTaskDescription: '',
    socialTasks: [],
    // Pool metadata fields
    description: '',
    twitterLink: '',
    discordLink: '',
    telegramLink: '',
  })

  // Use the artwork hook
  const {
    backgroundImage,
    imageLoading,
    handleImageLoad,
    handleImageError
  } = useCollectionArtwork(formData.collection, provider, 'erc721Prize')

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Sync with external state if provided
    if (field === 'collection' && setExternalCollectionAddress) {
      setExternalCollectionAddress(value)
    }
    // Clear error for this field when changed
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validateSection = (section) => {
    const newErrors = {}

    switch (section) {
      case 'basic':
        if (!formData.name?.trim()) newErrors.name = 'Pool name is required'
        if (!formData.collection?.trim()) newErrors.collection = 'Collection address is required'
        break
      case 'timing':
        if (!formData.startTime) newErrors.startTime = 'Start time is required'
        if (!formData.duration) newErrors.duration = 'Duration is required'
        else if (limits.minDuration && parseInt(formData.duration) * 60 < parseInt(limits.minDuration)) {
          newErrors.duration = `Minimum duration is ${Math.ceil(parseInt(limits.minDuration) / 60)} minutes`
        }
        else if (limits.maxDuration && parseInt(formData.duration) * 60 > parseInt(limits.maxDuration)) {
          newErrors.duration = `Maximum duration is ${Math.floor(parseInt(limits.maxDuration) / 60)} minutes`
        }
        break
      case 'participation':
        if (!formData.slotLimit) newErrors.slotLimit = 'Slot limit is required'
        else if (limits.minSlot && parseInt(formData.slotLimit) < parseInt(limits.minSlot)) {
          newErrors.slotLimit = `Minimum slots is ${limits.minSlot}`
        }
        else if (limits.maxSlot && parseInt(formData.slotLimit) > parseInt(limits.maxSlot)) {
          newErrors.slotLimit = `Maximum slots is ${limits.maxSlot}`
        }
        if (!formData.winnersCount) newErrors.winnersCount = 'Number of winners is required'
        if (!formData.maxTicketsPerUser) newErrors.maxTicketsPerUser = 'Max tickets per user is required'
        break
    }

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  // Sync external collection address changes
  useEffect(() => {
    if (externalCollectionAddress && externalCollectionAddress !== formData.collection) {
      setFormData(prev => ({ ...prev, collection: externalCollectionAddress }))
    }
  }, [externalCollectionAddress])

  // Update section completion status
  useEffect(() => {
    setSectionCompletion({
      basic: !!formData.name?.trim() && !!formData.collection?.trim(),
      timing: !!formData.startTime && !!formData.duration,
      participation: !!formData.slotLimit && !!formData.winnersCount && !!formData.maxTicketsPerUser,
    })
  }, [formData])

  const handleReview = () => {
    setShowSummary(true)
    onReviewStateChange?.(true)
  }

  const handleSubmit = async () => {
    if (!connected || !contracts) {
      toast.error('Please connect your wallet')
      return
    }
    if (!contracts.poolDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured')
      return
    }
    setLoading(true)
    try {
      const signer = provider.getSigner()
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000)
      const duration = parseInt(formData.duration) * 60
      const customSlotFee = formData.slotFee ? ethers.utils.parseEther(formData.slotFee) : 0

      // Token-gated logic
      const holderTokenAddress = tokenGatedEnabled && formData.holderTokenAddress
        ? formData.holderTokenAddress
        : ethers.constants.AddressZero
      const holderTokenStandard = tokenGatedEnabled ? parseInt(formData.holderTokenStandard) : 0
      const minHolderTokenBalance = tokenGatedEnabled && formData.minHolderTokenBalance
        ? ethers.BigNumber.from(parseInt(formData.minHolderTokenBalance))
        : ethers.BigNumber.from(0)
      const holderTokenId = tokenGatedEnabled && formData.holderTokenId
        ? parseInt(formData.holderTokenId)
        : 0

      const params = {
        name: formData.name,
        startTime,
        duration,
        slotLimit: parseInt(formData.slotLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxSlotsPerAddress: parseInt(formData.maxTicketsPerUser),
        isPrized: true,
        customSlotFee: customSlotFee,
        erc721Drop: true,
        erc1155Drop: false,
        prizeCollection: formData.collection,
        standard: 0, // ERC721
        prizeTokenId: 0,
        amountPerWinner: 1,
        creator: address,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        nativePrizeAmount: 0,
        // Token-gated params
        holderTokenAddress,
        holderTokenStandard,
        minHolderTokenBalance,
        holderTokenBalance: minHolderTokenBalance,
        holderTokenId,
        // Social media params
        socialEngagementRequired: socialEngagementEnabled,
        socialTaskDescription: socialEngagementEnabled ? formData.socialTaskDescription : '',
        // Pool metadata params
        description: formData.description || '',
        twitterLink: formData.twitterLink || '',
        discordLink: formData.discordLink || '',
        telegramLink: formData.telegramLink || '',
      }

      // Query social engagement fee if enabled
      let socialFee = ethers.BigNumber.from(0)
      if (socialEngagementEnabled) {
        socialFee = await contracts.poolDeployer.socialEngagementFee()
        console.log('Social engagement fee:', ethers.utils.formatEther(socialFee), 'ETH')
      }

      const tx = await contracts.poolDeployer.connect(signer).createPool(params, { value: socialFee })
      const receipt = await tx.wait()
      
      // Extract pool address from PoolCreated event
      const poolCreatedEvent = receipt?.events?.find(e => e.event === 'PoolCreated')
      const poolAddress = poolCreatedEvent?.args?.pool || poolCreatedEvent?.args?.[0]
      
      if (poolAddress) {
        setCreatedRaffleAddress(poolAddress)
      }
      toast.success('Your pool was created successfully!')
    } catch (error) {
      console.error('Error creating raffle:', error)
      toast.error(extractRevertReason(error))
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleString()
  }

  const summaryData = [
    { label: 'Pool Name', value: formData.name || 'Not set', type: 'text' },
    { label: 'Collection Address', value: formData.collection || 'Not set', type: 'text' },
    { label: 'Start Time', value: formatDate(formData.startTime), type: 'date' },
    { label: 'Duration', value: formData.duration ? `${formData.duration} minutes` : 'Not set', type: 'time' },
    { label: 'Max Slots', value: formData.slotLimit || 'Not set', type: 'users' },
    { label: 'Winners', value: formData.winnersCount || 'Not set', type: 'prize' },
    { label: 'Max Slots Per Address', value: formData.maxTicketsPerUser || 'Not set', type: 'users' },
    { label: 'Slot Fee', value: formData.slotFee ? `${formData.slotFee} ${getCurrencyLabel()}` : 'Not set', type: 'currency' },
    ...(tokenGatedEnabled ? [
      { label: 'Token-Gated', value: 'Yes', variant: 'success' },
    ] : []),
    ...(socialEngagementEnabled ? [
      { label: 'Social Tasks', value: 'Enabled', variant: 'success' },
    ] : []),
  ]

  // Handle creating another raffle (reset form)
  const handleCreateAnother = () => {
    setCreatedRaffleAddress(null)
    setShowSummary(false)
    onReviewStateChange?.(false)
    setFormData({
      name: '',
      collection: '',
      startTime: '',
      duration: '',
      slotLimit: '',
      winnersCount: '',
      maxTicketsPerUser: '',
      slotFee: '',
      holderTokenAddress: '',
      holderTokenStandard: '0',
      minHolderTokenBalance: '',
      holderTokenId: '',
    })
    setTokenGatedEnabled(false)
    setSocialEngagementEnabled(false)
  }

  // Show success state after raffle creation
  if (createdRaffleAddress) {
    return (
      <Card variant="elevated" className="p-8 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">Pool Created Successfully!</h2>
            <p className="text-muted-foreground">Your ERC721 drop pool has been deployed to the blockchain.</p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Pool Address</p>
            <p className="font-mono text-sm break-all">{createdRaffleAddress}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={`/pool/${createdRaffleAddress}`}>
              <Button variant="primary" className="gap-2 w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" />
                View Pool
              </Button>
            </Link>
            <Button variant="secondary" onClick={handleCreateAnother} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Create Another
            </Button>
          </div>
        </motion.div>
      </Card>
    )
  }

  // Show summary/review modal
  if (showSummary) {
    return (
      <SummaryCard
          title="Review Your Pool"
          description="Please review the details before creating your pool"
          data={summaryData}
          status={loading ? 'submitting' : 'preview'}
          statusMessage={loading ? 'Creating your pool...' : undefined}
          onEdit={() => { setShowSummary(false); onReviewStateChange?.(false); }}
          onCancel={() => { setShowSummary(false); onReviewStateChange?.(false); }}
          onSubmit={handleSubmit}
          submitLabel="Create Pool"
          editLabel="Edit Details"
        />
    )
  }

  return (
    <div className="relative">
      {/* Background Image Overlay */}
      {backgroundImage && (
        <>
          <img
            src={backgroundImage}
            alt="Collection artwork"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ display: 'none' }}
          />
          <div
            className="fixed inset-0 top-0 left-0 w-full h-1/2 opacity-40 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              filter: 'blur(0.5px) brightness(1.2) contrast(1.1)'
            }}
          />
        </>
      )}

      {/* Loading Overlay */}
      {imageLoading && (
        <div className="fixed inset-0 top-0 left-0 w-full h-1/2 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-background/90 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
            <span className="text-sm font-medium">Loading artwork...</span>
          </div>
        </div>
      )}

      <Card variant="elevated" className="p-6 max-w-3xl mx-auto relative z-10">
        <div className="mb-6">
          <h3 className="font-display text-xl font-semibold">ERC721 Drop Event</h3>
          <p className="text-sm text-muted-foreground">Create a pool for NFT collection drops</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-muted/30">
          {Object.entries(sectionCompletion).map(([key, complete], index) => (
            <React.Fragment key={key}>
              <div className={`flex items-center gap-1.5 text-sm ${complete ? 'text-success' : 'text-muted-foreground'}`}>
                {complete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-current" />
                )}
                <span className="hidden sm:inline capitalize">{key}</span>
              </div>
              {index < 2 && <div className="flex-1 h-px bg-border" />}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleReview(); }} className="space-y-4">
          {/* Basic Info Section */}
          <FormSection
            title="Basic Information"
            icon={FileText}
            defaultOpen={true}
            isComplete={sectionCompletion.basic}
            hasError={!!errors.name || !!errors.collection}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium mb-2">Pool Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => handleChange('name', e.target.value)}
                  onBlur={() => validateSection('basic')}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                  placeholder="My NFT Drop"
                  required
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium mb-2">Collection Address *</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={formData.collection}
                  onChange={(e) => handleChange('collection', e.target.value)}
                  onBlur={() => validateSection('basic')}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background font-mono"
                  required
                />
              </div>
            </div>
          </FormSection>

          {/* Timing Section */}
          <FormSection
            title="Timing"
            icon={Clock}
            defaultOpen={true}
            isComplete={sectionCompletion.timing}
            hasError={!!errors.startTime || !!errors.duration}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium mb-2">Start Time *</label>
                <input
                  type="datetime-local"
                  value={formData.startTime || ''}
                  onChange={e => handleChange('startTime', e.target.value)}
                  onBlur={() => validateSection('timing')}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                  required
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium mb-2 flex items-center gap-2">
                  Duration (minutes) *
                  {limits.minDuration && limits.maxDuration && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        <div>
                          Min: {Math.ceil(Number(limits.minDuration) / 60)} min<br />
                          Max: {Math.floor(Number(limits.maxDuration) / 60)} min
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.duration || ''}
                  onChange={e => handleChange('duration', e.target.value)}
                  onBlur={() => validateSection('timing')}
                  onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                  placeholder="60"
                  required
                />
              </div>
            </div>
          </FormSection>

          {/* Participation Rules Section */}
          <FormSection
            title="Participation Rules"
            icon={Users}
            defaultOpen={true}
            isComplete={sectionCompletion.participation}
            hasError={!!errors.slotLimit || !!errors.winnersCount || !!errors.maxTicketsPerUser}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-sm font-medium mb-2 flex items-center gap-2">
                  Slot Limit *
                  {limits.minSlot && limits.maxSlot && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        <div>
                          Min: {limits.minSlot}<br />
                          Max: {limits.maxSlot}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.slotLimit || ''}
                  onChange={e => handleChange('slotLimit', e.target.value)}
                  onBlur={() => validateSection('participation')}
                  onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                  placeholder="100"
                  required
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium mb-2 flex items-center gap-2">
                  Number of Winners *
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>
                      Winners must not exceed 30% of slot limit
                    </TooltipContent>
                  </Tooltip>
                </label>
                <input
                  type="number"
                  value={formData.winnersCount || ''}
                  onChange={e => handleChange('winnersCount', e.target.value)}
                  onBlur={() => validateSection('participation')}
                  onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                  placeholder="10"
                  required
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium mb-2 flex items-center gap-2">
                  Max Slots Per Address *
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6}>
                      Max slots per address must not exceed 0.1% of slot limit
                    </TooltipContent>
                  </Tooltip>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxTicketsPerUser || ''}
                  onChange={e => handleChange('maxTicketsPerUser', e.target.value)}
                  onBlur={() => validateSection('participation')}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                  placeholder="5"
                  required
                />
              </div>

              <div>
                <label className="block font-body text-sm font-medium mb-2">
                  {getCurrencyLabel('ticket')} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.slotFee || ''}
                  onChange={e => handleChange('slotFee', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                  placeholder="0 for free giveaway"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Enter 0 for NFT giveaway</p>
              </div>
            </div>
          </FormSection>

          {/* Token-Gated Section (Optional) */}
          <div className="space-y-4">
            <TokenGatedSection
              tokenGatedEnabled={tokenGatedEnabled}
              onTokenGatedChange={setTokenGatedEnabled}
              formData={formData}
              handleChange={handleChange}
              required={true}
            />
          </div>

          {/* Social Tasks Section (Optional) */}
          <div className="space-y-4">
            <SocialMediaTaskSection
              formData={formData}
              handleChange={handleChange}
              socialEngagementEnabled={socialEngagementEnabled}
              setSocialEngagementEnabled={setSocialEngagementEnabled}
            />
          </div>

          {/* Metadata Section (Optional) */}
          <div className="space-y-4">
            <PoolMetadataFields
              formData={formData}
              handleChange={handleChange}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              onClick={handleReview}
              disabled={loading || !connected}
              variant="primary"
              size="lg"
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Review & Create'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default ERC721DropForm
