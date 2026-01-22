import React, { useState } from 'react'
import { Coins, Info } from 'lucide-react'
import { ethers } from 'ethers'
import { useWallet } from '../../../contexts/WalletContext'
import { useContract } from '../../../contexts/ContractContext'
import { Button } from '../../ui/button'
import { toast } from '../../ui/sonner'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import TokenGatedSection from '../../TokenGatedSection'
import SocialMediaTaskSection from '../../SocialMediaTaskSection'
import PoolMetadataFields from '../../PoolMetadataFields'
import { useRaffleLimits, extractRevertReason } from './useRaffleHooks'

/**
 * WhitelistRaffleForm - Create a whitelist/allowlist raffle
 * Free entry, random winners, token-gating optional
 */
const WhitelistRaffleForm = () => {
  const { connected, address } = useWallet()
  const { contracts, executeTransaction } = useContract()
  const limits = useRaffleLimits(contracts, false)
  const [loading, setLoading] = useState(false)
  const [tokenGatedEnabled, setTokenGatedEnabled] = useState(false)
  const [socialEngagementEnabled, setSocialEngagementEnabled] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    duration: '',
    slotLimit: '',
    winnersCount: '',
    maxTicketsPerParticipant: '',
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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!connected || !contracts.poolDeployer) {
      toast.error('Please connect your wallet and ensure contracts are configured')
      return
    }

    setLoading(true)
    try {
      const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000)
      const duration = parseInt(formData.duration) * 60 // Convert minutes to seconds

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
        maxSlotsPerAddress: 1, // Hardcoded to 1 for Whitelist pools
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
        socialFee = await contracts.protocolManager.socialEngagementFee()
        console.log('Social engagement fee:', ethers.utils.formatEther(socialFee), 'ETH')
      }

      const result = await executeTransaction(
        contracts.poolDeployer.createPool,
        params,
        { value: socialFee }
      )

      if (result.success) {
        toast.success('Your raffle was created successfully!')
        // Reset form
        setFormData({
          name: '',
          startTime: '',
          duration: '',
          slotLimit: '',
          winnersCount: '',
          maxSlotsPerAddress: '',
          holderTokenAddress: '',
          holderTokenStandard: '0',
          minHolderTokenBalance: '',
          holderTokenId: '',
          socialTaskDescription: '',
          socialTasks: []
        })
        setTokenGatedEnabled(false)
        setSocialEngagementEnabled(false)
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

  return (
    <div className="bg-card border border-border rounded-xl p-6 max-w-3xl mx-auto shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-5 w-5" />
        <h3 className="font-display text-[length:var(--text-xl)] font-semibold">Whitelist Raffle</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Pool Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
              required
            />
          </div>

          <div>
            <label className="block font-body text-[length:var(--text-base)] font-medium mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={formData.startTime || ''}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
              required
            />
          </div>

          <div>
            <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
              Duration (minutes)
              {limits.minDuration && limits.maxDuration && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Duration Allowed: {Math.ceil(Number(limits.minDuration) / 60)} min<br />
                      Maximum Duration Allowed: {Math.floor(Number(limits.maxDuration) / 60)} min
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.duration || ''}
              onChange={(e) => handleChange('duration', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
              required
            />
          </div>

          <div>
            <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
              Slot Limit
              {limits.minSlot && limits.maxSlot && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    <div>
                      Minimum Slot Limit Allowed: {limits.minSlot}<br />
                      Maximum Slot Limit Allowed: {limits.maxSlot}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </label>
            <input
              type="number"
              value={formData.slotLimit || ''}
              onChange={(e) => handleChange('slotLimit', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
              required
            />
          </div>

          <div>
            <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
              Number of Winning Slots
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Winners must not exceed 30% of your Slot Limit
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={formData.winnersCount || ''}
              onChange={(e) => handleChange('winnersCount', e.target.value)}
              onWheel={(e) => (e.target instanceof HTMLElement) && e.target.blur()}
              className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background"
              required
            />
          </div>

          <div>
            <label className="block font-body text-[length:var(--text-base)] font-medium mb-2 flex items-center gap-2">
              Max Slots Per Address
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" tabIndex={0} />
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>
                  Each participant can only purchase one slot in Whitelist pools
                </TooltipContent>
              </Tooltip>
            </label>
            <input
              type="number"
              value={1}
              disabled
              className="w-full px-3 py-2.5 font-body text-[length:var(--text-base)] border border-border rounded-lg bg-background opacity-60 cursor-not-allowed"
              required
            />
          </div>
        </div>

        <TokenGatedSection
          tokenGatedEnabled={tokenGatedEnabled}
          onTokenGatedChange={setTokenGatedEnabled}
          formData={formData}
          handleChange={handleChange}
          required={true}
        />

        <SocialMediaTaskSection
          socialEngagementEnabled={socialEngagementEnabled}
          onSocialEngagementChange={setSocialEngagementEnabled}
          formData={formData}
          handleChange={handleChange}
          required={false}
        />

        <PoolMetadataFields
          formData={formData}
          handleChange={handleChange}
        />

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !connected}
            variant="primary"
            size="lg"
            className="flex-1"
          >
            {loading ? 'Creating...' : 'Create Raffle'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default WhitelistRaffleForm
