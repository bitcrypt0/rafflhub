// Default chain ID used when no wallet is connected (Base Sepolia for testnet)
// Change this to the desired mainnet chain ID when ready for production
export const DEFAULT_CHAIN_ID = 84532;

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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
    }
  },
  84532: {
    name: 'Base Sepolia',
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    contractAddresses: {
      protocolManager: '0x0D984A5481e1d169C69eEdFD1C7E891e85954Dde',
      poolDeployer: '0x12F3BDC7EF325B8Bb276Ef892AB3Ae08901963bD',
      revenueManager: '0x249CdDC74E46Fa9A76D6150e6A23B1df6B6edE81',
      nftFactory: '0xD445FdB2d365D10e87e3223EDA0Ea448BAe0c175',
      rewardsFlywheel: '0xfF80d0126684293f25D80cb604B06c330cA54d5e',
      socialEngagementManager: '0xd92a96E964aBC68F89f20F245eAffE554D053f72',
      purchaseAuthorizer: '0x720fB9D409421dC8BC2620B68E36287A4886efAD'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
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
      socialEngagementManager: '0x...',
      rewardsFlywheel: '0x...',
      purchaseAuthorizer: '0x...'
    }
  },
};