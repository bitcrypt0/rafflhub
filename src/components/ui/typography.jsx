import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Typography Component Library
 * Provides consistent, reusable text components using the fluid typography scale
 * from typography.css. All components use CSS variables for responsive sizing.
 */

// Page Heading (H1) - Main page titles
export const PageHeading = React.forwardRef(({ className, children, ...props }, ref) => (
  <h1
    ref={ref}
    className={cn(
      "font-display font-bold",
      "text-[length:var(--text-4xl)]",
      "leading-tight tracking-tighter",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </h1>
));
PageHeading.displayName = "PageHeading";

// Section Heading (H2) - Major section titles
export const SectionHeading = React.forwardRef(({ className, children, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "font-display font-semibold",
      "text-[length:var(--text-3xl)]",
      "leading-tight tracking-tight",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </h2>
));
SectionHeading.displayName = "SectionHeading";

// Subsection Heading (H3) - Subsection titles
export const SubsectionHeading = React.forwardRef(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-display font-semibold",
      "text-[length:var(--text-2xl)]",
      "leading-snug tracking-tight",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </h3>
));
SubsectionHeading.displayName = "SubsectionHeading";

// Card Heading (H3/H4) - Card and component titles
export const CardHeading = React.forwardRef(({ className, children, as: Component = "h3", ...props }, ref) => (
  <Component
    ref={ref}
    className={cn(
      "font-display font-semibold",
      "text-[length:var(--text-xl)]",
      "leading-snug tracking-normal",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </Component>
));
CardHeading.displayName = "CardHeading";

// Body Text (P) - Standard paragraph text
export const BodyText = React.forwardRef(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "font-body",
      "text-[length:var(--text-base)]",
      "leading-relaxed tracking-normal",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </p>
));
BodyText.displayName = "BodyText";

// Large Text - Emphasized body text
export const LargeText = React.forwardRef(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "font-body",
      "text-[length:var(--text-lg)]",
      "leading-relaxed tracking-normal",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </p>
));
LargeText.displayName = "LargeText";

// Small Text - De-emphasized text
export const SmallText = React.forwardRef(({ className, children, as: Component = "span", ...props }, ref) => (
  <Component
    ref={ref}
    className={cn(
      "font-body",
      "text-[length:var(--text-sm)]",
      "leading-normal tracking-normal",
      "text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </Component>
));
SmallText.displayName = "SmallText";

// Extra Small Text - Fine print, captions
export const ExtraSmallText = React.forwardRef(({ className, children, as: Component = "span", ...props }, ref) => (
  <Component
    ref={ref}
    className={cn(
      "font-body",
      "text-[length:var(--text-xs)]",
      "leading-normal tracking-normal",
      "text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </Component>
));
ExtraSmallText.displayName = "ExtraSmallText";

// Label Text - Form labels and input labels
export const LabelText = React.forwardRef(({ className, children, htmlFor, ...props }, ref) => (
  <label
    ref={ref}
    htmlFor={htmlFor}
    className={cn(
      "font-body font-medium",
      "text-[length:var(--text-base)]",
      "leading-normal tracking-normal",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </label>
));
LabelText.displayName = "LabelText";

// Muted Text - Secondary information
export const MutedText = React.forwardRef(({ className, children, as: Component = "span", ...props }, ref) => (
  <Component
    ref={ref}
    className={cn(
      "font-body",
      "text-[length:var(--text-sm)]",
      "leading-normal tracking-normal",
      "text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </Component>
));
MutedText.displayName = "MutedText";

// Display Text - Large hero text
export const DisplayText = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "font-display font-bold",
      "text-[length:var(--text-5xl)]",
      "leading-tight tracking-tighter",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
));
DisplayText.displayName = "DisplayText";

// Inline Code - Code snippets
export const InlineCode = React.forwardRef(({ className, children, ...props }, ref) => (
  <code
    ref={ref}
    className={cn(
      "font-mono",
      "text-[length:var(--text-sm)]",
      "px-1.5 py-0.5 rounded",
      "bg-muted text-foreground",
      "border border-border",
      className
    )}
    {...props}
  >
    {children}
  </code>
));
InlineCode.displayName = "InlineCode";

// Lead Text - Introduction paragraphs
export const LeadText = React.forwardRef(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "font-body",
      "text-[length:var(--text-xl)]",
      "leading-relaxed tracking-normal",
      "text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </p>
));
LeadText.displayName = "LeadText";

// Blockquote - Quoted text
export const Blockquote = React.forwardRef(({ className, children, ...props }, ref) => (
  <blockquote
    ref={ref}
    className={cn(
      "font-display italic",
      "text-[length:var(--text-lg)]",
      "leading-relaxed tracking-normal",
      "border-l-4 border-primary pl-6 my-4",
      "text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </blockquote>
));
Blockquote.displayName = "Blockquote";
