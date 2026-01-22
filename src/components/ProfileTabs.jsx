import React, { useState, useEffect, useRef } from 'react';
import { SUPPORTED_NETWORKS } from '../networks';

import { createPortal } from 'react-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useWallet } from '../contexts/WalletContext';
import { useCollections } from '../hooks/useCollections';

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
  Eye,
  Package,
  Copy,
  ExternalLink,
  ShoppingCart,
  Crown,
  RefreshCw,
  Trash2,
  Clock,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// State labels matching IPool.sol enum (states 0-7 only)
const RAFFLE_STATE_LABELS = [
  'Pending',           // 0
  'Active',            // 1
  'Ended',             // 2
  'Drawing',           // 3
  'Completed',         // 4
  'Deleted',           // 5
  'All Prizes Claimed', // 6
  'Unengaged'          // 7
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
    <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl transition-all duration-300 min-h-[160px] flex flex-col">
      <div className="flex items-start justify-between mb-2">
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

      <div className="grid grid-cols-2 gap-3 text-xs mb-2">
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

  // Activity type color mapping for timeline
  const getActivityTypeStyles = (type) => {
    const styles = {
      ticket_purchase: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-l-blue-500', icon: ShoppingCart },
      raffle_created: { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-l-green-500', icon: Plus },
      raffle_deleted: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-l-red-500', icon: Trash2 },
      prize_won: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-l-yellow-500', icon: Crown },
      prize_claimed: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-l-yellow-500', icon: Crown },
      refund_claimed: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-l-orange-500', icon: RefreshCw },
      revenue_withdrawn: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-l-emerald-500', icon: DollarSign },
      admin_withdrawn: { color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-l-purple-500', icon: DollarSign },
    };
    return styles[type] || { color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-l-muted-foreground', icon: Activity };
  };

  // Format relative time
  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const ActivityTab = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <p className="text-sm text-muted-foreground">Your latest transactions and events</p>
        </div>
        <Badge variant="secondary" className="font-medium">
          {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
        </Badge>
      </div>

      {activities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">No activity yet</h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your transaction history will appear here once you start participating in raffles or creating events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
          
          {/* Activity items */}
          <div className="space-y-3">
            {activities.slice(0, 15).map((activity, index) => {
              const styles = getActivityTypeStyles(activity.type);
              const IconComponent = styles.icon;
              
              return (
                <div 
                  key={index} 
                  className={`relative pl-12 pr-4 py-3 bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl hover:bg-card/80 hover:shadow-sm hover:border-border/60 transition-all duration-200 border-l-4 ${styles.border}`}
                >
                  {/* Timeline dot with icon */}
                  <div className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${styles.bg} flex items-center justify-center ring-4 ring-background`}>
                    <IconComponent className={`h-4 w-4 ${styles.color}`} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground leading-tight">
                        {activity.title}
                      </p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-muted-foreground" title={activity.timestamp}>
                        {getRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Show more indicator if there are more activities */}
          {activities.length > 15 && (
            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                + {activities.length - 15} more activities
              </p>
            </div>
          )}
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
              variant="primary"
              size="md"
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

  const MyCollectionsTab = () => {
    const { collections, loading: collectionsLoading } = useCollections();
    const [copiedAddress, setCopiedAddress] = useState(null);

    const handleCopyAddress = async (address) => {
      try {
        await navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    };

    // Generate gradient based on collection address for visual identity
    const getCollectionGradient = (addr, type) => {
      if (type === 'ERC721') return 'from-purple-500 to-pink-500';
      if (type === 'ERC1155') return 'from-indigo-500 to-purple-500';
      return 'from-primary to-primary/70';
    };

    const getTypeBadgeStyles = (type) => {
      if (type === 'ERC721') return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      if (type === 'ERC1155') return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      return 'bg-muted text-muted-foreground';
    };

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">My Collections</h3>
            <p className="text-sm text-muted-foreground">NFT collections you've deployed</p>
          </div>
          <Badge variant="secondary" className="font-medium">
            {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
          </Badge>
        </div>

        {collectionsLoading ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              </div>
              <p className="text-muted-foreground">Loading your collections...</p>
            </CardContent>
          </Card>
        ) : collections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h4 className="font-medium text-foreground mb-1">No collections yet</h4>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                Deploy your first NFT collection to start creating drop events and raffles.
              </p>
              <Button
                onClick={() => navigate('/deploy-collection')}
                variant="primary"
                size="md"
              >
                Deploy Collection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection, index) => (
              <div 
                key={`${collection.address}-${index}`} 
                className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg hover:border-border/80 transition-all duration-300"
              >
                {/* Gradient accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${getCollectionGradient(collection.address, collection.type)}`} />
                
                <div className="p-4">
                  {/* Header with image placeholder and info */}
                  <div className="flex items-start gap-3 mb-3">
                    {/* Collection image placeholder */}
                    <div className={`flex-shrink-0 w-14 h-14 rounded-lg bg-gradient-to-br ${getCollectionGradient(collection.address, collection.type)} flex items-center justify-center shadow-sm`}>
                      <Package className="h-6 w-6 text-white/90" />
                    </div>
                    
                    {/* Collection info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground text-sm truncate" title={collection.name}>
                            {collection.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              {collection.symbol}
                            </span>
                          </div>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${getTypeBadgeStyles(collection.type)}`}>
                          {collection.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 py-2 px-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Supply</p>
                      <p className="text-sm font-semibold">{collection.totalSupply || '0'}</p>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                          <p className="text-sm font-mono font-medium truncate" title={collection.address}>
                            {collection.address.slice(0, 6)}...{collection.address.slice(-4)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyAddress(collection.address)}
                          className="h-7 w-7 p-0 flex-shrink-0 hover:bg-muted/80"
                          title={copiedAddress === collection.address ? "Copied!" : "Copy address"}
                        >
                          {copiedAddress === collection.address ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const CreatorDashboardTab = () => (
    <div className="space-y-6">
      {/* Stats Cards - Responsive Grid */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card>
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

        <Card>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Slots Sold</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(creatorStats.totalParticipants || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total slots purchased across all your raffles
            </p>
          </CardContent>
        </Card>

        <Card>
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
            <span className="text-sm font-medium">My Collections</span>
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
            My Collections
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
        <MyCollectionsTab />
      </TabsContent>

      <TabsContent value="dashboard" className={isMobile ? "mt-4" : "mt-6"}>
        <CreatorDashboardTab />
      </TabsContent>
    </Tabs>
  </>
  );
};

export default ProfileTabs;