import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"

/**
 * Phase 2: Enhanced Input variants with focus glow and state styling
 */
const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-lg border bg-background px-4 py-3 text-base shadow-xs transition-all duration-200 outline-none focus:outline-none focus:ring-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-border focus:border-primary",
        filled: "border-transparent bg-muted/50 focus:bg-background focus:border-primary",
        ghost: "border-transparent bg-transparent focus:bg-muted/30 focus:border-primary",
      },
      state: {
        default: "",
        error: "border-destructive focus:border-destructive text-destructive",
        success: "border-success focus:border-success",
        warning: "border-warning focus:border-warning",
      },
      inputSize: {
        sm: "h-8 px-3 py-1.5 text-sm",
        default: "h-10 px-4 py-2",
        lg: "h-12 px-4 py-3 text-base",
      }
    },
    defaultVariants: {
      variant: "default",
      state: "default",
      inputSize: "default",
    },
  }
)

const Input = React.forwardRef(({
  className,
  type,
  variant,
  state,
  inputSize,
  ...props
}, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      data-slot="input"
      className={cn(
        inputVariants({ variant, state, inputSize }),
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props} />
  );
})

Input.displayName = "Input"

export { Input, inputVariants }
