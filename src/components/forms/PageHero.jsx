import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

/**
 * PageHero - Reusable page header with title, subtitle, and animated background
 * Used for consistent page headers across CreateRafflePage, DeployCollectionPage, etc.
 */

const PageHero = React.forwardRef(({
  // Content
  title,
  subtitle,
  icon: Icon,
  badge,

  // Background options
  variant = "default", // "default" | "gradient" | "glass" | "minimal"
  backgroundImage,
  overlay = true,

  // Animation
  animate = true,

  // Actions
  actions,

  // Styling
  className,
  contentClassName,

  children,
  ...props
}, ref) => {
  // Variant styles
  const variantStyles = {
    default: {
      container: "bg-gradient-to-br from-card/90 via-card/80 to-card/70 backdrop-blur-sm border-b border-border/30",
      content: "py-8 md:py-12",
    },
    gradient: {
      container: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border/30",
      content: "py-10 md:py-16",
    },
    glass: {
      container: "bg-white/5 backdrop-blur-xl border-b border-white/10",
      content: "py-10 md:py-14",
    },
    minimal: {
      container: "bg-transparent",
      content: "py-6 md:py-8",
    },
  }

  const styles = variantStyles[variant]

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  }

  const Wrapper = animate ? motion.div : "div"
  const ContentWrapper = animate ? motion.div : "div"

  return (
    <Wrapper
      ref={ref}
      className={cn(
        "relative overflow-hidden",
        styles.container,
        className
      )}
      variants={animate ? containerVariants : undefined}
      initial={animate ? "hidden" : undefined}
      animate={animate ? "visible" : undefined}
      {...props}
    >
      {/* Background image with overlay */}
      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          {overlay && (
            <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background" />
          )}
        </>
      )}

      {/* Decorative gradient orbs */}
      {variant !== "minimal" && (
        <>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-primary/5 rounded-full blur-3xl opacity-50 pointer-events-none" />
        </>
      )}

      {/* Content */}
      <div className={cn(
        "relative container mx-auto px-4 md:px-6",
        styles.content,
        contentClassName
      )}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1 max-w-3xl">
            {/* Badge */}
            {badge && (
              <ContentWrapper
                variants={animate ? itemVariants : undefined}
                className="mb-3"
              >
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  {badge}
                </span>
              </ContentWrapper>
            )}

            {/* Title with optional icon */}
            <ContentWrapper
              variants={animate ? itemVariants : undefined}
              className="flex items-center gap-4"
            >
              {Icon && (
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <Icon className="h-7 w-7" />
                </div>
              )}
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                {title}
              </h1>
            </ContentWrapper>

            {/* Subtitle */}
            {subtitle && (
              <ContentWrapper
                variants={animate ? itemVariants : undefined}
                className={cn("mt-3", Icon && "md:ml-[4.5rem]")}
              >
                <p className="text-lg text-muted-foreground max-w-2xl">
                  {subtitle}
                </p>
              </ContentWrapper>
            )}

            {/* Custom children content */}
            {children && (
              <ContentWrapper
                variants={animate ? itemVariants : undefined}
                className={cn("mt-4", Icon && "md:ml-[4.5rem]")}
              >
                {children}
              </ContentWrapper>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <ContentWrapper
              variants={animate ? itemVariants : undefined}
              className="flex flex-wrap items-center gap-3"
            >
              {actions}
            </ContentWrapper>
          )}
        </div>
      </div>
    </Wrapper>
  )
})

PageHero.displayName = "PageHero"

export { PageHero }
