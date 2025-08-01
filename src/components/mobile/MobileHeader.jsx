import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Search, Wallet, Sun, Moon, Waves } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWallet } from '../../contexts/WalletContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';
import { useRaffleSearch } from '../../hooks/useRaffleService';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetClose } from '../ui/sheet';
import NetworkSelector from '../ui/network-selector';

const MobileHeader = () => {
  const { connected, address, formatAddress, disconnect, connectWallet } = useWallet();
  const { theme, cycleTheme, getCurrentTheme } = useTheme();
  const { isMobile, isInitialized } = useMobileBreakpoints();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Use the new RaffleSearch hook
  const { searchResults, searchLoading, search, clearSearch } = useRaffleSearch();

  // Search functionality state
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Debounced search using the new service
  useEffect(() => {
    if (!showSearch || !searchTerm?.trim()) {
      clearSearch();
      return;
    }

    const handler = setTimeout(() => {
      search(searchTerm);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, showSearch, search, clearSearch]);

  // Click-away functionality for mobile search
  useEffect(() => {
    if (!showSearch) return;

    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setShowSearch(false);
        setSearchTerm('');
        clearSearch();
      }
    };

    // Use both mousedown and touchstart for mobile compatibility
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSearch, clearSearch]);

  const handleConnectWallet = async () => {
    try {
      await connectWallet('metamask');
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleSearchResultClick = (raffleAddress) => {
    navigate(`/raffle/${raffleAddress}`);
    setShowSearch(false);
    setSearchTerm('');
    clearSearch();
  };

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      // Closing search
      setSearchTerm('');
      clearSearch();
    } else {
      // Opening search - focus input after animation
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 200);
    }
  };

  // Ensure we only render on mobile and when initialized
  if (!isInitialized || !isMobile) {
    return null;
  }

  const navigationItems = [
    { name: 'Create Raffle', href: '/create-raffle', icon: '➕' },
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
              onClick={handleSearchToggle}
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
                  <div className="p-3">
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
                  </div>

                  {/* Settings Section */}
                  <div className="p-3 border-t border-border space-y-2">
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

                    {/* Close Button */}
                    <div className="pt-2">
                      <SheetClose className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-foreground">
                        <X className="h-4 w-4" />
                        <span className="text-sm font-medium">Close Menu</span>
                      </SheetClose>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {showSearch && (
          <div
            ref={searchContainerRef}
            className="px-4 pb-3 border-t border-border/50 animate-in slide-in-from-top-2 duration-200"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search raffle name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-muted/50 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                autoFocus
              />

              {/* Search Results Dropdown */}
              {showSearch && searchTerm && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-popover/95 backdrop-blur-md border border-border/50 rounded-xl max-h-60 overflow-y-auto shadow-xl">
                  {searchLoading && (
                    <div className="p-3 text-muted-foreground text-sm text-center">
                      Searching...
                    </div>
                  )}
                  {!searchLoading && searchResults.length > 0 && (
                    <>
                      {searchResults.map(r => (
                        <div
                          key={r.address}
                          className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border/20 last:border-b-0"
                          onClick={() => handleSearchResultClick(r.address)}
                        >
                          <div className="font-semibold text-foreground text-sm mb-1">{r.name}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate" title={r.address}>
                            {r.address}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {!searchLoading && searchTerm && searchResults.length === 0 && (
                    <div className="p-4 text-muted-foreground text-sm text-center">
                      No raffles found matching "{searchTerm}"
                    </div>
                  )}
                </div>
              )}
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
