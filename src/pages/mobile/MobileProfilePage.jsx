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

      {/* Mobile Tab Navigation */}
      <MobileTabNavigation 
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="pb-20"> {/* Bottom padding for tab navigation */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          </div>
        ) : (
          ActiveComponent && (
            <ActiveComponent {...(activeTabData.props || {})} />
          )
        )}
      </div>
    </div>
  );
};

export default MobileProfilePage;
