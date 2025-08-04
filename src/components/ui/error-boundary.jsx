import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { getBrowserInfo } from '../../utils/contractCallUtils';

/**
 * Enhanced Error Boundary with mobile-specific handling
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      browserInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const browserInfo = getBrowserInfo();

    this.setState({
      error,
      errorInfo,
      browserInfo
    });

    // Enhanced logging with browser information
    console.group('🚨 Error Boundary Caught Error');
    console.log('Browser:', browserInfo);
    console.log('Error:', error);
    console.log('Error Info:', errorInfo);
    console.groupEnd();

    // Report to error tracking service if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false,
        custom_parameters: {
          browser: browserInfo.name,
          browser_version: browserInfo.version,
          is_mobile: browserInfo.isMobile
        }
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  getBrowserSpecificErrorInfo = () => {
    const { error, browserInfo } = this.state;
    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    // Check for browser-specific issues
    if (errorMessage.includes('missing revert data') ||
        errorMessage.includes('call exception') ||
        errorMessage.includes('CALL_EXCEPTION')) {
      return {
        title: 'Network Connection Issue',
        message: `Your browser (${browserInfo?.name || 'unknown'}) is experiencing connectivity issues with the blockchain network.`,
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Switch to a different network and back',
          browserInfo?.name === 'firefox' ? 'Firefox may need extra time - please be patient' : 'Try using Chrome for better compatibility'
        ]
      };
    }

    if (errorMessage.includes('MetaMask') || errorMessage.includes('wallet')) {
      return {
        title: 'Wallet Connection Issue',
        message: 'There was a problem connecting to your wallet.',
        suggestions: [
          'Make sure MetaMask is installed and unlocked',
          'Try disconnecting and reconnecting your wallet',
          'Refresh the page and try again'
        ]
      };
    }

    // Browser-specific recommendations
    const suggestions = ['Refresh the page and try again'];
    if (browserInfo?.name === 'firefox') {
      suggestions.push('Firefox users may experience slower loading - please be patient');
    } else if (browserInfo?.name === 'safari') {
      suggestions.push('Safari users should ensure they have the latest version');
    } else if (browserInfo?.name === 'edge') {
      suggestions.push('Edge users may need to clear browser cache');
    }

    if (browserInfo?.isMobile) {
      suggestions.push('Mobile users: ensure stable internet connection');
    }

    return {
      title: 'Something went wrong',
      message: 'An unexpected error occurred while loading the application.',
      suggestions
    };
  };

  render() {
    if (this.state.hasError) {
      const { isMobile = false, fallbackComponent } = this.props;
      const { error, retryCount, browserInfo } = this.state;
      const errorInfo = this.getBrowserSpecificErrorInfo();

      // Use custom fallback if provided
      if (fallbackComponent) {
        return fallbackComponent(error, this.handleRetry, this.handleGoHome);
      }

      // Mobile-optimized error UI
      if (isMobile) {
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle className="text-lg">{errorInfo.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  {errorInfo.message}
                </p>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Try these solutions:</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {errorInfo.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {retryCount < 3 && (
                  <Button 
                    onClick={this.handleRetry} 
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                
                <Button 
                  onClick={this.handleGoHome} 
                  variant="outline" 
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>

                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer">
                      Error Details (Dev)
                    </summary>
                    <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto">
                      {error && error.toString()}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          </div>
        );
      }

      // Desktop error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-6" />
              <CardTitle className="text-2xl">Oops! Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground text-center">
                The application encountered an unexpected error. This could be due to:
              </p>
              
              <ul className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto">
                <li>• Network connectivity issues</li>
                <li>• Blockchain RPC provider problems</li>
                <li>• Temporary service disruption</li>
                <li>• Browser compatibility issues</li>
              </ul>

              <div className="flex gap-4 justify-center">
                {retryCount < 3 && (
                  <Button onClick={this.handleRetry} variant="default">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                
                <Button onClick={this.handleGoHome} variant="outline">
                  <Home className="h-4 w-4 mr-2" />
                  Return Home
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6">
                  <summary className="text-sm text-muted-foreground cursor-pointer mb-2">
                    Technical Details (Development Mode)
                  </summary>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-xs overflow-auto">
                      {error && error.toString()}
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling async errors in functional components
 */
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error) => {
    console.error('Async error caught:', error);
    setError(error);
  }, []);

  // Throw error to be caught by ErrorBoundary
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
};

/**
 * Network Error Component
 */
export const NetworkError = ({ error, onRetry, isMobile = false }) => {
  const getErrorMessage = (error) => {
    if (error?.message?.includes('Too Many Requests')) {
      return 'Rate limit exceeded. Please wait a moment before trying again.';
    }
    if (error?.message?.includes('timeout')) {
      return 'Request timed out. Please check your connection and try again.';
    }
    if (error?.message?.includes('network')) {
      return 'Network error. Please check your internet connection.';
    }
    if (error?.message?.includes('not available')) {
      return 'Smart contracts not available on this network.';
    }
    return 'Unable to connect to the blockchain. Please try again.';
  };

  if (isMobile) {
    return (
      <div className="text-center py-8 px-4">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <h3 className="font-semibold mb-2">Connection Problem</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {getErrorMessage(error)}
        </p>
        {onRetry && (
          <Button onClick={onRetry} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="font-semibold mb-2">Connection Problem</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {getErrorMessage(error)}
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Loading Error Component for partial failures
 */
export const LoadingError = ({ message, onRetry, compact = false }) => {
  if (compact) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground mb-2">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} size="sm" variant="ghost">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorBoundary;
