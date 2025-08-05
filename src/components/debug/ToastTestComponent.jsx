import React from 'react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { toast } from '../ui/sonner';
import { useErrorHandler } from '../../utils/errorHandling';

/**
 * Debug component for testing toast deduplication functionality
 * Only available in development mode
 */
const ToastTestComponent = () => {
  const { handleError, handleTransactionError } = useErrorHandler();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const testDuplicateErrors = () => {
    toast.error('Transaction failed: insufficient funds');
    setTimeout(() => toast.error('Transaction failed: insufficient funds'), 100);
    setTimeout(() => toast.error('Transaction failed: insufficient funds'), 200);
  };

  const testSimilarErrors = () => {
    toast.error('Network error: timeout occurred');
    setTimeout(() => toast.error('Network Error: Timeout Occurred'), 100);
    setTimeout(() => toast.error('network error: timeout occurred'), 200);
  };

  const testDifferentTypes = () => {
    toast.error('Operation failed');
    toast.warning('Operation failed');
    toast.info('Operation failed');
    toast.success('Operation failed');
  };

  const testErrorHandler = () => {
    const error = new Error('execution reverted: insufficient funds');
    handleError(error, {
      context: { operation: 'testOperation' },
      fallbackMessage: 'Test operation failed'
    });
    
    // Try same error again - should be deduplicated
    setTimeout(() => {
      handleError(error, {
        context: { operation: 'testOperation' },
        fallbackMessage: 'Test operation failed'
      });
    }, 100);
  };

  const testTransactionError = () => {
    const error = new Error('user rejected transaction');
    handleTransactionError(error, { operation: 'testTransaction' });
    
    // Try different transaction error
    setTimeout(() => {
      const error2 = new Error('insufficient funds for gas');
      handleTransactionError(error2, { operation: 'testTransaction' });
    }, 500);
  };

  const testForceError = () => {
    toast.error('Normal error');
    toast.error('Normal error'); // Should be blocked
    
    setTimeout(() => {
      toast.forceError('Forced error');
      toast.forceError('Forced error'); // Should show both
    }, 500);
  };

  const clearToastHistory = () => {
    toast.clearHistory();
    toast.success('Toast history cleared!');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>🧪 Toast Deduplication Test Panel</CardTitle>
        <p className="text-sm text-muted-foreground">
          Development mode only - Test toast notification deduplication
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={testDuplicateErrors}
            variant="destructive"
            size="sm"
          >
            Test Duplicate Errors
          </Button>
          
          <Button 
            onClick={testSimilarErrors}
            variant="destructive"
            size="sm"
          >
            Test Similar Errors
          </Button>
          
          <Button 
            onClick={testDifferentTypes}
            variant="outline"
            size="sm"
          >
            Test Different Types
          </Button>
          
          <Button 
            onClick={testErrorHandler}
            variant="secondary"
            size="sm"
          >
            Test Error Handler
          </Button>
          
          <Button 
            onClick={testTransactionError}
            variant="secondary"
            size="sm"
          >
            Test Transaction Error
          </Button>
          
          <Button 
            onClick={testForceError}
            variant="outline"
            size="sm"
          >
            Test Force Error
          </Button>
        </div>
        
        <div className="pt-4 border-t">
          <Button 
            onClick={clearToastHistory}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Clear Toast History
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Expected Behavior:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Duplicate Errors: Only first toast should show</li>
            <li>Similar Errors: Only first toast should show (normalized)</li>
            <li>Different Types: All should show (error, warning, info, success)</li>
            <li>Error Handler: Only first should show, second blocked</li>
            <li>Transaction Error: User rejection silent, gas error shows</li>
            <li>Force Error: Both forced errors should show</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ToastTestComponent;
