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
        <div className={`font-bold mb-2 ${isMobile ? 'text-xl' : 'text-2xl'}`} style={{ fontFamily: 'Orbitron, monospace' }}>
          Dropr
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
 * Content loading component - only covers content area below header
 */
export const ContentLoading = ({
  message = 'Loading...',
  isMobile = false,
  showProgress = false,
  progress = 0,
  maxProgress = 100
}) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-4">
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

/**
 * Phase 2: Blockchain-themed loading component
 */
export const BlockchainLoading = ({ 
  message = 'Processing on-chain...', 
  isMobile = false 
}) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Animated blocks */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-4 h-4 bg-primary rounded-sm animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        {/* Connecting lines */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/30 -z-10 -translate-y-1/2" />
      </div>
      <p className={cn(
        'text-muted-foreground',
        isMobile ? 'text-xs' : 'text-sm'
      )}>
        {message}
      </p>
    </div>
  );
};

/**
 * Phase 2: Transaction status component with step indicator
 */
export const TransactionStatus = ({ 
  status = 'idle', 
  steps = [],
  txHash,
  explorerUrl,
  isMobile = false 
}) => {
  const statusConfig = {
    idle: { icon: null, message: null },
    confirming: { message: 'Waiting for confirmation...' },
    pending: { message: 'Transaction pending...' },
    success: { message: 'Transaction confirmed!' },
    error: { message: 'Transaction failed' },
  };

  const config = statusConfig[status] || statusConfig.idle;

  if (status === 'idle') return null;

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      {steps.length > 0 && (
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <React.Fragment key={step.id || i}>
              <div className={cn(
                "flex items-center gap-2",
                step.status === 'complete' && "text-green-500",
                step.status === 'active' && "text-primary",
                step.status === 'pending' && "text-muted-foreground"
              )}>
                {step.status === 'complete' ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : step.status === 'active' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={cn(
                  "font-medium",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2",
                  step.status === 'complete' ? "bg-green-500" : "bg-muted"
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Status message */}
      {config.message && (
        <div className={cn(
          "flex items-center gap-2",
          status === 'success' && "text-green-500",
          status === 'error' && "text-red-500",
          (status === 'confirming' || status === 'pending') && "text-muted-foreground"
        )}>
          {(status === 'confirming' || status === 'pending') && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <span className="text-sm">{config.message}</span>
        </div>
      )}

      {/* Transaction hash link */}
      {txHash && explorerUrl && (
        <a
          href={`${explorerUrl}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View on Explorer
        </a>
      )}
    </div>
  );
};

/**
 * Phase 2: Empty state component with branded styling
 */
export const EmptyState = ({
  icon: Icon,
  title = 'No items found',
  description,
  action,
  actionLabel,
  isMobile = false
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className={cn(
        "font-semibold text-foreground mb-2",
        isMobile ? "text-lg" : "text-xl"
      )}>
        {title}
      </h3>
      {description && (
        <p className={cn(
          "text-muted-foreground max-w-md mb-6",
          isMobile ? "text-sm" : "text-base"
        )}>
          {description}
        </p>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

/**
 * Phase 2: Skeleton card for raffle loading states
 */
export const SkeletonCard = ({ isMobile = false }) => {
  return (
    <div className={cn(
      "bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden",
      isMobile ? "p-4" : "p-5"
    )}>
      {/* Status bar skeleton */}
      <div className="h-1 w-full bg-muted animate-skeleton rounded-full mb-4" />
      
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-4">
        <div className="h-5 w-32 bg-muted animate-skeleton rounded" />
        <div className="h-6 w-16 bg-muted animate-skeleton rounded-full" />
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-1">
          <div className="h-3 w-12 bg-muted animate-skeleton rounded" />
          <div className="h-4 w-16 bg-muted animate-skeleton rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-12 bg-muted animate-skeleton rounded" />
          <div className="h-4 w-8 bg-muted animate-skeleton rounded" />
        </div>
      </div>
      
      {/* Progress skeleton */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-muted animate-skeleton rounded" />
          <div className="h-3 w-12 bg-muted animate-skeleton rounded" />
        </div>
        <div className="h-2 w-full bg-muted animate-skeleton rounded-full" />
      </div>
      
      {/* Timer skeleton */}
      <div className="pt-4 border-t border-border/30">
        <div className="h-4 w-24 bg-muted animate-skeleton rounded" />
      </div>
    </div>
  );
};

export default LoadingSpinner;
