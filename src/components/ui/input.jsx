import * as React from "react"

import { cn } from "../../lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200",
        className
      )}
      {...props} />
  );
}

export { Input }
