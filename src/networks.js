export const SUPPORTED_NETWORKS = {
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  10: {
    name: 'OP Mainnet',
    rpcUrl: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  56: {
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc.blockrazor.xyz',
    explorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  97: {
    name: 'BNB Smart Chain Testnet',
    rpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
    explorer: 'https://testnet.bscscan.com',
    nativeCurrency: { name: 'Test BNB', symbol: 'tBNB', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  43113: {
    name: 'Avalanche Fuji Testnet',
    rpcUrl: 'https://avalanche-fuji.drpc.org',
    explorer: 'https://testnet.snowscan.xyz',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  43114: {
    name: 'Avalanche C-Chain',
    rpcUrl: 'https://avalanche.drpc.org',
    explorer: 'https://snowscan.xyz',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  8453: {
    name: 'Base Mainnet',
    rpcUrl: 'https://base.drpc.org',
    explorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  84532: {
    name: 'Base Sepolia',
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0xF6bAd8007e9b5D8cCCD779F450097BCFe2b25C12',
      poolDeployer: '0xaA7e5D33F524Bca693d5e86AcF51d1a4B91196dD',
      revenueManager: '0x4C86F1E612250a7Dd95AFF6Bb0614e901d866182',
      nftFactory: '0x3BA6BEaD1958A0c1413f4f0499a8Ea8288DFc2A6',
      socialEngagementManager: '0x102Bb9d22Cc40E3B1D2D5AfB0cDd35b7856eE033'
    }
  },
  11155111: {
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://sepolia.infura.io',
    explorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  11155420: {
    name: 'OP Sepolia Testnet',
    rpcUrl: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  2020: {
    name: 'Ronin Mainnet',
    rpcUrl: 'https://ronin.drpc.org',
    explorer: 'https://app.roninchain.com/',
    nativeCurrency: { name: 'Ronin', symbol: 'RON', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  2021: {
    name: 'Ronin Saigon Testnet',
    rpcUrl: 'https://saigon-testnet.roninchain.com/rpc',
    explorer: 'https://saigon-app.roninchain.com/explorer',
    nativeCurrency: { name: 'Ronin', symbol: 'RON', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  42161: {
    name: 'Arbitrum One',
    rpcUrl: 'https://arbitrum.drpc.org',
    explorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
  421614: {
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://endpoints.omniatech.io/v1/arbitrum/sepolia/public',
    explorer: 'https://sepolia.arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x...',
      poolDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...',
      socialEngagementManager: '0x...'
    }
  },
};