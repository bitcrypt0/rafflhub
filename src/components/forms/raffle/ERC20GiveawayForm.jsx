import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coins, Info, FileText, Clock, Users, Shield, Share2, Loader2, Check, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react'
import { ethers } from 'ethers'
import { useWallet } from '../../../contexts/WalletContext'
import { useContract } from '../../../contexts/ContractContext'
import { useMobileBreakpoints } from '../../../hooks/useMobileBreakpoints'
import { contractABIs } from '../../../contracts/contractABIs'
import { Button } from '../../ui/button'
import { Card } from '../../ui/card'
import { toast } from '../../ui/sonner'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import { FormSection } from '../FormSection'
import { SummaryCard } from '../SummaryCard'
import TokenGatedSection from '../../TokenGatedSection'
import SocialMediaTaskSection from '../../SocialMediaTaskSection'
import PoolMetadataFields from '../../PoolMetadataFields'
import { useRaffleLimits, approveToken, extractRevertReason } from './useRaffleHooks'

/**
 * ERC20GiveawayForm - Create an ERC20 token giveaway
 * Give away ERC20 tokens to lucky participants
 */
function ERC20GiveawayForm({ onReviewStateChange }) {
  const { connected, address, provider } = useWallet()
  const { contracts } = useContract()
  const { isMobile } = useMobileBreakpoints()
  const limits = useRaffleLimits(contracts, true)
  const [loading, setLoading] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [createdRaffleAddress, setCreatedRaffleAddress] = useState(null)
  const [socialEngagementEnabled, setSocialEngagementEnabled] = useState(false)

  const [sectionCompletion, setSectionCompletion] = useState({
    basic: false,
    timing: false,
    participation: false,
  })

  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    name: '',
    tokenAddress: '',
    tokenAmount: '',
    startTime: '',
    duration: '',
    slotLimit: '',
    winnersCount: '',
    maxSlotsPerAddress: '',
    // Token-gated fields
    tokenGatedEnabled: false,
    holderTokenAddress: '',
    holderTokenStandard: '0',
    minHolderTokenBalance: '',
    holderTokenId: '0',
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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validateSection = (section) => {
    const newErrors = {}

    switch (section) {
      case 'basic':
        if (!formData.name?.trim()) newErrors.name = 'Pool name is required'
        if (!formData.tokenAddress?.trim()) newErrors.tokenAddress = 'Token address is required'
        if (!formData.tokenAmount) newErrors.tokenAmount = 'Token amount is required'
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
        if (!formData.maxSlotsPerAddress) newErrors.maxSlotsPerAddress = 'Max slots per address is required'
        break
    }

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  useEffect(() => {
    setSectionCompletion({
      basic: !!formData.name?.trim() && !!formData.tokenAddress?.trim() && !!formData.tokenAmount,
      timing: !!formData.startTime && !!formData.duration,
      participation: !!formData.slotLimit && !!formData.winnersCount && !!formData.maxSlotsPerAddress,
    })
  }, [formData])

  const handleReview = () => {
    setShowSummary(true)
    onReviewStateChange?.(true)
  }

  const handleSubmit = async () => {
    if (!connected || !contracts.poolDeployer || !provider) {
      toast.error('Please connect your wallet and ensure contracts are configured')
      return
    }
    setLoading(true)
    try {
      const signer = provider.getSigner()

      // Step 1: Approve token
      const approvalResult = await approveToken({
        signer,
        tokenAddress: formData.tokenAddress,
        prizeType: 'erc20',
        spender: contracts.poolDeployer.address,
        amount: formData.tokenAmount
      })
      if (!approvalResult.success) {
        toast.error('Token approval failed: ' + approvalResult.error)
        setLoading(false)
        return
      }
      if (!approvalResult.alreadyApproved) {
        toast.success('Token approval granted')
        await new Promise(res => setTimeout(res, 2000))
      }

      // Step 2: Create raffle
      const tokenContract = new ethers.Contract(formData.tokenAddress, contractABIs.erc20, signer)
      const decimals = await tokenContract.decimals()
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000)
      const duration = parseInt(formData.duration) * 60
      const tokenAmount = formData.tokenAmount
        ? ethers.utils.parseUnits(formData.tokenAmount, decimals)
        : ethers.BigNumber.from(0)

      const params = {
        name: formData.name,
        startTime,
        duration,
        slotLimit: parseInt(formData.slotLimit),
        winnersCount: parseInt(formData.winnersCount),
        maxSlotsPerAddress: parseInt(formData.maxSlotsPerAddress),
        isPrized: true,
        customSlotFee: ethers.BigNumber.from(0),
        erc721Drop: false,
        prizeCollection: ethers.constants.AddressZero, // Use zero address for ERC20
        standard: 2, // Use 2 for ERC20
        prizeTokenId: 0,
        amountPerWinner: 0,
        creator: address,
        erc20PrizeToken: formData.tokenAddress,
        erc20PrizeAmount: tokenAmount,
        nativePrizeAmount: ethers.BigNumber.from(0),
        // Token-gated params
        holderTokenAddress: formData.tokenGatedEnabled
          ? formData.holderTokenAddress
          : ethers.constants.AddressZero,
        holderTokenStandard: formData.tokenGatedEnabled
          ? parseInt(formData.holderTokenStandard)
          : 0,
        minHolderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined
          ? ethers.BigNumber.from(parseInt(formData.minHolderTokenBalance))
          : ethers.BigNumber.from(0),
        holderTokenBalance: formData.tokenGatedEnabled && formData.minHolderTokenBalance !== '' && formData.minHolderTokenBalance !== undefined
          ? ethers.BigNumber.from(parseInt(formData.minHolderTokenBalance))
          : ethers.BigNumber.from(0),
        holderTokenId: formData.tokenGatedEnabled && (formData.holderTokenStandard === '0' || formData.holderTokenStandard === '1')
          ? (formData.holderTokenId !== '' && formData.holderTokenId !== undefined ? parseInt(formData.holderTokenId) : 0)
          : 0,
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
    { label: 'Token Address', value: formData.tokenAddress || 'Not set', type: 'text' },
    { label: 'Total Token Amount', value: formData.tokenAmount || 'Not set', type: 'text' },
    { label: 'Start Time', value: formatDate(formData.startTime), type: 'date' },
    { label: 'Duration', value: formData.duration ? `${formData.duration} minutes` : 'Not set', type: 'time' },
    { label: 'Max Slots', value: formData.slotLimit || 'Not set', type: 'users' },
    { label: 'Winners', value: formData.winnersCount || 'Not set', type: 'prize' },
    { label: 'Max Slots Per Address', value: formData.maxSlotsPerAddress || 'Not set', type: 'users' },
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
      tokenAddress: '',
      tokenAmount: '',
      startTime: '',
      duration: '',
      slotLimit: '',
      winnersCount: '',
      maxSlotsPerAddress: '',
      tokenGatedEnabled: false,
      holderTokenAddress: '',
      holderTokenStandard: '0',
      minHolderTokenBalance: '',
      holderTokenId: '0',
      socialTaskDescription: '',
      socialTasks: [],
      description: '',
      twitterLink: '',
      discordLink: '',
      telegramLink: '',
    })
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
            <p className="text-muted-foreground">Your ERC20 token giveaway pool has been deployed to the blockchain.</p>
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
    <Card variant="elevated" className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h3 className="font-display text-xl font-semibold">ERC20 Token Giveaway</h3>
        <p className="text-sm text-muted-foreground">Give away ERC20 tokens to lucky participants</p>
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
          hasError={!!errors.name || !!errors.tokenAddress || !!errors.tokenAmount}
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
                placeholder="My Token Giveaway"
                required
              />
            </div>

            <div>
              <label className="block font-body text-sm font-medium mb-2">Token Address *</label>
              <input
                type="text"
                value={formData.tokenAddress || ''}
                onChange={e => handleChange('tokenAddress', e.target.value)}
                onBlur={() => validateSection('basic')}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background font-mono"
                placeholder="0x..."
                required
              />
            </div>

            <div>
              <label className="block font-body text-sm font-medium mb-2">Total Token Amount *</label>
              <input
                type="number"
                min="0.00000001"
                step="any"
                value={formData.tokenAmount || ''}
                onChange={e => handleChange('tokenAmount', e.target.value)}
                onBlur={() => validateSection('basic')}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                placeholder="1000"
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
          hasError={!!errors.slotLimit || !!errors.winnersCount || !!errors.maxSlotsPerAddress}
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
                onChange={e => handleChange('slotLimit', e.target.value)}
                onBlur={() => validateSection('participation')}
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
                value={formData.maxSlotsPerAddress || ''}
                onChange={e => handleChange('maxSlotsPerAddress', e.target.value)}
                onBlur={() => validateSection('participation')}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
                placeholder="5"
                required
              />
            </div>
          </div>
        </FormSection>

        {/* Token-Gated Section (Optional) */}
        <div className="space-y-4">
          <TokenGatedSection
            formData={formData}
            handleChange={handleChange}
            required={true}
            useFormDataEnabled={true}
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
                Approving & Creating...
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

export default ERC20GiveawayForm
