import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Sparkles,
  ArrowLeft,
  Check,
} from 'lucide-react'
import { useWallet } from '../contexts/WalletContext'
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints'
import { SUPPORTED_NETWORKS } from '../networks'

// UI Components
import { Button } from '../components/ui/button'
import { RaffleErrorDisplay } from '../components/ui/raffle-error-display'

// Form Components
import { PageHero } from '../components/forms/PageHero'
import {
  RaffleTypeSelector,
  useRaffleTypeConfig,
  WhitelistRaffleFormV2,
  ERC721DropForm,
  ERC1155DropForm,
  LuckySaleERC721Form,
  ETHGiveawayForm,
  ERC20GiveawayForm,
} from '../components/forms/raffle'

/**
 * CreateRafflePageV2 - Redesigned raffle creation with wizard flow
 * Phase 2 implementation with visual type selector and live preview
 */
const CreateRafflePageV2 = () => {
  const { connected, chainId } = useWallet()
  const { isMobile } = useMobileBreakpoints()
  const location = useLocation()

  // Wizard state
  const [selectedType, setSelectedType] = useState(null)
  const [showingReview, setShowingReview] = useState(false)

  // For ERC721DropForm
  const [existingCollectionAddress, setExistingCollectionAddress] = useState('')

  // Handle incoming route state from collection deployment
  useEffect(() => {
    if (location.state?.fromDeployment) {
      const { collectionType, collectionAddress } = location.state
      
      // Map collection type to raffle type
      if (collectionType === 'ERC721') {
        setSelectedType('nft-drop-721')
        setExistingCollectionAddress(collectionAddress || '')
      } else if (collectionType === 'ERC1155') {
        setSelectedType('nft-drop-1155')
        setExistingCollectionAddress(collectionAddress || '')
      }
      
      // Clear the state to prevent re-triggering on navigation
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Get selected raffle type config
  const selectedTypeConfig = useRaffleTypeConfig(selectedType)

  // Check if contracts are available on current network
  const areContractsAvailable = useCallback(() => {
    if (!chainId || !SUPPORTED_NETWORKS[chainId]) {
      return false
    }
    const contractAddresses = SUPPORTED_NETWORKS[chainId].contractAddresses
    return contractAddresses?.poolDeployer &&
      contractAddresses.poolDeployer !== '0x...' &&
      contractAddresses?.protocolManager &&
      contractAddresses.protocolManager !== '0x...'
  }, [chainId])

  // Handle type selection
  const handleTypeSelect = useCallback((type) => {
    setSelectedType(type.id)
  }, [])

  // Handle going back to type selection
  const handleBack = useCallback(() => {
    setSelectedType(null)
    setExistingCollectionAddress('')
    setShowingReview(false)
  }, [])

  // Render the appropriate form based on selected type
  const renderForm = useMemo(() => {
    if (!selectedType) return null

    const commonProps = { onReviewStateChange: setShowingReview }

    switch (selectedType) {
      case 'whitelist':
        return <WhitelistRaffleFormV2 {...commonProps} />
      case 'nft-drop-721':
        return (
          <ERC721DropForm
            collectionAddress={existingCollectionAddress}
            setCollectionAddress={setExistingCollectionAddress}
            {...commonProps}
          />
        )
      case 'nft-drop-1155':
        return <ERC1155DropForm {...commonProps} />
      case 'lucky-sale':
        return <LuckySaleERC721Form {...commonProps} />
      case 'native-giveaway':
        return <ETHGiveawayForm {...commonProps} />
      case 'erc20-giveaway':
        return <ERC20GiveawayForm {...commonProps} />
      default:
        return null
    }
  }, [selectedType, existingCollectionAddress])

  // Animation variants
  const pageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' }
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: { duration: 0.3 }
    }
  }

  // Not connected state
  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-full blur-3xl" />
            <Plus className={`relative mx-auto text-muted-foreground ${isMobile ? 'h-12 w-12' : 'h-16 w-16'}`} />
          </div>
          <h2 className={`font-display font-bold mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
            Connect Your Wallet
          </h2>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
            Please connect your wallet to create raffles and deploy collections.
          </p>
        </motion.div>
      </div>
    )
  }

  // Contracts not available state
  if (!areContractsAvailable()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RaffleErrorDisplay
          error="CONTRACTS_NOT_AVAILABLE"
          onRetry={null}
          isMobile={isMobile}
          showCreateButton={false}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className={`${isMobile ? 'px-4' : 'container mx-auto px-6 lg:px-8'} py-8`}>
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {!selectedType ? (
              // Step 1: Type Selection
              <motion.div
                key="type-selection"
                variants={pageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Section Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                    <Sparkles className="h-4 w-4" />
                    <span>Step 1 of 3</span>
                  </div>
                  <h2 className={`font-display font-bold mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                    What type of raffle do you want to create?
                  </h2>
                  <p className="text-muted-foreground max-w-xl mx-auto">
                    Select the type that best fits your needs. Each option has different features and requirements.
                  </p>
                </div>

                {/* Type Selector */}
                <RaffleTypeSelector
                  selectedType={selectedType}
                  onTypeSelect={handleTypeSelect}
                  layout={isMobile ? "list" : "grid"}
                  showFeatures={!isMobile}
                  showDescription={true}
                />
              </motion.div>
            ) : (
              // Step 2: Form + Preview
              <motion.div
                key="form-section"
                variants={pageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {/* Back Button and Header */}
                <div className="flex items-center justify-between mb-6">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>

                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <Check className="h-4 w-4" />
                    <span>{showingReview ? 'Step 3 of 3' : 'Step 2 of 3'}</span>
                  </div>
                </div>

                {/* Form Content */}
                <div className="max-w-3xl mx-auto">
                  {renderForm}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default CreateRafflePageV2
