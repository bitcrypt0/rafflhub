import ProtocolManagerABI from './ProtocolManager.min.abi.json';
import PoolDeployerABI from './PoolDeployer.min.abi.json';
import RevenueManagerABI from './RevenueManager.min.abi.json';
import NFTFactoryABI from './NFTFactory.min.abi.json';
import ERC721PrizeABI from './ERC721Prize.min.abi.json';
import ERC1155PrizeABI from './ERC1155Prize.min.abi.json';
import PoolABI from './Pool.min.abi.json';
import SocialEngagementManagerABI from './SocialEngagementManager.min.abi.json';

const ERC20ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

export const contractABIs = {
  protocolManager: ProtocolManagerABI,
  poolDeployer: PoolDeployerABI,
  revenueManager: RevenueManagerABI,
  nftFactory: NFTFactoryABI,
  erc721Prize: ERC721PrizeABI,
  erc1155Prize: ERC1155PrizeABI,
  socialEngagementManager: SocialEngagementManagerABI,
  pool: [
    ...PoolABI,
    {
      "inputs": [],
      "name": "isRefundable",
      "outputs": [
        { "internalType": "bool", "name": "", "type": "bool" }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "holderTokenAddress",
      "outputs": [
        { "internalType": "address", "name": "", "type": "address" }
      ],
      "stateMutability": "view",
      "type": "function"
    },

  ],
  erc20: ERC20ABI
};


