import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { isAppSubdomain, isLocalDev } from './utils/subdomainUtils';
import { WalletProvider } from './contexts/WalletContext';
import { ContractProvider } from './contexts/ContractContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CollabDetectionProvider } from './contexts/CollabDetectionContext';
import HeaderModern from './components/layout/HeaderModern';
import FooterModern from './components/layout/FooterModern';
import { Toaster } from './components/ui/sonner';
import { useMobileBreakpoints } from './hooks/useMobileBreakpoints';
import ErrorBoundary from './components/ui/error-boundary';
import { usePerformanceMonitor } from './components/debug/PerformanceMonitor';
import { initAndroidKeyboardFix, cleanupAndroidKeyboardFix } from './utils/androidKeyboardFix';
import { initDisableNumberScroll, cleanupDisableNumberScroll } from './utils/disableNumberScroll';
import Homepage from './pages/Homepage';
import LandingPage from './pages/LandingPage';


// Load test utilities in development
if (process.env.NODE_ENV === 'development') {
  import('./utils/toastTestUtils');
  import('./utils/eventListenerTest');
}
import ProfilePage from './pages/ProfilePage';
import CreateRafflePageV2 from './pages/CreateRafflePageV2';
import DeployCollectionPageV2 from './pages/DeployCollectionPageV2';
import RaffleDetailPage from './pages/RaffleDetailPage';
import AuthCallback from './pages/AuthCallback';
import DocumentationPage from './pages/DocumentationPage';
import SupabaseIntegrationTest from './components/SupabaseIntegrationTest';


import './App.css';

// Redirect non-root paths on www to app subdomain (server-side redirect in vercel.json
// handles most cases; this is a client-side fallback)
const RedirectToApp = () => {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const baseDomain = window.location.hostname.replace(/^www\./, '');
    window.location.replace(
      `${window.location.protocol}//app.${baseDomain}${pathname}${search}${hash}`
    );
  }, []);
  return null;
};

// App content component to use hooks inside providers
const AppContent = () => {
  const _isApp = isAppSubdomain();
  const _isDev = isLocalDev();
  const { isMobile, isInitialized } = useMobileBreakpoints();
  const { component: performanceMonitor } = usePerformanceMonitor();

  // Initialize Android keyboard fix
  useEffect(() => {
    initAndroidKeyboardFix();

    // Initialize global number-input scroll guard
    const cleanupNumberScroll = initDisableNumberScroll();

    return () => {
      cleanupAndroidKeyboardFix();
      cleanupNumberScroll && cleanupNumberScroll();
    };
  }, []);

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, monospace' }}>
            Dropr
          </div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <HeaderModern />
      <main className="flex-1 min-h-0 pt-20 pb-8">
        <Routes>
          {/* --- Homepage: www.dropr.fun (and localhost for dev) --- */}
          {(_isDev || !_isApp) && (
            <Route path="/" element={<Homepage />} />
          )}

          {/* --- Dapp landing: app.dropr.fun/ (or localhost/app for dev) --- */}
          {_isDev && <Route path="/app" element={<LandingPage />} />}
          {_isApp && <Route path="/" element={<LandingPage />} />}

          {/* --- App routes: only on app subdomain and localhost --- */}
          {(_isDev || _isApp) && <Route path="/docs" element={<DocumentationPage />} />}
          {(_isDev || _isApp) && <Route path="/profile" element={<ProfilePage />} />}
          {(_isDev || _isApp) && <Route path="/create-raffle" element={<CreateRafflePageV2 />} />}
          {(_isDev || _isApp) && <Route path="/deploy-collection" element={<DeployCollectionPageV2 />} />}
          {(_isDev || _isApp) && <Route path="/pool/:raffleAddress" element={<RaffleDetailPage />} />}
          {(_isDev || _isApp) && <Route path="/:chainSlug/pool/:raffleAddress" element={<RaffleDetailPage />} />}
          {/* OAuth Callback Routes */}
          {(_isDev || _isApp) && <Route path="/auth/callback/twitter" element={<AuthCallback />} />}
          {(_isDev || _isApp) && <Route path="/auth/callback/discord" element={<AuthCallback />} />}
          {(_isDev || _isApp) && <Route path="/auth/callback/telegram" element={<AuthCallback />} />}
          {/* Supabase Integration Test (Development) */}
          {(_isDev || _isApp) && <Route path="/test-supabase" element={<SupabaseIntegrationTest />} />}

          {/* --- www catch-all: redirect to app subdomain --- */}
          {!_isDev && !_isApp && (
            <Route path="*" element={<RedirectToApp />} />
          )}
        </Routes>
      </main>
      <FooterModern />
      <Toaster />
      {performanceMonitor}
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <WalletProvider>
          <ContractProvider>
            <CollabDetectionProvider>
              <Router>
                <AppContent />
              </Router>
            </CollabDetectionProvider>
          </ContractProvider>
        </WalletProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;


