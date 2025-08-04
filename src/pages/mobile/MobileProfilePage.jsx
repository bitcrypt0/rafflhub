import React, { useState } from 'react';
import { User, Clock, Users, Ticket, Settings } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useProfileData } from '../../hooks/useProfileData';
import MobileProfileHeader from './MobileProfileHeader';
import MobileTabNavigation from './MobileTabNavigation';
import MobileActivityTab from './MobileActivityTab';
import MobileCreatedRafflesTab from './MobileCreatedRafflesTab';
import MobileTicketsTab from './MobileTicketsTab';
import MobileDashboardTab from './MobileDashboardTab';

/**
 * Mobile-specific ProfilePage implementation
 * Uses full-screen navigation and simple forms to avoid Android keyboard issues
 */
const MobileProfilePage = () => {
  const { connected, address } = useWallet();
  const [activeTab, setActiveTab] = useState('activity');
  
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
      icon: Clock,
      component: MobileActivityTab,
      props: { activities: userActivity, claimRefund }
    },
    { 
      id: 'created', 
      label: 'Created', 
      icon: Users,
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
      id: 'tickets', 
      label: 'Tickets', 
      icon: Ticket,
      component: MobileTicketsTab,
      props: { tickets: purchasedTickets, claimRefund }
    },
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: Settings,
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const Component = tab.component;
              const isActive = activeTab === tab.id;

              return (
                <div
                  key={tab.id}
                  className={`
                    bg-card border rounded-lg transition-all duration-200 overflow-hidden
                    ${isActive
                      ? 'border-primary shadow-md ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/50'
                    }
                  `}
                >
                  {/* Tab Header */}
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-full p-3 flex items-center gap-2 transition-colors
                      ${isActive
                        ? 'bg-primary/5 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                    <span className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>
                      {tab.label}
                    </span>
                  </button>

                  {/* Tab Content */}
                  {isActive && (
                    <div className="border-t border-border">
                      <div className="max-h-96 overflow-y-auto">
                        <Component {...(tab.props || {})} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileProfilePage;
