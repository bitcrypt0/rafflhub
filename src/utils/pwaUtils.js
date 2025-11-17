import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

// PWA installation prompt
export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [isInstallable, setIsInstallable] = React.useState(false);
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      }
    };

    checkInstalled();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error during PWA installation:', error);
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    install
  };
};

// Web App Manifest generator
export const generateManifest = () => {
  return {
    name: "Dropr - Web3 Raffle Platform",
    short_name: "Dropr",
    description: "Create and participate in Web3 raffles with NFT prizes",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#614E41",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png"
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png"
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png"
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png"
      },
      {
        src: "/icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png"
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png"
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    categories: ["finance", "business", "utilities"],
    lang: "en",
    dir: "ltr"
  };
};

// Service Worker utilities
export const serviceWorkerUtils = {
  // Register service worker
  register: async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              if (confirm('New version available! Would you like to update?')) {
                window.location.reload();
              }
            }
          });
        });
        
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
      }
    }
    return null;
  },

  // Unregister service worker
  unregister: async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        console.log('Service Workers unregistered');
      } catch (error) {
        console.error('Service Worker unregistration failed:', error);
      }
    }
  },

  // Check for service worker updates
  checkForUpdates: async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        return true;
      } catch (error) {
        console.error('Failed to check for updates:', error);
        return false;
      }
    }
    return false;
  }
};

// Cache management
export const cacheUtils = {
  // Cache name
  CACHE_NAME: 'dropr-v1',

  // Cache static assets
  cacheStaticAssets: async () => {
    if ('caches' in window) {
      try {
        const cache = await caches.open(cacheUtils.CACHE_NAME);
        const urlsToCache = [
          '/',
          '/app',
          '/manifest.json',
          '/icons/icon-192x192.png',
          '/icons/icon-512x512.png'
        ];
        
        await cache.addAll(urlsToCache);
        console.log('Static assets cached');
      } catch (error) {
        console.error('Failed to cache static assets:', error);
      }
    }
  },

  // Clear cache
  clearCache: async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('Cache cleared');
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }
  },

  // Get cache size
  getCacheSize: async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        let totalSize = 0;
        
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          
          for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
              const size = response.headers.get('content-length');
              totalSize += parseInt(size) || 0;
            }
          }
        }
        
        return totalSize;
      } catch (error) {
        console.error('Failed to get cache size:', error);
        return 0;
      }
    }
    return 0;
  }
};

// Network status monitoring
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [connectionType, setConnectionType] = React.useState('unknown');
  const [effectiveType, setEffectiveType] = React.useState('unknown');

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get connection info if available
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      const updateConnectionInfo = () => {
        setConnectionType(connection.type || 'unknown');
        setEffectiveType(connection.effectiveType || 'unknown');
      };

      updateConnectionInfo();
      connection.addEventListener('change', updateConnectionInfo);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', updateConnectionInfo);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    connectionType,
    effectiveType,
    isSlowConnection: effectiveType === 'slow-2g' || effectiveType === '2g'
  };
};

// Push notification utilities
export const pushNotificationUtils = {
  // Request notification permission
  requestPermission: async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  },

  // Subscribe to push notifications
  subscribe: async (serviceWorkerRegistration, publicVapidKey) => {
    try {
      const subscription = await serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicVapidKey
      });
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  },

  // Show local notification
  showNotification: (title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'dropr-notification',
        ...options
      });
    }
  }
};

// App lifecycle management
export const useAppLifecycle = () => {
  const [isAppVisible, setIsAppVisible] = React.useState(true);
  const [lastActiveTime, setLastActiveTime] = React.useState(Date.now());

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppVisible(!document.hidden);
      if (!document.hidden) {
        setLastActiveTime(Date.now());
      }
    };

    const handlePageShow = (event) => {
      // Check if page was loaded from cache (bfcache)
      if (event.persisted) {
        console.log('Page restored from back/forward cache');
        // Refresh data if needed
        window.location.reload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  return {
    isAppVisible,
    lastActiveTime,
    timeInBackground: Date.now() - lastActiveTime
  };
};

// Safe area utilities for notched devices
export const useSafeArea = () => {
  const [safeArea, setSafeArea] = React.useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  React.useEffect(() => {
    const updateSafeArea = () => {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(style.getPropertyValue('--safe-area-inset-top')) || 0,
        right: parseInt(style.getPropertyValue('--safe-area-inset-right')) || 0,
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom')) || 0,
        left: parseInt(style.getPropertyValue('--safe-area-inset-left')) || 0
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);

    return () => {
      window.removeEventListener('resize', updateSafeArea);
    };
  }, []);

  return safeArea;
};

// Performance monitoring for mobile
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = React.useState({
    loadTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    cumulativeLayoutShift: 0
  });

  React.useEffect(() => {
    if ('performance' in window) {
      // Measure load time
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      
      // Get Web Vitals
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            setMetrics(prev => ({ ...prev, largestContentfulPaint: entry.startTime }));
          } else if (entry.entryType === 'layout-shift') {
            setMetrics(prev => ({ 
              ...prev, 
              cumulativeLayoutShift: prev.cumulativeLayoutShift + entry.value 
            }));
          }
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'layout-shift'] });

      setMetrics(prev => ({ ...prev, loadTime }));

      return () => {
        observer.disconnect();
      };
    }
  }, []);

  return metrics;
};

// Install prompt component
export const InstallPrompt = ({ className }) => {
  const { isInstallable, install } = usePWAInstall();
  const [dismissed, setDismissed] = React.useState(false);

  if (!isInstallable || dismissed) return null;

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setDismissed(true);
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={cn(
        "fixed bottom-4 left-4 right-4 bg-card border border-border rounded-lg shadow-lg p-4 z-50",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Install Dropr</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Get the best experience with our app
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-md hover:bg-primary/90 transition-colors"
          >
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            ×
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default {
  usePWAInstall,
  generateManifest,
  serviceWorkerUtils,
  cacheUtils,
  useNetworkStatus,
  pushNotificationUtils,
  useAppLifecycle,
  useSafeArea,
  usePerformanceMonitor,
  InstallPrompt
};
