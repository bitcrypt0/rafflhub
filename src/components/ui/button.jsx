import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Brand-first variants
        primary:
          "bg-brand-500 text-white shadow-sm hover:bg-brand-600 focus-visible:ring-brand/20",
        secondary:
          "border-2 border-brand-500 text-brand-500 bg-transparent shadow-sm hover:bg-brand-500/10 focus-visible:ring-brand/15",
        tertiary:
          "text-[color:var(--brand-tertiary)] bg-transparent hover:bg-brand-500/10",
        // Backward compatibility aliases
        default:
          "bg-brand-500 text-white shadow-sm hover:bg-brand-600 focus-visible:ring-brand/20",
        outline:
          "border-2 border-brand-500 text-brand-500 bg-transparent shadow-sm hover:bg-brand-500/10",
        ghost:
          "text-[color:var(--brand-tertiary)] hover:bg-brand-500/10",
        link: "text-[color:var(--brand-tertiary)] underline-offset-4 hover:underline",
        // Semantic variants retained
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20",
        success:
          "bg-success text-success-foreground shadow-sm hover:bg-success/90 focus-visible:ring-success/20",
        warning:
          "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90 focus-visible:ring-warning/20",
        accent:
          "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 focus-visible:ring-accent/20",
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
      aria-disabled={props.disabled ? true : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants }
