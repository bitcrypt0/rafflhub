/**
 * PoolActivity Component
 *
 * Displays slot purchase activity for a pool.
 * Fetches activity data from backend API (when implemented).
 * Currently shows a placeholder with backend-ready structure.
 *
 * Variants:
 * - 'standard': For StandardPoolLayout - matches RaffleDetailsCard height
 * - 'nft': For NFTPoolLayout - matches WinnersSection height
 */

import React, { useState, useEffect } from 'react';
import { Activity, Clock, User, Ticket, AlertCircle } from 'lucide-react';

/**
 * Format relative time (e.g., "2 mins ago")
 */
const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

/**
 * Truncate address for display
 */
const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Activity Item Component
 */
const ActivityItem = ({ activity }) => {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Ticket className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {truncateAddress(activity.address)}
          </p>
          <p className="text-xs text-muted-foreground">
            Purchased {activity.slots} slot{activity.slots !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatRelativeTime(activity.timestamp)}
      </div>
    </div>
  );
};

/**
 * Empty State Component
 */
const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Activity className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">No activity yet</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Slot purchases will appear here
      </p>
    </div>
  );
};

/**
 * Backend Not Available State
 */
const BackendPendingState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
      <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">Activity tracking coming soon</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Backend service not yet implemented
      </p>
    </div>
  );
};

/**
 * Main PoolActivity Component
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

  // Height classes based on variant
  // 'standard' variant matches RaffleDetailsCard (no min-height constraint)
  // 'nft' variant matches WinnersSection height constraints
  const heightClasses = variant === 'nft'
    ? 'h-full flex flex-col min-h-[360px] sm:min-h-[380px] lg:min-h-[420px]'
    : 'h-full flex flex-col';

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

  return (
    <div className={`detail-beige-card bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${heightClasses} ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-display text-[length:var(--text-lg)] font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Pool Activity
        </h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !backendAvailable ? (
          <BackendPendingState />
        ) : activities.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1">
            {activities.map((activity, index) => (
              <ActivityItem key={activity.id || index} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PoolActivity;
