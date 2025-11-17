import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

const Card = React.forwardRef(function Card(
  { className, variant = "default", hover = true, ...props },
  ref
) {
  const variants = {
    default: "bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300",
    elevated: "bg-card border border-border/30 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300",
    glass: "glass-light border border-border/30 rounded-2xl shadow-lg hover:glass-medium hover:shadow-xl transition-all duration-300",
    gradient: "bg-gradient-to-br from-card to-muted border border-border/30 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300",
    minimal: "bg-background border border-border/20 rounded-xl shadow-sm hover:shadow-md hover:border-border/40 transition-all duration-300",
    outline: "bg-background border-2 border-border rounded-xl shadow-none hover:border-border/60 hover:shadow-sm transition-all duration-300",
  }

  return (
    <motion.div
      ref={ref}
      data-slot="card"
      className={cn(
        variants[variant],
        hover && "hover:-translate-y-1 cursor-pointer",
        "flex flex-col gap-6",
        className
      )}
      whileHover={hover ? { y: -4 } : {}}
      transition={{ duration: 0.2, ease: "easeOut" }}
      {...props}
    />
  )
})

const CardHeader = React.forwardRef(function CardHeader(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 py-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
})

const CardTitle = React.forwardRef(function CardTitle(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="card-title"
      className={cn("leading-none font-semibold font-display text-lg", className)}
      {...props}
    />
  )
})

const CardDescription = React.forwardRef(function CardDescription(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm leading-relaxed", className)}
      {...props}
    />
  )
})

const CardAction = React.forwardRef(function CardAction(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
})

const CardContent = React.forwardRef(function CardContent(
  { className, ...props },
  ref
) {
  return (
    <div 
      ref={ref} 
      data-slot="card-content" 
      className={cn("px-6 py-6", className)} 
      {...props} 
    />
  )
})

const CardFooter = React.forwardRef(function CardFooter(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn("flex items-center px-6 py-4 [.border-t]:pt-6", className)}
      {...props}
    />
  )
})

// Modern card variants
const ModernCard = React.forwardRef(function ModernCard(
  { 
    className, 
    children, 
    gradient = false, 
    glow = false, 
    interactive = true,
    ...props 
  },
  ref
) {
  return (
    <motion.div
      ref={ref}
      className={cn(
        "relative group",
        "bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl shadow-lg",
        "transition-all duration-300 ease-out",
        interactive && "hover:shadow-xl hover:-translate-y-2 cursor-pointer",
        gradient && "bg-gradient-to-br from-card via-card to-muted",
        glow && "shadow-lg shadow-brand-500/10 hover:shadow-xl hover:shadow-brand-500/20",
        className
      )}
      whileHover={interactive ? { 
        y: -8, 
        scale: 1.02,
        transition: { duration: 0.2, ease: "easeOut" }
      } : {}}
      whileTap={interactive ? { scale: 0.98 } : {}}
      {...props}
    >
      {/* Subtle gradient overlay */}
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-600/5 rounded-2xl pointer-events-none" />
      )}
      
      {/* Glow effect */}
      {glow && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-500/10 via-transparent to-brand-600/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  )
})

const GlassCard = React.forwardRef(function GlassCard(
  { className, children, intensity = "medium", ...props },
  ref
) {
  const intensityClasses = {
    light: "glass-light border border-border/30",
    medium: "glass-medium border border-border/40", 
    heavy: "glass-heavy border border-border/50"
  }

  return (
    <motion.div
      ref={ref}
      className={cn(
        "relative group",
        intensityClasses[intensity],
        "rounded-2xl shadow-lg",
        "transition-all duration-300 ease-out",
        "hover:shadow-xl hover:-translate-y-1",
        className
      )}
      whileHover={{ 
        y: -4, 
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
})

const GradientCard = React.forwardRef(function GradientCard(
  { 
    className, 
    children, 
    from = "brand-500", 
    to = "brand-600", 
    direction = "br",
    ...props 
  },
  ref
) {
  const directionClasses = {
    t: "to-t",
    tr: "to-tr", 
    r: "to-r",
    br: "to-br",
    b: "to-b",
    bl: "to-bl",
    l: "to-l",
    tl: "to-tl"
  }

  return (
    <motion.div
      ref={ref}
      className={cn(
        "relative group overflow-hidden",
        "bg-gradient-to-" + directionClasses[direction],
        `from-${from} to-${to}`,
        "rounded-2xl shadow-lg shadow-brand-500/20",
        "transition-all duration-300 ease-out",
        "hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-1",
        className
      )}
      whileHover={{ 
        y: -4, 
        scale: 1.01,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      {...props}
    >
      {/* Inner content background */}
      <div className="absolute inset-0 bg-background/10 backdrop-blur-sm rounded-2xl" />
      
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10 rounded-2xl" />
      
      <div className="relative z-10 text-white">
        {children}
      </div>
    </motion.div>
  )
})

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  ModernCard,
  GlassCard,
  GradientCard,
}
