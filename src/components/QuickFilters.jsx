import React from 'react';
import { Button } from './ui/button';
import { Clock, Trophy, Users, Ticket } from 'lucide-react';

/**
 * QuickFilters Component
 * Provides quick access to common filter combinations
 */
const QuickFilters = ({ 
  onFilterChange, 
  hasActiveFilters = false,
  className = "" 
}) => {
  const quickFilters = [
    {
      label: 'Active',
      icon: Clock,
      filters: { raffleState: ['active'] },
      description: 'Currently running raffles'
    },
    {
      label: 'Pending',
      icon: Users,
      filters: { raffleState: ['pending'] },
      description: 'Raffles starting soon'
    },
    {
      label: 'NFT Prizes',
      icon: Trophy,
      filters: { raffleType: ['prized'], prizeType: ['nft'] },
      description: 'Raffles with NFT prizes'
    },
    {
      label: 'Whitelist',
      icon: Ticket,
      filters: { raffleType: ['non_prized'] },
      description: 'Whitelist/Allowlist raffles'
    }
  ];

  const handleQuickFilter = (filterConfig) => {
    onFilterChange(filterConfig);
  };

  const clearFilters = () => {
    onFilterChange({
      raffleState: [],
      raffleType: [],
      prizeType: [],
      prizeStandard: []
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Quick Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-xs h-6 px-2"
          >
            Clear
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {quickFilters.map((filter) => {
          const Icon = filter.icon;
          return (
            <Button
              key={filter.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickFilter(filter.filters)}
              className="flex items-center justify-start gap-2 h-auto p-3 text-left"
              title={filter.description}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-medium">{filter.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickFilters;
