import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Monitor, Wallet, User, Plus, Search, Book, LogOut } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { contractABIs } from '../contracts/contractABIs';
import { SUPPORTED_NETWORKS } from '../networks';
import NetworkSelector from './ui/network-selector';
import Logo from './ui/Logo';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import MobileHeader from './mobile/MobileHeader';
import MobileErrorBoundary from './mobile/MobileErrorBoundary';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from './ui/dropdown-menu';

const Header = () => {
  const { connected, address, formatAddress, disconnect, connectWallet, provider, chainId } = useWallet();
  const { contracts, getContractInstance } = useContract();
  const { theme, cycleTheme, getCurrentTheme } = useTheme();
  const { isMobile, isInitialized } = useMobileBreakpoints();
  const [showSearch, setShowSearch] = useState(false);
  const location = useLocation();

  // Show loading state while detecting device type to prevent flash
  if (!isInitialized) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-[#614E41]">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Logo size="sm" />
          </div>
        </div>
      </header>
    );
  }

  // Use mobile header for mobile devices
  if (isMobile) {
    return (
      <MobileErrorBoundary>
        <MobileHeader />
      </MobileErrorBoundary>
    );
  }

  // Handle direct wallet connection
  const handleConnectWallet = async () => {
    try {
      await connectWallet('metamask');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      // You can add toast notification here if needed
    }
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allRaffles, setAllRaffles] = useState([]);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const [mouseInDropdown, setMouseInDropdown] = useState(false);
  const [inputFullyOpen, setInputFullyOpen] = useState(false);
  const searchInputWrapperRef = useRef(null);
  const hasFetchedRaffles = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // More targeted exclusions - only exclude specific dashboard interactions, not all profile page interactions
      const isDashboardInteraction = event.target.closest('.mobile-component-container') ||
                                   event.target.closest('[data-dashboard-card]') ||
                                   event.target.closest('[data-profile-tab]') ||
                                   event.target.closest('.dashboard-component') ||
                                   event.target.closest('.profile-dashboard');

      // Allow search field to close when clicking on other profile page elements
      const isSearchRelated = event.target.closest('[data-search-container]') ||
                             (searchInputWrapperRef.current && searchInputWrapperRef.current.contains(event.target));

      if (isDashboardInteraction) {
        return; // Don't close search when interacting with dashboard components
      }

      if (
        showSearch &&
        !isSearchRelated &&
        !mouseInDropdown
      ) {
        setShowSearch(false);
        setInputFullyOpen(false);
        setSearchTerm('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearch, mouseInDropdown]);

  // Fetch all raffles once for searching
  useEffect(() => {
    const fetchAllRaffles = async () => {
      if (!provider || !chainId || !SUPPORTED_NETWORKS[chainId]) {
        return;
      }
      if (hasFetchedRaffles.current) {
        return;
      }
      try {
        const raffleManagerAddress = SUPPORTED_NETWORKS[chainId].contractAddresses.raffleManager;
        if (!raffleManagerAddress) {
          setAllRaffles([]);
          hasFetchedRaffles.current = true;
          return;
        }
        const raffleManagerContract = new ethers.Contract(raffleManagerAddress, contractABIs.raffleManager, provider);
        const registeredRaffles = await raffleManagerContract.getAllRaffles();
        if (!registeredRaffles || registeredRaffles.length === 0) {
          setAllRaffles([]);
          hasFetchedRaffles.current = true;
          return;
        }
        const rafflePromises = registeredRaffles.map(async (raffleAddress) => {
          try {
            if (!provider) {
              return null;
            }
            const raffleContract = new ethers.Contract(raffleAddress, contractABIs.raffle, provider);
            const name = await raffleContract.name();
            return {
              address: raffleAddress,
              name: name
            };
          } catch (error) {
            return null;
          }
        });
        const raffleData = await Promise.all(rafflePromises);
        const validRaffles = raffleData.filter(r => r);
        setAllRaffles(validRaffles);
        hasFetchedRaffles.current = true;
      } catch (error) {
        setAllRaffles([]);
        hasFetchedRaffles.current = true;
      }
    };
    fetchAllRaffles();
  }, [provider, chainId]);

  // Monitor allRaffles changes
  useEffect(() => {
    // Removed debug logging
  }, [allRaffles]);

  // Debounced search
  useEffect(() => {
    if (!showSearch || !searchTerm) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const handler = setTimeout(() => {
      const term = searchTerm.trim().toLowerCase();
      const results = allRaffles.filter(r =>
        (r.name || '').trim().toLowerCase().includes(term) ||
        (r.address || '').trim().toLowerCase() === term ||
        (r.address || '').trim().toLowerCase().includes(term)
      );
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, showSearch, allRaffles]);

  const handleSearchResultClick = (raffleAddress) => {
    navigate(`/raffle/${raffleAddress}`);
    setTimeout(() => {
      setShowSearch(false);
      setSearchTerm('');
      setSearchResults([]);
    }, 150);
  };

  // This duplicate click-outside handler is now removed since we have the main one above

  useEffect(() => {
    hasFetchedRaffles.current = false;
  }, [provider, chainId]);

  return (
    <>
      <header className="relative w-full z-50 bg-background/80 backdrop-blur-md border-b border-[#614E41]">
        <div className="w-full px-0 py-0">
          <div className="bg-background/80 backdrop-blur-md border-b border-[#614E41] w-full">
            <div className="flex items-center justify-between h-16 px-6">
              <div className="flex items-center gap-3">
                <Link to="/" className="flex items-center gap-3">
                  <Logo size="md" className="hover:opacity-80" />
                </Link>
              </div>
              <div className="flex items-center gap-4 w-full justify-end">
                {/* Search Icon and Field - now next to dropdown */}
                <div className="flex items-center transition-all duration-300" style={{ minWidth: '40px', marginRight: '0.5rem' }}>
                  <button
                    className={`p-2 hover:bg-muted rounded-md transition-colors text-lg ${showSearch ? 'mr-2' : ''}`}
                    onClick={() => {
                      setShowSearch((v) => {
                        if (!v) {
                          // Opening: after animation, set inputFullyOpen and focus
                          setTimeout(() => {
                            setInputFullyOpen(true);
                            if (searchInputRef.current) searchInputRef.current.focus();
                          }, 300);
                        } else {
                          // Closing: immediately set inputFullyOpen to false
                          setInputFullyOpen(false);
                        }
                        return !v;
                      });
                    }}
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <div
                    ref={searchInputWrapperRef}
                    data-search-container
                    className="overflow-visible transition-all duration-300 rounded-md bg-background"
                    style={{ 
                      width: showSearch ? '16rem' : '0', 
                      marginLeft: '0', 
                      position: 'relative', 
                      display: 'inline-block', 
                      verticalAlign: 'middle',
                      overflow: 'visible'
                    }}
                  >
                    <input
                      ref={searchInputRef}
                      type="text"
                      className={`transition-all duration-300 px-3 py-2 rounded-md bg-background text-sm ${inputFullyOpen ? 'focus:outline-none focus:ring-2 focus:ring-primary border border-border' : 'border-0 outline-none shadow-none'} ${showSearch ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}
                      style={{
                        minWidth: showSearch ? '16rem' : '0',
                        maxWidth: showSearch ? '16rem' : '0',
                        boxSizing: 'border-box',
                        border: inputFullyOpen ? undefined : 'none',
                        outline: inputFullyOpen ? undefined : 'none',
                        boxShadow: inputFullyOpen ? undefined : 'none',
                        visibility: showSearch ? 'visible' : 'hidden',
                        pointerEvents: inputFullyOpen ? 'auto' : 'none',
                      }}
                      placeholder="Search raffle name or address..."
                      value={searchTerm}
                      onChange={e => {
                        const newValue = e.target.value;
                        setSearchTerm(newValue);
                      }}
                      autoFocus={inputFullyOpen}
                    />
                    {/* Search Results Dropdown - now relative to input and always 100% width */}
                    {showSearch && (
                      <div
                        className="absolute left-0 top-full mt-1 z-50 w-full"
                        style={{ 
                          boxSizing: 'border-box',
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 9999
                        }}
                        onMouseEnter={() => setMouseInDropdown(true)}
                        onMouseLeave={() => setMouseInDropdown(false)}
                      >
                        {searchLoading && (
                          <div className="p-2 text-muted-foreground text-xs bg-muted border border-border rounded">Searching...</div>
                        )}
                        {!searchLoading && searchResults.length > 0 && (
                          <div
                            className="bg-popover/90 backdrop-blur-md border border-border/50 rounded-xl max-h-60 overflow-y-auto shadow-xl custom-search-scrollbar"
                            style={{ overflowX: 'hidden' }}
                          >
                            {searchResults.map(r => (
                              <div
                                key={r.address}
                                className="px-3 py-2 hover:bg-muted cursor-pointer text-sm border-b border-border/20"
                                onMouseDown={() => handleSearchResultClick(r.address)}
                              >
                                <div className="font-semibold text-foreground">{r.name}</div>
                                <div
                                  className="text-xs text-muted-foreground font-mono"
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                    maxWidth: '100%',
                                  }}
                                  title={r.address}
                                >
                                  {r.address}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!searchLoading && searchTerm && searchResults.length === 0 && (
                          <div className="p-2 text-muted-foreground text-xs bg-muted border border-border rounded">No results found.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Theme Cycle */}
                <button
                  onClick={cycleTheme}
                  className="p-2 hover:bg-muted rounded-md transition-colors"
                  title={`Current: ${getCurrentTheme().name} - Click to cycle themes`}
                >
                  {getCurrentTheme().icon === 'Sun' && <Sun className="h-5 w-5" />}
                  {getCurrentTheme().icon === 'Moon' && <Moon className="h-5 w-5" />}
                  {getCurrentTheme().icon === 'Monitor' && <Monitor className="h-5 w-5" />}
                </button>
                {/* Network Selector */}
                <NetworkSelector />
                {/* Wallet connect/disconnect next */}
                {connected ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-background border border-[#614E41] rounded-md text-sm font-medium">
                    <span>{formatAddress(address)}</span>
                    <button
                      onClick={disconnect}
                      title="Disconnect Wallet"
                      className="hover:bg-destructive/10 rounded-full p-1 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectWallet}
                    className="flex items-center gap-2 px-3 py-2 bg-background text-foreground border border-[#614E41] rounded-md text-sm hover:bg-background/90 transition-colors"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>Connect Wallet</span>
                  </button>
                )}
                {/* New vertical dropdown menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 bg-background border border-[#614E41] rounded-md text-sm font-medium hover:bg-background/80 transition-colors">
                      Menu
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} collisionPadding={8} className="w-56 bg-popover/90 backdrop-blur-md border border-[#614E41] mt-2 rounded-xl shadow-2xl py-2 z-40 ring-1 ring-border/20 flex flex-col">
                    <DropdownMenuItem asChild>
                      <a
                        href="https://rafflhub.gitbook.io/rafflhub"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-primary/10 transition-colors rounded-lg"
                      >
                        <Book className="h-5 w-5" /> Docs
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-primary/10 transition-colors rounded-lg">
                        <User className="h-5 w-5" /> Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/create-raffle" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-primary/10 transition-colors rounded-lg">
                        <Plus className="h-5 w-5" /> Create Raffle
                      </Link>
                    </DropdownMenuItem>

                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export { Header };

// Enhanced Page Container Component with desktop-first design and mobile optimization
export const PageContainer = ({
  children,
  variant = 'default', // 'default', 'narrow', 'wide', 'profile'
  className = ''
}) => {
  const { isMobile } = useMobileBreakpoints();

  const getPaddingClasses = () => {
    // Desktop-first with mobile optimizations
    switch (variant) {
      case 'narrow':
        return 'mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-20 2xl:px-32';
      case 'wide':
        return 'container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20';
      case 'profile':
        return isMobile
          ? 'mx-auto px-4'
          : 'mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 2xl:px-10';
      case 'default':
      default:
        return isMobile
          ? 'mx-auto px-4'
          : 'mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 2xl:px-10';
    }
  };

  const baseClasses = getPaddingClasses();

  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
};

/* Custom scrollbar for search dropdown */
<style>
{`
.custom-search-scrollbar::-webkit-scrollbar {
  height: 6px;
  max-height: 6px;
}
.custom-search-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.custom-search-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
`}
</style>


