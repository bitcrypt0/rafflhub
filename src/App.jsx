import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import { ContractProvider } from './contexts/ContractContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CollabDetectionProvider } from './contexts/CollabDetectionContext';
import { Header } from './components/Layout';
import Footer from './components/Footer';
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
import CreateRafflePage from './pages/CreateRafflePage';
import RaffleDetailPage from './pages/RaffleDetailPage';
import AuthCallback from './pages/AuthCallback';


import './App.css';

// App content component to use hooks inside providers
const AppContent = () => {
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
            Rafflhub
          </div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 min-h-0">
        <Routes>
          {/* Marketing Homepage at root; dapp at /app */}
          <Route path="/" element={<Homepage />} />
          <Route path="/app" element={<div><div style={{ height: '80px' }} /><LandingPage /></div>} />
          <Route path="/profile" element={<div><div style={{ height: '80px' }} /><ProfilePage /></div>} />
          <Route path="/create-raffle" element={<div><div style={{ height: '80px' }} /><CreateRafflePage /></div>} />
          <Route path="/raffle/:raffleAddress" element={<div><div style={{ height: '80px' }} /><RaffleDetailPage /></div>} />
          <Route path="/:chainSlug/raffle/:raffleAddress" element={<div><div style={{ height: '80px' }} /><RaffleDetailPage /></div>} />
          {/* OAuth Callback Routes */}
          <Route path="/auth/callback/twitter" element={<AuthCallback />} />
          <Route path="/auth/callback/discord" element={<AuthCallback />} />
          <Route path="/auth/callback/telegram" element={<AuthCallback />} />
        </Routes>
      </main>
      <Footer />
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


