import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';

/**
 * Hook for managing native currency display based on current network
 * Provides network-aware currency symbols and formatting functions
 */
export const useNativeCurrency = () => {
  const { chainId, networkInfo } = useWallet();

  // Get native currency info for current network
  const nativeCurrency = useMemo(() => {
    // Return network-specific currency or fallback to ETH
    return networkInfo?.nativeCurrency || { 
      symbol: 'ETH', 
      name: 'Ether', 
      decimals: 18 
    };
  }, [networkInfo]);

  // Format amount with native currency symbol
  const formatAmount = useMemo(() => {
    return (amount, options = {}) => {
      const { 
        showSymbol = true, 
        decimals = 4,
        fallbackSymbol = 'ETH'
      } = options;

      if (!amount) return showSymbol ? `0 ${nativeCurrency.symbol}` : '0';

      try {
        // Handle BigNumber or string amounts
        const formattedAmount = ethers.utils.formatEther(amount);
        const numericAmount = parseFloat(formattedAmount);
        
        // Format with specified decimal places, preserving significant digits for small amounts
        let displayAmount;
        if (numericAmount === 0) {
          displayAmount = '0';
        } else if (numericAmount < Math.pow(10, -decimals)) {
          // For very small amounts, use more decimal places to show the actual value
          const extendedDecimals = Math.max(decimals, 8); // Use at least 8 decimals for very small amounts
          displayAmount = numericAmount.toFixed(extendedDecimals);
          // Remove trailing zeros but keep at least one significant digit
          displayAmount = displayAmount.replace(/\.?0+$/, '');
          if (displayAmount === '0' || displayAmount === '') {
            displayAmount = numericAmount.toFixed(extendedDecimals);
          }
        } else {
          // For normal amounts, format with specified decimals
          displayAmount = numericAmount.toFixed(decimals);
          // Only remove trailing zeros for amounts >= 0.01 to preserve precision for small amounts
          if (numericAmount >= 0.01) {
            displayAmount = displayAmount.replace(/\.?0+$/, '');
          }
        }
        
        return showSymbol 
          ? `${displayAmount} ${nativeCurrency.symbol}`
          : displayAmount;
      } catch (error) {
        console.warn('Error formatting amount:', error);
        return showSymbol ? `0 ${fallbackSymbol}` : '0';
      }
    };
  }, [nativeCurrency.symbol]);

  // Format amount for ticket prices (use more decimals to show exact small amounts)
  const formatTicketPrice = useMemo(() => {
    return (amount) => formatAmount(amount, { decimals: 8 }); // Increased from 4 to 8 for precision
  }, [formatAmount]);

  // Format amount for prize displays (use more decimals for precision)
  const formatPrizeAmount = useMemo(() => {
    return (amount) => formatAmount(amount, { decimals: 6 }); // Increased from 3 to 6 for precision
  }, [formatAmount]);

  // Format amount for revenue displays (typically 6 decimal places for precision)
  const formatRevenueAmount = useMemo(() => {
    return (amount) => formatAmount(amount, { decimals: 6 });
  }, [formatAmount]);

  // Get currency symbol only
  const getCurrencySymbol = useMemo(() => {
    return () => nativeCurrency.symbol;
  }, [nativeCurrency.symbol]);

  // Get full currency info
  const getCurrencyInfo = useMemo(() => {
    return () => nativeCurrency;
  }, [nativeCurrency]);

  // Check if current network uses ETH
  const isEthNetwork = useMemo(() => {
    return nativeCurrency.symbol === 'ETH';
  }, [nativeCurrency.symbol]);

  // Check if current network uses AVAX
  const isAvaxNetwork = useMemo(() => {
    return nativeCurrency.symbol === 'AVAX';
  }, [nativeCurrency.symbol]);

  // Get network-specific currency label for forms
  const getCurrencyLabel = useMemo(() => {
    return (context = 'general') => {
      switch (context) {
        case 'ticket':
          return `Ticket Price (${nativeCurrency.symbol})`;
        case 'prize':
          return `Prize Amount (${nativeCurrency.symbol})`;
        case 'revenue':
          return `Revenue (${nativeCurrency.symbol})`;
        case 'amount':
          return `Amount (${nativeCurrency.symbol})`;
        default:
          return nativeCurrency.symbol;
      }
    };
  }, [nativeCurrency.symbol]);

  return {
    // Currency info
    nativeCurrency,
    getCurrencyInfo,
    getCurrencySymbol,
    getCurrencyLabel,
    
    // Formatting functions
    formatAmount,
    formatTicketPrice,
    formatPrizeAmount,
    formatRevenueAmount,
    
    // Network checks
    isEthNetwork,
    isAvaxNetwork,
    
    // Current network info
    chainId,
    networkName: networkInfo?.name || 'Unknown Network'
  };
};
