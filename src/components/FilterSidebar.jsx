import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { Button } from './ui/button';
import { countRafflesByFilters } from '../utils/filterUtils';
import { useCollabDetection } from '../contexts/CollabDetectionContext';
import QuickFilters from './QuickFilters';

// Mobile-specific CSS for input sizing
const mobileInputStyles = `
  @media (max-width: 640px) {
    .mobile-checkbox-radio {
      width: 12px !important;
      height: 12px !important;
      min-width: 12px !important;
      min-height: 12px !important;
      max-width: 12px !important;
      max-height: 12px !important;
    }
  }
`;

/**
 * FilterSidebar Component
 * Vertical filter panel for raffle filtering on LandingPage
 */
const FilterSidebar = ({
  isOpen,
  onToggle,
  filters,
  onFiltersChange,
  raffleCount = 0,
  allRaffles = [], // All raffles for counting
  className = ""
}) => {
  const { countEnhancedRaffleTypes } = useCollabDetection();

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    raffleState: true,
    raffleType: true,
    prizeType: true,
    prizeStandard: true
  });

  // Calculate counts for filter options using enhanced detection
  const raffleCounts = useMemo(() => {
    const standardCounts = countRafflesByFilters(allRaffles);
    const enhancedRaffleTypeCounts = countEnhancedRaffleTypes(allRaffles);

    return {
      ...standardCounts,
      raffleType: enhancedRaffleTypeCounts
    };
  }, [allRaffles, countEnhancedRaffleTypes]);

  // Filter options with dynamic counts
  const filterOptions = useMemo(() => ({
    raffleState: [
      { value: 'pending', label: 'Pending', count: raffleCounts.raffleState.pending || 0 },
      { value: 'active', label: 'Active', count: raffleCounts.raffleState.active || 0 },
      { value: 'ended', label: 'Ended', count: raffleCounts.raffleState.ended || 0 },
      { value: 'drawing', label: 'Drawing', count: raffleCounts.raffleState.drawing || 0 },
      { value: 'completed', label: 'Completed', count: raffleCounts.raffleState.completed || 0 },
      { value: 'deleted', label: 'Deleted', count: raffleCounts.raffleState.deleted || 0 },
      { value: 'activation_failed', label: 'Activation Failed', count: raffleCounts.raffleState.activation_failed || 0 },
      { value: 'all_prizes_claimed', label: 'All Prizes Claimed', count: raffleCounts.raffleState.all_prizes_claimed || 0 },
      { value: 'unengaged', label: 'Unengaged', count: raffleCounts.raffleState.unengaged || 0 }
    ],
    raffleType: [
      { value: 'non_prized', label: 'Whitelist', count: raffleCounts.raffleType.non_prized || 0 },
      { value: 'prized', label: 'Prized', count: raffleCounts.raffleType.prized || 0 },
      { value: 'nft_collab', label: 'NFT Collab', count: raffleCounts.raffleType.nft_collab || 0 },
      { value: 'whitelist_collab', label: 'Whitelist Collab', count: raffleCounts.raffleType.whitelist_collab || 0 }
    ],
    prizeType: [
      { value: 'nft', label: 'NFT', count: raffleCounts.prizeType.nft || 0 },
      { value: 'erc20', label: 'ERC20 Token', count: raffleCounts.prizeType.erc20 || 0 },
      { value: 'eth', label: 'ETH', count: raffleCounts.prizeType.eth || 0 },
      { value: 'token_giveaway', label: 'Token Giveaway', count: raffleCounts.prizeType.token_giveaway || 0 }
    ],
    prizeStandard: [
      { value: 'erc721', label: 'ERC721', count: raffleCounts.prizeStandard.erc721 || 0 },
      { value: 'erc1155', label: 'ERC1155', count: raffleCounts.prizeStandard.erc1155 || 0 },
      { value: 'erc20', label: 'ERC20', count: raffleCounts.prizeStandard.erc20 || 0 },
      { value: 'eth', label: 'ETH', count: raffleCounts.prizeStandard.eth || 0 }
    ]
  }), [raffleCounts]);

  // Toggle section expansion
  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((category, value, isChecked) => {
    const newFilters = { ...filters };
    
    if (category === 'raffleType') {
      // Single select for raffle type
      newFilters[category] = isChecked ? [value] : [];
    } else {
      // Multi-select for other categories
      if (!newFilters[category]) {
        newFilters[category] = [];
      }
      
      if (isChecked) {
        newFilters[category] = [...newFilters[category], value];
      } else {
        newFilters[category] = newFilters[category].filter(item => item !== value);
      }
    }
    
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      raffleState: [],
      raffleType: [],
      prizeType: [],
      prizeStandard: []
    });
  }, [onFiltersChange]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(filterArray => filterArray.length > 0);
  }, [filters]);

  // Render filter section
  const renderFilterSection = useCallback((title, category, options) => {
    const isExpanded = expandedSections[category];
    const isRaffleType = category === 'raffleType';
    const isPrizeCategory = category === 'prizeType' || category === 'prizeStandard';
    const isDisabled = isPrizeCategory && !filters.raffleType?.includes('prized');

    return (
      <div key={category} className="border-b border-border/30 last:border-b-0">
        <button
          onClick={() => toggleSection(category)}
          className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-muted/50 transition-colors"
          disabled={isDisabled}
        >
          <span className={`text-sm sm:text-base font-medium ${isDisabled ? 'text-muted-foreground' : ''}`}>
            {title}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          )}
        </button>
        
        {isExpanded && !isDisabled && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-1 sm:space-y-2">
            {options.map((option) => {
              const isChecked = filters[category]?.includes(option.value) || false;

              return (
                <label
                  key={option.value}
                  className="flex items-center space-x-2 sm:space-x-3 cursor-pointer hover:bg-muted/30 p-1.5 sm:p-2 rounded-md transition-colors"
                >
                  <input
                    type={isRaffleType ? "radio" : "checkbox"}
                    name={isRaffleType ? category : undefined}
                    checked={isChecked}
                    onChange={(e) => handleFilterChange(category, option.value, e.target.checked)}
                    className={`mobile-checkbox-radio ${isRaffleType ?
                      // Radio button styling
                      'h-3 w-3 sm:h-4 sm:w-4 text-primary bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-full focus:ring-0 focus:outline-none checked:bg-primary checked:border-primary appearance-none relative' +
                      (isChecked ? ' after:content-[""] after:absolute after:top-1/2 after:left-1/2 after:transform after:-translate-x-1/2 after:-translate-y-1/2 after:w-1 after:h-1 sm:after:w-1.5 sm:after:h-1.5 after:bg-white after:rounded-full' : '')
                      :
                      // Checkbox styling - mobile specific
                      'h-3 w-3 sm:h-4 sm:w-4 text-primary accent-primary bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-primary focus:ring-offset-0 checked:bg-primary checked:border-primary'
                    }`}
                    style={!isRaffleType ? {
                      // Force mobile checkbox styling
                      minHeight: '12px',
                      minWidth: '12px',
                      maxHeight: '12px',
                      maxWidth: '12px'
                    } : {
                      // Force mobile radio button styling
                      minHeight: '12px',
                      minWidth: '12px',
                      maxHeight: '12px',
                      maxWidth: '12px'
                    }}
                  />
                  <span className="flex-1 text-xs sm:text-sm leading-tight">{option.label}</span>
                  {option.count > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      {option.count}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        
        {isDisabled && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-xs text-muted-foreground italic">
              Select "Prized" raffle type to enable this filter
            </p>
          </div>
        )}
      </div>
    );
  }, [expandedSections, filters, handleFilterChange, toggleSection]);

  return (
    <>
      {/* Mobile-specific styles */}
      <style dangerouslySetInnerHTML={{ __html: mobileInputStyles }} />

      {/* Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={onToggle}
        />
      )}

      {/* Filter Sidebar */}
      <div className={`
        fixed left-0
        top-14 sm:top-16
        h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)]
        w-72 sm:w-80 md:w-96
        bg-background border-r border-border
        transform transition-transform duration-300 ease-in-out
        z-40
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${className}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-muted/20">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="font-semibold text-base sm:text-lg">Filter Raffles</h2>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs px-2 sm:px-3 h-7 sm:h-8 hover:bg-destructive/10 hover:text-destructive"
              >
                Clear All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="hover:bg-muted h-7 w-7 sm:h-8 sm:w-8 p-0"
              title="Close filters"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="p-3 sm:p-4 bg-muted/30">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{raffleCount}</span> raffles
          </p>
        </div>

        {/* Quick Filters */}
        <div className="p-3 sm:p-4 border-b border-border/30">
          <QuickFilters
            onFilterChange={onFiltersChange}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        {/* Filter Sections */}
        <div className="flex-1 overflow-y-auto">
          {renderFilterSection('Raffle State', 'raffleState', filterOptions.raffleState)}
          {renderFilterSection('Raffle Type', 'raffleType', filterOptions.raffleType)}
          {renderFilterSection('Prize Type', 'prizeType', filterOptions.prizeType)}
          {renderFilterSection('Prize Standard', 'prizeStandard', filterOptions.prizeStandard)}
        </div>
      </div>
    </>
  );
};

export default FilterSidebar;
