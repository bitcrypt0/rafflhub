import * as React from "react"
import { motion } from "framer-motion"
import {
  Users,
  Package,
  Gift,
  Coins,
  CircleDollarSign,
  Sparkles,
  Check,
  ChevronRight,
} from "lucide-react"
import { cn } from "../../../lib/utils"
import { Card } from "../../ui/card"

/**
 * RaffleTypeSelector - Visual card-based raffle type selection
 * Replaces the filter bar with an intuitive visual selector
 */

// Raffle type configurations
const RAFFLE_TYPES = [
  {
    id: 'whitelist',
    name: 'Whitelist Pool',
    description: 'Create a whitelisting event for your community.',
    icon: Users,
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    features: ['100% Trustless','Optional token-gating', 'Multiple winners'],
    poolType: 'Whitelist/Allowlist',
  },
  {
    id: 'nft-drop-721',
    name: 'NFT Drop (ERC721)',
    description: 'Deploy pools to fairly distribute your collection.',
    icon: Package,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    features: ['Supports customized contracts (must implement the IMintable interface)', 'Flexible ticket pricing', 'On-demand minting'],
    poolType: 'NFTDrop',
    nftStandard: 'ERC721',
  },
  {
    id: 'nft-drop-1155',
    name: 'NFT Drop (ERC1155)',
    description: 'Distribute edition NFTs.',
    icon: Package,
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    features: ['Supports customized contracts (must implement the IMintable interface)', 'Flexible ticket pricing', 'On-demand minting'],
    poolType: 'NFTDrop',
    nftStandard: 'ERC1155',
  },
  {
    id: 'lucky-sale',
    name: 'NFT Lucky Sale/NFT Giveaway',
    description: 'Give away an existing NFT from your wallet.',
    icon: Gift,
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    features: ['Securely escrowed', 'Flexible ticket pricing', 'Single winner'],
    poolType: 'Lucky Sale/NFT Pool',
    nftStandard: 'ERC721',
  },
  {
    id: 'native-giveaway',
    name: 'Native Token Giveaway',
    description: 'Reward your community with ETH/BSC/AVAX.',
    icon: Coins,
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    features: ['Securely escrowed', 'Equally split among winners', 'Optional token-gating'],
    poolType: 'Native Token Pool',
  },
  {
    id: 'erc20-giveaway',
    name: 'Token Giveaway',
    description: 'Give away ERC20 tokens to lucky participants.',
    icon: CircleDollarSign,
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    features: ['Securely escrowed', 'Equally split among winners', 'Multiple winners'],
    poolType: 'ERC20 Token Pool',
  },
]

const RaffleTypeSelector = React.forwardRef(({
  // Selection state
  selectedType,
  onTypeSelect,

  // Display options
  layout = "grid", // "grid" | "list" | "compact"
  showFeatures = true,
  showDescription = true,

  // Styling
  className,

  ...props
}, ref) => {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
  }

  // Layout classes
  const layoutClasses = {
    grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
    list: "flex flex-col gap-3",
    compact: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3",
  }

  return (
    <motion.div
      ref={ref}
      className={cn(layoutClasses[layout], className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {RAFFLE_TYPES.map((type) => (
        <RaffleTypeCard
          key={type.id}
          type={type}
          isSelected={selectedType === type.id}
          onSelect={() => onTypeSelect(type)}
          layout={layout}
          showFeatures={showFeatures && layout !== "compact"}
          showDescription={showDescription && layout !== "compact"}
          variants={cardVariants}
        />
      ))}
    </motion.div>
  )
})

RaffleTypeSelector.displayName = "RaffleTypeSelector"

/**
 * Individual raffle type card
 */
const RaffleTypeCard = ({
  type,
  isSelected,
  onSelect,
  layout,
  showFeatures,
  showDescription,
  variants,
}) => {
  const Icon = type.icon

  // Compact layout
  if (layout === "compact") {
    return (
      <motion.button
        type="button"
        onClick={onSelect}
        variants={variants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
          isSelected
            ? `border-primary bg-primary/10 shadow-lg`
            : "border-border/50 bg-card/50 hover:border-border hover:bg-card/80"
        )}
      >
        <span className={cn(
          "text-xs font-medium text-center leading-tight",
          isSelected ? "text-primary" : "text-foreground"
        )}>
          {type.name}
        </span>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2"
          >
            <Check className="h-4 w-4 text-primary" />
          </motion.div>
        )}
      </motion.button>
    )
  }

  // List layout
  if (layout === "list") {
    return (
      <motion.button
        type="button"
        onClick={onSelect}
        variants={variants}
        whileHover={{ x: 4 }}
        className={cn(
          "relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left",
          isSelected
            ? `border-primary bg-primary/5 shadow-lg`
            : "border-border/50 bg-card/50 hover:border-border hover:bg-card/80"
        )}
      >
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-foreground">{type.name}</h4>
            {isSelected && <Check className="h-4 w-4 text-primary" />}
          </div>
          {showDescription && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {type.description}
            </p>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight className={cn(
          "h-5 w-5 shrink-0 transition-transform",
          isSelected ? "text-primary" : "text-muted-foreground"
        )} />
      </motion.button>
    )
  }

  // Default grid layout
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      variants={variants}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex flex-col p-5 rounded-xl border-2 transition-all duration-200 text-left h-full",
        isSelected
          ? `border-primary bg-primary/5 shadow-xl shadow-primary/10`
          : "border-border/50 bg-card/50 hover:border-border hover:bg-card/80 hover:shadow-lg"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"
        >
          <Check className="h-4 w-4" />
        </motion.div>
      )}

      {/* Gradient accent */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r opacity-0 transition-opacity",
        type.color,
        isSelected && "opacity-100"
      )} />

      {/* Title */}
      <h4 className={cn(
        "font-display text-lg font-semibold mb-1",
        isSelected ? "text-primary" : "text-foreground"
      )}>
        {type.name}
      </h4>

      {/* Description */}
      {showDescription && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {type.description}
        </p>
      )}

      {/* Features */}
      {showFeatures && type.features && (
        <div className="mt-auto pt-4 border-t border-border/30">
          <ul className="space-y-1.5">
            {type.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary/60" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.button>
  )
}

/**
 * Helper hook to get raffle type configuration
 */
export const useRaffleTypeConfig = (typeId) => {
  return React.useMemo(() => {
    return RAFFLE_TYPES.find(type => type.id === typeId) || null
  }, [typeId])
}

/**
 * Get raffle type by pool type and standard
 */
export const getRaffleTypeByPoolConfig = (poolType, nftStandard) => {
  return RAFFLE_TYPES.find(type => {
    if (type.poolType !== poolType) return false
    if (type.nftStandard && type.nftStandard !== nftStandard) return false
    return true
  })
}

export { RaffleTypeSelector, RAFFLE_TYPES }
