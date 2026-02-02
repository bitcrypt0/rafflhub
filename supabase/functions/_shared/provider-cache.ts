import { ethers } from 'https://esm.sh/ethers@5.7.2';
import { SUPPORTED_NETWORKS, isSupportedNetwork } from './networks.ts';

/**
 * Provider cache to avoid recreating JsonRpcProvider instances
 * Improves performance by reusing providers across function calls
 */
class ProviderCache {
  private cache = new Map<number, ethers.providers.JsonRpcProvider>();
  private static instance: ProviderCache;

  private constructor() {}

  /**
   * Get singleton instance of ProviderCache
   */
  public static getInstance(): ProviderCache {
    if (!ProviderCache.instance) {
      ProviderCache.instance = new ProviderCache();
    }
    return ProviderCache.instance;
  }

  /**
   * Get or create a provider for the specified chain
   * @param chainId The chain ID to get provider for
   * @returns JsonRpcProvider instance
   * @throws Error if chain is not supported
   */
  public getProvider(chainId: number): ethers.providers.JsonRpcProvider {
    // Validate chain is supported
    if (!isSupportedNetwork(chainId)) {
      throw new Error(`Chain ID ${chainId} is not supported`);
    }

    // Return cached provider if exists
    if (this.cache.has(chainId)) {
      return this.cache.get(chainId)!;
    }

    // Create new provider
    const network = SUPPORTED_NETWORKS[chainId];
    
    // Check for custom RPC URL in environment variables
    const customRpcUrl = this.getCustomRpcUrl(chainId);
    const rpcUrl = customRpcUrl || network.rpcUrl;

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Cache the provider
    this.cache.set(chainId, provider);
    
    return provider;
  }

  /**
   * Get custom RPC URL from environment variables if available
   * Environment variables follow pattern: {CHAIN_NAME}_RPC_URL
   * e.g., ETHEREUM_RPC_URL, OPTIMISM_RPC_URL, etc.
   */
  private getCustomRpcUrl(chainId: number): string | null {
    const envVarMap: Record<number, string> = {
      1: 'ETHEREUM_RPC_URL',
      10: 'OPTIMISM_RPC_URL',
      56: 'BSC_RPC_URL',
      97: 'BSC_TESTNET_RPC_URL',
      43113: 'AVALANCHE_FUJI_RPC_URL',
      43114: 'AVALANCHE_RPC_URL',
      8453: 'BASE_RPC_URL',
      84532: 'BASE_SEPOLIA_RPC_URL',
      11155111: 'ETHEREUM_SEPOLIA_RPC_URL',
      11155420: 'OPTIMISM_SEPOLIA_RPC_URL',
      2020: 'RONIN_RPC_URL',
      2021: 'RONIN_SAIGON_RPC_URL',
      42161: 'ARBITRUM_RPC_URL',
      421614: 'ARBITRUM_SEPOLIA_RPC_URL'
    };

    const envVarName = envVarMap[chainId];
    if (!envVarName) return null;

    return Deno.env.get(envVarName) || null;
  }

  /**
   * Clear cached provider for a specific chain
   * Useful when you need to refresh the connection
   */
  public clearProvider(chainId: number): void {
    this.cache.delete(chainId);
  }

  /**
   * Clear all cached providers
   * Useful for cleanup or testing
   */
  public clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached providers
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Check if a provider is cached for the given chain
   */
  public hasProvider(chainId: number): boolean {
    return this.cache.has(chainId);
  }
}

// Export singleton instance
export const providerCache = ProviderCache.getInstance();

// Export class for testing purposes
export { ProviderCache };
