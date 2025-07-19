# Configuring the Frontend with Real Contract Addresses

This guide explains how to configure your frontend to use the correct smart contract addresses for each supported EVM network.

## Where to Configure

All network and contract address configuration is managed in:

- `src/networks.js`

This file exports the `SUPPORTED_NETWORKS` object, which contains all supported networks and their contract addresses.

## Step-by-Step Instructions

1. **Deploy your contracts to each network.**
   - Note the deployed addresses for each contract (e.g., RaffleManager, RaffleDeployer, RevenueManager, NFTFactory) on each network.

2. **Open `src/networks.js` in your code editor.**

3. **Locate the `SUPPORTED_NETWORKS` object.**
   - Each network is keyed by its chain ID (e.g., `1` for Ethereum Mainnet, `84532` for Base Sepolia, etc.).
   - Each network entry has a `contractAddresses` object with placeholders like `"0x..."`.

4. **Replace the placeholder addresses with your real deployed contract addresses.**

### Example

Suppose you deployed your contracts to Ethereum Mainnet and Base Sepolia:

```js
export const SUPPORTED_NETWORKS = {
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
    contractAddresses: {
      RaffleManager: '0x1234abcd...ef',
      RaffleDeployer: '0x5678abcd...ef',
      RevenueManager: '0x9abcabcd...ef',
      NFTFactory: '0xdef1abcd...ef'
    }
  },
  84532: {
    name: 'Base Sepolia',
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.basescan.org',
    contractAddresses: {
      RaffleManager: '0x1111abcd...ef',
      RaffleDeployer: '0x2222abcd...ef',
      RevenueManager: '0x3333abcd...ef',
      NFTFactory: '0x4444abcd...ef'
    }
  },
  // ... other networks ...
};
```

5. **Save the file.**

6. **Restart your frontend (if running) to ensure changes take effect.**

## Notes
- You can add or remove networks as needed by editing the `SUPPORTED_NETWORKS` object.
- Make sure the contract addresses are correct and correspond to the correct network/chain ID.
- If you add new contract types, add them to the `contractAddresses` object for each network.

## Troubleshooting
- If you see errors about missing or incorrect contract addresses, double-check that you updated all relevant fields for the correct network.
- The frontend will only interact with contracts whose addresses are set for the currently selected network.

---

**For further customization, refer to the comments in `src/networks.js`.** 