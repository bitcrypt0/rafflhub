import React from 'react';
import { Filter } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '../contexts/ThemeContext';

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
  const { } = useTheme();

  return (
    <Button
      variant="primary"
      size={size}
      onClick={onClick}
      className={`
        relative flex items-center gap-2 border-0
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
