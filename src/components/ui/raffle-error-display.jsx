import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { useNavigate } from 'react-router-dom';

/**
 * Specialized error display component for raffle-related errors
 * Handles different error types with appropriate messaging and actions
 */
export const RaffleErrorDisplay = ({ 
  error, 
  onRetry, 
  isMobile = false,
  showCreateButton = true 
}) => {
  const navigate = useNavigate();

  const getErrorContent = (errorType) => {
    switch (errorType) {
      case 'CONTRACTS_NOT_AVAILABLE':
        return {
          title: 'Network Not Supported',
          message: 'Dropr is not available on this network. Check back soon!',
          icon: <AlertCircle className="h-8 w-8 text-orange-500" />,
          showRetry: false,
          showCreate: false
        };
      
      case 'NO_RAFFLES_FOUND':
        return {
          title: 'No Pools Found',
          message: 'No Pools are found on this network! Be the first user to create a Pool.',
          icon: <AlertCircle className="h-8 w-8 text-blue-500" />,
          showRetry: true,
          showCreate: true
        };
      
      case 'RATE_LIMIT':
        return {
          title: 'Rate Limit Exceeded',
          message: 'Too many requests. Please wait a moment and try again.',
          icon: <AlertCircle className="h-8 w-8 text-yellow-500" />,
          showRetry: true,
          showCreate: false
        };
      
      case 'TIMEOUT':
        return {
          title: 'Request Timeout',
          message: 'Request timed out. Please check your connection and try again.',
          icon: <AlertCircle className="h-8 w-8 text-red-500" />,
          showRetry: true,
          showCreate: false
        };
      
      case 'NETWORK_ERROR':
      default:
        return {
          title: 'Network Error',
          message: 'Unable to connect to the blockchain. Please check your connection and try again.',
          icon: <AlertCircle className="h-8 w-8 text-red-500" />,
          showRetry: true,
          showCreate: false
        };
    }
  };

  const handleCreatePool = () => {
    navigate('/create-raffle');
  };

  // Handle both string error messages and error codes
  const errorType = typeof error === 'string' ? error : error?.message || 'NETWORK_ERROR';
  const content = getErrorContent(errorType);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center max-w-md mx-auto">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {content.icon}
        </div>

        {/* Title */}
        <h3 className={`font-semibold mb-3 ${isMobile ? 'text-lg' : 'text-xl'}`}>
          {content.title}
        </h3>

        {/* Message */}
        <p className={`text-muted-foreground mb-6 ${isMobile ? 'text-sm' : 'text-base'}`}>
          {content.message}
        </p>

        {/* Action Buttons */}
        <div className={`flex gap-3 ${isMobile ? 'flex-col' : 'flex-row justify-center'}`}>
          {content.showRetry && onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className={`${isMobile ? 'w-full' : ''}`}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}

          {content.showCreate && showCreateButton && (
            <Button
              onClick={handleCreatePool}
              className={`${isMobile ? 'w-full' : ''}`}
            >
              Create Pool
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Mobile-optimized version of the raffle error display
 */
export const MobileRaffleErrorDisplay = ({ error, onRetry, showCreateButton = true }) => {
  return (
    <RaffleErrorDisplay 
      error={error} 
      onRetry={onRetry} 
      isMobile={true} 
      showCreateButton={showCreateButton}
    />
  );
};

export default RaffleErrorDisplay;
