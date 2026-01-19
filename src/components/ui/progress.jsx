import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"

/**
 * Phase 2: Enhanced Progress variants with gradient, glow, and shimmer effects
 */
const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full",
  {
    variants: {
      size: {
        sm: "h-1.5",
        default: "h-2",
        md: "h-3",
        lg: "h-4",
      },
      variant: {
        default: "bg-primary/20",
        muted: "bg-muted/50",
        gradient: "bg-muted/30",
      }
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-500",
  {
    variants: {
      variant: {
        default: "bg-primary",
        gradient: "bg-gradient-to-r from-primary via-primary/80 to-primary",
        success: "bg-gradient-to-r from-green-500 to-green-400",
        warning: "bg-gradient-to-r from-yellow-500 to-yellow-400",
        danger: "bg-gradient-to-r from-red-500 to-red-400",
      }
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Progress({
  className,
  value,
  size,
  variant = "default",
  indicatorVariant,
  showGlow = false,
  showShimmer = false,
  ...props
}) {
  const safeValue = Math.min(100, Math.max(0, value || 0))
  
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(progressVariants({ size, variant }), className)}
      {...props}>
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          indicatorVariants({ variant: indicatorVariant || variant }),
          "rounded-full"
        )}
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
      {/* Shimmer overlay */}
      {showShimmer && safeValue > 0 && (
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-full"
          style={{ width: `${safeValue}%` }}
        />
      )}
      {/* Glow effect at progress edge */}
      {showGlow && safeValue > 0 && safeValue < 100 && (
        <div
          className="absolute top-0 bottom-0 w-2 bg-primary/50 blur-sm rounded-full"
          style={{ left: `calc(${safeValue}% - 4px)` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
}

/**
 * Phase 2: EnhancedProgress component with all visual effects enabled
 */
function EnhancedProgress({
  className,
  value,
  size = "md",
  showLabel = false,
  labelPosition = "right",
  ...props
}) {
  const safeValue = Math.min(100, Math.max(0, value || 0))
  
  if (showLabel && labelPosition === "right") {
    return (
      <div className="flex items-center gap-3">
        <Progress 
          value={safeValue} 
          size={size} 
          variant="gradient"
          indicatorVariant="gradient"
          showGlow
          showShimmer
          className={cn("flex-1", className)}
          {...props} 
        />
        <span className="text-sm font-medium text-muted-foreground min-w-[3ch] text-right">
          {Math.round(safeValue)}%
        </span>
      </div>
    )
  }
  
  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && labelPosition === "top" && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{Math.round(safeValue)}%</span>
        </div>
      )}
      <Progress 
        value={safeValue} 
        size={size} 
        variant="gradient"
        indicatorVariant="gradient"
        showGlow
        showShimmer
        {...props} 
      />
    </div>
  )
}

export { Progress, EnhancedProgress, progressVariants, indicatorVariants }
