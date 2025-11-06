import React from 'react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './select';
import { useWallet } from '../../contexts/WalletContext';
import { SUPPORTED_NETWORKS } from '../../networks';
import { toast } from './sonner';

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

  return (
    <div className="flex items-center gap-2">
      <Select value={chainId ? String(chainId) : ''} onValueChange={handleChange} disabled={pending}>
        <SelectTrigger className="min-w-[160px] sm:min-w-[180px] header-accent-surface text-foreground border-[#614E41]">
          <SelectValue placeholder="Select Network" />
        </SelectTrigger>
        <SelectContent className="border border-[#614E41]">
          {getAvailableNetworks().map(([id, net]) => (
            <SelectItem key={id} value={id}>
              {net.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* Show warning if wallet is connected and network doesn't have contracts configured */}
      {/* Show a hint only when no networks are configured at all */}
      {availableNetworks.length === 0 && (
        <span className="text-xs text-red-500 ml-2">Contracts Not Available</span>
      )}
      {/* If networks are configured but the current chain isn't among them, show 'Unsupported Network' */}
      {chainId && isSupportedNetwork && availableNetworks.length > 0 && !availableNetworks.some(([id]) => parseInt(id) === chainId) && (
        <span className="text-xs text-red-500 ml-2">Unsupported Network</span>
      )}
    </div>
  );
};

export default NetworkSelector;