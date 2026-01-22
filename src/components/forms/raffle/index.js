// Raffle Form Components - Phase 1 Extraction
// These components are extracted from CreateRafflePage.jsx for better organization

// Type selector component
export {
  RaffleTypeSelector,
  RAFFLE_TYPES,
  useRaffleTypeConfig,
  getRaffleTypeByPoolConfig
} from './RaffleTypeSelector'

// Shared hooks and utilities
export {
  // Hooks
  useRaffleLimits,
  useCollectionWhitelistStatus,
  useCollectionInternalStatus,
  useCollectionArtwork,

  // Utility functions
  approveToken,
  checkTokenApproval,
  extractRevertReason,
  convertDecentralizedToHTTP,
  extractImageURL,
  constructMetadataURIs,
} from './useRaffleHooks'

// Live preview component
export { LivePreviewCard } from './LivePreviewCard'

// Individual form components
export { default as WhitelistRaffleForm } from './WhitelistRaffleForm'
export { default as WhitelistRaffleFormV2 } from './WhitelistRaffleFormV2'
export { default as ERC721DropForm } from './ERC721DropForm'
export { default as ERC1155DropForm } from './ERC1155DropForm'
export { default as LuckySaleERC721Form } from './LuckySaleERC721Form'
export { default as ETHGiveawayForm } from './ETHGiveawayForm'
export { default as ERC20GiveawayForm } from './ERC20GiveawayForm'
