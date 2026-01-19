import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "../../lib/utils"

/**
 * Phase 2: Enhanced Card variants with glassmorphism, elevation, and glow effects
 */
const cardVariants = cva(
  "relative overflow-hidden rounded-xl transition-all duration-300 flex flex-col",
  {
    variants: {
      variant: {
        default: "bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-xl hover:border-border/80",
        elevated: "bg-card/90 backdrop-blur-md border border-border/30 shadow-xl hover:shadow-2xl hover:-translate-y-1",
        glass: "bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl",
        gradient: "bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm border border-border/30",
        interactive: "bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg hover:border-primary/50 hover:shadow-primary/10 cursor-pointer hover:-translate-y-0.5",
        flat: "bg-card border border-border",
      },
      glow: {
        none: "",
        primary: "hover:shadow-glow-primary",
        success: "hover:shadow-glow-success",
        warning: "hover:shadow-glow-warning",
      },
      padding: {
        none: "",
        sm: "gap-4",
        default: "gap-6",
        lg: "gap-8",
      }
    },
    defaultVariants: {
      variant: "default",
      glow: "none",
      padding: "default",
    },
  }
)

function Card({
  className,
  variant,
  glow,
  padding,
  ...props
}) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, glow, padding }), className)}
      {...props} />
  );
}

function CardHeader({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 py-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props} />
  );
}

function CardTitle({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props} />
  );
}

function CardDescription({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props} />
  );
}

function CardAction({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props} />
  );
}

function CardContent({
  className,
  ...props
}) {
  return (<div data-slot="card-content" className={cn("px-6 py-6", className)} {...props} />);
}

function CardFooter({
  className,
  ...props
}) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 py-4 [.border-t]:pt-6", className)}
      {...props} />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
