import React from 'react';
import { Trophy } from 'lucide-react';
import { RaffleErrorDisplay } from './ui/raffle-error-display';

/**
 * FilteredRaffleGrid Component
 * Displays filtered raffles in a responsive grid
 */
const FilteredRaffleGrid = ({ 
  raffles = [], 
  loading = false, 
  error = null,
  RaffleCardComponent,
  emptyMessage = "No raffles found matching your filters.",
  className = ""
}) => {
  // Loading state
  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg animate-pulse"
            >
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-5/6"></div>
                </div>
                <div className="h-10 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <RaffleErrorDisplay
          error={error}
          onRetry={null} // FilteredRaffleGrid doesn't handle retries
          showCreateButton={true}
        />
      </div>
    );
  }

  // Empty state
  if (!raffles || raffles.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-muted/20 rounded-full flex items-center justify-center">
            <Trophy className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Raffles Found</h3>
          <p className="text-muted-foreground max-w-md">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  // Raffle grid
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Results header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {raffles.length} {raffles.length === 1 ? 'Raffle' : 'Raffles'} Found
        </h2>
      </div>

      {/* Raffle grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {raffles.map((raffle) => (
          <RaffleCardComponent 
            key={raffle.id || raffle.address} 
            raffle={raffle} 
          />
        ))}
      </div>
    </div>
  );
};

export default FilteredRaffleGrid;
