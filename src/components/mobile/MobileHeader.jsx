import React, { useState } from 'react';
import { Menu, X, Search, Wallet, Sun, Moon, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '../ui/sheet';
import NetworkSelector from '../ui/network-selector';

const MobileHeader = () => {
  const { connected, address, formatAddress, disconnect, connectWallet } = useWallet();
  const { theme, cycleTheme, getCurrentTheme } = useTheme();
  const { isMobile, isInitialized } = useMobileBreakpoints();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleConnectWallet = async () => {
    try {
      await connectWallet('metamask');
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  // Ensure we only render on mobile and when initialized
  if (!isInitialized || !isMobile) {
    return null;
  }

  const navigationItems = [
    { name: 'Browse Raffles', href: '/', icon: '🎲' },
    { name: 'Create Raffle', href: '/create-raffle', icon: '➕' },
    { name: 'Whitelist Raffles', href: '/whitelist-raffles', icon: '📋' },
    { name: 'NFT Raffles', href: '/nft-prized-raffles', icon: '🎨' },
    { name: 'Token Giveaways', href: '/token-giveaway-raffles', icon: '💰' },
    { name: 'Profile', href: '/profile', icon: '👤' }
  ];

  if (!isMobile) {
    return null; // Use desktop header for non-mobile
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span 
              className="text-lg font-bold text-foreground" 
              style={{ fontFamily: 'Orbitron, monospace' }}
            >
              Rafflhub
            </span>
          </Link>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Search Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Mobile Menu Trigger */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              
              <SheetContent side="right" className="w-80 p-0 bg-background">
                <SheetHeader className="p-3 border-b border-border">
                  <SheetTitle className="text-left text-foreground text-base">Menu</SheetTitle>
                </SheetHeader>
                
                <div className="flex flex-col h-full">
                  {/* Wallet Section */}
                  <div className="p-3 border-b border-border">
                    {connected ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                            <Wallet className="h-3 w-3 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">Connected</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {formatAddress(address)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnect}
                          className="w-full text-foreground h-8"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleConnectWallet}
                        className="w-full bg-foreground text-background hover:bg-foreground/90 h-8"
                      >
                        <Wallet className="h-3 w-3 mr-2" />
                        Connect Wallet
                      </Button>
                    )}
                  </div>

                  {/* Navigation */}
                  <nav className="p-3">
                    <div className="space-y-1">
                      {navigationItems.map((item) => (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setIsDrawerOpen(false)}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-foreground hover:text-foreground"
                        >
                          <span className="text-base">{item.icon}</span>
                          <span className="text-sm font-medium text-foreground">{item.name}</span>
                        </Link>
                      ))}
                    </div>
                  </nav>

                  {/* Settings Section */}
                  <div className="p-3 border-t border-border space-y-2 mt-auto">
                    {/* Theme Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Theme</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cycleTheme}
                        className="h-7 w-7 p-0 border-border text-foreground hover:bg-muted"
                      >
                        {getCurrentTheme().icon === 'Sun' && <Sun className="h-3 w-3" />}
                        {getCurrentTheme().icon === 'Moon' && <Moon className="h-3 w-3" />}
                        {getCurrentTheme().icon === 'Waves' && <Waves className="h-3 w-3" />}
                      </Button>
                    </div>

                    {/* Network Selector */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Network</span>
                      <NetworkSelector />
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {showSearch && (
          <div className="px-4 pb-3 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search raffles..."
                className="w-full h-12 pl-10 pr-4 bg-muted/50 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                autoFocus
              />
            </div>
          </div>
        )}
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14" />
    </>
  );
};

export default MobileHeader;
