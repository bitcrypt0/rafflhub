import React from 'react';
import { cn } from '../../lib/utils';
import { useMobileBreakpoints, useIsTouchDevice } from '../../hooks/useMobileBreakpoints';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../ui/select';

// Mobile-optimized form wrapper
export const MobileForm = ({ 
  children, 
  onSubmit,
  className = '',
  spacing = 'default'
}) => {
  const { isMobile } = useMobileBreakpoints();

  const getSpacingClasses = () => {
    switch (spacing) {
      case 'tight': return isMobile ? 'space-y-4' : 'space-y-5';
      case 'loose': return isMobile ? 'space-y-6' : 'space-y-8';
      default: return isMobile ? 'space-y-5' : 'space-y-6';
    }
  };

  return (
    <form 
      onSubmit={onSubmit}
      className={cn(
        'w-full',
        getSpacingClasses(),
        className
      )}
    >
      {children}
    </form>
  );
};

// Touch-friendly input component
export const MobileInput = ({ 
  label,
  error,
  required = false,
  className = '',
  inputClassName = '',
  type = 'text',
  ...props
}) => {
  const { isMobile } = useMobileBreakpoints();
  const isTouchDevice = useIsTouchDevice();

  const inputClasses = cn(
    'w-full border border-border rounded-lg bg-background transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
    isMobile || isTouchDevice 
      ? 'h-12 px-4 py-3 text-base' // Larger touch targets
      : 'h-10 px-3 py-2 text-sm',
    error && 'border-destructive focus:ring-destructive/20 focus:border-destructive',
    inputClassName
  );

  // Mobile-specific input modes
  const getInputMode = () => {
    switch (type) {
      case 'number': return 'numeric';
      case 'email': return 'email';
      case 'tel': return 'tel';
      case 'url': return 'url';
      default: return 'text';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className={cn(
          'block font-medium text-foreground',
          isMobile ? 'text-base' : 'text-sm'
        )}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <input
        type={type}
        inputMode={isMobile ? getInputMode() : undefined}
        className={inputClasses}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};

// Mobile-optimized select component
export const MobileSelect = ({ 
  label,
  error,
  required = false,
  placeholder = "Select an option",
  children,
  className = '',
  ...props
}) => {
  const { isMobile } = useMobileBreakpoints();

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className={cn(
          'block font-medium text-foreground',
          isMobile ? 'text-base' : 'text-sm'
        )}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select {...props}>
        <SelectTrigger className={cn(
          'w-full border border-border rounded-lg bg-background',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          isMobile ? 'h-12 px-4 text-base' : 'h-10 px-3 text-sm',
          error && 'border-destructive focus:ring-destructive/20 focus:border-destructive'
        )}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {children}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};

// Mobile-optimized textarea
export const MobileTextarea = ({ 
  label,
  error,
  required = false,
  className = '',
  rows = 4,
  ...props
}) => {
  const { isMobile } = useMobileBreakpoints();

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className={cn(
          'block font-medium text-foreground',
          isMobile ? 'text-base' : 'text-sm'
        )}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <textarea
        rows={isMobile ? Math.max(rows, 3) : rows}
        className={cn(
          'w-full border border-border rounded-lg bg-background transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'resize-none',
          isMobile ? 'p-4 text-base' : 'p-3 text-sm',
          error && 'border-destructive focus:ring-destructive/20 focus:border-destructive'
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};

// Touch-friendly button component
export const MobileButton = ({ 
  children,
  variant = 'default',
  size = 'default',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const { isMobile } = useMobileBreakpoints();
  const isTouchDevice = useIsTouchDevice();

  const getMobileSize = () => {
    if (!isMobile && !isTouchDevice) return size;
    
    switch (size) {
      case 'sm': return 'default';
      case 'lg': return 'xl';
      case 'xl': return 'xl';
      default: return 'lg';
    }
  };

  return (
    <Button
      variant={variant}
      size={getMobileSize()}
      className={cn(
        isMobile && 'min-h-[44px]', // Minimum touch target
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

// Mobile form field group
export const MobileFieldGroup = ({ 
  children,
  cols = 1,
  smCols = null,
  className = ''
}) => {
  const { isMobile } = useMobileBreakpoints();

  const gridClasses = cn(
    'grid gap-4',
    `grid-cols-${cols}`,
    !isMobile && smCols && `sm:grid-cols-${smCols}`,
    className
  );

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};

// Mobile form section with collapsible header
export const MobileFormSection = ({ 
  title,
  subtitle,
  children,
  collapsible = false,
  defaultOpen = true,
  className = ''
}) => {
  const { isMobile } = useMobileBreakpoints();
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('space-y-4', className)}>
      <div 
        className={cn(
          'flex items-center justify-between',
          collapsible && 'cursor-pointer'
        )}
        onClick={collapsible ? () => setIsOpen(!isOpen) : undefined}
      >
        <div>
          <h3 className={cn(
            'font-semibold text-foreground',
            isMobile ? 'text-lg' : 'text-xl'
          )}>
            {title}
          </h3>
          {subtitle && (
            <p className={cn(
              'text-muted-foreground',
              isMobile ? 'text-sm' : 'text-base'
            )}>
              {subtitle}
            </p>
          )}
        </div>
        {collapsible && (
          <Button variant="ghost" size="sm">
            {isOpen ? '−' : '+'}
          </Button>
        )}
      </div>
      
      {(!collapsible || isOpen) && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};
