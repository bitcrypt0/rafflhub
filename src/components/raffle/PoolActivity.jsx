/**
 * PoolActivity Component
 *
 * Displays pool activity including slot purchases, refunds, prize claims, and randomness requests.
 * Uses table/row-based layout matching the screenshot design.
 * Receives activity data from parent component (fetched from backend).
 *
 * Activity Types:
 * - slots_purchased: SlotsPurchased event
 * - random_requested: RandomRequested event
 * - refund_claimed: RefundClaimed event
 * - prize_claimed: PrizeClaimed event
 *
 * Variants:
 * - 'standard': For StandardPoolLayout - used inside RaffleInfoTabs
 * - 'nft': For NFTPoolLayout - used inside RaffleInfoTabs
 */

import React, { useState, useMemo } from 'react';
import { Activity, Clock, Filter } from 'lucide-react';

// Explorer link generator
function getExplorerLink(addressOrTx, chainIdOverride, isTransaction = false) {
  let chainId = 1;
  if (typeof chainIdOverride === 'number') {
    chainId = chainIdOverride;
  } else if (window.ethereum && window.ethereum.chainId) {
    chainId = parseInt(window.ethereum.chainId, 16);
  }
  const explorerMap = {
    1: 'https://etherscan.io',
    5: 'https://goerli.etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    80001: 'https://mumbai.polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    420: 'https://goerli-optimism.etherscan.io',
    42161: 'https://arbiscan.io',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    43114: 'https://snowtrace.io',
    43113: 'https://testnet.snowtrace.io',
    8453: 'https://basescan.org',
    84531: 'https://goerli.basescan.org',
    84532: 'https://sepolia.basescan.org',
    11155420: 'https://sepolia-optimism.etherscan.io',
  };
  const baseUrl = explorerMap[chainId] || explorerMap[1];
  const path = isTransaction ? 'tx' : 'address';
  return `${baseUrl}/${path}/${addressOrTx}`;
}

/**
 * Format relative time (e.g., "2m", "1h", "3d")
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Unknown';
  
  // Handle both ISO string and epoch timestamps
  const eventTime = typeof timestamp === 'string' 
    ? new Date(timestamp).getTime()
    : timestamp * 1000; // Assume epoch in seconds
  
  const now = Date.now();
  const diff = now - eventTime;
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
 * Get activity label based on type
 */
const getActivityLabel = (activity) => {
  switch (activity.activity_type) {
    case 'slot_purchase':
      return `purchased ${activity.quantity || 1} slot${(activity.quantity || 1) > 1 ? 's' : ''}`;
    case 'randomness_requested':
      return 'requested randomness';
    case 'prize_won':
      return 'winner';
    case 'refund_claimed':
      return 'refund claimed';
    case 'prize_claimed':
      return 'prize claimed';
    case 'raffle_created':
      return 'created pool';
    default:
      return activity.activity_type || 'activity';
  }
};

/**
 * Main PoolActivity Component - Table-based layout
 */
// Activity filter options
const ACTIVITY_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'slot_purchase', label: 'Slot Purchases' },
  { value: 'randomness_requested', label: 'Randomness Requests' },
  { value: 'prize_claimed', label: 'Prize Claims' },
  { value: 'refund_claimed', label: 'Refund Claims' },
];

const MAX_VISIBLE_ENTRIES = 7;

