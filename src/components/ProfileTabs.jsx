import React, { useState, useEffect, useRef } from 'react';
import { SUPPORTED_NETWORKS } from '../networks';

import { createPortal } from 'react-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useWallet } from '../contexts/WalletContext';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import {
  Activity,
  Plus,
  Ticket,
  BarChart3,
  Users,
  TrendingUp,
  DollarSign,
  Award,
  Calendar,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Use the same state labels as RaffleCard component
const RAFFLE_STATE_LABELS = [
  'Pending',
  'Active',
  'Ended',
  'Drawing',
  'Completed',
  'Deleted',
  'Activation Failed',
  'Prizes Claimed',
  'Unengaged'
];

// Date/time formatting helper to robustly handle Date objects, ms and seconds
const formatDateTimeDisplay = (value) => {
  try {
    if (!value) return 'Unknown';
    let d;
    if (value instanceof Date) {
      d = value;
    } else if (typeof value === 'number') {
      // If it's likely seconds, scale to ms
      d = new Date(value < 1e12 ? value * 1000 : value);
    } else {
      d = new Date(value);
    }
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleString();
  } catch (_) {
    return 'Unknown';
  }
};


// Profile raffle card component with winner count support
const ProfileRaffleCard = ({ raffle, onRaffleClick, formatRevenueAmount, getCurrencySymbol }) => {
  const { winnerCount } = useWinnerCount(raffle.address, raffle.stateNum);

  const getStatusBadge = () => {


    // Get dynamic label for Prizes Claimed state based on winner count
    const getDynamicLabel = (stateNum) => {
      const dynamicLabel = getDynamicPrizeLabel(stateNum, winnerCount);
      if (dynamicLabel) {
        return dynamicLabel;
      }
      return RAFFLE_STATE_LABELS[stateNum] || 'Unknown';
    };

    const label = getDynamicLabel(raffle.stateNum);
    const colorMap = {
      'Pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Active': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'Ended': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'Drawing': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'Completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Deleted': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'Activation Failed': 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300',
      'Prizes Claimed': 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300',
      'Prize Claimed': 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300', // Same styling for singular
      'Unengaged': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'Unknown': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[label] || colorMap['Unknown']}`}>{label}</span>;
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-xl border-border/80 transition-all duration-300 min-h-[180px] flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 
            className="font-semibold text-sm mb-1 truncate cursor-pointer hover:text-[#614E41] transition-colors duration-200"
            onClick={() => onRaffleClick(raffle.address)}
          >
            {raffle.name}
          </h3>
        </div>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs mb-3">
        <div>
          <span className="text-muted-foreground">Slots Sold</span>
          <p className="font-semibold">{raffle.ticketsSold || 0}/{raffle.maxTickets}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Revenue</span>
          <p className="font-semibold text-green-600">
            {formatRevenueAmount(raffle.revenue || 0)}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Created</span>
          <p className="font-semibold">{raffle.createdAt ? new Date((raffle.createdAt < 1e12 ? raffle.createdAt * 1000 : raffle.createdAt)).toLocaleString() : 'Unknown'}</p>
        </div>
      </div>
    </div>
  );
};

// Removed individual component imports - now handled by UnifiedDashboardGrid
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
import { useWinnerCount, getDynamicPrizeLabel } from '../hooks/useWinnerCount';
import UnifiedMobileModal from './mobile/UnifiedMobileModal';
import { initMobileKeyboardFix, cleanupMobileKeyboardFix } from '../utils/androidKeyboardFix';
import UnifiedDashboardGrid from './dashboard/UnifiedDashboardGrid';

const ProfileTabs = ({
  activities,
  createdRaffles,
  purchasedTickets,
  creatorStats,
  onDeleteRaffle,
  onViewRevenue,
  onClaimPrize,
  onClaimRefund
}) => {
  const navigate = useNavigate();
  const { chainId } = useWallet();

  const [activeTab, setActiveTab] = useState('activity');
  const { isMobile } = useMobileBreakpoints();
  const { formatRevenueAmount, getCurrencySymbol } = useNativeCurrency();

  // Initialize mobile keyboard fix
  useEffect(() => {
    initMobileKeyboardFix();
    return () => cleanupMobileKeyboardFix();
  }, []);

  // Modal state management for desktop only
  const [modals, setModals] = useState({
    royalty: false,
    minter: false,
    tokenCreator: false,
    revenue: false
  });

  // Removed mobile utility state - now using UnifiedDashboardGrid

  // Removed MobileUtilityPage and MobileUtilityGrid - now using UnifiedDashboardGrid

  // Simple body scroll lock for mobile modals (no aggressive viewport manipulation)
  useEffect(() => {
    if (isMobile) {
      const isAnyModalOpen = Object.values(modals).some(Boolean);

      if (isAnyModalOpen) {
        // Simple overflow hidden - let the new modal handle the rest
        document.body.style.overflow = 'hidden';

        return () => {
          document.body.style.overflow = '';
        };
      }
    }
  }, [modals, isMobile]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (isMobile) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isMobile]);

  // Mobile-aware modal component using the new UnifiedMobileModal
  const MobileAwareModal = ({
    isOpen,
    onOpenChange,
    trigger,
    title,
    children
  }) => {
    // Use the new UnifiedMobileModal for mobile, simple modal for desktop
    if (isMobile) {
      return (
        <UnifiedMobileModal
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          trigger={trigger}
          title={title}
        >
          {children}
        </UnifiedMobileModal>
      );
    }

    // Desktop modal implementation
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  };

  const ActivityTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <Badge variant="outline">{activities.length} activities</Badge>
      </div>

      {activities.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No activity yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 10).map((activity, index) => (
            <div key={index} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl border-border/80 transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {activity.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{activity.title}</p>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );



  const CreatedRafflesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Raffles</h3>
        <Badge variant="outline">{createdRaffles.length} raffles</Badge>
      </div>

      {createdRaffles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">

            <p className="text-muted-foreground mb-4">You haven't created any raffles yet</p>
            <Button
              onClick={() => navigate('/create-raffle')}
              className="bg-[#614E41] text-white hover:bg-[#4a3a30] transition-colors"
            >
              Create Your First Raffle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {createdRaffles.map((raffle) => (
            <ProfileRaffleCard
              key={raffle.address}
              raffle={raffle}
              onRaffleClick={(address) => {
                  const slug = chainId && SUPPORTED_NETWORKS[chainId] ? SUPPORTED_NETWORKS[chainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : (chainId || '');
                  const path = slug ? `/${slug}/raffle/${address}` : `/raffle/${address}`;
                  navigate(path);
                }}
              formatRevenueAmount={formatRevenueAmount}
              getCurrencySymbol={getCurrencySymbol}
            />
          ))}
        </div>
      )}
    </div>
  );

  const PurchasedTicketsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Slots</h3>
        <Badge variant="outline">{purchasedTickets.length} slots</Badge>
      </div>

      {purchasedTickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You haven't purchased any slots yet</p>
            <Button
              onClick={() => navigate('/')}
              className="bg-[#614E41] text-white hover:bg-[#4a3a30] transition-colors"
            >
              Browse Raffles
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {purchasedTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Ticket Icon */}
                  <div className="flex-shrink-0 mt-1">
                    <Ticket className="h-4 w-4 text-blue-500" />
                  </div>

                  {/* Ticket Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm">
                          Purchased {ticket.ticketCount} {ticket.raffleName || ticket.name} slot{ticket.ticketCount > 1 ? 's' : ''}
                        </h4>
                        <p className="text-muted-foreground text-sm mt-1">
                          {ticket.totalSpent} {getCurrencySymbol()}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground flex-shrink-0">
                        {formatDateTimeDisplay(ticket.purchaseTime)}
                      </span>
                    </div>

                  </div>
                </div>

                <div className="flex gap-2">
                  {ticket.canClaimPrize && (
                    <Button
                      size="sm"
                      onClick={() => onClaimPrize(ticket)}
                      className="flex-1 bg-[#614E41] text-white hover:bg-[#4a3a30] transition-colors"
                    >
                      <Award className="h-4 w-4 mr-1" />
                      Claim Prize
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const CreatorDashboardTab = () => (
    <div className="space-y-6">
      {/* Stats Cards - Responsive Grid */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raffles</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(creatorStats.totalRaffles || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {Number(creatorStats.activeRaffles || 0).toLocaleString()} currently active
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withdrawable Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRevenueAmount(creatorStats.withdrawableRevenue || '0')}</div>
            <p className="text-xs text-muted-foreground">
              Available to withdraw across all raffles
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Slots Sold</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(creatorStats.totalParticipants || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {Number(creatorStats.uniqueParticipants || 0).toLocaleString()} slots across all your raffles
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              Completed raffles
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Unified Dashboard Grid - Works across all platforms */}
      <UnifiedDashboardGrid />
    </div>
  );

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-profile-tab="true">
      {isMobile ? (
        // Mobile: 2x2 grid layout with proper buttons
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'activity'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Activity</span>
          </button>
          <button
            onClick={() => setActiveTab('created')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'created'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Created</span>
          </button>
          <button
            onClick={() => setActiveTab('purchased')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'purchased'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <span className="text-sm font-medium">My Slots</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'dashboard'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <span className="text-sm font-medium">Dashboard</span>
          </button>
        </div>
      ) : (
        // Desktop: horizontal tabs
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="activity">
            Activity
          </TabsTrigger>
          <TabsTrigger value="created">
            My Raffles
          </TabsTrigger>
          <TabsTrigger value="purchased">
            My Slots
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            Dashboard
          </TabsTrigger>
        </TabsList>
      )}

      <TabsContent value="activity" className={isMobile ? "mt-4" : "mt-6"}>
        <ActivityTab />
      </TabsContent>

      <TabsContent value="created" className={isMobile ? "mt-4" : "mt-6"}>
        <CreatedRafflesTab />
      </TabsContent>

      <TabsContent value="purchased" className={isMobile ? "mt-4" : "mt-6"}>
        <PurchasedTicketsTab />
      </TabsContent>

      <TabsContent value="dashboard" className={isMobile ? "mt-4" : "mt-6"}>
        <CreatorDashboardTab />
      </TabsContent>
    </Tabs>
  </>
  );
};

export default ProfileTabs;