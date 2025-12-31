import ProtocolManagerJSON from './ProtocolManager.json';
import PoolDeployerJSON from './PoolDeployer.json';
import RevenueManagerJSON from './RevenueManager.json';
import NFTFactoryJSON from './NFTFactory.json';
import ERC721PrizeJSON from './ERC721Prize.json';
import ERC1155PrizeJSON from './ERC1155Prize.json';
import PoolJSON from './Pool.json';
import SocialEngagementManagerJSON from './SocialEngagementManager.json';
import KOLApprovalJSON from './KOLApproval.json';
import RewardsFlywheelJSON from './RewardsFlywheel.json';

const ERC20ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

export const contractABIs = {
  protocolManager: ProtocolManagerJSON.abi,
  poolDeployer: PoolDeployerJSON.abi,
  revenueManager: RevenueManagerJSON.abi,
  nftFactory: NFTFactoryJSON.abi,
  erc721Prize: ERC721PrizeJSON.abi,
  erc1155Prize: ERC1155PrizeJSON.abi,
  socialEngagementManager: SocialEngagementManagerJSON.abi,
  kolApproval: KOLApprovalJSON.abi,
  rewardsFlywheel: RewardsFlywheelJSON.abi,
  pool: PoolJSON.abi,
  erc20: ERC20ABI
};
