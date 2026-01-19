import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "../../lib/utils"

/**
 * Phase 2: Enhanced Button variants with gradient, glow effects, and loading state
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        // Brand-first variants
        primary:
          "bg-brand-500 text-white shadow-sm hover:bg-brand-600 hover:shadow-md active:scale-[0.98]",
        secondary:
          "border-2 border-brand-500 text-brand-500 bg-transparent shadow-sm hover:bg-brand-500/10 active:scale-[0.98]",
        tertiary:
          "text-[color:var(--brand-tertiary)] bg-transparent hover:bg-brand-500/10 active:scale-[0.98]",
        // Phase 2: New gradient variant with animated background
        gradient:
          "bg-gradient-to-r from-brand-500 via-brand-400 to-brand-500 bg-[length:200%_100%] text-white shadow-lg hover:shadow-xl hover:shadow-brand-500/20 animate-gradient-x active:scale-[0.98]",
        // Phase 2: Glow variant for premium CTAs
        glow:
          "bg-brand-500 text-white shadow-lg hover:shadow-glow-primary hover:bg-brand-600 active:scale-[0.98]",
        // Backward compatibility aliases
        default:
          "bg-brand-500 text-white shadow-sm hover:bg-brand-600 hover:shadow-md active:scale-[0.98]",
        outline:
          "border-2 border-brand-500 text-brand-500 bg-transparent shadow-sm hover:bg-brand-500/10 active:scale-[0.98]",
        ghost:
          "text-[color:var(--brand-tertiary)] hover:bg-brand-500/10 active:scale-[0.98]",
        link: "text-[color:var(--brand-tertiary)] underline-offset-4 hover:underline",
        // Semantic variants retained
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-glow-error active:scale-[0.98]",
        success:
          "bg-success text-success-foreground shadow-sm hover:bg-success/90 hover:shadow-glow-success active:scale-[0.98]",
        warning:
          "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90 hover:shadow-glow-warning active:scale-[0.98]",
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 active:scale-[0.98]",
      },
      size: {
        md: "h-10 px-4 py-2 text-[length:var(--text-base)] has-[>svg]:px-3",
        default: "h-10 px-4 py-2 text-[length:var(--text-base)] has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 py-2 text-[length:var(--text-sm)] has-[>svg]:px-2.5",
        lg: "h-12 px-6 py-3 text-[length:var(--text-base)] has-[>svg]:px-4",
        xl: "h-14 px-8 py-3 text-[length:var(--text-lg)] has-[>svg]:px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
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
    loadingText,
    children,
    ...props
  },
  ref
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      type={props.type ?? "button"}
      aria-disabled={props.disabled || loading ? true : undefined}
      disabled={props.disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText && <span>{loadingText}</span>}
        </span>
      ) : (
        children
      )}
    </Comp>
  );
});

Button.displayName = "Button";

/**
 * Phase 2: ButtonLoading component for inline loading states
 */
const ButtonLoading = ({ text = "Processing..." }) => (
  <span className="flex items-center gap-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>{text}</span>
  </span>
);

export { Button, buttonVariants, ButtonLoading }