const PoolActivity = ({
  raffle,
  activity: propActivity, // Activity data passed from parent
  variant = 'standard',
  className = '',
}) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Use activity from props or from raffle._backendActivity
  // Filter out 'prize_won' (winner) entries since winners are already displayed in the Winners tab
  const allActivities = useMemo(() => {
    let activityList = [];
    if (propActivity && propActivity.length > 0) {
      activityList = propActivity;
    } else if (raffle?._backendActivity && raffle._backendActivity.length > 0) {
      activityList = raffle._backendActivity;
    }
    
    // Filter out winner entries
    return activityList.filter(activity => activity.activity_type !== 'prize_won');
  }, [propActivity, raffle?._backendActivity]);

  // Apply user-selected filter
  const activities = useMemo(() => {
    if (activeFilter === 'all') return allActivities;
    return allActivities.filter(activity => activity.activity_type === activeFilter);
  }, [allActivities, activeFilter]);

  const backendAvailable = allActivities.length > 0;
  const loading = false; // Activity is passed from parent, no loading state needed

  // Get current filter label
  const currentFilterLabel = activeFilter === 'all'
    ? 'Filter Activities'
    : ACTIVITY_FILTERS.find(f => f.value === activeFilter)?.label || 'Filter Activities';

  // Render table-based activity list
  const renderActivityTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!backendAvailable || allActivities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h4 className="font-medium text-foreground mb-1">No Activity Yet</h4>
          <p className="text-sm text-muted-foreground max-w-xs">Pool activity will appear here as events occur</p>
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col">
        {/* Filter Bar */}
        <div className="flex items-center px-4 py-2 border-b border-border/50 bg-muted/20">
          {/* Filter Dropdown - left aligned */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground bg-background/50 border border-border/50 rounded-md transition-colors"
            >
              <Filter className="h-3 w-3" />
              <span>{currentFilterLabel}</span>
            </button>
            
            {showFilterDropdown && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-card border border-border rounded-md shadow-lg py-1">
                {ACTIVITY_FILTERS.map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setActiveFilter(filter.value);
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors ${
                      activeFilter === filter.value ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Scrollable Table Rows - max 7 visible entries */}
        <div 
          className="divide-y divide-border/30 overflow-y-auto"
          style={{ maxHeight: `${MAX_VISIBLE_ENTRIES * 48}px` }}
        >
          {activities.length === 0 && activeFilter !== 'all' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No {currentFilterLabel.toLowerCase()} found</p>
            </div>
          )}
          {activities.map((activity, i) => {
            const userAddress = activity.user_address || activity.address || '';
            return (
              <div 
                key={activity.id || i}
                className="px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* Mobile layout: stacked rows */}
                <div className="flex flex-col gap-1 md:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-5 shrink-0">{i + 1}</span>
                    <span className="font-mono text-sm truncate" title={userAddress}>
                      {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Unknown'}
                    </span>
                    {activity.transaction_hash && (
                      <a
                        href={getExplorerLink(activity.transaction_hash, activity.chain_id, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center flex-shrink-0"
                        title="View transaction on block explorer"
                      >
                        <img
                          src="/images/etherscan logos/etherscan-logo-circle.svg"
                          alt="Etherscan"
                          width="16"
                          height="16"
                          className="opacity-70 hover:opacity-100 transition-opacity"
                        />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pl-7">
                    <span className="text-sm font-medium text-foreground">{getActivityLabel(activity)}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Desktop layout: 12-column grid */}
                <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                  {/* Rank */}
                  <div className="col-span-1 text-sm font-medium text-muted-foreground">
                    {i + 1}
                  </div>
                  
                  {/* User Address with Transaction Link */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm truncate" title={userAddress}>
                      {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Unknown'}
                    </span>
                    {activity.transaction_hash && (
                      <a
                        href={getExplorerLink(activity.transaction_hash, activity.chain_id, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center flex-shrink-0"
                        title="View transaction on block explorer"
                      >
                        <img
                          src="/images/etherscan logos/etherscan-logo-circle.svg"
                          alt="Etherscan"
                          width="16"
                          height="16"
                          className="opacity-70 hover:opacity-100 transition-opacity"
                        />
                      </a>
                    )}
                  </div>
                  
                  {/* Activity Type/Action */}
                  <div className="col-span-4 flex justify-center">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                      {getActivityLabel(activity)}
                    </span>
                  </div>
                  
                  {/* Time */}
                  <div className="col-span-4 flex justify-center">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
