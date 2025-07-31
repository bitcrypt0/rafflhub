import React from 'react';
import { Filter } from 'lucide-react';
import { Button } from './ui/button';

/**
 * FilterToggleButton Component
 * Button to toggle filter sidebar visibility
 */
const FilterToggleButton = ({
  onClick,
  hasActiveFilters = false,
  className = "",
  variant = "outline",
  size = "default"
}) => {
  return (
    <Button
      variant={hasActiveFilters ? "default" : variant}
      size={size}
      onClick={onClick}
      className={`
        relative flex items-center gap-2
        ${hasActiveFilters ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
        ${className}
      `}
    >
      <Filter className="h-4 w-4" />
      <span className="font-medium">
        {hasActiveFilters ? 'Filters Applied' : 'Filter Raffles'}
      </span>
      {hasActiveFilters && (
        <span className="ml-1 px-2 py-0.5 text-xs bg-primary-foreground/20 rounded-full">
          Active
        </span>
      )}
    </Button>
  );
};

export default FilterToggleButton;
