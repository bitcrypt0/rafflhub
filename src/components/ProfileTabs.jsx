import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
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
        <div className="flex items-center gap-2">
          <Badge variant="outline">{createdRaffles.length} raffles</Badge>
          <Button onClick={() => navigate('/create-raffle')} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </div>
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
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
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

        <Card>
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

        <Card>
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

      {/* Hide Quick Actions and Recent Activity on mobile */}
      {!isMobile && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest raffle activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    {activity.icon}
                    <span className="flex-1">{activity.description}</span>
                    <span className="text-muted-foreground">
                      {new Date(activity.timestamp * 1000).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your raffles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => navigate('/create-raffle')}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Raffle
              </Button>
              <Button
                variant="outline"
                className="w-full border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
              <Button
                variant="outline"
                className="w-full border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Withdraw Revenue
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Management Components */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Royalty and Reveal Management</CardTitle>
            <CardDescription>Reveal your collection and manage royalties</CardDescription>
          </CardHeader>
          <CardContent>
            <RoyaltyAdjustmentComponent />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Minter Approval Management</CardTitle>
            <CardDescription>Manage minter approvals for your collections</CardDescription>
          </CardHeader>
          <CardContent>
            <MinterApprovalComponent />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Creator Revenue Withdrawal</CardTitle>
            <CardDescription>Withdraw revenue from your raffles</CardDescription>
          </CardHeader>
          <CardContent>
            <CreatorRevenueWithdrawalComponent />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

      <TabsContent value="activity" className="mt-6">
        <ActivityTab />
      </TabsContent>

      <TabsContent value="created" className="mt-6">
        <CreatedRafflesTab />
      </TabsContent>

      <TabsContent value="purchased" className="mt-6">
        <PurchasedTicketsTab />
      </TabsContent>

      <TabsContent value="dashboard" className="mt-6">
        <CreatorDashboardTab />
      </TabsContent>
    </Tabs>
  );
};

export default ProfileTabs; 