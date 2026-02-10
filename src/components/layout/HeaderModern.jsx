import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  User, 
  Plus, 
  Bell, 
  Settings, 
  LogOut, 
  Menu,
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
import { isAppSubdomain, isLocalDev, getAppRootUrl, isExternalUrl } from '../../utils/subdomainUtils';
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
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const HeaderModern = () => {
  // Safely get wallet context with error handling
  let walletContext;
  try {
    walletContext = useWallet();
  } catch (error) {
    console.error('Wallet context not available:', error);
    // Return a minimal header while wallet context loads
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-16 px-4">
          <Logo size="sm" />
        </div>
      </header>
    );
  }

  const { 
    connected, 
    address, 
    formatAddress, 
    disconnect, 
    connectWallet, 
    provider, 
    chainId 
  } = walletContext;
  const { contracts, getContractInstance } = useContract();
  const { theme, cycleTheme, getCurrentTheme } = useTheme();
  const { isMobile, isTablet, isInitialized } = useMobileBreakpoints();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isHomepage = !isAppSubdomain() && location.pathname === '/';
  const isApp = isAppSubdomain() ? location.pathname === '/' : location.pathname === '/app';
  const appRootUrl = getAppRootUrl();
  const appRootIsExternal = isExternalUrl(appRootUrl);

  // Handle scroll for header transparency
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      await connectWallet('metamask');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

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
              appRootIsExternal ? (
                <a href={appRootUrl}>
                  <Logo size="sm" className="hover:opacity-80 transition-opacity" />
                </a>
              ) : (
                <Link to={appRootUrl}>
                  <Logo size="sm" className="hover:opacity-80 transition-opacity" />
                </Link>
              )
            ) : (
              <Logo size="sm" />
            )}
          </motion.div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
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
              appRootIsExternal ? (
                <a href={appRootUrl} className="flex items-center gap-3 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Logo size="md" className="hover:opacity-80 transition-opacity" />
                </a>
              ) : (
                <Link to={appRootUrl} className="flex items-center gap-3 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Logo size="md" className="hover:opacity-80 transition-opacity" />
                </Link>
              )
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
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Network selector */}
            {!isHomepage && <NetworkSelector />}

            {/* Wallet */}
            {!isHomepage && (connected ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 hover:bg-muted/50 border border-border text-foreground rounded-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <span className="hidden sm:inline text-foreground text-sm">
                      {formatAddress(address)}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default HeaderModern;
