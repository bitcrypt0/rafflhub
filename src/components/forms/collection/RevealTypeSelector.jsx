import * as React from "react"
import { motion } from "framer-motion"
import {
  Eye,
  EyeOff,
  Clock,
  Zap,
  Hand,
  Calendar,
  Check,
} from "lucide-react"
import { cn } from "../../../lib/utils"

/**
 * RevealTypeSelector - Visual toggle for NFT reveal type selection
 * Replaces dropdown with visual cards showing each reveal option
 */
const RevealTypeSelector = React.forwardRef(({
  value = "0",
  onValueChange,
  disabled = false,
  className,
  ...props
}, ref) => {
  const revealTypes = [
    {
      value: "0",
      label: "Instant Reveal",
      description: "NFTs are fully revealed immediately upon minting",
      icon: Zap,
      secondaryIcon: Eye,
      gradient: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      textColor: "text-green-500",
    },
    {
      value: "1",
      label: "Manual Reveal",
      description: "You control when NFTs are revealed via contract call",
      icon: Hand,
      secondaryIcon: EyeOff,
      gradient: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      textColor: "text-amber-500",
    },
    {
      value: "2",
      label: "Scheduled Reveal",
      description: "NFTs automatically reveal at a specified time",
      icon: Calendar,
      secondaryIcon: Clock,
      gradient: "from-blue-500 to-indigo-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      textColor: "text-blue-500",
    },
  ]

  return (
    <div
      ref={ref}
      className={cn("grid grid-cols-1 md:grid-cols-3 gap-3", className)}
      {...props}
    >
      {revealTypes.map((type) => {
        const isSelected = value === type.value
        const Icon = type.icon
        const SecondaryIcon = type.secondaryIcon

        return (
          <motion.button
            key={type.value}
            type="button"
            onClick={() => !disabled && onValueChange?.(type.value)}
            disabled={disabled}
            className={cn(
              "relative p-4 rounded-xl border-2 text-left transition-all duration-200",
              "hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              isSelected
                ? cn(type.borderColor, type.bgColor, "shadow-sm")
                : "border-border/50 bg-card/50 hover:border-border hover:bg-card",
              disabled && "opacity-50 cursor-not-allowed hover:shadow-none"
            )}
            whileHover={!disabled ? { scale: 1.02 } : undefined}
            whileTap={!disabled ? { scale: 0.98 } : undefined}
          >
            {/* Selected indicator */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  "absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center",
                  `bg-gradient-to-br ${type.gradient}`
                )}
              >
                <Check className="h-3 w-3 text-white" />
              </motion.div>
            )}

            {/* Icon */}
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors",
              isSelected
                ? `bg-gradient-to-br ${type.gradient}`
                : "bg-muted/50"
            )}>
              <Icon className={cn(
                "h-5 w-5",
                isSelected ? "text-white" : "text-muted-foreground"
              )} />
            </div>

            {/* Content */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  "font-medium text-sm",
                  isSelected ? type.textColor : "text-foreground"
                )}>
                  {type.label}
                </h4>
                <SecondaryIcon className={cn(
                  "h-3.5 w-3.5",
                  isSelected ? type.textColor : "text-muted-foreground"
                )} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {type.description}
              </p>
            </div>

            {/* Gradient border overlay for selected state */}
            {isSelected && (
              <motion.div
                layoutId="reveal-selector-border"
                className={cn(
                  "absolute inset-0 rounded-xl border-2 pointer-events-none",
                  type.borderColor
                )}
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
})

RevealTypeSelector.displayName = "RevealTypeSelector"

export { RevealTypeSelector }
