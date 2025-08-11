import React from 'react';
import { Settings, Crown, Key, Plus, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mobile dashboard tab with utilities interface
 */
const MobileDashboardTab = ({ creatorStats }) => {
  const navigate = useNavigate();

  // Dashboard utilities configuration
  const utilities = [
    {
      id: 'royalty',
      title: 'Royalty & Reveal',
      description: 'Manage royalties and reveal collections',
      path: '/profile/mobile/royalty',
      color: 'from-[#614E41] to-[#4a3a30]'
    },
    {
      id: 'minter',
      title: 'Minter Approval',
      description: 'Manage minter approvals for collections',
      path: '/profile/mobile/minter',
      color: 'from-[#614E41] to-[#4a3a30]'
    },
    {
      id: 'tokens',
      title: 'Create New Token ID & Set Token URI',
      description: 'Add new token IDs to ERC1155 collections and set metadata URIs',
      path: '/profile/mobile/tokens',
      color: 'from-[#614E41] to-[#4a3a30]'
    },
    {
      id: 'revenue',
      title: 'Withdraw Revenue',
      description: 'Withdraw revenue from completed raffles',
      path: '/profile/mobile/revenue',
      color: 'from-[#614E41] to-[#4a3a30]'
    }
  ];

  const handleUtilityClick = (path) => {
    navigate(path);
  };

  return (
    <div className="p-6">
      {/* Utilities Interface - Direct Display */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {utilities.map((utility) => {
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


    </div>
  );
};

export default MobileDashboardTab;
