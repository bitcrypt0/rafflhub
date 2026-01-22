import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Clock,
  Users,
  Trophy,
  Gift,
  Coins,
  Package,
  Calendar,
  Shield,
  Twitter,
  MessageCircle,
  Hash,
  Sparkles,
  ChevronRight,
} from "lucide-react"
import { cn } from "../../../lib/utils"
import { Card, CardContent, CardHeader } from "../../ui/card"

/**
 * LivePreviewCard - Real-time preview of raffle configuration
 * Shows how the raffle will appear to participants
 */
const LivePreviewCard = React.forwardRef(({
  // Raffle type info
  raffleType,
  raffleTypeName,
  raffleTypeIcon: RaffleTypeIcon,
  raffleTypeColor,

  // Form data
  formData = {},

  // Display options
  variant = "glass", // "default" | "elevated" | "glass"
  showPlaceholders = true,

  // Native currency
  currencySymbol = "ETH",

  className,
  ...props
}, ref) => {
  // Format duration display
  const formatDuration = (minutes) => {
    if (!minutes) return null
    const mins = parseInt(minutes)
    if (mins < 60) return `${mins} min`
    if (mins < 1440) return `${Math.floor(mins / 60)} hr ${mins % 60 > 0 ? `${mins % 60} min` : ''}`
    return `${Math.floor(mins / 1440)} days`
  }

  // Format date display
  const formatDate = (dateString) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return null
    }
  }

  // Get prize display based on raffle type
  const getPrizeDisplay = () => {
    switch (raffleType) {
      case 'native-giveaway':
        return formData.ethAmount ? `${formData.ethAmount} ${currencySymbol}` : null
      case 'erc20-giveaway':
        return formData.tokenAmount ? `${formData.tokenAmount} tokens` : null
      case 'nft-drop-721':
      case 'nft-drop-1155':
        return formData.collectionAddress ? 'NFT Collection' : null
      case 'lucky-sale':
        return formData.tokenId ? `NFT #${formData.tokenId}` : null
      case 'whitelist':
        return 'Whitelist Spot'
      default:
        return null
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 },
    },
  }

  // Check if we have minimum data to show preview
  const hasMinimumData = formData.name || getPrizeDisplay()

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("relative", className)}
      {...props}
    >
      <Card variant={variant} className="overflow-hidden border-2 border-border/50">
        {/* Gradient accent at top */}
        <div className={cn(
          "h-1.5 bg-gradient-to-r",
          raffleTypeColor || "from-primary to-primary/60"
        )} />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {RaffleTypeIcon && (
                <div className={cn(
                  "p-2 rounded-lg bg-gradient-to-br",
                  raffleTypeColor || "from-primary to-primary/60"
                )}>
                  <RaffleTypeIcon className="h-4 w-4 text-white" />
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Live Preview
                </p>
                <p className="text-sm font-medium text-foreground">
                  {raffleTypeName || 'Raffle'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              <Sparkles className="h-3 w-3" />
              <span>Real-time</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Raffle Name */}
          <AnimatePresence mode="wait">
            <motion.div
              key={formData.name || 'placeholder-name'}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="space-y-1"
            >
              <h3 className={cn(
                "text-xl font-display font-bold truncate",
                formData.name ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {formData.name || (showPlaceholders ? "Your Raffle Name" : "")}
              </h3>
              {formData.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {formData.description}
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Prize Display */}
          {(getPrizeDisplay() || showPlaceholders) && (
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                {raffleType === 'whitelist' ? (
                  <Trophy className="h-5 w-5 text-primary" />
                ) : raffleType?.includes('nft') || raffleType === 'lucky-sale' ? (
                  <Package className="h-5 w-5 text-primary" />
                ) : (
                  <Coins className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prize</p>
                <p className={cn(
                  "font-semibold",
                  getPrizeDisplay() ? "text-foreground" : "text-muted-foreground/50"
                )}>
                  {getPrizeDisplay() || (showPlaceholders ? "Configure prize..." : "")}
                </p>
              </div>
            </motion.div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Timing */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs">Start Time</span>
              </div>
              <p className={cn(
                "text-sm font-medium",
                formData.startTime ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {formatDate(formData.startTime) || (showPlaceholders ? "Not set" : "")}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">Duration</span>
              </div>
              <p className={cn(
                "text-sm font-medium",
                formData.duration ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {formatDuration(formData.duration) || (showPlaceholders ? "Not set" : "")}
              </p>
            </motion.div>

            {/* Participation */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Max Slots</span>
              </div>
              <p className={cn(
                "text-sm font-medium",
                formData.slotLimit ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {formData.slotLimit || (showPlaceholders ? "—" : "")}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="h-3.5 w-3.5" />
                <span className="text-xs">Winners</span>
              </div>
              <p className={cn(
                "text-sm font-medium",
                formData.winnersCount ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {formData.winnersCount || (showPlaceholders ? "—" : "")}
              </p>
            </motion.div>
          </div>

          {/* Optional Features */}
          <div className="flex flex-wrap gap-2">
            {formData.tokenGatedEnabled && (
              <motion.div
                variants={itemVariants}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium"
              >
                <Shield className="h-3 w-3" />
                <span>Token-Gated</span>
              </motion.div>
            )}

            {formData.socialEngagementRequired && (
              <motion.div
                variants={itemVariants}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-medium"
              >
                <Twitter className="h-3 w-3" />
                <span>Social Tasks</span>
              </motion.div>
            )}

            {formData.slotFee && parseFloat(formData.slotFee) > 0 && (
              <motion.div
                variants={itemVariants}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium"
              >
                <Coins className="h-3 w-3" />
                <span>{formData.slotFee} {currencySymbol}/slot</span>
              </motion.div>
            )}
          </div>

          {/* Social Links */}
          {(formData.twitterLink || formData.discordLink || formData.telegramLink) && (
            <motion.div variants={itemVariants} className="flex items-center gap-2 pt-2 border-t border-border/30">
              {formData.twitterLink && (
                <div className="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  <Twitter className="h-3.5 w-3.5" />
                </div>
              )}
              {formData.discordLink && (
                <div className="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
              )}
              {formData.telegramLink && (
                <div className="p-1.5 rounded-md bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  <Hash className="h-3.5 w-3.5" />
                </div>
              )}
            </motion.div>
          )}

          {/* Empty state */}
          {!hasMinimumData && showPlaceholders && (
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
              <span>Fill in the form to see preview</span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
})

LivePreviewCard.displayName = "LivePreviewCard"

export { LivePreviewCard }
