import React from 'react';
import { Settings, Crown, Key, Plus, DollarSign, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mobile dashboard tab with simple navigation grid and stats
 */
const MobileDashboardTab = ({ creatorStats }) => {
  const navigate = useNavigate();

  // Dashboard utilities configuration
  const utilities = [
    {
      id: 'royalty',
      title: 'Royalty & Reveal',
      description: 'Manage royalties and reveal collections',
      icon: Crown,
      path: '/profile/mobile/royalty',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'minter',
      title: 'Minter Approval',
      description: 'Manage minter approvals for collections',
      icon: Key,
      path: '/profile/mobile/minter',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'tokens',
      title: 'Create Token ID',
      description: 'Add new token IDs to ERC1155 collections',
      icon: Plus,
      path: '/profile/mobile/tokens',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'revenue',
      title: 'Withdraw Revenue',
      description: 'Withdraw revenue from completed raffles',
      icon: DollarSign,
      path: '/profile/mobile/revenue',
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const handleUtilityClick = (path) => {
    navigate(path);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Creator Stats Overview */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Creator Overview</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {creatorStats.totalRaffles}
            </div>
            <div className="text-xs text-muted-foreground">Total Raffles</div>
            <div className="text-xs text-primary mt-1">
              {creatorStats.activeRaffles} active
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {parseFloat(creatorStats.totalRevenue).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">ETH Revenue</div>
            <div className="text-xs text-primary mt-1">
              {creatorStats.successRate}% success rate
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {creatorStats.totalParticipants}
            </div>
            <div className="text-xs text-muted-foreground">Participants</div>
            <div className="text-xs text-primary mt-1">
              {creatorStats.uniqueParticipants} unique
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {creatorStats.monthlyRevenue}
            </div>
            <div className="text-xs text-muted-foreground">Monthly ETH</div>
            <div className="text-xs text-primary mt-1">
              This month
            </div>
          </div>
        </div>
      </div>

      {/* Utilities Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Creator Utilities</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {utilities.map((utility) => {
            const Icon = utility.icon;
            
            return (
              <button
                key={utility.id}
                onClick={() => handleUtilityClick(utility.path)}
                className="group relative overflow-hidden bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all duration-200 text-left"
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${utility.color} opacity-0 group-hover:opacity-10 transition-opacity duration-200`} />
                
                {/* Content */}
                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${utility.color} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  
                  <h4 className="font-medium text-foreground text-sm mb-1 group-hover:text-primary transition-colors">
                    {utility.title}
                  </h4>
                  
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {utility.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
        
        <div className="space-y-3">
          <button
            onClick={() => navigate('/create-raffle')}
            className="w-full bg-primary text-white p-4 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Create New Raffle
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="w-full bg-muted text-foreground p-4 rounded-lg font-medium hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
          >
            <Users className="h-5 w-5" />
            Browse All Raffles
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileDashboardTab;
