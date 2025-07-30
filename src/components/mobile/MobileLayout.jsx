import React from 'react';
import { cn } from '../../lib/utils';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';

// Mobile-first responsive container
export const MobileContainer = ({ 
  children, 
  variant = 'default',
  className = '',
  noPadding = false
}) => {
  const { isMobile, isTablet } = useMobileBreakpoints();

  const getPaddingClasses = () => {
    if (noPadding) return '';
    
    switch (variant) {
      case 'narrow':
        return 'px-4 sm:px-6 md:px-8 lg:px-12 xl:px-20 2xl:px-32';
      case 'wide':
        return 'px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20';
      case 'form':
        return 'px-4 sm:px-6 md:px-8 lg:px-12';
      case 'tight':
        return 'px-3 sm:px-4 md:px-6';
      case 'default':
      default:
        return 'px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12';
    }
  };

  const baseClasses = cn(
    'mx-auto w-full',
    getPaddingClasses(),
    className
  );
  
  return (
    <div className={baseClasses}>
      {children}
    </div>
  );
};

// Mobile-optimized page wrapper
export const MobilePage = ({ 
  children, 
  className = '',
  variant = 'default',
  hasBottomNav = false
}) => {
  const { isMobile } = useMobileBreakpoints();
  
  return (
    <div className={cn(
      'min-h-screen bg-background',
      isMobile && hasBottomNav && 'pb-16', // Space for bottom navigation
      className
    )}>
      <MobileContainer variant={variant}>
        {children}
      </MobileContainer>
    </div>
  );
};

// Mobile-first grid system
export const MobileGrid = ({ 
  children, 
  cols = 1,
  smCols = null,
  mdCols = null,
  lgCols = null,
  gap = 4,
  className = ''
}) => {
  const gridClasses = cn(
    'grid',
    `grid-cols-${cols}`,
    smCols && `sm:grid-cols-${smCols}`,
    mdCols && `md:grid-cols-${mdCols}`,
    lgCols && `lg:grid-cols-${lgCols}`,
    `gap-${gap}`,
    className
  );

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};

// Mobile-optimized card component
export const MobileCard = ({ 
  children, 
  className = '',
  variant = 'default',
  padding = 'default'
}) => {
  const { isMobile } = useMobileBreakpoints();

  const getPaddingClasses = () => {
    if (isMobile) {
      switch (padding) {
        case 'tight': return 'p-3';
        case 'loose': return 'p-6';
        case 'none': return 'p-0';
        default: return 'p-4';
      }
    } else {
      switch (padding) {
        case 'tight': return 'p-4';
        case 'loose': return 'p-8';
        case 'none': return 'p-0';
        default: return 'p-6';
      }
    }
  };

  const cardClasses = cn(
    'bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-lg transition-all duration-300',
    isMobile ? 'hover:shadow-lg' : 'hover:shadow-xl hover:border-border/80',
    getPaddingClasses(),
    className
  );

  return (
    <div className={cardClasses}>
      {children}
    </div>
  );
};

// Mobile-friendly section wrapper
export const MobileSection = ({ 
  children, 
  title,
  subtitle,
  className = '',
  headerClassName = '',
  spacing = 'default'
}) => {
  const { isMobile } = useMobileBreakpoints();

  const getSpacingClasses = () => {
    if (isMobile) {
      switch (spacing) {
        case 'tight': return 'py-4';
        case 'loose': return 'py-8';
        default: return 'py-6';
      }
    } else {
      switch (spacing) {
        case 'tight': return 'py-6';
        case 'loose': return 'py-12';
        default: return 'py-8';
      }
    }
  };

  return (
    <section className={cn(getSpacingClasses(), className)}>
      {(title || subtitle) && (
        <div className={cn('mb-6', headerClassName)}>
          {title && (
            <h2 className={cn(
              'font-bold text-foreground',
              isMobile ? 'text-xl mb-2' : 'text-2xl mb-3'
            )}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p className={cn(
              'text-muted-foreground',
              isMobile ? 'text-sm' : 'text-base'
            )}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
};

// Mobile stack layout (vertical on mobile, horizontal on desktop)
export const MobileStack = ({ 
  children, 
  direction = 'vertical',
  spacing = 4,
  className = ''
}) => {
  const { isMobile } = useMobileBreakpoints();

  const stackClasses = cn(
    'flex',
    isMobile || direction === 'vertical' 
      ? `flex-col gap-${spacing}` 
      : `flex-row gap-${spacing} items-center`,
    className
  );

  return (
    <div className={stackClasses}>
      {children}
    </div>
  );
};

// Mobile-optimized responsive wrapper
export const ResponsiveWrapper = ({ 
  mobile, 
  tablet, 
  desktop, 
  fallback 
}) => {
  const { isMobile, isTablet, isDesktop } = useMobileBreakpoints();

  if (isMobile && mobile) return mobile;
  if (isTablet && tablet) return tablet;
  if (isDesktop && desktop) return desktop;
  
  return fallback || mobile || tablet || desktop;
};
