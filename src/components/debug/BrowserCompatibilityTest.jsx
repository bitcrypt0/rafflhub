/**
 * Browser Compatibility Test Component
 * Use this component to test browser compatibility and contract call reliability
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useWallet } from '../../contexts/WalletContext';
import { useContract } from '../../contexts/ContractContext';
import { runCompatibilityTest } from '../../utils/browserCompatibilityTest';
import { getBrowserInfo, getPlatformConfig } from '../../utils/contractCallUtils';

const BrowserCompatibilityTest = ({ raffleAddress = null }) => {
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [browserInfo, setBrowserInfo] = useState(null);
  const [platformConfig, setPlatformConfig] = useState(null);
  
  const { connected } = useWallet();
  const { getContractInstance } = useContract();

  useEffect(() => {
    setBrowserInfo(getBrowserInfo());
    setPlatformConfig(getPlatformConfig());
  }, []);

  const runTest = async () => {
    setIsRunning(true);
    try {
      let contractABI = null;
      
      // Try to get contract ABI if address is provided
      if (raffleAddress && getContractInstance) {
        try {
          const contract = getContractInstance(raffleAddress, 'pool');
          contractABI = contract?.interface?.fragments || null;
        } catch (error) {
          console.warn('Could not get contract ABI for testing:', error);
        }
      }
      
      const results = await runCompatibilityTest(raffleAddress, contractABI);
      setTestResults(results);
    } catch (error) {
      console.error('Compatibility test failed:', error);
      setTestResults({
        browser: browserInfo,
        web3: { overall: 'FAILED', tests: [{ name: 'Test Error', passed: false, message: error.message }] },
        contract: null,
        recommendations: ['Test failed to run - check console for details']
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PASSED': return 'bg-green-500';
      case 'FAILED': return 'bg-red-500';
      case 'SKIPPED': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'PASSED': return 'Pass';
      case 'FAILED': return 'Fail';
      case 'SKIPPED': return 'Skip';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Browser Compatibility Test
            <Button 
              onClick={runTest} 
              disabled={isRunning}
              size="sm"
            >
              {isRunning ? 'Running...' : 'Run Test'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {browserInfo && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Browser:</strong> {browserInfo.name} {browserInfo.version}
              </div>
              <div>
                <strong>Platform:</strong> {browserInfo.isMobile ? 'Mobile' : 'Desktop'}
              </div>
              {platformConfig && (
                <>
                  <div>
                    <strong>Strategy:</strong> {platformConfig.useSequential ? 'Sequential' : 'Parallel'}
                  </div>
                  <div>
                    <strong>Batch Size:</strong> {platformConfig.batchSize}
                  </div>
                  <div>
                    <strong>Timeout:</strong> {platformConfig.timeout}ms
                  </div>
                  <div>
                    <strong>Retries:</strong> {platformConfig.retries}
                  </div>
                </>
              )}
            </div>
          )}
          
          {!connected && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Connect your wallet for more comprehensive testing
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {testResults && (
        <div className="space-y-4">
          {/* Web3 Provider Tests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Web3 Provider Tests
                <Badge className={getStatusColor(testResults.web3.overall)}>
                  {getStatusText(testResults.web3.overall)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {testResults.web3.tests.map((test, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{test.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{test.message}</span>
                      <Badge 
                        variant={test.passed ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {test.passed ? 'Pass' : 'Fail'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contract Tests */}
          {testResults.contract && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Contract Call Tests
                  <Badge className={getStatusColor(testResults.contract.overall)}>
                    {getStatusText(testResults.contract.overall)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {testResults.contract.tests.map((test, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{test.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{test.message}</span>
                        <Badge 
                          variant={test.passed ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {test.passed ? 'Pass' : 'Fail'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {testResults.recommendations && testResults.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {testResults.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default BrowserCompatibilityTest;
