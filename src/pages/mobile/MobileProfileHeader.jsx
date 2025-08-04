import React from 'react';
import { User, TrendingUp, Trophy, DollarSign } from 'lucide-react';

/**
 * Mobile-optimized profile header with wallet info and key stats
 */
const MobileProfileHeader = ({ address, activityStats, creatorStats }) => {
  // Format address for mobile display
  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="bg-gradient-to-br from-primary/10 to-secondary/10 border-b border-border">
      {/* Header Section */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Track activities and manage raffles
            </p>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Connected Account
          </p>
          <p className="font-mono text-sm text-foreground break-all">
            {formatAddress(address)}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Activity Stats */}
          <div className="bg-card/50 rounded-lg p-3 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Activity
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Tickets</span>
                <span className="text-sm font-semibold">
                  {activityStats.totalTicketsPurchased}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Prizes</span>
                <span className="text-sm font-semibold">
                  {activityStats.totalPrizesWon}
                </span>
              </div>
            </div>
          </div>

          {/* Creator Stats */}
          <div className="bg-card/50 rounded-lg p-3 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Creator
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Raffles</span>
                <span className="text-sm font-semibold">
                  {creatorStats.totalRaffles}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Revenue</span>
                <span className="text-sm font-semibold">
                  {parseFloat(creatorStats.totalRevenue).toFixed(2)} ETH
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileProfileHeader;
