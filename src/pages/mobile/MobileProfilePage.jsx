import React, { useState, useEffect, useRef } from 'react';
import { User, Clock, Users, Settings } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useProfileData } from '../../hooks/useProfileData';
import MobileProfileHeader from './MobileProfileHeader';
import MobileTabNavigation from './MobileTabNavigation';
import MobileActivityTab from './MobileActivityTab';
import MobileCreatedRafflesTab from './MobileCreatedRafflesTab';

import MobileDashboardTab from './MobileDashboardTab';

/**
 * Mobile-specific ProfilePage implementation
 * Uses full-screen navigation and simple forms to avoid Android keyboard issues
 */
const MobileProfilePage = () => {
  const { connected, address } = useWallet();
  const [activeTab, setActiveTab] = useState('activity');
  const gridRef = useRef(null);

  // Use shared data hook
  const {
    userActivity,
    createdRaffles,
    purchasedTickets,
    activityStats,
    creatorStats,
    loading,
    showRevenueModal,
    setShowRevenueModal,
    selectedRaffle,
    setSelectedRaffle,
    withdrawRevenue,
    claimRefund
  } = useProfileData();

  // Auto-close functionality when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only close if we have an active tab and the click is outside the grid
      if (activeTab && gridRef.current && !gridRef.current.contains(event.target)) {
        setActiveTab(null); // Close all tabs when clicking outside
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeTab]); // Add activeTab as dependency

  // Reset active tab when returning to page (fixes disappearing components)
  useEffect(() => {
    if (connected && !activeTab) {
      setActiveTab('activity'); // Default to activity tab
    }
  }, [connected, activeTab]);

  // Show connect wallet message if not connected
  if (!connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground text-sm">
            Please connect your wallet to view your profile and activity.
          </p>
        </div>
      </div>
    );
  }

  // Tab configuration
  const tabs = [
    {
      id: 'activity',
      label: 'Activity',
      component: MobileActivityTab,
      props: { activities: userActivity, claimRefund }
    },
    {
      id: 'created',
      label: 'My Raffles',
      component: MobileCreatedRafflesTab,
      props: {
        raffles: createdRaffles,
        showRevenueModal,
        setShowRevenueModal,
        selectedRaffle,
        setSelectedRaffle,
        withdrawRevenue
      }
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      component: MobileDashboardTab,
      props: { creatorStats }
    }
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Profile Header */}
      <MobileProfileHeader
        address={address}
        activityStats={activityStats}
        creatorStats={creatorStats}
      />

      {/* Grid Layout for Tab Components */}
      <div className="p-4 pb-6">
        {/* Show loading only on initial load, not when returning from dashboard */}
        {loading && !userActivity && !createdRaffles && !purchasedTickets ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          </div>
        ) : (
          <div ref={gridRef} className="space-y-3">
            {/* Tab Navigation Grid - 3 tabs layout */}
            <div className="grid grid-cols-3 gap-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(isActive ? null : tab.id)}
                    className={`
                      p-4 bg-card border rounded-lg transition-all duration-200
                      flex items-center gap-3 text-left
                      ${isActive
                        ? 'border-primary shadow-md ring-1 ring-primary/20 bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Tab Content - Full Width */}
            {activeTab && (
              <div className="bg-card border border-primary/20 rounded-lg shadow-sm overflow-hidden">
                <div className="border-b border-border bg-primary/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const activeTabData = tabs.find(tab => tab.id === activeTab);
                      const Icon = activeTabData?.icon;
                      return (
                        <>
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            {activeTabData?.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="min-h-[200px] max-h-[70vh] overflow-y-auto">
                  {(() => {
                    const activeTabData = tabs.find(tab => tab.id === activeTab);
                    const Component = activeTabData?.component;
                    return Component ? <Component {...(activeTabData.props || {})} /> : null;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileProfilePage;
