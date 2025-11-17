import React, { useRef, useEffect, useCallback } from 'react';

// Touch gesture utilities for enhanced mobile experience
export const useSwipeGestures = (onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50) => {
  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  const minSwipeDistance = threshold;

  const onTouchStart = (e) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    
    const distance = touchStart.current - touchEnd.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
};

// Vertical swipe gestures
export const useVerticalSwipe = (onSwipeUp, onSwipeDown, threshold = 50) => {
  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  const onTouchStart = (e) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientY;
  };

  const onTouchMove = (e) => {
    touchEnd.current = e.targetTouches[0].clientY;
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    
    const distance = touchStart.current - touchEnd.current;
    const isUpSwipe = distance > threshold;
    const isDownSwipe = distance < -threshold;

    if (isUpSwipe && onSwipeUp) {
      onSwipeUp();
    }
    if (isDownSwipe && onSwipeDown) {
      onSwipeDown();
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
};

// Long press gesture
export const useLongPress = (onLongPress, ms = 500) => {
  const timerRef = useRef(null);

  const start = useCallback(() => {
    timerRef.current = setTimeout(() => {
      onLongPress();
    }, ms);
  }, [onLongPress, ms]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear
  };
};

// Pull to refresh functionality
export const usePullToRefresh = (onRefresh, threshold = 80) => {
  const [isPulling, setIsPulling] = React.useState(false);
  const [pullDistance, setPullDistance] = React.useState(0);
  const startY = React.useRef(0);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;
    
    if (distance > 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance * 0.5, threshold * 2));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= threshold && onRefresh) {
      onRefresh();
    }
    
    setIsPulling(false);
    setPullDistance(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, onRefresh]);

  return {
    containerRef,
    isPulling,
    pullDistance,
    isRefreshing: pullDistance >= threshold
  };
};

// Haptic feedback utilities
export const useHapticFeedback = () => {
  const trigger = useCallback((type = 'light') => {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(50);
          break;
        case 'success':
          navigator.vibrate([10, 50, 10]);
          break;
        case 'error':
          navigator.vibrate([50, 30, 50, 30, 50]);
          break;
        case 'warning':
          navigator.vibrate([25, 25, 25]);
          break;
        default:
          navigator.vibrate(10);
      }
    }
  }, []);

  return { trigger };
};

// Touch-friendly carousel component
export const TouchCarousel = ({ children, className, onSwipeLeft, onSwipeRight }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const containerRef = useRef(null);
  
  const swipeGestures = useSwipeGestures(
    () => {
      setCurrentIndex(prev => Math.min(prev + 1, children.length - 1));
      onSwipeLeft?.();
    },
    () => {
      setCurrentIndex(prev => Math.max(prev - 1, 0));
      onSwipeRight?.();
    }
  );

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToNext = () => {
    setCurrentIndex(prev => Math.min(prev + 1, children.length - 1));
  };

  const goToPrevious = () => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  };

  return (
    <div className={className} ref={containerRef}>
      <div 
        className="overflow-hidden"
        {...swipeGestures}
      >
        <div 
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {children.map((child, index) => (
            <div key={index} className="w-full flex-shrink-0">
              {child}
            </div>
          ))}
        </div>
      </div>
      
      {/* Navigation dots */}
      <div className="flex justify-center gap-2 mt-4">
        {children.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              index === currentIndex 
                ? 'bg-primary w-6' 
                : 'bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// Enhanced mobile button with haptic feedback
export const MobileButton = React.forwardRef(function MobileButton(
  { 
    children, 
    hapticType = 'light',
    onHapticFeedback,
    className,
    ...props 
  },
  ref
) {
  const { trigger } = useHapticFeedback();

  const handleClick = (e) => {
    trigger(hapticType);
    onHapticFeedback?.(hapticType);
    props.onClick?.(e);
  };

  return (
    <button
      ref={ref}
      className={cn(
        "min-h-[44px] min-w-[44px] px-4 py-3 rounded-lg transition-all duration-200 active:scale-95",
        "touch-manipulation", // Prevents double-tap zoom
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});

// Swipeable card component
export const SwipeableCard = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  leftAction,
  rightAction,
  className 
}) => {
  const [translateX, setTranslateX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startX = React.useRef(0);
  const cardRef = useRef(null);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX - translateX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const newTranslateX = currentX - startX.current;
    
    // Limit swipe distance
    const maxSwipe = 100;
    const clampedX = Math.max(-maxSwipe, Math.min(maxSwipe, newTranslateX));
    setTranslateX(clampedX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Check if swipe exceeded threshold
    const threshold = 50;
    if (Math.abs(translateX) > threshold) {
      if (translateX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (translateX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    
    // Reset position
    setTranslateX(0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Left action background */}
      {leftAction && (
        <div className="absolute inset-y-0 left-0 flex items-center px-4 bg-success text-white z-0">
          {leftAction}
        </div>
      )}
      
      {/* Right action background */}
      {rightAction && (
        <div className="absolute inset-y-0 right-0 flex items-center px-4 bg-destructive text-white z-0">
          {rightAction}
        </div>
      )}
      
      {/* Card */}
      <div
        ref={cardRef}
        className={cn(
          "relative z-10 bg-card border border-border rounded-lg shadow-sm transition-transform duration-200",
          className
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

// Mobile-optimized scroll container
export const MobileScrollContainer = ({ 
  children, 
  className, 
  horizontal = false,
  snap = false,
  ...props 
}) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Enable momentum scrolling on iOS
    const style = container.style;
    style.webkitOverflowScrolling = 'touch';
    style.overflowX = horizontal ? 'auto' : 'hidden';
    style.overflowY = horizontal ? 'hidden' : 'auto';

    // Prevent rubber band scrolling
    const handleTouchMove = (e) => {
      const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = container;
      
      if (horizontal) {
        if (scrollLeft <= 0 || scrollLeft >= scrollWidth - clientWidth) {
          e.preventDefault();
        }
      } else {
        if (scrollTop <= 0 || scrollTop >= scrollHeight - clientHeight) {
          e.preventDefault();
        }
      }
    };

    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [horizontal]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "overflow-auto touch-manipulation",
        horizontal && "flex snap-x snap-mandatory",
        snap && "snap-y snap-mandatory",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Mobile viewport utilities
export const useMobileViewport = () => {
  const [viewportHeight, setViewportHeight] = React.useState(window.innerHeight);
  const [keyboardVisible, setKeyboardVisible] = React.useState(false);

  useEffect(() => {
    const handleResize = () => {
      const newHeight = window.innerHeight;
      const heightDiff = Math.abs(viewportHeight - newHeight);
      
      // If height decreased by more than 100px, assume keyboard is visible
      if (heightDiff > 100) {
        setKeyboardVisible(true);
      } else {
        setKeyboardVisible(false);
      }
      
      setViewportHeight(newHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Visual Viewport API for more accurate keyboard detection
    if ('visualViewport' in window) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if ('visualViewport' in window) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [viewportHeight]);

  return {
    viewportHeight,
    keyboardVisible,
    safeAreaBottom: getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-bottom') || '0px'
  };
};

export default {
  useSwipeGestures,
  useVerticalSwipe,
  useLongPress,
  usePullToRefresh,
  useHapticFeedback,
  TouchCarousel,
  MobileButton,
  SwipeableCard,
  MobileScrollContainer,
  useMobileViewport
};
