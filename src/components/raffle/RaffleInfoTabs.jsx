import React, { useState, useMemo } from 'react';
import { Trophy, Info, Activity, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';

/**
 * RaffleInfoTabs Component
 * 
 * Unified tab container for Winners, Details, and Activity sections.
 * Uses ProfileTabs-style horizontal tab selector with table-based content layout.
 * 
 * @param {Object} raffle - The raffle/pool data object
 * @param {React.ReactNode} winnersSection - The WinnersSection component
 * @param {React.ReactNode} raffleDetailsCard - The RaffleDetailsCard component (optional for NFT pools)
 * @param {React.ReactNode} poolActivitySection - The PoolActivity component
 * @param {boolean} isMobile - Whether the current viewport is mobile
 * @param {boolean} isUnengaged - Whether the pool is in Unengaged state (hides Winners tab)
 * @param {string} defaultTab - The default active tab ('winners', 'details', or 'activity')
 * @param {string} variant - Layout variant ('standard' or 'nft')
 */
const RaffleInfoTabs = ({
  raffle,
  winnersSection,
  raffleDetailsCard,
  poolActivitySection,
  isMobile = false,
  isUnengaged = false,
  defaultTab = 'winners',
  variant = 'standard',
  className = ''
}) => {
  // Determine initial tab based on pool state
  // Default to 'activity' since it's now the first tab
  const initialTab = useMemo(() => {
    if (isUnengaged) {
      // If unengaged, default to activity or details
      return 'activity';
    }
    return defaultTab === 'winners' ? 'activity' : defaultTab;
  }, [isUnengaged, defaultTab]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // Build tabs configuration based on available content and pool state
  // Order: Activity first, then Winners, then Details
  const tabs = useMemo(() => {
    const tabList = [];
    
    // Activity tab - first
    if (poolActivitySection) {
      tabList.push({
        id: 'activity',
        label: 'Activity',
        icon: Activity,
        content: poolActivitySection
      });
    }
    
    // Winners tab - second (hidden for Unengaged pools)
    if (!isUnengaged && winnersSection) {
      tabList.push({
        id: 'winners',
        label: 'Winners',
        icon: Trophy,
        content: winnersSection
      });
    }
    
    // Details tab - third (only for standard pools, NFT pools don't have this)
    if (raffleDetailsCard) {
      tabList.push({
        id: 'details',
        label: 'Details',
        icon: Info,
        content: raffleDetailsCard
      });
    }
    
    return tabList;
  }, [isUnengaged, winnersSection, raffleDetailsCard, poolActivitySection]);

  // Get badge for Winners tab based on raffle state
  const getWinnersBadge = () => {
    if (!raffle) return null;
    
    const stateNum = raffle.stateNum;
    const winnersSelected = raffle.winnersSelected || 0;
    const winnersCount = raffle.winnersCount || 0;
    
    // Drawing state - show progress (using same approach as 'Slot Fees Refundable' tag for consistent contrast)
    if (stateNum === 3) {
      return (
        <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          {winnersSelected}/{winnersCount}
        </span>
      );
    }
    
    // Completed state - show checkmark (using same approach as 'Slot Fees Refundable' tag for consistent contrast)
    if (stateNum === 4 || stateNum === 6) {
      return (
        <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3" />
          {winnersCount}
        </span>
      );
    }
    
    return null;
  };

  // If no tabs available, return null
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={`raffle-info-tabs ${className}`}>
      <div className="detail-beige-card bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
          {/* ProfileTabs-style Tab Headers - Horizontal with border styling */}
          <div className="grid w-full border-b border-border" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-primary text-foreground bg-muted/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.id === 'winners' && getWinnersBadge()}
              </button>
            ))}
          </div>

          {/* Tab Content Panels - Table-based layout */}
          <div className="flex-1 overflow-hidden">
            {tabs.map((tab) => (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className="mt-0 h-full focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden"
              >
                <div className="h-full overflow-y-auto">
                  {tab.content}
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default RaffleInfoTabs;
