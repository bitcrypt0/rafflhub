import React from 'react';
import { Clock, Trophy, Ticket, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mobile-optimized activity tab with simple list layout
 */
const MobileActivityTab = ({ activities, claimRefund }) => {
  const navigate = useNavigate();

  const getActivityIcon = (type) => {
    switch (type) {
      case 'ticket_purchase':
        return <Ticket className="h-4 w-4 text-blue-500" />;
      case 'prize_won':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'refund_claimed':
        return <RefreshCw className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityTitle = (activity) => {
    switch (activity.type) {
      case 'ticket_purchase':
        return `Purchased ${activity.ticketCount} ticket${activity.ticketCount > 1 ? 's' : ''}`;
      case 'prize_won':
        return 'Won Prize!';
      case 'refund_claimed':
        return 'Claimed Refund';
      default:
        return 'Activity';
    }
  };

  const getActivityDescription = (activity) => {
    switch (activity.type) {
      case 'ticket_purchase':
        return `${activity.raffleName} • ${activity.amount} ETH`;
      case 'prize_won':
        return `${activity.raffleName} • Congratulations!`;
      case 'refund_claimed':
        return `${activity.raffleName} • ${activity.amount} ETH`;
      default:
        return activity.raffleName;
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const handleRaffleClick = (raffleAddress) => {
    navigate(`/raffle/${raffleAddress}`);
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="p-3">
        <div className="text-center py-6">
          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">No Activity Yet</h3>
          <p className="text-muted-foreground text-xs">
            Activity will appear here once you participate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
      {activities.slice(0, 5).map((activity) => (
        <div
          key={activity.id}
          className="bg-muted/30 border border-border/50 rounded-lg p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start gap-2">
            {/* Activity Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getActivityIcon(activity.type)}
            </div>

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground text-xs">
                    {getActivityTitle(activity)}
                  </h4>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">
                    {getActivityDescription(activity)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDate(activity.timestamp)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => handleRaffleClick(activity.raffleAddress)}
                  className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors"
                >
                  View
                </button>

                {activity.type === 'ticket_purchase' && activity.state === 'ended' && (
                  <button
                    onClick={() => claimRefund(activity.raffleAddress)}
                    className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded hover:bg-green-500/20 transition-colors"
                  >
                    Refund
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* View All Button */}
      {activities.length > 5 && (
        <div className="pt-2 border-t border-border/50">
          <button
            onClick={() => navigate('/profile')} // Navigate to full profile to see all activities
            className="w-full text-xs text-primary hover:text-primary/80 transition-colors py-2"
          >
            View All {activities.length} Activities
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileActivityTab;
