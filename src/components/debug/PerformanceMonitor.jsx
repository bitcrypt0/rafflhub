import React, { useState, useEffect } from 'react';
import { Activity, Smartphone, Monitor, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import raffleService from '../../services/RaffleService';

/**
 * Performance monitoring component for debugging mobile vs desktop performance
 */
const PerformanceMonitor = ({ isVisible = false, onToggle }) => {
  const [stats, setStats] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);

  useEffect(() => {
    if (isVisible) {
      // Initial load
      updateStats();
      
      // Set up auto-refresh
      const interval = setInterval(updateStats, 2000);
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [isVisible]);

  const updateStats = () => {
    const cacheStats = raffleService.getCacheStats();
    setStats(cacheStats);
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getPerformanceColor = (duration) => {
    if (duration < 1000) return 'text-green-600';
    if (duration < 3000) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onToggle}
          size="sm"
          variant="outline"
          className="bg-background/80 backdrop-blur-sm"
        >
          <Activity className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-auto">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance Monitor
            </CardTitle>
            <Button onClick={onToggle} size="sm" variant="ghost">
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {stats ? (
            <>
              {/* Cache Info */}
              <div>
                <h4 className="font-semibold mb-2">Cache Status</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Entries:</span>
                    <span className="ml-1 font-mono">{stats.size}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Keys:</span>
                    <span className="ml-1 font-mono">{stats.keys.length}</span>
                  </div>
                </div>
              </div>

              {/* Performance Comparison */}
              {stats.performance && (
                <div>
                  <h4 className="font-semibold mb-2">Platform Performance</h4>
                  <div className="space-y-2">
                    {/* Mobile Stats */}
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-3 w-3" />
                      <span className="text-muted-foreground">Mobile:</span>
                      <Badge variant="outline" className="text-xs">
                        {stats.performance.mobile.totalOperations} ops
                      </Badge>
                      <span className={`font-mono ${getPerformanceColor(stats.performance.mobile.avgDuration)}`}>
                        {formatDuration(stats.performance.mobile.avgDuration)} avg
                      </span>
                    </div>

                    {/* Desktop Stats */}
                    <div className="flex items-center gap-2">
                      <Monitor className="h-3 w-3" />
                      <span className="text-muted-foreground">Desktop:</span>
                      <Badge variant="outline" className="text-xs">
                        {stats.performance.desktop.totalOperations} ops
                      </Badge>
                      <span className={`font-mono ${getPerformanceColor(stats.performance.desktop.avgDuration)}`}>
                        {formatDuration(stats.performance.desktop.avgDuration)} avg
                      </span>
                    </div>

                    {/* Performance Difference */}
                    {stats.performance.mobile.avgDuration > 0 && stats.performance.desktop.avgDuration > 0 && (
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-muted-foreground">Difference:</span>
                        <span className={`font-mono ${
                          stats.performance.mobile.avgDuration > stats.performance.desktop.avgDuration 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          {((stats.performance.mobile.avgDuration / stats.performance.desktop.avgDuration - 1) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Operation Breakdown */}
              {stats.performance && (
                <div>
                  <h4 className="font-semibold mb-2">Operations</h4>
                  <div className="space-y-1">
                    {Object.entries(stats.performance.mobile.operations).map(([op, data]) => (
                      <div key={`mobile-${op}`} className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Smartphone className="h-2 w-2" />
                          {op}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {data.count}
                          </Badge>
                          <span className={`font-mono text-xs ${getPerformanceColor(data.avgDuration)}`}>
                            {formatDuration(data.avgDuration)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {Object.entries(stats.performance.desktop.operations).map(([op, data]) => (
                      <div key={`desktop-${op}`} className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Monitor className="h-2 w-2" />
                          {op}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {data.count}
                          </Badge>
                          <span className={`font-mono text-xs ${getPerformanceColor(data.avgDuration)}`}>
                            {formatDuration(data.avgDuration)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Stats */}
              {stats.errors && Object.keys(stats.errors).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    Errors
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(stats.errors).map(([key, data]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">{key}</span>
                        <Badge variant="destructive" className="text-xs">
                          {data.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={() => {
                    raffleService.clearCache();
                    updateStats();
                  }}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Clear Cache
                </Button>
                <Button
                  onClick={() => {
                    console.log('Full Performance Stats:', stats);
                  }}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Log Stats
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <Clock className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">Loading stats...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Hook to enable performance monitoring in development
 */
export const usePerformanceMonitor = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  const isDev = process.env.NODE_ENV === 'development';

  const toggle = () => setIsVisible(!isVisible);

  // Keyboard shortcut to toggle (Ctrl/Cmd + Shift + P)
  useEffect(() => {
    if (!isDev) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDev]);

  if (!isDev) {
    return { component: null };
  }

  return {
    component: <PerformanceMonitor isVisible={isVisible} onToggle={toggle} />,
    isVisible,
    toggle
  };
};

export default PerformanceMonitor;
