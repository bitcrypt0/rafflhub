import React from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './select';
import { useWallet } from '../../contexts/WalletContext';
import { SUPPORTED_NETWORKS } from '../../networks';
import { toast } from './sonner';
import { cn } from '../../lib/utils';

// Safely extract a string from any error
const getErrorMessage = (err) => {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string') return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const NetworkSelector = () => {
  const { chainId, switchNetwork, addNetwork, isSupportedNetwork } = useWallet();
  const [pending, setPending] = React.useState(false);

  // Filter networks to only show those with configured contract addresses
  const getAvailableNetworks = () => {
    return Object.entries(SUPPORTED_NETWORKS).filter(([id, network]) => {
      const contractAddresses = network.contractAddresses;
      // Check if essential contracts are configured (not placeholder '0x...')
      return contractAddresses?.protocolManager &&
             contractAddresses.protocolManager !== '0x...' &&
             contractAddresses?.poolDeployer &&
             contractAddresses.poolDeployer !== '0x...';
    });
  };

	  const availableNetworks = getAvailableNetworks();


  const handleChange = async (value) => {
    const targetChainId = parseInt(value, 10);
    setPending(true);
    try {
      await switchNetwork(targetChainId);
    } catch (err) {
      const errMsg = getErrorMessage(err).toLowerCase();
      // Rabby/MetaMask: Unrecognized chain ID or not added
      if (
        (err && err.code === 4902) ||
        errMsg.includes('add this network') ||
        errMsg.includes('unrecognized chain id') ||
        (err && err.code === -32603)
      ) {
        try {
          await addNetwork(targetChainId);
          // Try switching again after adding
          setTimeout(async () => {
            try {
              await switchNetwork(targetChainId);
            } catch (switchErr) {
              setTimeout(() => {
                if (window.ethereum && window.ethereum.chainId) {
                  const currentChainId = parseInt(window.ethereum.chainId, 16);
                  if (currentChainId !== targetChainId) {
                    toast.error('Failed to switch to the new network after adding: ' + getErrorMessage(switchErr));
                  }
                }
              }, 1000);
            }
          }, 500);
        } catch (addErr) {
          setTimeout(() => {
            if (window.ethereum && window.ethereum.chainId) {
              const currentChainId = parseInt(window.ethereum.chainId, 16);
              if (currentChainId !== targetChainId) {
                toast.error('Failed to add network: ' + getErrorMessage(addErr));
              }
            }
          }, 1000);
        }
      } else {
        // Only show error if it's not a user rejection
        if (!err.message?.includes('User rejected') && err.code !== 4001) {
          setTimeout(() => {
            if (window.ethereum && window.ethereum.chainId) {
              const currentChainId = parseInt(window.ethereum.chainId, 16);
              if (currentChainId !== targetChainId) {
                toast.error('Failed to switch network: ' + getErrorMessage(err));
              }
            }
          }, 1000);
        }
      }
    } finally {
      setPending(false);
    }
  };

  // Phase 4: Get current network info
  const currentNetwork = chainId ? SUPPORTED_NETWORKS[chainId] : null;
  const isUnsupported = chainId && availableNetworks.length > 0 && !availableNetworks.some(([id]) => parseInt(id) === chainId);

  return (
    <div className="flex items-center gap-2">
      <Select value={chainId ? String(chainId) : ''} onValueChange={handleChange} disabled={pending}>
        <SelectTrigger className={cn(
          "min-w-[160px] sm:min-w-[180px] text-foreground rounded-full transition-all duration-200",
          pending && "opacity-70",
          isUnsupported && "border-destructive/50 bg-destructive/5",
          !isUnsupported && chainId && "border-primary/30"
        )}>
          <div className="flex items-center gap-2">
            {/* Phase 4: Connection status indicator */}
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : chainId ? (
              <div className={cn(
                "w-2 h-2 rounded-full",
                isUnsupported ? "bg-destructive" : "bg-green-500 animate-pulse"
              )} />
            ) : (
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            )}
            <SelectValue placeholder="Select Network" />
          </div>
        </SelectTrigger>
        <SelectContent className="border-border">
          {getAvailableNetworks().map(([id, net]) => {
            const isActive = parseInt(id) === chainId;
            return (
              <SelectItem 
                key={id} 
                value={id}
                className={cn(
                  "transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Network icon placeholder */}
                  <div className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {net.name.charAt(0)}
                  </div>
                  <span>{net.name}</span>
                  {isActive && (
                    <CheckCircle className="h-3 w-3 text-primary ml-auto" />
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      
      {/* Phase 4: Enhanced status indicators */}
      {availableNetworks.length === 0 && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>No Networks</span>
        </div>
      )}
      {isUnsupported && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>Unsupported</span>
        </div>
      )}
    </div>
  );
};

export default NetworkSelector;