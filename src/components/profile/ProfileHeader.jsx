import * as React from "react"
import { motion } from "framer-motion"
import {
  User,
  Copy,
  ExternalLink,
  Check,
  Wallet,
  Calendar,
} from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { toast } from "../ui/sonner"

/**
 * ProfileHeader - Enhanced profile header with avatar and wallet info
 * Shows connected wallet, chain info, and quick stats
 */
const ProfileHeader = React.forwardRef(({
  address,
  chainId,
  chainName,
  chainIcon: ChainIcon,
  memberSince,
  className,
  ...props
}, ref) => {
  const [copied, setCopied] = React.useState(false)

  // Generate a deterministic color based on address
  const getAvatarColors = (addr) => {
    if (!addr) return { bg: "from-primary to-primary/60", text: "text-primary-foreground" }

    // Hash the address to get consistent colors
    const hash = addr.toLowerCase().split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)

    const hue1 = Math.abs(hash % 360)
    const hue2 = (hue1 + 40) % 360

    return {
      style: {
        background: `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 70%, 40%))`,
      },
    }
  }

  const avatarColors = getAvatarColors(address)

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Copy address to clipboard
  const handleCopyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success("Address copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy address")
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  }

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm",
        "border border-border/50 shadow-xl",
        className
      )}
      {...props}
    >
      {/* Gradient background accent */}
      <div
        className="absolute inset-0 opacity-10"
        style={avatarColors.style}
      />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <motion.div
            variants={itemVariants}
            className="relative"
          >
            <div
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={avatarColors.style}
            >
              {address ? (
                <span className="text-2xl md:text-3xl font-bold font-mono">
                  {address.slice(2, 4).toUpperCase()}
                </span>
              ) : (
                <User className="h-10 w-10" />
              )}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-full border-2 border-card flex items-center justify-center">
              <Check className="h-3 w-3 text-white" />
            </div>
          </motion.div>

          {/* Info */}
          <div className="flex-1 space-y-3">
            {/* Address with copy */}
            <motion.div variants={itemVariants} className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm md:text-base">
                  {formatAddress(address)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyAddress}
                  className="h-6 w-6 p-0 ml-1"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </motion.div>

            {/* Meta info */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"
            >
              {/* Chain info */}
              {chainName && (
                <div className="flex items-center gap-2 bg-muted/30 rounded-full px-3 py-1">
                  {ChainIcon ? (
                    <ChainIcon className="h-4 w-4" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-primary/20" />
                  )}
                  <span>{chainName}</span>
                </div>
              )}

              {/* Member since */}
              {memberSince && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Member since {memberSince}</span>
                </div>
              )}
            </motion.div>
          </div>

          {/* View on explorer */}
          {address && (
            <motion.div variants={itemVariants}>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => {
                  // This would need the actual explorer URL based on chainId
                  window.open(`https://etherscan.io/address/${address}`, '_blank')
                }}
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden md:inline">View on Explorer</span>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
})

ProfileHeader.displayName = "ProfileHeader"

export { ProfileHeader }
