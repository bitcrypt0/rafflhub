import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Clock,
  Shield,
  Share2,
  FileText,
  Info,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { ethers } from 'ethers'
import { useWallet } from '../../../contexts/WalletContext'
import { useContract } from '../../../contexts/ContractContext'
import { Button } from '../../ui/button'
import { toast } from '../../ui/sonner'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import { Card } from '../../ui/card'
import { FormSection } from '../FormSection'
import { SummaryCard } from '../SummaryCard'
import TokenGatedSection from '../../TokenGatedSection'
import SocialMediaTaskSection from '../../SocialMediaTaskSection'
import PoolMetadataFields from '../../PoolMetadataFields'
import { useRaffleLimits, extractRevertReason } from './useRaffleHooks'

/**
 * WhitelistRaffleFormV2 - Enhanced whitelist raffle form with progressive disclosure
 * Features: Collapsible sections, validation indicators, pre-submit summary
 */
const WhitelistRaffleFormV2 = ({ onFormDataChange, onReviewStateChange }) => {
  const { connected, address } = useWallet()
  const { contracts, executeTransaction } = useContract()
  const limits = useRaffleLimits(contracts, false)

  // Form state
  const [loading, setLoading] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [createdRaffleAddress, setCreatedRaffleAddress] = useState(null)
  const [tokenGatedEnabled, setTokenGatedEnabled] = useState(false)
  const [socialEngagementEnabled, setSocialEngagementEnabled] = useState(false)

  // Section completion state
  const [sectionCompletion, setSectionCompletion] = useState({
    basic: false,
    timing: false,
    participation: false,
    tokenGated: true, // Optional, so starts complete
    social: true, // Optional, so starts complete
    metadata: true, // Optional, so starts complete
  })

  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    slotLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '1',
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

  // Validation state
  const [errors, setErrors] = useState({})

  // Handle form changes
  const handleChange = useCallback((field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      // Notify parent of changes for live preview
      onFormDataChange?.(newData)
      return newData
    })
    // Clear error for this field when changed
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }, [onFormDataChange])

  // Validate a specific section
  const validateSection = useCallback((section) => {
    const newErrors = {}

    switch (section) {
      case 'basic':
        if (!formData.name?.trim()) newErrors.name = 'Pool name is required'
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
        else if (parseInt(formData.winnersCount) > parseInt(formData.slotLimit) * 0.3) {
          newErrors.winnersCount = 'Winners cannot exceed 30% of slot limit'
        }
        break
      case 'tokenGated':
        if (tokenGatedEnabled) {
          if (!formData.holderTokenAddress || !ethers.utils.isAddress(formData.holderTokenAddress)) {
            newErrors.holderTokenAddress = 'Valid token address required'
          }
        }
        break
    }

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }, [formData, limits, tokenGatedEnabled])

  // Update section completion status
  useEffect(() => {
    setSectionCompletion({
      basic: !!formData.name?.trim(),
      timing: !!formData.startTime && !!formData.duration,
      participation: !!formData.slotLimit && !!formData.winnersCount,
      tokenGated: !tokenGatedEnabled || !!formData.holderTokenAddress,
      social: true, // Optional
      metadata: true, // Optional
    })
  }, [formData, tokenGatedEnabled])

  // Validate all sections
  const validateAll = useCallback(() => {
    const sections = ['basic', 'timing', 'participation', 'tokenGated']
    let allValid = true
    for (const section of sections) {
      if (!validateSection(section)) allValid = false
    }
    return allValid
  }, [validateSection])

  // Handle pre-submit review
  const handleReview = useCallback(() => {
    if (validateAll()) {
      setShowSummary(true)
      onReviewStateChange?.(true)
    } else {
      toast.error('Please fix the errors before reviewing')
    }
  }, [validateAll, onReviewStateChange])

  // Handle form submission
  const handleSubmit = async () => {
    if (!connected || !contracts.poolDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured')
      return
    }

    setLoading(true)
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000)
      const duration = parseInt(formData.duration) * 60

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
        maxSlotsPerAddress: 1,
        isPrized: false,
        customSlotFee: 0,
        erc721Drop: false,
        erc1155Drop: true,
        prizeCollection: ethers.constants.AddressZero,
        standard: 0,
        prizeTokenId: 0,
        amountPerWinner: 0,
        creator: address,
        erc20PrizeToken: ethers.constants.AddressZero,
        erc20PrizeAmount: 0,
        nativePrizeAmount: 0,
        holderTokenAddress,
        holderTokenStandard,
        minHolderTokenBalance,
        holderTokenBalance: minHolderTokenBalance,
        holderTokenId,
        socialEngagementRequired: socialEngagementEnabled,
        socialTaskDescription: socialEngagementEnabled ? formData.socialTaskDescription : '',
        description: formData.description || '',
        twitterLink: formData.twitterLink || '',
        discordLink: formData.discordLink || '',
        telegramLink: formData.telegramLink || '',
      }

      let socialFee = ethers.BigNumber.from(0)
      if (socialEngagementEnabled) {
        socialFee = await contracts.protocolManager.socialEngagementFee()
      }

      const result = await executeTransaction(
        contracts.poolDeployer.createPool,
        params,
        { value: socialFee }
      )

      if (result.success) {
        // Extract pool address from PoolCreated event
        const poolCreatedEvent = result.receipt?.events?.find(e => e.event === 'PoolCreated')
        const poolAddress = poolCreatedEvent?.args?.pool || poolCreatedEvent?.args?.[0]
        
        if (poolAddress) {
          setCreatedRaffleAddress(poolAddress)
        }
        toast.success('Your raffle was created successfully!')
      } else {
        toast.error(result.error || 'Failed to create raffle')
      }
    } catch (error) {
      console.error('Error creating raffle:', error)
      if (!error.message?.includes('Transaction failed')) {
        toast.error(extractRevertReason(error))
      }
    } finally {
      setLoading(false)
    }
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleString()
  }

  // Build summary data
  const summaryData = [
    { label: 'Pool Name', value: formData.name || 'Not set', type: 'text' },
    { label: 'Start Time', value: formatDate(formData.startTime), type: 'date' },
    { label: 'Duration', value: formData.duration ? `${formData.duration} minutes` : 'Not set', type: 'time' },
    { label: 'Max Slots', value: formData.slotLimit || 'Not set', type: 'users' },
    { label: 'Winners', value: formData.winnersCount || 'Not set', type: 'prize' },
    { label: 'Slots Per Address', value: '1 (fixed)', type: 'users', variant: 'muted' },
    ...(tokenGatedEnabled ? [
      { label: 'Token-Gated', value: 'Yes', variant: 'success' },
      { label: 'Gate Token', value: formData.holderTokenAddress ? `${formData.holderTokenAddress.slice(0, 6)}...${formData.holderTokenAddress.slice(-4)}` : 'Not set' },
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
      startTime: '',
      duration: '',
      slotLimit: '',
      winnersCount: '',
      maxTicketsPerParticipant: '1',
      holderTokenAddress: '',
      holderTokenStandard: '0',
      minHolderTokenBalance: '',
      holderTokenId: '',
      socialTaskDescription: '',
      socialTasks: [],
      description: '',
      twitterLink: '',
      discordLink: '',
      telegramLink: '',
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
            <h2 className="font-display text-2xl font-bold mb-2">Raffle Created Successfully!</h2>
            <p className="text-muted-foreground">Your whitelist raffle has been deployed to the blockchain.</p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground mb-1">Raffle Address</p>
            <p className="font-mono text-sm break-all">{createdRaffleAddress}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={`/raffle/${createdRaffleAddress}`}>
              <Button variant="primary" className="gap-2 w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" />
                View Raffle
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
          title="Review Your Raffle"
          description="Please review the details before creating your raffle"
          data={summaryData}
          status={loading ? 'submitting' : 'preview'}
          statusMessage={loading ? 'Creating your raffle...' : undefined}
          onEdit={() => { setShowSummary(false); onReviewStateChange?.(false); }}
          onCancel={() => { setShowSummary(false); onReviewStateChange?.(false); }}
          onSubmit={handleSubmit}
          submitLabel="Create Raffle"
          editLabel="Edit Details"
          variant="elevated"
        />
    )
  }

  return (
    <Card variant="elevated" className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h3 className="font-display text-xl font-semibold">Whitelist Raffle</h3>
        <p className="text-sm text-muted-foreground">Create a free entry raffle for your community</p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6 p-3 rounded-lg bg-muted/30">
        {Object.entries(sectionCompletion).slice(0, 3).map(([key, complete], index) => (
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

      <form className="space-y-4">
        {/* Basic Info Section */}
        <FormSection
          title="Basic Information"
          icon={FileText}
          defaultOpen={true}
          isComplete={sectionCompletion.basic}
          hasError={!!errors.name}
        >
          <div>
            <label className="block font-body text-sm font-medium mb-2">Pool Name *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => validateSection('basic')}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-background transition-colors ${
                errors.name ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-primary'
              }`}
              placeholder="My Awesome Raffle"
              required
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.name}
              </p>
            )}
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
                onChange={(e) => handleChange('startTime', e.target.value)}
                onBlur={() => validateSection('timing')}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-background ${
                  errors.startTime ? 'border-destructive' : 'border-border'
                }`}
                required
              />
              {errors.startTime && (
                <p className="mt-1 text-xs text-destructive">{errors.startTime}</p>
              )}
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
                value={formData.duration || ''}
                onChange={(e) => handleChange('duration', e.target.value)}
                onBlur={() => validateSection('timing')}
                onWheel={(e) => e.target.blur()}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-background ${
                  errors.duration ? 'border-destructive' : 'border-border'
                }`}
                placeholder="60"
                required
              />
              {errors.duration && (
                <p className="mt-1 text-xs text-destructive">{errors.duration}</p>
              )}
            </div>
          </div>
        </FormSection>

        {/* Participation Section */}
        <FormSection
          title="Participation Rules"
          icon={Users}
          defaultOpen={true}
          isComplete={sectionCompletion.participation}
          hasError={!!errors.slotLimit || !!errors.winnersCount}
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
                value={formData.slotLimit || ''}
                onChange={(e) => handleChange('slotLimit', e.target.value)}
                onBlur={() => validateSection('participation')}
                onWheel={(e) => e.target.blur()}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-background ${
                  errors.slotLimit ? 'border-destructive' : 'border-border'
                }`}
                placeholder="100"
                required
              />
              {errors.slotLimit && (
                <p className="mt-1 text-xs text-destructive">{errors.slotLimit}</p>
              )}
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
                onChange={(e) => handleChange('winnersCount', e.target.value)}
                onBlur={() => validateSection('participation')}
                onWheel={(e) => e.target.blur()}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-background ${
                  errors.winnersCount ? 'border-destructive' : 'border-border'
                }`}
                placeholder="10"
                required
              />
              {errors.winnersCount && (
                <p className="mt-1 text-xs text-destructive">{errors.winnersCount}</p>
              )}
            </div>

            <div>
              <label className="block font-body text-sm font-medium mb-2 flex items-center gap-2">
                Max Slots Per Address
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    Fixed at 1 for whitelist raffles
                  </TooltipContent>
                </Tooltip>
              </label>
              <input
                type="number"
                value={1}
                disabled
                className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-muted/50 opacity-60 cursor-not-allowed"
              />
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
            socialEngagementEnabled={socialEngagementEnabled}
            onSocialEngagementChange={setSocialEngagementEnabled}
            formData={formData}
            handleChange={handleChange}
            required={false}
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
  )
}

export default WhitelistRaffleFormV2
