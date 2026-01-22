import * as React from "react"
import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { cn } from "../../lib/utils"
import { Card } from "../ui/card"

/**
 * AnimatedStatCard - Stats card with animated counter and gradient background
 * Features count-up animation on load and hover effects
 */
const AnimatedStatCard = React.forwardRef(({
  // Content
  label,
  value,
  suffix = "",
  prefix = "",
  decimals = 0,

  // Visual
  icon: Icon,
  gradient = "from-primary to-primary/60",
  iconColor = "text-primary",

  // Options
  animationDuration = 1.5,
  animateOnView = true,

  className,
  ...props
}, ref) => {
  const [hasAnimated, setHasAnimated] = React.useState(false)
  const count = useMotionValue(0)
  const roundedCount = useTransform(count, (latest) => {
    if (decimals > 0) {
      return latest.toFixed(decimals)
    }
    return Math.round(latest).toLocaleString()
  })

  // Parse the value to a number
  const numericValue = React.useMemo(() => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''))
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }, [value])

  // Animate count when component comes into view
  React.useEffect(() => {
    if (hasAnimated || !animateOnView) return

    const controls = animate(count, numericValue, {
      duration: animationDuration,
      ease: "easeOut",
      onComplete: () => setHasAnimated(true),
    })

    return controls.stop
  }, [numericValue, animationDuration, hasAnimated, animateOnView])

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.4, ease: "easeOut" },
    },
    hover: {
      y: -4,
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  }

  return (
    <motion.div
      ref={ref}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className={cn("relative", className)}
      {...props}
    >
      <Card variant="elevated" className="relative overflow-hidden p-4 md:p-5">
        {/* Gradient background accent */}
        <div
          className={cn(
            "absolute inset-0 opacity-10 bg-gradient-to-br",
            gradient
          )}
        />

        {/* Gradient border accent */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
            gradient
          )}
        />

        <div className="relative flex items-center gap-4">
          {/* Icon */}
          {Icon && (
            <div
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl",
                "bg-gradient-to-br opacity-90",
                gradient
              )}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <motion.p
              className="text-2xl md:text-3xl font-bold font-display truncate"
            >
              {prefix}
              <motion.span>{roundedCount}</motion.span>
              {suffix && <span className="text-lg ml-1">{suffix}</span>}
            </motion.p>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {label}
            </p>
          </div>
        </div>

        {/* Subtle shine effect on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full"
          whileHover={{ translateX: "100%" }}
          transition={{ duration: 0.6 }}
        />
      </Card>
    </motion.div>
  )
})

AnimatedStatCard.displayName = "AnimatedStatCard"

/**
 * StatCardGrid - Grid container for stat cards
 */
const StatCardGrid = React.forwardRef(({
  children,
  columns = 4,
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        columns === 5 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

StatCardGrid.displayName = "StatCardGrid"

export { AnimatedStatCard, StatCardGrid }
