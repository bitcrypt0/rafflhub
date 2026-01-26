/**
 * PoolActivity Component
 *
 * Displays slot purchase activity for a pool.
 * Uses table/row-based layout matching the screenshot design.
 * Fetches activity data from backend API (when implemented).
 *
 * Variants:
 * - 'standard': For StandardPoolLayout - used inside RaffleInfoTabs
 * - 'nft': For NFTPoolLayout - used inside RaffleInfoTabs
 */

import React, { useState, useEffect } from 'react';
import { Activity, Clock, Ticket, AlertCircle } from 'lucide-react';

/**
 * Format relative time (e.g., "2m", "1h", "3d")
 */
const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'Now';
};

/**
 * Main PoolActivity Component - Table-based layout
 */
const PoolActivity = ({
  raffle,
  variant = 'standard',
  className = '',
}) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Fetch activity from backend (placeholder for future implementation)
  useEffect(() => {
    const fetchActivity = async () => {
      if (!raffle?.address) return;

      setLoading(true);
      setError(null);

      try {
        // TODO: Replace with actual backend API call when implemented
        // const response = await fetch(`/api/pools/${raffle.address}/activity`);
        // const data = await response.json();
        // setActivities(data.activities);
        // setBackendAvailable(true);

        // For now, backend is not available
        setBackendAvailable(false);
        setActivities([]);
      } catch (err) {
        console.error('Failed to fetch pool activity:', err);
        setError('Failed to load activity');
        setBackendAvailable(false);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [raffle?.address]);

  // Render table-based activity list
  const renderActivityTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!backendAvailable) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h4 className="font-medium text-foreground mb-1">Activity Tracking Coming Soon</h4>
          <p className="text-sm text-muted-foreground max-w-xs">Backend service not yet implemented</p>
        </div>
      );
    }

    if (activities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h4 className="font-medium text-foreground mb-1">No Activity Yet</h4>
          <p className="text-sm text-muted-foreground max-w-xs">Slot purchases will appear here</p>
        </div>
      );
    }

    return (
      <div className="w-full">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50 bg-muted/20">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Participant</div>
          <div className="col-span-3 text-center">Slots</div>
          <div className="col-span-3 text-right">Time</div>
        </div>
        
        {/* Table Rows */}
        <div className="divide-y divide-border/30">
          {activities.map((activity, i) => (
            <div 
              key={activity.id || i}
              className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
            >
              {/* Rank */}
              <div className="col-span-1 text-sm font-medium text-muted-foreground">
                {i + 1}
              </div>
              
              {/* Participant Address */}
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-primary" />
                <span className="font-mono text-sm truncate" title={activity.address}>
                  {activity.address.slice(0, 6)}...{activity.address.slice(-4)}
                </span>
              </div>
              
              {/* Slots Purchased */}
              <div className="col-span-3 text-center">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                  <Ticket className="h-3 w-3 text-primary" />
                  {activity.slots}
                </span>
              </div>
              
              {/* Time */}
              <div className="col-span-3 flex justify-end">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`pool-activity-content h-full flex flex-col ${className}`}>
      {renderActivityTable()}
    </div>
  );
};

export default PoolActivity;
