/**
 * ResponsiveInput Component
 * Unified input component that handles mobile keyboard issues through responsive design
 * rather than complex event handling. Provides consistent behavior across all platforms.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';

const ResponsiveInput = React.forwardRef(({ 
  type = "text",
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
  required = false,
  min,
  max,
  step,
  ...props 
}, ref) => {
  const { isMobile } = useMobileBreakpoints();

  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      min={min}
      max={max}
      step={step}
      className={cn(
        // Base styles
        "w-full px-3 py-2 border border-border rounded-md bg-background",
        "text-foreground placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors duration-200",
        
        // Mobile-specific optimizations
        isMobile && [
          "text-base", // Prevents zoom on iOS (16px minimum)
          "min-h-[44px]", // Proper touch targets for mobile
          "touch-manipulation", // Optimizes touch interactions
        ],
        
        // Desktop/tablet optimizations
        !isMobile && [
          "text-sm", // Smaller text for desktop
          "min-h-[40px]", // Standard height for desktop
        ],
        
        className
      )}
      // Always apply mobile-friendly attributes (safe for all platforms)
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      style={{
        fontSize: isMobile ? '16px' : undefined,
        ...props.style
      }}
      {...props}
    />
  );
});

ResponsiveInput.displayName = "ResponsiveInput";

// Specialized variants for common use cases
export const ResponsiveTextarea = React.forwardRef(({ 
  value,
  onChange,
  placeholder,
  className,
  rows = 3,
  disabled = false,
  required = false,
  ...props 
}, ref) => {
  const { isMobile } = useMobileBreakpoints();

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      rows={rows}
      className={cn(
        // Base styles
        "w-full px-3 py-2 border border-border rounded-md bg-background",
        "text-foreground placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors duration-200 resize-vertical",
        
        // Mobile-specific optimizations
        isMobile && [
          "text-base", // Prevents zoom on iOS
          "min-h-[44px]", // Proper touch targets
          "touch-manipulation",
        ],
        
        // Desktop/tablet optimizations
        !isMobile && [
          "text-sm",
        ],
        
        className
      )}
      // Always apply mobile-friendly attributes (safe for all platforms)
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      style={{
        fontSize: isMobile ? '16px' : undefined,
        ...props.style
      }}
      {...props}
    />
  );
});

ResponsiveTextarea.displayName = "ResponsiveTextarea";

// Number input with mobile optimizations
export const ResponsiveNumberInput = React.forwardRef(({ 
  value,
  onChange,
  placeholder,
  className,
  min,
  max,
  step = "any",
  disabled = false,
  required = false,
  ...props 
}, ref) => {
  const { isMobile } = useMobileBreakpoints();

  return (
    <ResponsiveInput
      ref={ref}
      type="number"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      required={required}
      className={cn(
        // Number input specific styles
        "[appearance:textfield]", // Remove spinner on Firefox
        "[&::-webkit-outer-spin-button]:appearance-none",
        "[&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
      // Mobile-friendly numeric input attributes (safe for all platforms)
      inputMode={isMobile ? "decimal" : undefined}
      pattern={isMobile ? "[0-9]*" : undefined}
      {...props}
    />
  );
});

ResponsiveNumberInput.displayName = "ResponsiveNumberInput";

// Address input with mobile optimizations
export const ResponsiveAddressInput = React.forwardRef(({ 
  value,
  onChange,
  placeholder = "0x...",
  className,
  disabled = false,
  required = false,
  ...props 
}, ref) => {
  return (
    <ResponsiveInput
      ref={ref}
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={cn(
        // Address-specific styles
        "font-mono", // Monospace for addresses
        "tracking-tight", // Tighter letter spacing
        className
      )}
      // Address-specific attributes
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      {...props}
    />
  );
});

ResponsiveAddressInput.displayName = "ResponsiveAddressInput";

export default ResponsiveInput;
