import React from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Enhanced loading component with mobile optimizations
 */
export const LoadingSpinner = ({ 
  size = 'default', 
  className = '',
  text = '',
  showText = true 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
        {showText && text && (
          <p className="text-sm text-muted-foreground">{text}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Full page loading component
 */
export const PageLoading = ({
  message = 'Loading...',
  isMobile = false,
  showProgress = false,
  progress = 0,
  maxProgress = 100
}) => {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="text-center space-y-4 px-4">
        <div className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
          Rafflhub
        </div>
        
        <LoadingSpinner 
          size={isMobile ? 'lg' : 'xl'} 
          text={message}
          showText={true}
        />
        
        {showProgress && (
          <div className="w-64 max-w-full mx-auto">
            <div className="bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress / maxProgress) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {progress} / {maxProgress}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Card loading skeleton
 */
export const CardSkeleton = ({ count = 1, isMobile = false }) => {
  const skeletons = Array.from({ length: count }, (_, i) => (
    <div 
      key={i} 
      className={cn(
        'bg-card border border-border rounded-lg p-4 space-y-3',
        isMobile ? 'h-48' : 'h-64'
      )}
    >
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="h-3 bg-muted rounded w-1/2"></div>
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded"></div>
          <div className="h-3 bg-muted rounded w-5/6"></div>
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="h-6 bg-muted rounded w-16"></div>
          <div className="h-8 bg-muted rounded w-20"></div>
        </div>
      </div>
    </div>
  ));

  if (isMobile) {
    return <div className="space-y-4">{skeletons}</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {skeletons}
    </div>
  );
};

/**
 * Network status indicator
 */
export const NetworkStatus = ({ 
  isConnected = true, 
  isLoading = false,
  isMobile = false 
}) => {
  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center gap-2 text-muted-foreground',
        isMobile ? 'text-xs' : 'text-sm'
      )}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-2',
      isConnected ? 'text-green-600' : 'text-red-600',
      isMobile ? 'text-xs' : 'text-sm'
    )}>
      {isConnected ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
};

/**
 * Progressive loading component for mobile
 */
export const ProgressiveLoader = ({ 
  items = [], 
  isLoading = false,
  onLoadMore,
  hasMore = false,
  isMobile = false 
}) => {
  if (isLoading && items.length === 0) {
    return (
      <div className="text-center py-8">
        <LoadingSpinner 
          size={isMobile ? 'default' : 'lg'} 
          text="Loading raffles..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="animate-fade-in-up">
          {item}
        </div>
      ))}
      
      {isLoading && items.length > 0 && (
        <div className="text-center py-4">
          <LoadingSpinner 
            size="sm" 
            text="Loading more..."
            showText={!isMobile}
          />
        </div>
      )}
      
      {!isLoading && hasMore && onLoadMore && (
        <div className="text-center py-4">
          <button
            onClick={onLoadMore}
            className="text-primary hover:text-primary/80 text-sm font-medium"
          >
            Load more raffles
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Search loading component
 */
export const SearchLoading = ({ isMobile = false }) => {
  return (
    <div className={cn(
      'flex items-center justify-center py-4',
      isMobile ? 'py-2' : 'py-4'
    )}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className={cn('animate-spin', isMobile ? 'h-3 w-3' : 'h-4 w-4')} />
        <span className={isMobile ? 'text-xs' : 'text-sm'}>
          Searching...
        </span>
      </div>
    </div>
  );
};

/**
 * Inline loading component for buttons
 */
export const ButtonLoading = ({ 
  isLoading = false, 
  children, 
  loadingText = 'Loading...',
  ...props 
}) => {
  return (
    <button {...props} disabled={isLoading || props.disabled}>
      {isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{loadingText}</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

/**
 * Retry loading component
 */
export const RetryLoader = ({ 
  onRetry, 
  message = 'Failed to load', 
  retryText = 'Try again',
  isLoading = false,
  isMobile = false 
}) => {
  return (
    <div className={cn(
      'text-center py-8',
      isMobile && 'py-4'
    )}>
      {isLoading ? (
        <LoadingSpinner 
          size={isMobile ? 'default' : 'lg'} 
          text="Retrying..."
        />
      ) : (
        <div className="space-y-3">
          <p className={cn(
            'text-muted-foreground',
            isMobile ? 'text-sm' : 'text-base'
          )}>
            {message}
          </p>
          <button
            onClick={onRetry}
            className="text-primary hover:text-primary/80 font-medium text-sm"
          >
            {retryText}
          </button>
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
