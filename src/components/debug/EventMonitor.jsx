import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Clock, Activity, Wifi, WifiOff, Eye, EyeOff } from 'lucide-react';

/**
 * Debug component for monitoring raffle event listening
 * Only available in development mode
 */
const EventMonitor = ({ 
  isListening, 
  eventHistory = [], 
  lastBlockNumber,
  raffleAddress,
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventIcon = (eventName) => {
    switch (eventName) {
      case 'WinnersSelected':
        return '🏆';
      case 'PrizeClaimed':
        return '🎁';
      case 'TicketsPurchased':
        return '🎫';
      default:
        return '📡';
    }
  };

  const getEventColor = (eventName) => {
    switch (eventName) {
      case 'WinnersSelected':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PrizeClaimed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'TicketsPurchased':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const recentEvents = eventHistory.slice(-5).reverse();

  return (
    <Card className={`border-dashed border-2 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Event Monitor
            {isListening ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-6 px-2"
            >
              {showDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2"
            >
              {isExpanded ? '−' : '+'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        {/* Status Overview */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className={isListening ? 'text-green-600' : 'text-red-600'}>
              {isListening ? 'Listening' : 'Disconnected'}
            </span>
          </div>
          
          {lastBlockNumber && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-500" />
              <span className="text-gray-600">Block: {lastBlockNumber}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <span className="text-gray-600">Events: {eventHistory.length}</span>
          </div>
        </div>

        {showDetails && raffleAddress && (
          <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
            Raffle: {raffleAddress.slice(0, 10)}...{raffleAddress.slice(-8)}
          </div>
        )}

        {/* Recent Events */}
        {isExpanded && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-700">Recent Events:</div>
            
            {recentEvents.length === 0 ? (
              <div className="text-xs text-gray-500 italic py-2">
                No events received yet...
              </div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {recentEvents.map((event, index) => (
                  <div
                    key={`${event.timestamp}-${index}`}
                    className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded"
                  >
                    <span className="text-base">{getEventIcon(event.eventName)}</span>
                    
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-1 py-0 ${getEventColor(event.eventName)}`}
                    >
                      {event.eventName}
                    </Badge>
                    
                    <span className="text-gray-500 flex-1">
                      {formatTimestamp(event.timestamp)}
                    </span>
                    
                    {event.blockNumber && (
                      <span className="text-gray-400 text-xs">
                        #{event.blockNumber}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {eventHistory.length > 5 && (
              <div className="text-xs text-gray-500 text-center">
                ... and {eventHistory.length - 5} more events
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {isExpanded && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log('Event History:', eventHistory)}
              className="text-xs h-6"
            >
              Log Events
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('Event Listener Status:', {
                  isListening,
                  raffleAddress,
                  lastBlockNumber,
                  eventCount: eventHistory.length,
                  recentEvents: recentEvents.map(e => ({
                    event: e.eventName,
                    time: formatTimestamp(e.timestamp),
                    block: e.blockNumber
                  }))
                });
              }}
              className="text-xs h-6"
            >
              Log Status
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EventMonitor;
