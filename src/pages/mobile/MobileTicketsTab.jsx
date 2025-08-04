import React from 'react';
import { Ticket, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mobile-optimized tickets tab with simple list layout
 */
const MobileTicketsTab = ({ tickets, claimRefund }) => {
  const navigate = useNavigate();

  const getStateColor = (state) => {
    switch (state) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'ended':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStateLabel = (state) => {
    switch (state) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'ended':
        return 'Ended';
      case 'allPrizesClaimed':
        return 'Finished';
      default:
        return state;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRaffleClick = (raffleAddress) => {
    navigate(`/raffle/${raffleAddress}`);
  };

  const handleClaimRefund = (raffleAddress) => {
    claimRefund(raffleAddress);
  };

  if (!tickets || tickets.length === 0) {
    return (
      <div className="p-3">
        <div className="text-center py-6">
          <Ticket className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">No Tickets Purchased</h3>
          <p className="text-muted-foreground text-xs">
            Purchase tickets in active raffles to see them here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
      {tickets.slice(0, 3).map((ticket) => (
        <div
          key={ticket.address || ticket.raffleAddress}
          className="bg-muted/30 border border-border/50 rounded-lg p-3"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground text-xs truncate">
                {ticket.name || ticket.raffleName || `Raffle ${ticket.address?.slice(0, 8)}...`}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ends: {formatDate(ticket.endTime)}
              </p>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getStateColor(ticket.state)}`}>
              {getStateLabel(ticket.state)}
            </span>
          </div>

          {/* Compact Ticket Info */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Tickets</p>
              <p className="text-xs font-semibold">
                {ticket.ticketCount}
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="text-xs font-semibold text-blue-600">
                {parseFloat(ticket.totalSpent).toFixed(3)} ETH
              </p>
            </div>
          </div>

          {/* Ticket Numbers (limited) */}
          <div className="mb-2">
            <p className="text-xs text-muted-foreground mb-1">Tickets:</p>
            <div className="flex flex-wrap gap-1">
              {ticket.tickets.slice(0, 3).map((ticketNum, index) => (
                <span
                  key={index}
                  className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                >
                  #{ticketNum}
                </span>
              ))}
              {ticket.tickets.length > 3 && (
                <span className="text-xs text-muted-foreground px-1.5 py-0.5">
                  +{ticket.tickets.length - 3}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => handleRaffleClick(ticket.address || ticket.raffleAddress)}
              className="flex-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors"
            >
              View
            </button>

            {ticket.state === 'ended' && (
              <button
                onClick={() => handleClaimRefund(ticket.address || ticket.raffleAddress)}
                className="flex-1 text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Refund
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MobileTicketsTab;
