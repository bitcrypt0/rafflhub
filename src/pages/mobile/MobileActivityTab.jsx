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
    const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`;
    const quantity = activity.quantity || activity.ticketCount || 1;

    switch (activity.type) {
      case 'ticket_purchase':
        return `Purchased ${quantity} ${raffleName} ticket${quantity > 1 ? 's' : ''}`;
      case 'prize_won':
        return 'Won Prize!';
      case 'refund_claimed':
        return 'Claimed Refund';
      default:
        return 'Activity';
    }
  };

  const getActivityDescription = (activity) => {
    const raffleName = activity.raffleName || activity.name || `Raffle ${activity.raffleAddress?.slice(0, 8)}...`;
    switch (activity.type) {
      case 'ticket_purchase':
        return `${activity.amount} ETH`;
      case 'prize_won':
        return `${raffleName} • Congratulations!`;
      case 'refund_claimed':
        return `${raffleName} • ${activity.amount} ETH`;
      default:
        return raffleName;
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
      <div className="p-6">
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
          <p className="text-muted-foreground text-sm">
            Activity will appear here once you participate in raffles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {activities.slice(0, 8).map((activity) => (
        <div
          key={activity.id}
          className="bg-muted/30 border border-border/50 rounded-lg p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Activity Icon */}
            <div className="flex-shrink-0 mt-1">
              {getActivityIcon(activity.type)}
            </div>

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground text-sm">
                    {getActivityTitle(activity)}
                  </h4>
                  <p className="text-muted-foreground text-sm mt-1">
                    {getActivityDescription(activity)}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {formatDate(activity.timestamp)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleRaffleClick(activity.raffleAddress)}
                  className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 transition-colors"
                >
                  View Raffle
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
