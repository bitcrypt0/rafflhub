import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-600 text-white [a&]:hover:bg-blue-500/90",
        secondary:
          "border-transparent bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 [a&]:hover:bg-gray-200 dark:hover:bg-gray-700",
        destructive:
          "border-transparent bg-red-600 text-white [a&]:hover:bg-red-500/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-red-500/60",
        outline:
          "text-black dark:text-white [a&]:hover:bg-gray-200 dark:hover:bg-gray-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props} />
  );
}

export { Badge, badgeVariants }
