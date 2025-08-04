import React from 'react';
import { Plus, Users, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Mobile-optimized created raffles tab with simple card layout
 */
const MobileCreatedRafflesTab = ({ 
  raffles, 
  showRevenueModal, 
  setShowRevenueModal, 
  selectedRaffle, 
  setSelectedRaffle, 
  withdrawRevenue 
}) => {
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

  const handleCreateRaffle = () => {
    navigate('/create-raffle');
  };

  const handleRaffleClick = (raffleAddress) => {
    navigate(`/raffle/${raffleAddress}`);
  };

  const handleWithdrawRevenue = (raffle) => {
    setSelectedRaffle(raffle);
    setShowRevenueModal(true);
  };

  const confirmWithdraw = () => {
    if (selectedRaffle) {
      withdrawRevenue(selectedRaffle.address);
    }
  };

  if (!raffles || raffles.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Raffles Created</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Create your first raffle to start earning revenue and building your community.
          </p>
          <button
            onClick={handleCreateRaffle}
            className="bg-primary text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Create Your First Raffle
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Create New Raffle Button */}
      <button
        onClick={handleCreateRaffle}
        className="w-full bg-primary text-white p-4 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Create New Raffle
      </button>

      {/* Raffles List */}
      {raffles.slice(0, 5).map((raffle) => (
        <div
          key={raffle.address}
          className="bg-muted/30 border border-border/50 rounded-lg p-4"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground text-sm">
                {raffle.name}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(raffle.endTime)}
              </p>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getStateColor(raffle.state)}`}>
              {getStateLabel(raffle.state)}
            </span>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Sold</p>
              <p className="text-xs font-semibold">
                {raffle.ticketsSold}/{raffle.maxTickets}
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-xs font-semibold text-green-600">
                {parseFloat(raffle.revenue).toFixed(3)} ETH
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => handleRaffleClick(raffle.address)}
              className="flex-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors"
            >
              View
            </button>

            {(raffle.state === 'completed' || raffle.state === 'allPrizesClaimed') && parseFloat(raffle.revenue) > 0 && (
              <button
                onClick={() => handleWithdrawRevenue(raffle)}
                className="flex-1 text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded hover:bg-green-500/20 transition-colors"
              >
                Withdraw
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Simple Revenue Withdrawal Modal */}
      {showRevenueModal && selectedRaffle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Withdraw Revenue</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Withdraw {parseFloat(selectedRaffle.revenue).toFixed(4)} ETH from "{selectedRaffle.name}"?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevenueModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-md text-sm hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmWithdraw}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileCreatedRafflesTab;
