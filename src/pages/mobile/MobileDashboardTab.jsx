import React from 'react';
import { Settings, Crown, Key, Plus, DollarSign, TrendingUp } from 'lucide-react';
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
    <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
      {/* Creator Stats Overview */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-3 border border-border/50">
        <div className="flex items-center gap-1 mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Creator Stats</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground mb-0.5">
              {creatorStats.totalRaffles}
            </div>
            <div className="text-xs text-muted-foreground">Raffles</div>
          </div>

          <div className="text-center">
            <div className="text-lg font-bold text-foreground mb-0.5">
              {parseFloat(creatorStats.totalRevenue).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">ETH Revenue</div>
          </div>
        </div>
      </div>

      {/* Utilities Section */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <Settings className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Utilities</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {utilities.map((utility) => {
            const Icon = utility.icon;

            return (
              <button
                key={utility.id}
                onClick={() => handleUtilityClick(utility.path)}
                className="group relative overflow-hidden bg-card border border-border rounded-lg p-2 hover:shadow-sm transition-all duration-200 text-left"
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${utility.color} opacity-0 group-hover:opacity-10 transition-opacity duration-200`} />

                {/* Content */}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`p-1 rounded bg-gradient-to-br ${utility.color} text-white`}>
                      <Icon className="h-3 w-3" />
                    </div>
                  </div>

                  <h4 className="font-medium text-foreground text-xs mb-0.5 group-hover:text-primary transition-colors">
                    {utility.title}
                  </h4>

                  <p className="text-xs text-muted-foreground leading-tight">
                    {utility.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>


    </div>
  );
};

export default MobileDashboardTab;
