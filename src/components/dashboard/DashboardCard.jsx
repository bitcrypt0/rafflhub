/**
 * DashboardCard Component
 * Unified card component that expands/collapses on mobile and opens modals on desktop.
 * Provides consistent behavior for Dashboard management components.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';

const DashboardCard = ({
  title,
  description,
  icon,
  component: Component,
  defaultExpanded = false,
  className = '',
  // Allow overriding desktop modal width/classes per card
  dialogContentClassName,
  // External state management props (no longer needed but kept for compatibility)
  isExpanded: externalIsExpanded,
  onToggle: externalOnToggle,
  ...props
}) => {
  const { isMobile, isTablet, isDesktop } = useMobileBreakpoints();

  // Modal state for all platforms
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  return (
    <Card
      data-dashboard-card="true"
      className={cn(
        "relative transition-all duration-300 ease-in-out",
        // Responsive sizing
        isMobile && "w-full",
        isTablet && "w-full",
        className
      )}>
      <CardHeader className={cn(
        "pb-3",
        isMobile && "pb-2" // Tighter spacing on mobile
      )}>
        <CardTitle className={cn(
          "flex items-center gap-2",
          isMobile ? "text-base" : "text-lg" // Responsive text size
        )}>
          <span className="flex-1">{title}</span>
        </CardTitle>
        <CardDescription className={cn(
          "text-muted-foreground",
          isMobile ? "text-sm" : "text-sm" // Consistent description size
        )}>
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className={cn(
        "pt-0",
        isMobile && "px-4 pb-4" // Adjusted padding for mobile
      )}>
        {/* Desktop: Modal trigger button */}
        {isDesktop && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleModalOpen}
                variant="primary"
                size="md"
                className={cn(
                  "w-full",
                  "transition-all duration-200",
                  "shadow-sm hover:shadow-md h-10 text-sm"
                )}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open {title}
              </Button>
            </DialogTrigger>
            <DialogContent className={cn(
                // Default modal width; per-card overrides can adjust this
                "max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden",
                dialogContentClassName
              )}>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {Component && <Component />}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Mobile/Tablet: Modal trigger button (no accordion) */}
        {!isDesktop && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={handleModalOpen}
                variant="primary"
                size={isMobile ? "lg" : "md"}
                className={cn(
                  "w-full",
                  "transition-all duration-200",
                  "shadow-sm hover:shadow-md h-10 text-sm"
                )}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open {title}
              </Button>
            </DialogTrigger>
            <DialogContent className={cn(
                // Default modal width; per-card overrides can adjust this
                "max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden",
                dialogContentClassName
              )}>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {Component && <Component />}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

// Specialized card variants for specific use cases
export const CompactDashboardCard = ({ 
  title,
  description,
  icon,
  component: Component,
  className = '',
  ...props 
}) => {
  const { isMobile } = useMobileBreakpoints();
  
  return (
    <DashboardCard
      title={title}
      description={description}
      icon={icon}
      component={Component}
      className={cn(
        // Compact styling
        "shadow-sm",
        isMobile && "shadow-none border-l-4 border-l-primary",
        className
      )}
      {...props}
    />
  );
};

// Card with persistent expanded state (for important components)
export const PersistentDashboardCard = ({ 
  title,
  description,
  icon,
  component: Component,
  storageKey,
  className = '',
  ...props 
}) => {
  // Use localStorage to persist expanded state
  const getInitialExpanded = () => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(`dashboard-card-${storageKey}`);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  };

  const [isExpanded, setIsExpanded] = useState(getInitialExpanded);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    // Persist state
    try {
      localStorage.setItem(`dashboard-card-${storageKey}`, JSON.stringify(newExpanded));
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <Card className={cn(
      "relative transition-all duration-300 ease-in-out",
      isExpanded && "ring-2 ring-primary/20 shadow-lg",
      className
    )}>
      {/* Same content as DashboardCard but with persistent state */}
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="flex-1">{title}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="ml-auto p-1 h-auto"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <Button 
          onClick={handleToggle}
          className={cn(
            "w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white",
            "hover:from-purple-600 hover:to-purple-700 transition-all duration-200",
            isExpanded && "mb-4"
          )}
        >
          {isExpanded ? `Close ${title}` : `Open ${title}`}
        </Button>
        
        {isExpanded && (
          <div className="transition-all duration-300 ease-in-out">
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              {Component && <Component />}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCard;
