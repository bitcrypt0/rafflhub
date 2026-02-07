import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { Button } from './ui/button';
import { countRafflesByFilters } from '../utils/filterUtils';
import { useCollabDetection } from '../contexts/CollabDetectionContext';
import { useNativeCurrency } from '../hooks/useNativeCurrency';
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

  // Header height tracking to snap filter to top after header scrolls out of view
  const useHeaderOffset = () => {
    const [offset, setOffset] = useState({ top: 56, height: 56 }); // default ~14 (3.5rem) => 56px

    useEffect(() => {
      const header = document.querySelector('header');
      const baseHeight = header ? header.getBoundingClientRect().height : 56;

      const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 640px)').matches;

      const onScroll = () => {
        const scrolled = window.scrollY || window.pageYOffset || 0;
        if (isMobile()) {
          // On mobile, header remains fixed; keep panel below header always
          setOffset({ top: baseHeight, height: window.innerHeight - baseHeight });
        } else {
          // Desktop/tablet: once header scrolls out, panel covers full screen
          if (scrolled >= baseHeight) {
            setOffset({ top: 0, height: window.innerHeight });
          } else {
            setOffset({ top: baseHeight - scrolled, height: window.innerHeight - (baseHeight - scrolled) });
          }
        }
      };

      // Initialize and listen
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    }, []);

    return offset;
  };


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
  backendFilterCounts = null, // Pre-computed counts from backend
  className = ""
}) => {
  const { countEnhancedRaffleTypes } = useCollabDetection();
  const { getCurrencySymbol } = useNativeCurrency();


  const headerOffset = useHeaderOffset();

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState({
    raffleState: true,
    raffleType: true,
    prizeType: true,
    prizeStandard: true
  });

  // Calculate counts for filter options — always recompute from live allRaffles
  // so counts stay in sync with real-time updates (state changes, new pools, etc.)
  const raffleCounts = useMemo(() => {
    // When allRaffles is populated, always compute from live data for real-time accuracy
    if (allRaffles && allRaffles.length > 0) {
      const standardCounts = countRafflesByFilters(allRaffles);
      const enhancedRaffleTypeCounts = countEnhancedRaffleTypes(allRaffles);
      return {
        ...standardCounts,
        raffleType: enhancedRaffleTypeCounts
      };
    }

    // Fallback to backend counts during initial load (before allRaffles is populated)
    if (backendFilterCounts) {
      return {
        raffleState: backendFilterCounts.raffleState || {},
        raffleType: backendFilterCounts.raffleType || {},
        prizeType: backendFilterCounts.prizeType || {},
        prizeStandard: backendFilterCounts.prizeStandard || {}
      };
    }

    return { raffleState: {}, raffleType: {}, prizeType: {}, prizeStandard: {} };
  }, [allRaffles, countEnhancedRaffleTypes, backendFilterCounts]);

  // Filter options with dynamic counts
  const filterOptions = useMemo(() => ({
    raffleState: [
      { value: 'pending', label: 'Pending', count: raffleCounts.raffleState.pending || 0 },
      { value: 'active', label: 'Active', count: raffleCounts.raffleState.active || 0 },
      { value: 'ended', label: 'Ended', count: raffleCounts.raffleState.ended || 0 },
      { value: 'drawing', label: 'Drawing', count: raffleCounts.raffleState.drawing || 0 },
      { value: 'completed', label: 'Completed', count: raffleCounts.raffleState.completed || 0 },
      { value: 'deleted', label: 'Deleted', count: raffleCounts.raffleState.deleted || 0 },
      
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
      { value: 'erc20', label: 'ERC20', count: raffleCounts.prizeType.erc20 || 0 },
      { value: 'native', label: getCurrencySymbol(), count: raffleCounts.prizeType.native || 0 }
    ],
    prizeStandard: [
      { value: 'erc721', label: 'ERC721', count: raffleCounts.prizeStandard.erc721 || 0 },
      { value: 'erc1155', label: 'ERC1155', count: raffleCounts.prizeStandard.erc1155 || 0 },
      { value: 'erc20', label: 'ERC20', count: raffleCounts.prizeStandard.erc20 || 0 },
      { value: 'native', label: getCurrencySymbol(), count: raffleCounts.prizeStandard.native || 0 }
    ]
  }), [raffleCounts, getCurrencySymbol]);

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
          style={(category === 'raffleState' || category === 'raffleType' || category === 'prizeType' || category === 'prizeStandard') ? { border: '1px solid #614E41' } : undefined}
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
      <div
        style={{ top: headerOffset.top, height: headerOffset.height }}
        className={`
        fixed left-0
        w-72 sm:w-80 md:w-96
        bg-background border-r border-border
        transform transition-transform duration-300 ease-in-out
        z-40
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${className}
      `}>
        {/* Header - sticky under mobile header so label stays visible */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-3 sm:p-4 border-b border-border bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
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
