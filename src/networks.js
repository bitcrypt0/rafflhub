export const SUPPORTED_NETWORKS = {
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  10: {
    name: 'OP Mainnet',
    rpcUrl: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  56: {
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc.blockrazor.xyz',
    explorer: 'https://bscscan.com',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  97: {
    name: 'BNB Smart Chain Testnet',
    rpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
    explorer: 'https://testnet.bscscan.com',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  43113: {
    name: 'Avalanche Fuji Testnet',
    rpcUrl: 'https://avalanche-fuji.drpc.org',
    explorer: 'https://testnet.snowscan.xyz',
    contractAddresses: {
      raffleManager: '0x16271DE93576784a5467c06ec1D9405DE4195D36',
      raffleDeployer: '0x7daD9Dfd20e57cb845251Ed94E78408bB0185232',
      revenueManager: '0x0a26D3A4e135B91E98ECD4e6Bb09A29B81B74538',
      nftFactory: '0x883c330F177116164db6daf0248695a3DcCeD3F5'
    }
  },
  43114: {
    name: 'Avalanche C-Chain',
    rpcUrl: 'https://avalanche.drpc.org',
    explorer: 'https://snowscan.xyz',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  8453: {
    name: 'Base Mainnet',
    rpcUrl: 'https://base.drpc.org',
    explorer: 'https://basescan.org',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  84532: {
    name: 'Base Sepolia',
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.basescan.org',
    contractAddresses: {
      raffleManager: '0x07645Af9ee7c1775efa7bD8129f8e3cedac1B665',
      raffleDeployer: '0xD076E542A87de5C73c630F078C6fF2079b43004B',
      revenueManager: '0xb819071303bE1Fd4A18F0967df5bFF2858a67bdF',
      nftFactory: '0xf5df455Db6c6A29F5D537258535c23f049Ae9B9D'
    }
  },
  11155111: {
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://sepolia.infura.io',
    explorer: 'https://sepolia.etherscan.io',
    contractAddresses: {
      raffleManager: '0x3394D9363097733804F7A5B8FB098d1f25E3C89a',
      raffleDeployer: '0xbD40F4375Bb2d198C8C28662f1bbF41F0F439eA3',
      revenueManager: '0x3881512287a49997df4B8f2c8eb70d4b04Fe9A04',
      nftFactory: '0x05bF52d99457560711daDa6d7b99036405de43c6'
    }
  },
  11155420: {
    name: 'OP Sepolia Testnet',
    rpcUrl: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    contractAddresses: {
      raffleManager: '0xC57B06780E9195e95E777b0BA1230C0225E2e98C',
      raffleDeployer: '0x95cA4cba9630932dC70d8363FE53DfC38B982B48',
      revenueManager: '0xB392147C9F8F88c428f83D45b730bc3DE6e83C2D',
      nftFactory: '0x688a648514F27E4d90e460DB89bC6e72c2a705B0'
    }
  },
  2020: {
    name: 'Ronin Mainnet',
    rpcUrl: 'https://ronin.drpc.org',
    explorer: 'https://app.roninchain.com/',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  2021: {
    name: 'Ronin Saigon Testnet',
    rpcUrl: 'https://saigon-testnet.roninchain.com/rpc',
    explorer: 'https://saigon-app.roninchain.com/explorer',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  42161: {
    name: 'Arbitrum One',
    rpcUrl: 'https://arbitrum.drpc.org',
    explorer: 'https://arbiscan.io',
    contractAddresses: {
      raffleManager: '0x...',
      raffleDeployer: '0x...',
      revenueManager: '0x...',
      nftFactory: '0x...'
    }
  },
  421614: {
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://endpoints.omniatech.io/v1/arbitrum/sepolia/public',
    explorer: 'https://sepolia.arbiscan.io',
    contractAddresses: {
      raffleManager: '0x38FfF955929fc3F47cA2D4E1d59FF70CBDB97Dc6',
      raffleDeployer: '0xf98d8f491Ab29D7C17b7E53785f498e81370FF58',
      revenueManager: '0x4Ed6890cc32f04D8E422Dc534460832f032D0052',
      nftFactory: '0xb2F34D0E4761be2229f445Aa47EDe064aee25F2c'
    }
  },
}; 