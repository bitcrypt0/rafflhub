import * as React from "react"
import { Copy, ExternalLink, Check, Coins, Image as ImageIcon } from "lucide-react"
import { cn } from "../../lib/utils"

/**
 * Phase 4: Token/NFT Display Components for Web3 UI patterns
 */

/**
 * TokenAmount - Formatted token display with icon
 */
const TokenAmount = ({
  amount,
  symbol,
  decimals = 18,
  icon,
  showIcon = true,
  size = "default",
  className,
}) => {
  const sizeClasses = {
    sm: "text-sm",
    default: "text-base",
    lg: "text-lg font-semibold",
    xl: "text-2xl font-bold",
  }

  const iconSizes = {
    sm: "h-4 w-4",
    default: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-8 w-8",
  }

  return (
    <div className={cn("flex items-center gap-2", sizeClasses[size], className)}>
      {showIcon && (
        icon ? (
          <img src={icon} alt={symbol} className={cn("rounded-full", iconSizes[size])} />
        ) : (
          <div className={cn(
            "rounded-full bg-primary/10 flex items-center justify-center",
            iconSizes[size]
          )}>
            <Coins className={cn("text-primary", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
          </div>
        )
      )}
      <span className="font-mono">{amount}</span>
      {symbol && <span className="text-muted-foreground">{symbol}</span>}
    </div>
  )
}

/**
 * AddressDisplay - Truncated address with copy and explorer link
 */
const AddressDisplay = ({
  address,
  explorerUrl,
  truncate = true,
  showCopy = true,
  showExplorer = true,
  label,
  size = "default",
  className,
}) => {
  const [copied, setCopied] = React.useState(false)

  const formatAddress = (addr) => {
    if (!addr) return ""
    if (!truncate) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const handleCopy = async (e) => {
    e.stopPropagation()
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const sizeClasses = {
    sm: "text-xs",
    default: "text-sm",
    lg: "text-base",
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <span className={cn("text-muted-foreground", sizeClasses[size])}>{label}</span>
      )}
      <span className={cn("font-mono", sizeClasses[size])}>
        {formatAddress(address)}
      </span>
      <div className="flex items-center gap-1">
        {showCopy && (
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Copy address"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        )}
        {showExplorer && explorerUrl && (
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-muted rounded transition-colors"
            title="View on explorer"
          >
            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
          </a>
        )}
      </div>
    </div>
  )
}

/**
 * NFTPreview - Image with loading state and metadata
 */
const NFTPreview = ({
  imageUrl,
  name,
  collection,
  tokenId,
  onClick,
  selected = false,
  size = "default",
  className,
}) => {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  const sizeClasses = {
    sm: "w-16 h-16",
    default: "w-24 h-24",
    lg: "w-32 h-32",
    xl: "w-48 h-48",
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all duration-200",
        selected ? "border-primary shadow-glow-primary" : "border-border hover:border-primary/50",
        onClick && "cursor-pointer hover:-translate-y-0.5",
        className
      )}
    >
      <div className={cn("relative bg-muted", sizeClasses[size])}>
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={name || `Token #${tokenId}`}
            className={cn(
              "w-full h-full object-cover transition-opacity",
              loading ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
          />
        )}
        
        {/* Selection indicator */}
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>
      
      {/* Metadata */}
      {(name || tokenId) && (
        <div className="p-2 bg-card/80 backdrop-blur-sm">
          {collection && (
            <div className="text-[10px] text-muted-foreground truncate">{collection}</div>
          )}
          <div className="text-xs font-medium truncate">
            {name || `#${tokenId}`}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * NFTCard - Full NFT card with details
 */
const NFTCard = ({
  imageUrl,
  name,
  collection,
  tokenId,
  owner,
  price,
  priceSymbol,
  onClick,
  selected = false,
  className,
}) => {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card rounded-xl overflow-hidden border transition-all duration-300",
        selected ? "border-primary shadow-glow-primary" : "border-border hover:border-primary/50 hover:shadow-xl",
        onClick && "cursor-pointer hover:-translate-y-1",
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={name || `Token #${tokenId}`}
            className={cn(
              "w-full h-full object-cover transition-all duration-300 group-hover:scale-105",
              loading ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
          />
        )}
        
        {/* Selection indicator */}
        {selected && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Check className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-2">
        {collection && (
          <div className="text-xs text-muted-foreground truncate">{collection}</div>
        )}
        <div className="font-semibold truncate group-hover:text-primary transition-colors">
          {name || `Token #${tokenId}`}
        </div>
        
        {price && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Price</span>
            <TokenAmount amount={price} symbol={priceSymbol} size="sm" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * GasEstimate - Real-time gas estimation display
 */
const GasEstimate = ({
  gasLimit,
  gasPrice,
  estimatedCost,
  symbol = "ETH",
  loading = false,
  className,
}) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm",
      className
    )}>
      <span className="text-muted-foreground">Estimated Gas</span>
      <div className="flex items-center gap-2">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-16 h-4 bg-muted animate-pulse rounded" />
          </div>
        ) : (
          <>
            <span className="font-mono">{estimatedCost}</span>
            <span className="text-muted-foreground">{symbol}</span>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * StaleDataIndicator - Shows when data might be outdated
 */
const StaleDataIndicator = ({
  lastUpdated,
  onRefresh,
  refreshing = false,
  staleThreshold = 60000, // 1 minute
  className,
}) => {
  const [isStale, setIsStale] = React.useState(false)

  React.useEffect(() => {
    if (!lastUpdated) return
    
    const checkStale = () => {
      const now = Date.now()
      setIsStale(now - lastUpdated > staleThreshold)
    }
    
    checkStale()
    const interval = setInterval(checkStale, 10000)
    return () => clearInterval(interval)
  }, [lastUpdated, staleThreshold])

  if (!isStale) return null

  return (
    <div className={cn(
      "flex items-center gap-2 text-xs text-warning",
      className
    )}>
      <div className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
      <span>Data may be outdated</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-primary hover:underline disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      )}
    </div>
  )
}

export {
  TokenAmount,
  AddressDisplay,
  NFTPreview,
  NFTCard,
  GasEstimate,
  StaleDataIndicator,
}
