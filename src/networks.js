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
      raffleManager: '0xF425Db442318D587f04280956F562C99e52818E3',
      raffleDeployer: '0xa86aDF75CdE7BA7c23204cdfa095Cd498629091a',
      revenueManager: '0xd496047e70CEafd89a05C1B63910F10d0180F283',
      nftFactory: '0x1dF3590f141b6E0992EcE00D65d314Cf5B97D848'
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
      raffleManager: '0x4fbD6Bf0996a75264221A9464e7771b4965E0073',
      raffleDeployer: '0xb03e8db6c778f6059213ECC9D6accD83534B12aC',
      revenueManager: '0xE4c1aa1E6Aa42521175aD8FFb1c82bbCBf071696',
      nftFactory: '0x4880D1b732c8F62DC5b2eaba420bA4eD2b2D15Ee'
    }
  },
  11155420: {
    name: 'OP Sepolia Testnet',
    rpcUrl: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    contractAddresses: {
      raffleManager: '0x84Ac83bF1de2AF40B14274EB07A4bD1D682E7336',
      raffleDeployer: '0xcae2f5dF2eC945D42CFa14f09EA03B706A536255',
      revenueManager: '0xf80576d76e432b099F9Bc0706B9ca7474f423eDD',
      nftFactory: '0x463905b666Ce234a5bc094143eB3CC23bF6114C0'
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
      raffleManager: '0x688a648514F27E4d90e460DB89bC6e72c2a705B0',
      raffleDeployer: '0xc8F58Aa80CA95f7A40028EeBFb7BeD6DFA9eEFcb',
      revenueManager: '0xC57B06780E9195e95E777b0BA1230C0225E2e98C',
      nftFactory: '0x95cA4cba9630932dC70d8363FE53DfC38B982B48'
    }
  },
}; 