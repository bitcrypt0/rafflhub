import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
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
import RoyaltyAdjustmentComponent from './RoyaltyAdjustmentComponent';
import MinterApprovalComponent from './MinterApprovalComponent';
import CreatorRevenueWithdrawalComponent from './CreatorRevenueWithdrawalComponent';
import CreateNewTokenIDComponent from './CreateNewTokenIDComponent';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';

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
  const [activeTab, setActiveTab] = useState('activity');
  const { isMobile } = useMobileBreakpoints();

  // Modal state management for mobile
  const [modals, setModals] = useState({
    royalty: false,
    minter: false,
    tokenCreator: false,
    revenue: false
  });

  // Lock body scroll when any modal is open on mobile
  useEffect(() => {
    if (isMobile) {
      const isAnyModalOpen = Object.values(modals).some(Boolean);

      if (isAnyModalOpen) {
        // Store original overflow value
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Cleanup function to restore original overflow
        return () => {
          document.body.style.overflow = originalOverflow;
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

  // Custom mobile modal component that avoids Radix UI issues
  const MobileAwareModal = ({
    isOpen,
    onOpenChange,
    trigger,
    title,
    children
  }) => {
    // Handle backdrop click
    const handleBackdropClick = (e) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false);
      }
    };

    // Handle escape key
    useEffect(() => {
      if (isOpen && isMobile) {
        const handleEscape = (e) => {
          if (e.key === 'Escape') {
            onOpenChange(false);
          }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }
    }, [isOpen, isMobile, onOpenChange]);

    if (isMobile) {
      return (
        <>
          {/* Trigger button */}
          <div onClick={() => onOpenChange(true)}>
            {trigger}
          </div>

          {/* Custom mobile modal - rendered via portal */}
          {isOpen && createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-end justify-center"
              onClick={handleBackdropClick}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/50" />

              {/* Modal content */}
              <div
                className="relative w-full bg-background rounded-t-xl shadow-xl animate-in slide-in-from-bottom-2 duration-300 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-2 hover:bg-muted rounded-md transition-colors"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                  {children}
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      );
    }

    // Desktop: Use regular Dialog
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
            <div key={index} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {activity.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(activity.timestamp * 1000).toLocaleDateString()}
                  </p>
                  {activity.txHash && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Tx: {activity.txHash.slice(0, 10)}...
                    </p>
                  )}
                </div>
                {activity.raffleAddress && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/raffle/${activity.raffleAddress}`)}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
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
        <h3 className="text-lg font-semibold">Created Raffles</h3>
        <Badge variant="outline">{createdRaffles.length} raffles</Badge>
      </div>

      {createdRaffles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You haven't created any raffles yet</p>
            <Button
              onClick={() => navigate('/create-raffle')}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
            >
              Create Your First Raffle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {createdRaffles.map((raffle) => (
            <Card key={raffle.address} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate">{raffle.name}</CardTitle>
                  <Badge 
                    variant={raffle.state === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {raffle.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tickets Sold</p>
                    <p className="font-medium">{raffle.ticketsSold}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Revenue</p>
                    <p className="font-medium">
                      {raffle.ticketsSold * parseFloat(raffle.ticketPrice) / 1e18} ETH
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/raffle/${raffle.address}`)}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onViewRevenue(raffle)}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Revenue
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const PurchasedTicketsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Purchased Tickets</h3>
        <Badge variant="outline">{purchasedTickets.length} tickets</Badge>
      </div>

      {purchasedTickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You haven't purchased any tickets yet</p>
            <Button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
            >
              Browse Raffles
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {purchasedTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate">{ticket.raffleName}</CardTitle>
                  <Badge 
                    variant={ticket.canClaimPrize ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {ticket.canClaimPrize ? 'Prize Available' : ticket.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ticket Price</p>
                    <p className="font-medium">{parseFloat(ticket.ticketPrice) / 1e18} ETH</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">
                      {new Date(ticket.purchaseTime * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/raffle/${ticket.raffleAddress}`)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {ticket.canClaimPrize && (
                    <Button
                      size="sm"
                      onClick={() => onClaimPrize(ticket)}
                      className="flex-1"
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
    <div className={`space-y-6 ${isMobile ? 'w-full overflow-hidden' : ''}`}>
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raffles</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.totalRaffles}</div>
            <p className="text-xs text-muted-foreground">
              {creatorStats.activeRaffles} currently active
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.totalRevenue} ETH</div>
            <p className="text-xs text-muted-foreground">
              +{creatorStats.monthlyRevenue} this month
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.totalParticipants}</div>
            <p className="text-xs text-muted-foreground">
              {creatorStats.uniqueParticipants} unique users
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


      {/* Management Components - Modal Based */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        <Card className={`${isMobile ? 'w-full overflow-hidden' : ''}`}>
          <CardHeader>
            <CardTitle className={isMobile ? 'text-base' : ''}>Royalty and Reveal Management</CardTitle>
            <CardDescription className={isMobile ? 'text-sm' : ''}>Reveal your collection and manage royalties</CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4' : ''}>
            <MobileAwareModal
              isOpen={modals.royalty}
              onOpenChange={(open) => setModals(prev => ({ ...prev, royalty: open }))}
              title="Royalty and Reveal Management"
              trigger={
                <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                  Open Royalty Manager
                </Button>
              }
            >
              <RoyaltyAdjustmentComponent />
            </MobileAwareModal>
          </CardContent>
        </Card>
        <Card className={`${isMobile ? 'w-full overflow-hidden' : ''}`}>
          <CardHeader>
            <CardTitle className={isMobile ? 'text-base' : ''}>Minter Approval Management</CardTitle>
            <CardDescription className={isMobile ? 'text-sm' : ''}>Manage minter approvals for your collections</CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4' : ''}>
            <MobileAwareModal
              isOpen={modals.minter}
              onOpenChange={(open) => setModals(prev => ({ ...prev, minter: open }))}
              title="Minter Approval Management"
              trigger={
                <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                  Open Minter Manager
                </Button>
              }
            >
              <MinterApprovalComponent />
            </MobileAwareModal>
          </CardContent>
        </Card>
        <Card className={`${isMobile ? 'w-full overflow-hidden' : ''}`}>
          <CardHeader>
            <CardTitle className={isMobile ? 'text-base' : ''}>Create New Token ID</CardTitle>
            <CardDescription className={isMobile ? 'text-sm' : ''}>Add new token IDs to existing ERC1155 collections</CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4' : ''}>
            <MobileAwareModal
              isOpen={modals.tokenCreator}
              onOpenChange={(open) => setModals(prev => ({ ...prev, tokenCreator: open }))}
              title="Create New Token ID"
              trigger={
                <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                  Open Token Creator
                </Button>
              }
            >
              <CreateNewTokenIDComponent />
            </MobileAwareModal>
          </CardContent>
        </Card>
        <Card className={`${isMobile ? 'w-full overflow-hidden' : ''}`}>
          <CardHeader>
            <CardTitle className={isMobile ? 'text-base' : ''}>Creator Revenue Withdrawal</CardTitle>
            <CardDescription className={isMobile ? 'text-sm' : ''}>Withdraw revenue from your raffles</CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4' : ''}>
            <MobileAwareModal
              isOpen={modals.revenue}
              onOpenChange={(open) => setModals(prev => ({ ...prev, revenue: open }))}
              title="Creator Revenue Withdrawal"
              trigger={
                <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                  Open Revenue Manager
                </Button>
              }
            >
              <CreatorRevenueWithdrawalComponent />
            </MobileAwareModal>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
            <Activity className="h-5 w-5" />
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
            <Plus className="h-5 w-5" />
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
            <Ticket className="h-5 w-5" />
            <span className="text-sm font-medium">Tickets</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'dashboard'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>
        </div>
      ) : (
        // Desktop: horizontal tabs
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="created" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Created
          </TabsTrigger>
          <TabsTrigger value="purchased" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Purchased
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
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
  );
};

export default ProfileTabs; 