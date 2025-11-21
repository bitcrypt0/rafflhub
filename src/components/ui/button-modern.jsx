import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-destructive/20",
        outline:
          "border-2 border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-accent hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:-translate-y-0.5 active:translate-y-0",
        ghost:
          "hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 active:translate-y-0",
        link: 
          "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        success:
          "bg-success text-success-foreground shadow-md hover:bg-success/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-success/20",
        warning:
          "bg-warning text-warning-foreground shadow-md hover:bg-warning/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-warning/20",
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 hover:-translate-y-0.5 active:translate-y-0",
        // Modern gradient variants
        "gradient-brand":
          "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg hover:from-brand-600 hover:to-brand-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-brand/20",
        "gradient-success":
          "bg-gradient-to-r from-success-500 to-success-600 text-white shadow-lg hover:from-success-600 hover:to-success-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-success/20",
        "gradient-warning":
          "bg-gradient-to-r from-warning-500 to-warning-600 text-white shadow-lg hover:from-warning-600 hover:to-warning-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-warning/20",
        "gradient-error":
          "bg-gradient-to-r from-error-500 to-error-600 text-white shadow-lg hover:from-error-600 hover:to-error-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-error/20",
        // Glass variants
        "glass-light":
          "glass-light border border-border/50 text-foreground shadow-lg hover:glass-medium hover:-translate-y-0.5 active:translate-y-0 hover:border-border/70",
        "glass-heavy":
          "glass-heavy border border-border/50 text-foreground shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 hover:border-border/70",
        // Glow variants
        "glow-brand":
          "bg-brand-500 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-600/30 hover:-translate-y-0.5 active:translate-y-0",
        "glow-success":
          "bg-success text-white shadow-lg shadow-success/25 hover:bg-success/600 hover:shadow-xl hover:shadow-success/30 hover:-translate-y-0.5 active:translate-y-0",
        // Minimal variants
        "minimal":
          "bg-transparent text-foreground border border-border/30 hover:bg-muted/50 hover:border-border/60 transition-all duration-200",
        "minimal-dark":
          "bg-transparent text-foreground border border-border/50 hover:bg-foreground/10 hover:border-border/80 transition-all duration-200",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 py-2 has-[>svg]:px-2.5 text-xs",
        lg: "h-12 px-6 py-3 has-[>svg]:px-4 text-base",
        xl: "h-14 px-8 py-4 has-[>svg]:px-5 text-lg",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    ...props
  },
  ref
) {
  const Comp = asChild ? Slot : "button"
  
  const buttonContent = (
    <>
      {loading && (
        <motion.div
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      )}
      <Slot className={cn(loading && "opacity-0")}>{props.children}</Slot>
    </>
  )

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={loading || props.disabled}
      {...props}
    >
      {asChild ? buttonContent : buttonContent}
    </Comp>
  )
})

Button.displayName = "Button"

export { Button, buttonVariants }
