import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShoppingCart,
  Plus,
  Trash2,
  Crown,
  Gift,
  RefreshCw,
  DollarSign,
  Activity,
  ExternalLink,
  ChevronDown,
  Clock,
} from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Card } from "../ui/card"

/**
 * ActivityTimeline - Vertical timeline with rich activity cards
 * Shows user activity with icons, timestamps, and expandable details
 */

// Activity type configurations
const activityConfig = {
  ticket_purchase: {
    icon: ShoppingCart,
    color: "bg-blue-500",
    ringColor: "ring-blue-500/20",
    label: "Slot Purchased",
  },
  raffle_created: {
    icon: Plus,
    color: "bg-green-500",
    ringColor: "ring-green-500/20",
    label: "Raffle Created",
  },
  raffle_deleted: {
    icon: Trash2,
    color: "bg-red-500",
    ringColor: "ring-red-500/20",
    label: "Raffle Deleted",
  },
  prize_won: {
    icon: Crown,
    color: "bg-yellow-500",
    ringColor: "ring-yellow-500/20",
    label: "Prize Won",
  },
  prize_claimed: {
    icon: Gift,
    color: "bg-purple-500",
    ringColor: "ring-purple-500/20",
    label: "Prize Claimed",
  },
  refund_claimed: {
    icon: RefreshCw,
    color: "bg-orange-500",
    ringColor: "ring-orange-500/20",
    label: "Refund Claimed",
  },
  revenue_withdrawn: {
    icon: DollarSign,
    color: "bg-emerald-500",
    ringColor: "ring-emerald-500/20",
    label: "Revenue Withdrawn",
  },
  admin_withdrawn: {
    icon: DollarSign,
    color: "bg-indigo-500",
    ringColor: "ring-indigo-500/20",
    label: "Admin Withdrawal",
  },
  default: {
    icon: Activity,
    color: "bg-gray-500",
    ringColor: "ring-gray-500/20",
    label: "Activity",
  },
}

/**
 * ActivityTimelineItem - Individual timeline item
 */
const ActivityTimelineItem = React.forwardRef(({
  activity,
  isLast = false,
  onViewRaffle,
  className,
  ...props
}, ref) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const config = activityConfig[activity.type] || activityConfig.default
  const Icon = config.icon

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown"
    const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3 },
    },
  }

  return (
    <motion.div
      ref={ref}
      variants={itemVariants}
      className={cn("relative pl-8", className)}
      {...props}
    >
      {/* Timeline connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-10 bottom-0 w-0.5 bg-border/50" />
      )}

      {/* Timeline dot */}
      <div
        className={cn(
          "absolute left-0 top-2 w-8 h-8 rounded-full flex items-center justify-center",
          "ring-4 ring-background",
          config.color
        )}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>

      {/* Content card */}
      <Card
        variant="flat"
        className={cn(
          "p-4 ml-4 transition-all duration-200",
          "hover:shadow-md hover:border-border/80",
          isExpanded && "border-primary/30"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4 className="font-medium text-sm truncate">
              {activity.title || config.label}
            </h4>

            {/* Description */}
            {activity.description && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {activity.description}
              </p>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatTimestamp(activity.timestamp)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {activity.raffleAddress && onViewRaffle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewRaffle(activity)}
                className="h-8 w-8 p-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}

            {(activity.txHash || activity.amount) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0"
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </Button>
            )}
          </div>
        </div>

        {/* Expandable details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                {activity.amount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{activity.amount}</span>
                  </div>
                )}
                {activity.txHash && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transaction</span>
                    <a
                      href={`https://etherscan.io/tx/${activity.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-primary hover:underline"
                    >
                      {activity.txHash.slice(0, 10)}...
                    </a>
                  </div>
                )}
                {activity.prizeType && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Prize Type</span>
                    <span className="font-medium">{activity.prizeType}</span>
                  </div>
                )}
                {activity.tokenId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Token ID</span>
                    <span className="font-mono">{activity.tokenId}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
})

ActivityTimelineItem.displayName = "ActivityTimelineItem"

/**
 * ActivityTimeline - Main timeline container
 */
const ActivityTimeline = React.forwardRef(({
  activities = [],
  onViewRaffle,
  maxItems = 10,
  showLoadMore = true,
  onLoadMore,
  loading = false,
  emptyMessage = "No activity yet",
  className,
  ...props
}, ref) => {
  const [displayCount, setDisplayCount] = React.useState(maxItems)

  const visibleActivities = activities.slice(0, displayCount)
  const hasMore = activities.length > displayCount

  const handleLoadMore = () => {
    if (onLoadMore) {
      onLoadMore()
    } else {
      setDisplayCount(prev => prev + maxItems)
    }
  }

  // Container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  if (activities.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-4", className)}
      {...props}
    >
      {visibleActivities.map((activity, index) => (
        <ActivityTimelineItem
          key={activity.id || index}
          activity={activity}
          isLast={index === visibleActivities.length - 1 && !hasMore}
          onViewRaffle={onViewRaffle}
        />
      ))}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Load more button */}
      {showLoadMore && hasMore && !loading && (
        <div className="flex justify-center pt-4">
          <Button
            variant="secondary"
            onClick={handleLoadMore}
            className="gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Load More ({activities.length - displayCount} remaining)
          </Button>
        </div>
      )}
    </motion.div>
  )
})

ActivityTimeline.displayName = "ActivityTimeline"

export { ActivityTimeline, ActivityTimelineItem }
