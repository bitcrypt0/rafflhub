import React, { useState } from 'react';
import { Settings, Crown, Key, Plus, DollarSign, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mobile dashboard tab with simple navigation grid and stats
 */
const MobileDashboardTab = ({ creatorStats }) => {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({
    stats: true,
    utilities: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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
    <div className="p-6 space-y-4">
      {/* Creator Stats Accordion */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border border-border/50 overflow-hidden">
        <button
          onClick={() => toggleSection('stats')}
          className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Creator Stats</h3>
          </div>
          {expandedSections.stats ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {expandedSections.stats && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {creatorStats.totalRaffles}
                </div>
                <div className="text-sm text-muted-foreground">Raffles Created</div>
              </div>

              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {parseFloat(creatorStats.totalRevenue).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">ETH Revenue</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Utilities Accordion */}
      <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('utilities')}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Utilities</h3>
          </div>
          {expandedSections.utilities ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {expandedSections.utilities && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 gap-3">
              {utilities.map((utility) => {
                const Icon = utility.icon;

                return (
                  <button
                    key={utility.id}
                    onClick={() => handleUtilityClick(utility.path)}
                    className="group relative overflow-hidden bg-muted/20 border border-border/30 rounded-lg p-4 hover:shadow-md transition-all duration-200 text-left"
                  >
                    {/* Background Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${utility.color} opacity-0 group-hover:opacity-10 transition-opacity duration-200`} />

                    {/* Content */}
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${utility.color} text-white`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <h4 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                          {utility.title}
                        </h4>
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {utility.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default MobileDashboardTab;
