import React from 'react';

/**
 * Mobile-optimized tab navigation with bottom fixed positioning
 */
const MobileTabNavigation = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="grid grid-cols-4 gap-1 p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200
                ${isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              <Icon className={`h-5 w-5 mb-1 ${isActive ? 'text-primary' : ''}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-primary' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileTabNavigation;
