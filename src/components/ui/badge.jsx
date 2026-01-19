import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { CheckCircle } from "lucide-react"

import { cn } from "../../lib/utils"

/**
 * Phase 2: Enhanced Badge variants with status-specific styling and animations
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 aria-invalid:border-destructive transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        outline:
          "text-foreground [a&]:hover:bg-muted",
        // Phase 2: Status variants for raffle states
        pending:
          "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 animate-pulse-subtle",
        active:
          "border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        live:
          "border-transparent bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse",
        ended:
          "border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        drawing:
          "border-transparent bg-gradient-to-r from-purple-500 to-pink-500 text-white bg-[length:200%_100%] animate-gradient-x",
        completed:
          "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
        deleted:
          "border-transparent bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 line-through",
        success:
          "border-transparent bg-success/10 text-success dark:bg-success/20",
        warning:
          "border-transparent bg-warning/10 text-warning dark:bg-warning/20",
        info:
          "border-transparent bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        default: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props} />
  );
}

/**
 * Phase 2: StatusBadge component for raffle states with icons
 */
const statusConfig = {
  pending: { label: "Pending", variant: "pending" },
  active: { label: "Active", variant: "active" },
  live: { label: "Live", variant: "live" },
  ended: { label: "Ended", variant: "ended" },
  drawing: { label: "Drawing", variant: "drawing" },
  completed: { label: "Completed", variant: "completed", icon: CheckCircle },
  deleted: { label: "Deleted", variant: "deleted" },
  allPrizesClaimed: { label: "Prizes Claimed", variant: "completed", icon: CheckCircle },
  unengaged: { label: "Unengaged", variant: "secondary" },
}

function StatusBadge({ status, className, showIcon = true, ...props }) {
  const config = statusConfig[status] || { label: status, variant: "secondary" }
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={className} {...props}>
      {showIcon && Icon && <Icon className="size-3" />}
      {config.label}
    </Badge>
  )
}

export { Badge, badgeVariants, StatusBadge, statusConfig }
