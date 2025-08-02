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
      raffleManager: '0x6cB76737D48808894DEE60cE109280fC656Dd507',
      raffleDeployer: '0x211E3D8024C0986A907CFE427d33aDD194cC8DA4',
      revenueManager: '0x8502356d5DD2913bF902Fb61EC5D38351B22267f',
      nftFactory: '0x2581CBbd9F386cf35aC636a1Ce0cB0E6d2F6E3bf'
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
      raffleManager: '0x92C333E08746D7A204E873ea617dBee188f78B98',
      raffleDeployer: '0xDF05a7588a15d73BA818f92c197dCc9465CcdC65',
      revenueManager: '0x67AC55ca832fA03970b16f28BFe10c56E020c5B5',
      nftFactory: '0x160737D48ea71DC070c5FD7BC3eDBE59ecc6b777'
    }
  },
  11155111: {
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://sepolia.infura.io',
    explorer: 'https://sepolia.etherscan.io',
    contractAddresses: {
      raffleManager: '0xaC8c8918341C0a5109DDE9c4b60474f6ED67d2F5',
      raffleDeployer: '0x37bEC9f70074C1220a86389F5A3185b264295132',
      revenueManager: '0x950CC9324A4228810DBd70A55c1199d002Ec0D6D',
      nftFactory: '0x56C7Fd7bc0FB7bdF409dD295Abd926060A19FeB0'
    }
  },
  11155420: {
    name: 'OP Sepolia Testnet',
    rpcUrl: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    contractAddresses: {
      raffleManager: '0x4Ed6890cc32f04D8E422Dc534460832f032D0052',
      raffleDeployer: '0xb2F34D0E4761be2229f445Aa47EDe064aee25F2c',
      revenueManager: '0x7A292e5B8aEfcabD7EA709d08053B01c0414b256',
      nftFactory: '0x38FfF955929fc3F47cA2D4E1d59FF70CBDB97Dc6'
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
      raffleManager: '0x98b20229665CFa296008c388b0cbD8b15a38A4C5',
      raffleDeployer: '0x0e4fd77629Bb11D0a7298173C1C81b6C075Cb72A',
      revenueManager: '0x6fC8B56e2939AC1098eed8FD194c5b301CBfb3AA',
      nftFactory: '0x0b4F7b472aa07722D16d3368f1B9D66A18254D2B'
    }
  },
}; 