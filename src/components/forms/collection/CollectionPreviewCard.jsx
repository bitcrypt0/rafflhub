import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Image,
  Star,
  Link as LinkIcon,
  Hash,
  Percent,
  Package,
  Clock,
  Eye,
  EyeOff,
  Sparkles,
  User,
  Loader2,
  ImageOff,
} from "lucide-react"
import { cn } from "../../../lib/utils"
import { Card, CardContent, CardHeader } from "../../ui/card"

/**
 * CollectionPreviewCard - Real-time preview of NFT collection configuration
 * Shows artwork preview and collection details as user fills the form
 */
const CollectionPreviewCard = React.forwardRef(({
  // Collection type
  collectionType = "ERC721", // "ERC721" | "ERC1155"

  // Form data
  formData = {},

  // Artwork state
  artworkUrl,
  artworkLoading = false,
  artworkError = false,

  // Display options
  variant = "glass",
  showPlaceholders = true,
  sticky = false,

  className,
  ...props
}, ref) => {
  // Get reveal type display
  const getRevealTypeDisplay = (type) => {
    switch (type) {
      case "0": return { label: "Instant", icon: Eye, color: "text-success" }
      case "1": return { label: "Manual", icon: EyeOff, color: "text-amber-500" }
      case "2": return { label: "Scheduled", icon: Clock, color: "text-blue-500" }
      default: return { label: "Not set", icon: Eye, color: "text-muted-foreground" }
    }
  }

  const revealType = getRevealTypeDisplay(formData.revealType)

  // Format date display
  const formatDate = (dateString) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
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

  // Check if we have minimum data
  const hasMinimumData = formData.name || formData.symbol

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative",
        sticky && "lg:sticky lg:top-24",
        className
      )}
      {...props}
    >
      <Card variant={variant} className="overflow-hidden border-2 border-border/50">
        {/* Gradient accent at top */}
        <div className={cn(
          "h-1.5 bg-gradient-to-r",
          collectionType === "ERC721"
            ? "from-purple-500 to-pink-500"
            : "from-amber-500 to-orange-500"
        )} />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Collection Preview
              </p>
              <p className="text-sm font-medium text-foreground">
                {collectionType} Collection
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              <Sparkles className="h-3 w-3" />
              <span>Real-time</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Artwork Preview */}
          <motion.div
            variants={itemVariants}
            className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 border border-border/30"
          >
            <AnimatePresence mode="wait">
              {artworkLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading artwork...</span>
                </motion.div>
              ) : artworkUrl && !artworkError ? (
                <motion.img
                  key="artwork"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  src={artworkUrl}
                  alt="Collection artwork preview"
                  className="w-full h-full object-cover"
                  onError={() => {}} // Parent should handle error state
                />
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"
                >
                  {artworkError ? (
                    <>
                      <ImageOff className="h-10 w-10 opacity-50" />
                      <span className="text-sm">Failed to load artwork</span>
                    </>
                  ) : (
                    <>
                      <div className={cn(
                        "w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold",
                        collectionType === "ERC721"
                          ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400"
                          : "bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400"
                      )}>
                        {formData.symbol?.slice(0, 2) || (collectionType === "ERC721" ? "721" : "1155")}
                      </div>
                      <span className="text-sm">
                        {formData.dropURI || formData.unrevealedBaseURI
                          ? "Fetching artwork..."
                          : "Add Drop URI to preview artwork"}
                      </span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Collection Name & Symbol */}
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
                {formData.name || (showPlaceholders ? "Collection Name" : "")}
              </h3>
              {(formData.symbol || showPlaceholders) && (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-mono uppercase",
                    formData.symbol
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground/50"
                  )}>
                    ${formData.symbol || "SYM"}
                  </span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Max Supply */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span className="text-xs">Max Supply</span>
              </div>
              <p className={cn(
                "text-sm font-medium",
                formData.maxSupply ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {formData.maxSupply === "0" || !formData.maxSupply
                  ? (collectionType === "ERC1155" ? "Unlimited" : (showPlaceholders ? "Not set" : ""))
                  : formData.maxSupply?.toLocaleString?.() || formData.maxSupply}
              </p>
            </motion.div>

            {/* Royalty */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Percent className="h-3.5 w-3.5" />
                <span className="text-xs">Royalty</span>
              </div>
              <p className={cn(
                "text-sm font-medium",
                formData.royaltyPercentage ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {formData.royaltyPercentage ? `${formData.royaltyPercentage}%` : (showPlaceholders ? "0%" : "")}
              </p>
            </motion.div>

            {/* Reveal Type */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <revealType.icon className="h-3.5 w-3.5" />
                <span className="text-xs">Reveal</span>
              </div>
              <p className={cn(
                "text-sm font-medium",
                revealType.color
              )}>
                {revealType.label}
              </p>
            </motion.div>

            {/* Owner */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span className="text-xs">Owner</span>
              </div>
              <p className={cn(
                "text-sm font-medium font-mono text-foreground"
              )}>
                {formData.royaltyRecipient
                  ? `${formData.royaltyRecipient.slice(0, 6)}...${formData.royaltyRecipient.slice(-4)}`
                  : (showPlaceholders ? "Connected wallet" : "")}
              </p>
            </motion.div>
          </div>

          {/* Reveal Time (if scheduled) */}
          {formData.revealType === "2" && formData.revealTime && (
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
            >
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Reveals on</p>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(formData.revealTime)}
                </p>
              </div>
            </motion.div>
          )}

          {/* URIs Display */}
          <div className="space-y-2">
            {formData.baseURI && (
              <motion.div
                variants={itemVariants}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <LinkIcon className="h-3 w-3" />
                <span className="truncate font-mono">{formData.baseURI.slice(0, 40)}...</span>
              </motion.div>
            )}
            {formData.dropURI && (
              <motion.div
                variants={itemVariants}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Hash className="h-3 w-3" />
                <span className="truncate font-mono">{formData.dropURI.slice(0, 40)}...</span>
              </motion.div>
            )}
          </div>

          {/* Empty state */}
          {!hasMinimumData && showPlaceholders && (
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground border-t border-border/30"
            >
              <Sparkles className="h-4 w-4" />
              <span>Fill in the form to see preview</span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
})

CollectionPreviewCard.displayName = "CollectionPreviewCard"

export { CollectionPreviewCard }
