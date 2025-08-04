import { useState, useEffect } from 'react';

// Enhanced mobile detection with multiple breakpoints
export const useMobileBreakpoints = () => {
  // Initialize with server-safe defaults and immediate client-side detection
  const getInitialBreakpoints = () => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: false,
        screenWidth: 1024,
        isInitialized: false
      };
    }

    // Immediate detection for browser environment
    const width = window.innerWidth;
    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      screenWidth: width,
      isInitialized: true
    };
  };

  const [breakpoints, setBreakpoints] = useState(getInitialBreakpoints);

  useEffect(() => {
    const updateBreakpoints = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Detect if this is likely a keyboard-triggered resize on mobile
      const isLikelyKeyboardResize = breakpoints.isMobile &&
        Math.abs(width - breakpoints.screenWidth) < 50 && // Width didn't change much
        Math.abs(height - window.screen.height) > 200; // But height changed significantly

      // Skip updates if this looks like a keyboard resize to prevent auto-close
      if (isLikelyKeyboardResize) {
        console.log('Skipping breakpoint update - likely keyboard resize');
        return;
      }

      const newBreakpoints = {
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        screenWidth: width,
        isInitialized: true
      };

      // Debug logging for mobile issues
      if (width < 768) {
        console.log('Mobile detected:', {
          width,
          height,
          userAgent: navigator.userAgent,
          touchDevice: newBreakpoints.isTouchDevice,
          isKeyboardResize: isLikelyKeyboardResize
        });
      }

      setBreakpoints(newBreakpoints);
    };

    // Ensure we have the correct initial state
    updateBreakpoints();

    // Listen for resize events with debouncing to reduce keyboard-triggered updates
    let resizeTimeout;
    const debouncedUpdate = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateBreakpoints, 150); // Debounce resize events
    };

    window.addEventListener('resize', debouncedUpdate);

    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      clearTimeout(resizeTimeout);
    };
  }, [breakpoints.isMobile, breakpoints.screenWidth]);

  return breakpoints;
};

// Hook for specific mobile queries
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

// Predefined breakpoint hooks
export const useIsMobile = () => {
  return useMediaQuery('(max-width: 767px)');
};

export const useIsTablet = () => {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
};

export const useIsDesktop = () => {
  return useMediaQuery('(min-width: 1024px)');
};

export const useIsTouchDevice = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  
  return isTouchDevice;
};
