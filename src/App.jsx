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
import LandingPage from './pages/LandingPage';
import ProfilePage from './pages/ProfilePage';
import CreateRafflePage from './pages/CreateRafflePage';
import RaffleDetailPage from './pages/RaffleDetailPage';


import './App.css';

// App content component to use hooks inside providers
const AppContent = () => {
  const { isMobile, isInitialized } = useMobileBreakpoints();
  const { component: performanceMonitor } = usePerformanceMonitor();

  // Initialize Android keyboard fix
  useEffect(() => {
    initAndroidKeyboardFix();

    return () => {
      cleanupAndroidKeyboardFix();
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
      {/* Consistent spacing for both mobile and desktop */}
      <div style={{ height: '80px' }} />
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/create-raffle" element={<CreateRafflePage />} />
          <Route path="/raffle/:raffleAddress" element={<RaffleDetailPage />} />

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


