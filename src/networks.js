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
      protocolManager: '0xA1f8BEc81035a6a84d3ab6dbdc1A261B2Ff17dCC',
      poolDeployer: '0xCca825dDFF4FE4b73Bf6f8188d1DDaA6E4315A76',
      revenueManager: '0xe9d85103a3a7BF3174371B3682d3835d92C5ebF8',
      nftFactory: '0x9C48920A901aBA4e3e011FFeE632EAff23D4C093',
      socialEngagementManager: '0x3C57287C72f6b415b13AA593d96164Cd3cc6D033'
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