import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  Activity, 
  Plus, 
  Ticket, 
  BarChart3, 
  Users, 
  TrendingUp,
  DollarSign,
  Award,
  Calendar,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RoyaltyAdjustmentComponent from './RoyaltyAdjustmentComponent';
import MinterApprovalComponent from './MinterApprovalComponent';
import CreatorRevenueWithdrawalComponent from './CreatorRevenueWithdrawalComponent';
import CreateNewTokenIDComponent from './CreateNewTokenIDComponent';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';

const ProfileTabs = ({
  activities,
  createdRaffles,
  purchasedTickets,
  creatorStats,
  onDeleteRaffle,
  onViewRevenue,
  onClaimPrize,
  onClaimRefund
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('activity');
  const { isMobile } = useMobileBreakpoints();

  // Modal state management for desktop only
  const [modals, setModals] = useState({
    royalty: false,
    minter: false,
    tokenCreator: false,
    revenue: false
  });

  // Mobile full-page navigation state
  const [mobileActivePage, setMobileActivePage] = useState(null);

  // Mobile utility components data
  const mobileUtilities = [
    {
      key: 'royalty',
      title: 'Royalty & Reveal',
      description: 'Manage royalties and reveal collections',
      icon: '👑',
      component: RoyaltyAdjustmentComponent
    },
    {
      key: 'minter',
      title: 'Minter Approval',
      description: 'Manage minter approvals for collections',
      icon: '🔑',
      component: MinterApprovalComponent
    },
    {
      key: 'tokenCreator',
      title: 'Create Token ID',
      description: 'Add new token IDs to ERC1155 collections',
      icon: '🆕',
      component: CreateNewTokenIDComponent
    },
    {
      key: 'revenue',
      title: 'Revenue Withdrawal',
      description: 'Withdraw revenue from completed raffles',
      icon: '💰',
      component: CreatorRevenueWithdrawalComponent
    }
  ];

  // Mobile navigation functions
  const openMobilePage = (pageKey) => {
    setMobileActivePage(pageKey);
  };

  const closeMobilePage = () => {
    setMobileActivePage(null);
  };

  // Prevent body scroll when mobile page is open
  useEffect(() => {
    if (isMobile && mobileActivePage) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isMobile, mobileActivePage]);

  // Mobile full-page utility component
  const MobileUtilityPage = ({ utilityKey }) => {
    const utility = mobileUtilities.find(u => u.key === utilityKey);
    if (!utility) return null;

    const UtilityComponent = utility.component;

    return (
      <div className="fixed inset-0 z-50 bg-background">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background/95 backdrop-blur-sm">
          <button
            onClick={closeMobilePage}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-lg">{utility.icon}</span>
            <h1 className="text-lg font-semibold">{utility.title}</h1>
          </div>

          <div className="w-16"></div> {/* Spacer for centering */}
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">{utility.description}</p>
          </div>

          {/* Render the utility component */}
          <div className="mobile-utility-page-content">
            <UtilityComponent />
          </div>
        </div>
      </div>
    );
  };

  // Mobile utility grid component
  const MobileUtilityGrid = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Creator Utilities</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Manage your collections, royalties, and revenue
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {mobileUtilities.map((utility) => (
          <button
            key={utility.key}
            onClick={() => openMobilePage(utility.key)}
            className="p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-all duration-200 text-left"
          >
            <div className="flex flex-col items-center text-center gap-2">
              <span className="text-2xl">{utility.icon}</span>
              <div>
                <h4 className="font-medium text-sm leading-tight">{utility.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">
                  {utility.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // Lock body scroll when any modal is open on mobile
  useEffect(() => {
    if (isMobile) {
      const isAnyModalOpen = Object.values(modals).some(Boolean);

      if (isAnyModalOpen) {
        // Store original values
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalTop = document.body.style.top;
        const originalWidth = document.body.style.width;

        // Prevent scrolling and fix position
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = '0';
        document.body.style.width = '100%';

        // Aggressive viewport and scroll management for Android
        const viewport = document.querySelector('meta[name=viewport]');
        const originalViewport = viewport?.getAttribute('content');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
        }

        // Prevent body from moving when keyboard opens
        const scrollY = window.scrollY;
        document.body.style.top = `-${scrollY}px`;

        // Additional Android-specific fixes
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100%';

        // Prevent touch events on body
        const preventBodyTouch = (e) => {
          if (!modalRef.current?.contains(e.target)) {
            e.preventDefault();
          }
        };

        document.body.addEventListener('touchstart', preventBodyTouch, { passive: false });
        document.body.addEventListener('touchmove', preventBodyTouch, { passive: false });

        // Cleanup function to restore original values
        return () => {
          document.body.style.overflow = originalOverflow;
          document.body.style.position = originalPosition;
          document.body.style.top = originalTop;
          document.body.style.width = originalWidth;

          // Restore document element styles
          document.documentElement.style.overflow = '';
          document.documentElement.style.height = '';

          // Remove touch event listeners
          document.body.removeEventListener('touchstart', preventBodyTouch);
          document.body.removeEventListener('touchmove', preventBodyTouch);

          // Restore scroll position
          const scrollY = document.body.style.top;
          if (scrollY) {
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
          }

          if (viewport && originalViewport) {
            viewport.setAttribute('content', originalViewport);
          }
        };
      }
    }
  }, [modals, isMobile]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (isMobile) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isMobile]);

  // Custom mobile modal component that avoids Radix UI issues
  const MobileAwareModal = ({
    isOpen,
    onOpenChange,
    trigger,
    title,
    children
  }) => {
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const modalRef = useRef(null);

    // Completely disable backdrop interaction when keyboard is open or inputs are focused
    const handleBackdropClick = (e) => {
      console.log('Backdrop click:', { keyboardOpen, target: e.target.tagName });

      // Never close if keyboard is open
      if (keyboardOpen) {
        console.log('Backdrop click blocked: keyboard open');
        return;
      }

      // Check if any input in the modal has focus
      const activeElement = document.activeElement;
      if (activeElement && modalRef.current?.contains(activeElement)) {
        console.log('Backdrop click blocked: input has focus');
        return;
      }

      // Check if clicking on any interactive element
      const target = e.target;
      if (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.closest('[role="combobox"]') ||
          target.closest('[data-radix-select-trigger]') ||
          target.closest('[data-radix-select-content]') ||
          target.closest('[data-radix-select-item]') ||
          target.closest('button') ||
          target.closest('input') ||
          target.closest('textarea')) {
        console.log('Backdrop click blocked: interactive element');
        return;
      }

      // Only close if clicking directly on backdrop
      if (e.target === e.currentTarget) {
        console.log('Closing modal via backdrop');
        onOpenChange(false);
      }
    };

    // Handle escape key
    useEffect(() => {
      if (isOpen && isMobile) {
        const handleEscape = (e) => {
          if (e.key === 'Escape') {
            onOpenChange(false);
          }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }
    }, [isOpen, isMobile, onOpenChange]);

    // Android-specific keyboard detection and input focus handling
    useEffect(() => {
      if (isOpen && isMobile) {
        const initialViewportHeight = window.visualViewport?.height || window.innerHeight;
        const initialWindowHeight = window.innerHeight;
        let focusTimeout;
        let blurTimeout;

        // More aggressive keyboard detection for Android
        const handleViewportChange = () => {
          const currentHeight = window.visualViewport?.height || window.innerHeight;
          const windowHeight = window.innerHeight;

          // Check both visual viewport and window height changes
          const viewportDiff = initialViewportHeight - currentHeight;
          const windowDiff = initialWindowHeight - windowHeight;
          const maxDiff = Math.max(viewportDiff, windowDiff);

          // Lower threshold for Android (100px instead of 150px)
          const isKeyboardOpen = maxDiff > 100;
          console.log('Keyboard detection:', { viewportDiff, windowDiff, maxDiff, isKeyboardOpen });
          setKeyboardOpen(isKeyboardOpen);
        };

        // Aggressive input focus handling for Android
        const handleFocusIn = (e) => {
          console.log('Focus in:', e.target.tagName, e.target.type);
          if (e.target.tagName === 'INPUT' ||
              e.target.tagName === 'TEXTAREA' ||
              e.target.hasAttribute('contenteditable') ||
              e.target.closest('[data-radix-select-trigger]')) {

            // Clear any pending blur timeout
            if (blurTimeout) {
              clearTimeout(blurTimeout);
              blurTimeout = null;
            }

            // Immediately set keyboard open for Android
            setKeyboardOpen(true);

            // Also set with delay as backup
            focusTimeout = setTimeout(() => {
              setKeyboardOpen(true);
            }, 50);
          }
        };

        const handleFocusOut = (e) => {
          console.log('Focus out:', e.target.tagName);
          if (focusTimeout) {
            clearTimeout(focusTimeout);
            focusTimeout = null;
          }

          // Delay closing keyboard state to prevent flicker
          blurTimeout = setTimeout(() => {
            // Check if another input has focus
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (
              activeElement.tagName === 'INPUT' ||
              activeElement.tagName === 'TEXTAREA' ||
              activeElement.hasAttribute('contenteditable') ||
              activeElement.closest('[data-radix-select-trigger]')
            );

            if (!isInputFocused) {
              // Double-check with viewport
              const currentHeight = window.visualViewport?.height || window.innerHeight;
              const windowHeight = window.innerHeight;
              const viewportDiff = initialViewportHeight - currentHeight;
              const windowDiff = initialWindowHeight - windowHeight;
              const maxDiff = Math.max(viewportDiff, windowDiff);

              if (maxDiff <= 100) {
                setKeyboardOpen(false);
              }
            }
          }, 500); // Longer delay for Android
        };

        // Multiple event listeners for better Android support
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', handleViewportChange);
        }
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('orientationchange', handleViewportChange);

        // Focus event listeners with capture for better Android support
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);

        // Additional Android-specific events
        document.addEventListener('touchstart', (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            console.log('Touch start on input');
            setKeyboardOpen(true);
          }
        }, true);

        return () => {
          if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', handleViewportChange);
          }
          window.removeEventListener('resize', handleViewportChange);
          window.removeEventListener('orientationchange', handleViewportChange);
          document.removeEventListener('focusin', handleFocusIn, true);
          document.removeEventListener('focusout', handleFocusOut, true);

          if (focusTimeout) {
            clearTimeout(focusTimeout);
          }
          if (blurTimeout) {
            clearTimeout(blurTimeout);
          }
        };
      }
    }, [isOpen, isMobile]);

    if (isMobile) {
      return (
        <>
          {/* Trigger button */}
          <div onClick={() => onOpenChange(true)}>
            {trigger}
          </div>

          {/* Custom mobile modal - rendered via portal */}
          {isOpen && createPortal(
            <div
              className={`fixed inset-0 z-[9999] ${keyboardOpen ? 'items-start pt-4' : 'items-end'} flex justify-center`}
              onClick={handleBackdropClick}
              style={{
                // Prevent viewport scaling issues on iOS
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/50" />

              {/* Modal content */}
              <div
                ref={modalRef}
                className={`relative w-full bg-background shadow-xl duration-300 flex flex-col ${
                  keyboardOpen
                    ? 'rounded-xl mx-4 max-h-[calc(100vh-2rem)]'
                    : 'rounded-t-xl max-h-[90vh] animate-in slide-in-from-bottom-2'
                }`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  // Ensure modal stays in view when keyboard opens
                  maxHeight: keyboardOpen ? 'calc(100vh - 2rem)' : '90vh',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
                  <h2 className="text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{title}</h2>
                  <div className="flex items-center gap-2">
                    {/* Debug info for development */}
                    {process.env.NODE_ENV === 'development' && (
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        KB: {keyboardOpen ? 'Open' : 'Closed'}
                      </span>
                    )}
                    <button
                      onClick={() => onOpenChange(false)}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div
                  className="p-4 overflow-y-auto flex-1 mobile-modal-content"
                  style={{
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y', // Allow vertical scrolling but prevent other gestures
                    position: 'relative',
                    zIndex: 1
                  }}
                  onTouchStart={(e) => {
                    console.log('Content touch start:', e.target.tagName);
                    e.stopPropagation();

                    // If touching an input, ensure keyboard state is set
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                      setKeyboardOpen(true);
                    }
                  }}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    console.log('Content click:', e.target.tagName);
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => {
                    console.log('Content pointer down:', e.target.tagName);
                    e.stopPropagation();
                  }}
                >
                  {/* Wrap children in a provider that ensures Select portals work */}
                  <div
                    style={{ position: 'relative', zIndex: 'auto' }}
                    onFocus={(e) => {
                      console.log('Content focus:', e.target.tagName);
                      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                        setKeyboardOpen(true);
                      }
                    }}
                  >
                    {children}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      );
    }

    // Desktop: Use regular Dialog
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  };

  const ActivityTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <Badge variant="outline">{activities.length} activities</Badge>
      </div>
      
      {activities.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No activity yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 10).map((activity, index) => (
            <div key={index} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 hover:shadow-lg transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {activity.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(activity.timestamp * 1000).toLocaleDateString()}
                  </p>
                  {activity.txHash && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Tx: {activity.txHash.slice(0, 10)}...
                    </p>
                  )}
                </div>
                {activity.raffleAddress && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/raffle/${activity.raffleAddress}`)}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const CreatedRafflesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Created Raffles</h3>
        <Badge variant="outline">{createdRaffles.length} raffles</Badge>
      </div>

      {createdRaffles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You haven't created any raffles yet</p>
            <Button
              onClick={() => navigate('/create-raffle')}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
            >
              Create Your First Raffle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {createdRaffles.map((raffle) => (
            <Card key={raffle.address} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate">{raffle.name}</CardTitle>
                  <Badge 
                    variant={raffle.state === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {raffle.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tickets Sold</p>
                    <p className="font-medium">{raffle.ticketsSold}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Revenue</p>
                    <p className="font-medium">
                      {raffle.ticketsSold * parseFloat(raffle.ticketPrice) / 1e18} ETH
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/raffle/${raffle.address}`)}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onViewRevenue(raffle)}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Revenue
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const PurchasedTicketsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Purchased Tickets</h3>
        <Badge variant="outline">{purchasedTickets.length} tickets</Badge>
      </div>

      {purchasedTickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">You haven't purchased any tickets yet</p>
            <Button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors"
            >
              Browse Raffles
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {purchasedTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate">{ticket.raffleName}</CardTitle>
                  <Badge 
                    variant={ticket.canClaimPrize ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {ticket.canClaimPrize ? 'Prize Available' : ticket.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ticket Price</p>
                    <p className="font-medium">{parseFloat(ticket.ticketPrice) / 1e18} ETH</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">
                      {new Date(ticket.purchaseTime * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/raffle/${ticket.raffleAddress}`)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {ticket.canClaimPrize && (
                    <Button
                      size="sm"
                      onClick={() => onClaimPrize(ticket)}
                      className="flex-1"
                    >
                      <Award className="h-4 w-4 mr-1" />
                      Claim Prize
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const CreatorDashboardTab = () => (
    <div className={`space-y-6 ${isMobile ? 'w-full overflow-hidden' : ''}`}>
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raffles</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.totalRaffles}</div>
            <p className="text-xs text-muted-foreground">
              {creatorStats.activeRaffles} currently active
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.totalRevenue} ETH</div>
            <p className="text-xs text-muted-foreground">
              +{creatorStats.monthlyRevenue} this month
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.totalParticipants}</div>
            <p className="text-xs text-muted-foreground">
              {creatorStats.uniqueParticipants} unique users
            </p>
          </CardContent>
        </Card>

        <Card className={isMobile ? 'w-full overflow-hidden' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creatorStats.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              Completed raffles
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Management Components - Platform Aware */}
      {isMobile ? (
        /* Mobile: Full-page navigation */
        <MobileUtilityGrid />
      ) : (
        /* Desktop: Modal-based interface */
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Royalty and Reveal Management</CardTitle>
              <CardDescription>Reveal your collection and manage royalties</CardDescription>
            </CardHeader>
            <CardContent>
              <MobileAwareModal
                isOpen={modals.royalty}
                onOpenChange={(open) => setModals(prev => ({ ...prev, royalty: open }))}
                title="Royalty and Reveal Management"
                trigger={
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                    Open Royalty Manager
                  </Button>
                }
              >
                <RoyaltyAdjustmentComponent />
              </MobileAwareModal>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Minter Approval Management</CardTitle>
              <CardDescription>Manage minter approvals for your collections</CardDescription>
            </CardHeader>
            <CardContent>
              <MobileAwareModal
                isOpen={modals.minter}
                onOpenChange={(open) => setModals(prev => ({ ...prev, minter: open }))}
                title="Minter Approval Management"
                trigger={
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                    Open Minter Manager
                  </Button>
                }
              >
                <MinterApprovalComponent />
              </MobileAwareModal>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Create New Token ID</CardTitle>
              <CardDescription>Add new token IDs to existing ERC1155 collections</CardDescription>
            </CardHeader>
            <CardContent>
              <MobileAwareModal
                isOpen={modals.tokenCreator}
                onOpenChange={(open) => setModals(prev => ({ ...prev, tokenCreator: open }))}
                title="Create New Token ID"
                trigger={
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                    Open Token Creator
                  </Button>
                }
              >
                <CreateNewTokenIDComponent />
              </MobileAwareModal>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Creator Revenue Withdrawal</CardTitle>
              <CardDescription>Withdraw revenue from your raffles</CardDescription>
            </CardHeader>
            <CardContent>
              <MobileAwareModal
                isOpen={modals.revenue}
                onOpenChange={(open) => setModals(prev => ({ ...prev, revenue: open }))}
                title="Creator Revenue Withdrawal"
                trigger={
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700">
                    Open Revenue Manager
                  </Button>
                }
              >
                <CreatorRevenueWithdrawalComponent />
              </MobileAwareModal>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {isMobile ? (
        // Mobile: 2x2 grid layout with proper buttons
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'activity'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <Activity className="h-5 w-5" />
            <span className="text-sm font-medium">Activity</span>
          </button>
          <button
            onClick={() => setActiveTab('created')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'created'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-medium">Created</span>
          </button>
          <button
            onClick={() => setActiveTab('purchased')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'purchased'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <Ticket className="h-5 w-5" />
            <span className="text-sm font-medium">Tickets</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
              activeTab === 'dashboard'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>
        </div>
      ) : (
        // Desktop: horizontal tabs
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="created" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Created
          </TabsTrigger>
          <TabsTrigger value="purchased" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Purchased
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>
      )}

      <TabsContent value="activity" className={isMobile ? "mt-4" : "mt-6"}>
        <ActivityTab />
      </TabsContent>

      <TabsContent value="created" className={isMobile ? "mt-4" : "mt-6"}>
        <CreatedRafflesTab />
      </TabsContent>

      <TabsContent value="purchased" className={isMobile ? "mt-4" : "mt-6"}>
        <PurchasedTicketsTab />
      </TabsContent>

      <TabsContent value="dashboard" className={isMobile ? "mt-4" : "mt-6"}>
        <CreatorDashboardTab />
      </TabsContent>
    </Tabs>

    {/* Mobile Full-Page Utility Overlay */}
    {isMobile && mobileActivePage && (
      <MobileUtilityPage utilityKey={mobileActivePage} />
    )}
  </>
  );
};

export default ProfileTabs; 