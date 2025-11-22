/**
 * UnifiedDashboardGrid Component
 * Main grid component that arranges dashboard cards responsively.
 * Layout: 1 column (mobile), 2 columns (tablet/desktop)
 * Replaces the complex mobile/desktop dual rendering system.
 */

import React, { useState, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';
import DashboardCard from './DashboardCard';
import RoyaltyAdjustmentComponent from '../RoyaltyAdjustmentComponent';
import CreateNewTokenIDComponent from '../CreateNewTokenIDComponent';
import MinterApprovalComponent from '../MinterApprovalComponent';
import CreatorRevenueWithdrawalComponent from '../CreatorRevenueWithdrawalComponent';
import KOLApprovalComponent from '../KOLApprovalComponent';
import VestingConfigurationComponent from '../VestingConfigurationComponent';

const UnifiedDashboardGrid = ({ 
  className = '',
  showStats = true,
  ...props 
}) => {
  const { isMobile, isTablet, isDesktop } = useMobileBreakpoints();

  // Single state management for all platforms - use ref to persist across re-renders
  const [expandedCard, setExpandedCard] = useState(null);
  const expandedCardRef = useRef(expandedCard);

  // Update ref when state changes
  expandedCardRef.current = expandedCard;

  // Dashboard components configuration
  const dashboardComponents = [
    {
      id: 'royalty',
      title: 'Royalty & Reveal',
      description: 'Reveal your collection and manage royalties',

      component: RoyaltyAdjustmentComponent,
      priority: 1 // Higher priority components shown first on mobile
    },
    {
      id: 'vesting',
      title: 'Configure Creator Allocation Vesting',
      description: 'Configure vesting schedules for creator token allocations to prevent rug pulls',
      component: VestingConfigurationComponent,
      priority: 2
    },
    {
      id: 'minter',
      title: 'Minter Approval & Royalty Enforcement Exemption',
      description: 'Manage minter approvals and royalty enforcement exemptions for collections',
      component: MinterApprovalComponent,
      priority: 3
    },
    {
      id: 'kol',
      title: 'KOL Approval Management',
      description: 'Approve Key Opinion Leaders (KOLs) for collections with specific pool limits and slot fees',
      component: KOLApprovalComponent,
      priority: 4
    },
    {
      id: 'tokenCreator',
      title: 'Create New Token ID & Set Token URI',
      description: 'Add new token IDs to existing ERC1155 collections and set metadata URIs',
      component: CreateNewTokenIDComponent,
      priority: 5
    },
    {
      id: 'revenue',
      title: 'Creator Mint & Revenue Withdrawal',
      description: 'Mint tokens to winners and withdraw revenue from your raffles',
      component: CreatorRevenueWithdrawalComponent,
      priority: 6
    }
  ];

  // Handle card expansion - stable state management
  const handleCardToggle = (cardId) => {
    // Always allow toggling the clicked card, regardless of platform
    // This prevents auto-closing when mobile state changes
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  // Determine grid layout based on screen size
  const getGridCols = () => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    if (isDesktop) return 2;
    return 2; // Default fallback
  };

  const gridCols = getGridCols();

  return (
    <div className={cn(
      "w-full space-y-6",
      className
    )} {...props}>
      
      {/* Header Section */}
      <div className="space-y-2">
        <h3 className={cn(
          "font-semibold text-foreground",
          isMobile ? "text-lg" : "text-xl"
        )}>
          Creator Dashboard
        </h3>
        <p className={cn(
          "text-muted-foreground",
          isMobile ? "text-sm" : "text-base"
        )}>
          Manage your collections, royalties, and revenue
        </p>
      </div>

      {/* Responsive Dashboard Grid */}
      <div className={cn(
        "grid gap-4 w-full",
        // Responsive grid columns
        gridCols === 1 && "grid-cols-1",
        gridCols === 2 && "grid-cols-1 md:grid-cols-2",
        // Mobile-specific spacing
        isMobile && "gap-3"
      )}>
        {dashboardComponents.map((component) => (
          <DashboardCard
            key={component.id}
            title={component.title}
            description={component.description}

            component={component.component}
            // Always use external state management to prevent auto-close
            isExpanded={expandedCard === component.id}
            onToggle={() => handleCardToggle(component.id)}
            className={cn(
              // Responsive card styling
              isMobile && [
                "w-full",
                // Add extra margin when expanded on mobile
                expandedCard === component.id && "mb-2"
              ],
              // Desktop/tablet styling
              !isMobile && "h-fit"
            )}
            // Provide modal width for Minter Approval & Royalty Enforcement Exemption (reduced by ~1/3)
            dialogContentClassName={component.id === 'minter' ? "max-w-4xl xl:max-w-4xl" : undefined}
          />
        ))}
      </div>

      {/* Mobile-specific help text */}
      {isMobile && (
        <div className="mt-6 p-3 bg-muted/50 rounded-lg border border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Tap any card above to expand and access its functionality. 
            Only one card can be open at a time on mobile.
          </p>
        </div>
      )}


    </div>
  );
};

// Specialized grid variants
export const CompactDashboardGrid = ({ className = '', ...props }) => {
  const { isMobile } = useMobileBreakpoints();
  
  return (
    <UnifiedDashboardGrid
      className={cn(
        "space-y-4", // Tighter spacing
        isMobile && "space-y-3",
        className
      )}
      showStats={false} // Hide stats in compact mode
      {...props}
    />
  );
};

// Grid with persistent state
export const PersistentDashboardGrid = ({ 
  storageKey = 'dashboard-grid-state',
  className = '', 
  ...props 
}) => {
  // Load initial state from localStorage
  const getInitialState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const [persistentState, setPersistentState] = useState(getInitialState);

  // Save state changes
  const handleStateChange = (newState) => {
    setPersistentState(newState);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newState));
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <UnifiedDashboardGrid
      className={className}
      initialState={persistentState}
      onStateChange={handleStateChange}
      {...props}
    />
  );
};

export default UnifiedDashboardGrid;
