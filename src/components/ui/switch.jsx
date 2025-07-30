"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../../lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}) {
  const sizeClasses = {
    default: {
      root: "h-5 w-9 rounded-full",
      thumb: "h-4 w-4 rounded-full data-[state=checked]:translate-x-4"
    },
    mobile: {
      root: "h-6 w-11 rounded-lg",
      thumb: "h-4 w-4 rounded-md data-[state=checked]:translate-x-5"
    },
    large: {
      root: "h-8 w-14 rounded-full",
      thumb: "h-7 w-7 rounded-full data-[state=checked]:translate-x-6"
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.default;

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex shrink-0 cursor-pointer items-center border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
        currentSize.root,
        className
      )}
      {...props}>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block bg-background shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0",
          currentSize.thumb
        )} />
    </SwitchPrimitive.Root>
  );
}

export { Switch }
