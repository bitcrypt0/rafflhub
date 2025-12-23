import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Wallet, 
  User, 
  Plus, 
  Bell, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Sparkles,
  Trophy,
  BookOpen,
  Gift
} from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useContract } from '../../contexts/ContractContext';
import { ethers } from 'ethers';
import { contractABIs } from '../../contracts/contractABIs';
import { SUPPORTED_NETWORKS } from '../../networks';
import NetworkSelector from '../ui/network-selector';
import Logo from '../ui/Logo';
import { useMobileBreakpoints } from '../../hooks/useMobileBreakpoints';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '../ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '../ui/sheet';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const HeaderModern = () => {
  const { 
    connected, 
    address, 
    formatAddress, 
    disconnect, 
    connectWallet, 
    provider, 
    chainId 
  } = useWallet();
  const { contracts, getContractInstance } = useContract();
  const { theme, cycleTheme, getCurrentTheme } = useTheme();
  const { isMobile, isTablet, isInitialized } = useMobileBreakpoints();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allPools, setAllPools] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Refs
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const hasFetchedRaffles = useRef(false);

  const isHomepage = location.pathname === '/';
  const isApp = location.pathname === '/app';

  // Handle scroll for header transparency
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch all pools for search
  useEffect(() => {
    if (!provider || !chainId || hasFetchedRaffles.current) return;

    const fetchAllPools = async () => {
      try {
        const protocolManagerAddress = SUPPORTED_NETWORKS[chainId]?.contractAddresses?.protocolManager;
        if (!protocolManagerAddress) {
          setAllPools([]);
          hasFetchedRaffles.current = true;
          return;
        }
        
        const protocolManagerContract = new ethers.Contract(
          protocolManagerAddress, 
          contractABIs.protocolManager, 
          provider
        );
        const registeredPools = await protocolManagerContract.getAllPools();
        
        if (!registeredPools || registeredPools.length === 0) {
          setAllPools([]);
          hasFetchedRaffles.current = true;
          return;
        }

        const poolPromises = registeredPools.map(async (poolAddress) => {
          try {
            const poolContract = new ethers.Contract(poolAddress, contractABIs.pool, provider);
            const name = await poolContract.name();
            return { address: poolAddress, name };
          } catch (error) {
            return null;
          }
        });

        const poolData = await Promise.all(poolPromises);
        const validPools = poolData.filter(r => r);
        setAllPools(validPools);
        hasFetchedRaffles.current = true;
      } catch (error) {
        console.error('Error fetching pools:', error);
        setAllPools([]);
        hasFetchedRaffles.current = true;
      }
    };

    fetchAllPools();
  }, [provider, chainId]);

  // Debounced search
  useEffect(() => {
    if (!searchOpen || !searchTerm?.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const handler = setTimeout(() => {
      const term = searchTerm.trim().toLowerCase();
      const results = allPools.filter(r =>
        (r.name || '').trim().toLowerCase().includes(term) ||
        (r.address || '').trim().toLowerCase() === term ||
        (r.address || '').trim().toLowerCase().includes(term)
      );
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, searchOpen, allPools]);

  // Handle search result click
  const handleSearchResultClick = (raffleAddress) => {
    const slug = chainId && SUPPORTED_NETWORKS[chainId] 
      ? SUPPORTED_NETWORKS[chainId].name.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
      : (chainId || '');
    const path = slug ? `/${slug}/raffle/${raffleAddress}` : `/raffle/${raffleAddress}`;
    navigate(path);
    setSearchOpen(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      await connectWallet('metamask');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  // Handle search toggle
  const handleSearchToggle = () => {
    setSearchOpen(!searchOpen);
    if (!searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchTerm('');
      setSearchResults([]);
    }
  };

  // Close search on clickaway
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSearchOpen(false);
        setSearchTerm('');
        setSearchResults([]);
      }
    };

    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchOpen]);

  // Navigation items - removed all main navigation items
  const navigationItems = [
  ];

  // Dropdown menu items
  const dropdownItems = [
    { label: 'Create Raffle Pool', href: '/create-raffle', icon: Plus },
    { label: 'Deploy Collection', href: '/deploy-collection', icon: Gift },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Docs', href: '/docs', icon: BookOpen },
  ];

  // Header variants
  const headerVariants = {
    initial: { y: -100, opacity: 0 },
    animate: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 100, 
        damping: 20,
        staggerChildren: 0.1
      }
    },
    scrolled: {
      backgroundColor: isScrolled ? "hsl(var(--background) / 0.95)" : "hsl(var(--background) / 0.8)",
      backdropFilter: isScrolled ? "blur(12px)" : "blur(8px)",
      borderBottom: isScrolled ? "1px solid hsl(var(--border))" : "1px solid transparent",
      transition: { duration: 0.3 }
    }
  };

  const itemVariants = {
    initial: { y: -20, opacity: 0 },
    animate: { y: 0, opacity: 1 }
  };

  if (!isInitialized) {
    return (
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border"
      >
        <div className="flex items-center justify-between h-16 px-4">
          <Logo size="sm" />
        </div>
      </motion.header>
    );
  }

  if (isMobile || isTablet) {
    return (
      <motion.header 
        variants={headerVariants}
        initial="initial"
        animate="animate"
        whileInView="scrolled"
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border"
      >
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo */}
          <motion.div variants={itemVariants}>
            {isHomepage ? (
              <Logo size="sm" />
            ) : connected ? (
              <Link to="/app">
                <Logo size="sm" className="hover:opacity-80 transition-opacity" />
              </Link>
            ) : (
              <Logo size="sm" />
            )}
          </motion.div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            {!isHomepage && (
              <motion.div variants={itemVariants}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSearchToggle}
                  className="relative"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {/* Theme toggle */}
            <motion.div variants={itemVariants}>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                title={`Current: ${getCurrentTheme().name}`}
              >
                {getCurrentTheme().icon === 'Sun' && <Sun className="h-4 w-4" />}
                {getCurrentTheme().icon === 'Moon' && <Moon className="h-4 w-4" />}
                {getCurrentTheme().icon === 'Monitor' && <Monitor className="h-4 w-4" />}
              </Button>
            </motion.div>

            {/* Mobile menu */}
            <motion.div variants={itemVariants}>
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-4 mt-6">
                    {/* Navigation Section */}
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Navigation</h3>
                      <nav className="flex flex-col gap-1 px-2">
                        {dropdownItems.map((item) => (
                          <Button
                            key={item.href}
                            variant="ghost"
                            className="justify-start gap-3 h-10"
                            onClick={() => {
                              navigate(item.href);
                              setMobileMenuOpen(false);
                            }}
                          >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </Button>
                        ))}
                      </nav>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border"></div>

                    {/* Wallet Section */}
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Wallet</h3>
                      <div className="px-2 space-y-2">
                        {connected ? (
                          <>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                              <Wallet className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-mono flex-1">
                                {formatAddress(address)}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full justify-start gap-2 h-10"
                              onClick={() => {
                                disconnect();
                                setMobileMenuOpen(false);
                              }}
                            >
                              <LogOut className="h-4 w-4" />
                              Disconnect
                            </Button>
                          </>
                        ) : (
                          <Button
                            className="w-full gap-2 h-10"
                            onClick={() => {
                              handleConnectWallet();
                              setMobileMenuOpen(false);
                            }}
                          >
                            <Wallet className="h-4 w-4" />
                            Connect Wallet
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border"></div>

                    {/* Network Section */}
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">Network</h3>
                      <div className="px-2">
                        <NetworkSelector />
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </motion.div>
          </div>
        </div>

        {/* Mobile search overlay */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              ref={searchContainerRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-background"
            >
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search raffles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10 focus:ring-0 focus:border-border focus-visible:ring-0 focus-visible:border-border"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <Button
                        key={result.address}
                        variant="ghost"
                        className="w-full justify-start h-auto p-3"
                        onClick={() => handleSearchResultClick(result.address)}
                      >
                        <div className="text-left">
                          <div className="font-medium">{result.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {result.address.slice(0, 10)}...{result.address.slice(-8)}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    );
  }

  // Desktop header
  return (
    <motion.header 
      variants={headerVariants}
      initial="initial"
      animate="animate"
      whileInView="scrolled"
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div variants={itemVariants} className="flex items-center gap-8">
            {isHomepage ? (
              <div className="flex items-center gap-3 cursor-default select-none">
                <Logo size="md" />
              </div>
            ) : connected ? (
              <Link to="/app" className="flex items-center gap-3 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Logo size="md" className="hover:opacity-80 transition-opacity" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 cursor-default select-none">
                <Logo size="md" />
              </div>
            )}

            {/* Navigation */}
            {!isHomepage && (
              <nav className="hidden lg:flex items-center gap-6">
                {navigationItems.map((item) => (
                  <motion.div key={item.href} variants={itemVariants}>
                    <Button
                      variant="ghost"
                      className="gap-2 hover:bg-muted/50"
                      onClick={() => navigate(item.href)}
                    >
                      {item.label === 'Create' ? null : <item.icon className="h-4 w-4" />}
                      {item.label}
                    </Button>
                  </motion.div>
                ))}
              </nav>
            )}
          </motion.div>

          {/* Right side actions */}
          <motion.div 
            variants={itemVariants}
            className="flex items-center gap-3"
          >
            {/* Search */}
            {!isHomepage && (
              <div className="relative" ref={searchContainerRef}>
                <AnimatePresence>
                  {searchOpen ? (
                  <motion.div
                    initial={{ width: 40, opacity: 0 }}
                    animate={{ width: 300, opacity: 1 }}
                    exit={{ width: 40, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="relative"
                  >
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Search raffles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-10 bg-background/50 backdrop-blur-sm focus:ring-0 focus:border-border focus-visible:ring-0 focus-visible:border-border rounded-full"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                      onClick={handleSearchToggle}
                    >
                      <X className="h-4 w-4" />
                    </Button>

                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50"
                      >
                        {searchResults.map((result) => (
                          <Button
                            key={result.address}
                            variant="ghost"
                            className="w-full justify-start h-auto p-4 rounded-none border-b border-border last:border-b-0"
                            onClick={() => handleSearchResultClick(result.address)}
                          >
                            <div className="text-left">
                              <div className="font-medium">{result.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {result.address.slice(0, 10)}...{result.address.slice(-8)}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                  ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSearchToggle}
                    className="hover:bg-muted/50"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Network selector */}
            {!isHomepage && <NetworkSelector />}

            {/* Wallet */}
            {!isHomepage && (connected ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 hover:bg-muted/50">
                    <Wallet className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {formatAddress(address)}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/create-raffle')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Raffle Pool
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/deploy-collection')}>
                    <Gift className="mr-2 h-4 w-4" />
                    Deploy Collection
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/docs')}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Docs
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={disconnect}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={handleConnectWallet}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Connect Wallet
              </Button>
            ))}

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleTheme}
              title={`Current: ${getCurrentTheme().name}`}
              className="hover:bg-muted/50"
            >
              {getCurrentTheme().icon === 'Sun' && <Sun className="h-4 w-4" />}
              {getCurrentTheme().icon === 'Moon' && <Moon className="h-4 w-4" />}
              {getCurrentTheme().icon === 'Monitor' && <Monitor className="h-4 w-4" />}
            </Button>

            {/* Notifications */}
            {!isHomepage && (
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-muted/50 relative"
              >
                <Bell className="h-4 w-4" />
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
};

export default HeaderModern;
