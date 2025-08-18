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
  const { isLight, isDark, isDimBlue } = useTheme();

  // Theme-aware color application requested:
  // - Light theme: #614E41 (beige brand) with white text
  // - Dark & Dim Blue themes: #F5E9DC (light beige) with dark text
  const themeColorClasses = isLight
    ? 'bg-[#614E41] text-white hover:bg-[#4a3a30]'
    : (isDark || isDimBlue)
      ? 'bg-[#F5E9DC] text-[#0A0A0A] hover:bg-[#e7d8c7]'
      : '';

  return (
    <Button
      variant={hasActiveFilters ? "default" : variant}
      size={size}
      onClick={onClick}
      className={`
        relative flex items-center gap-2 border-0
        ${hasActiveFilters ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
        ${themeColorClasses}
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
