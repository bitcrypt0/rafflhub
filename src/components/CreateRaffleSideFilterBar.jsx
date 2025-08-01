import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, Filter, X, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';

/**
 * CreateRaffleSideFilterBar Component
 * Replicates LandingPage FilterSidebar structure for CreateRafflePage
 * Maintains exact hierarchical filter logic for form rendering
 */
const CreateRaffleSideFilterBar = ({
  isOpen,
  onToggle,
  // Current filter states (maintaining existing logic)
  raffleType,
  setRaffleType,
  nftStandard,
  setNftStandard,
  erc721Source,
  setErc721Source,
  erc1155Source,
  setErc1155Source,
  className = ""
}) => {
  const { isMobile } = useMobileBreakpoints();

  // Expanded sections state (like LandingPage)
  const [expandedSections, setExpandedSections] = useState({
    raffleType: true,
    nftConfiguration: true,
    collectionSource: true
  });

  // Filter options (from existing FILTERS constant)
  const raffleTypeOptions = [
    { value: 'Whitelist/Allowlist', label: 'Whitelist/Allowlist', description: 'Access control raffles' },
    { value: 'NFTDrop', label: 'NFT Drop', description: 'NFT collection raffles' },
    { value: 'Lucky Sale/NFT Giveaway', label: 'Lucky Sale/NFT Giveaway', description: 'Discounted NFT sales' },
    { value: 'ETH Giveaway', label: 'ETH Giveaway', description: 'Ethereum prize raffles' },
    { value: 'ERC20 Token Giveaway', label: 'ERC20 Token Giveaway', description: 'Token prize raffles' }
  ];

  const nftStandardOptions = [
    { value: 'ERC721', label: 'ERC721', description: 'Single NFT standard' },
    { value: 'ERC1155', label: 'ERC1155', description: 'Multi-token standard' }
  ];

  const erc721SourceOptions = [
    { value: 'New ERC721 Collection', label: 'New ERC721 Collection', description: 'Deploy new collection' },
    { value: 'Existing ERC721 Collection', label: 'Existing ERC721 Collection', description: 'Use existing collection' }
  ];

  const erc1155SourceOptions = [
    { value: 'New ERC1155 Collection', label: 'New ERC1155 Collection', description: 'Deploy new collection' },
    { value: 'Existing ERC1155 Collection', label: 'Existing ERC1155 Collection', description: 'Use existing collection' }
  ];

  // Toggle section expansion
  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setRaffleType('Whitelist/Allowlist');
    setNftStandard('ERC721');
    setErc721Source('New ERC721 Collection');
    setErc1155Source('New ERC1155 Collection');
  }, [setRaffleType, setNftStandard, setErc721Source, setErc1155Source]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return raffleType !== 'Whitelist/Allowlist' || 
           nftStandard !== 'ERC721' || 
           erc721Source !== 'New ERC721 Collection' || 
           erc1155Source !== 'New ERC1155 Collection';
  }, [raffleType, nftStandard, erc721Source, erc1155Source]);

  // Conditional visibility logic (maintaining existing behavior)
  const showNftConfiguration = raffleType === 'NFTDrop' || raffleType === 'Lucky Sale/NFT Giveaway';
  const showCollectionSource = showNftConfiguration;

  // Render filter section (like LandingPage structure)
  const renderFilterSection = useCallback((title, category, options, currentValue, onChange, isDisabled = false) => {
    const isExpanded = expandedSections[category];
    const isRadio = true; // All our filters are single-select

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
              const isChecked = currentValue === option.value;

              return (
                <label
                  key={option.value}
                  className="flex items-start space-x-2 sm:space-x-3 cursor-pointer hover:bg-muted/30 p-1.5 sm:p-2 rounded-md transition-colors"
                >
                  <input
                    type="radio"
                    name={category}
                    checked={isChecked}
                    onChange={() => onChange(option.value)}
                    className="mt-1 h-4 w-4 text-primary border-0 focus:ring-0 focus:outline-none"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-medium leading-tight">{option.label}</span>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        
        {isDisabled && (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <p className="text-xs text-muted-foreground italic">
              Select appropriate raffle type to enable this filter
            </p>
          </div>
        )}
      </div>
    );
  }, [expandedSections, toggleSection]);

  return (
    <>
      {/* Backdrop Overlay (like LandingPage) */}
      {isOpen && (
        <div
          className="fixed inset-0 top-14 sm:top-16 bg-black/50 z-30"
          onClick={onToggle}
        />
      )}

      {/* Filter Sidebar (reduced width) */}
      <div className={`
        fixed left-0
        top-14 sm:top-16
        h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)]
        w-64 sm:w-72 md:w-80
        bg-background border-r border-border
        transform transition-transform duration-300 ease-in-out
        z-40
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${className}
      `}>
        {/* Header (like LandingPage) */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-muted/20">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="font-semibold text-base sm:text-lg">Create Raffle</h2>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs px-2 sm:px-3 h-7 sm:h-8 hover:bg-destructive/10 hover:text-destructive"
              >
                Reset
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

        {/* Description */}
        <div className="p-3 sm:p-4 bg-muted/30">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure Raffle type and Prizes
          </p>
        </div>

        {/* Filter Sections */}
        <div className="flex-1 overflow-y-auto">
          {/* Raffle Type Section */}
          {renderFilterSection(
            'Raffle Type',
            'raffleType',
            raffleTypeOptions,
            raffleType,
            setRaffleType
          )}

          {/* NFT Configuration Section (conditional) */}
          {showNftConfiguration && renderFilterSection(
            'NFT Standard',
            'nftConfiguration',
            nftStandardOptions,
            nftStandard,
            setNftStandard
          )}

          {/* Collection Source Section (conditional) */}
          {showCollectionSource && nftStandard === 'ERC721' && renderFilterSection(
            'ERC721 Source',
            'collectionSource',
            erc721SourceOptions,
            erc721Source,
            setErc721Source
          )}

          {showCollectionSource && nftStandard === 'ERC1155' && renderFilterSection(
            'ERC1155 Source',
            'collectionSource',
            erc1155SourceOptions,
            erc1155Source,
            setErc1155Source
          )}
        </div>
      </div>
    </>
  );
};

export default CreateRaffleSideFilterBar;
