import ProtocolManagerJSON from './ProtocolManager.json';
import PoolDeployerJSON from './PoolDeployer.json';
import RevenueManagerJSON from './RevenueManager.json';
import NFTFactoryJSON from './NFTFactory.json';
import DroprERC721AJSON from './DroprERC721A.json';
import DroprERC1155JSON from './DroprERC1155.json';
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
  erc721Prize: DroprERC721AJSON.abi,
  erc1155Prize: DroprERC1155JSON.abi,
  socialEngagementManager: SocialEngagementManagerJSON.abi,
  kolApproval: KOLApprovalJSON.abi,
  rewardsFlywheel: RewardsFlywheelJSON.abi,
  pool: PoolJSON.abi,
  erc20: ERC20ABI
};
