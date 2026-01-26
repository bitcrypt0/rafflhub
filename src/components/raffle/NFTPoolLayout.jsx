/**
 * NFTPoolLayout Component
 *
 * A specialized layout for NFT-prized pools that showcases the NFT artwork
 * as the hero element. Designed for NFT Drop pools and LuckySale/Giveaway pools.
 *
 * Layout Structure (Redesigned):
 * - Hero Section: Ticket Purchase | NFT Artwork Showcase (side by side on desktop)
 * - Bottom Section: RaffleInfoTabs (Activity, Winners, Details in tabs)
 */

import React from 'react';
import RaffleInfoTabs from './RaffleInfoTabs';

/**
 * Main NFT Pool Layout Component
 */
const NFTPoolLayout = ({
  raffle,
  prizeImageCard,
  ticketPurchaseSection,
  winnersSection,
  raffleDetailsCard,
  poolActivitySection,
  socialVerification,
  collectionName,
  isMobile = false,
  className = '',
}) => {
  if (!raffle) return null;

  // Check if pool is in Unengaged state (stateNum === 7)
  const isUnengaged = raffle.stateNum === 7;

  // Mobile Layout: Stacked with artwork at top
  if (isMobile) {
    return (
      <div className={`nft-pool-layout space-y-6 ${className}`}>
        {/* NFT Artwork Hero - Full width on mobile */}
        <div className="nft-artwork-showcase-mobile rounded-2xl overflow-hidden">
          {prizeImageCard}
        </div>

        {/* Social Verification (if required) */}
        {socialVerification && (
          <div className="social-verification-section">
            {socialVerification}
          </div>
        )}

        {/* Ticket Purchase Section */}
        <div className="ticket-purchase-section">
          {ticketPurchaseSection}
        </div>

        {/* Tabbed Info Section: Activity, Winners, Details */}
        <RaffleInfoTabs
          raffle={raffle}
          winnersSection={winnersSection}
          raffleDetailsCard={raffleDetailsCard}
          poolActivitySection={poolActivitySection}
          isMobile={isMobile}
          isUnengaged={isUnengaged}
          defaultTab="activity"
          variant="nft"
        />
      </div>
    );
  }

  // Desktop Layout: Hero row + Tabs below
  return (
    <div className={`nft-pool-layout ${className}`}>
      {/* Social Verification (if required) - Full width above grid */}
      {socialVerification && (
        <div className="social-verification-section mb-8">
          {socialVerification}
        </div>
      )}

      {/* Main Content - Vertical Stack */}
      <div className="space-y-8">
        {/* Hero Row: Ticket Purchase + NFT Artwork */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Ticket Purchase Section */}
          <div className="ticket-purchase-section">
            {ticketPurchaseSection}
          </div>

          {/* Right: NFT Artwork Showcase */}
          <div className="flex items-start justify-center">
            {prizeImageCard}
          </div>
        </div>

        {/* Tabbed Info Section: Activity, Winners, Details */}
        <RaffleInfoTabs
          raffle={raffle}
          winnersSection={winnersSection}
          raffleDetailsCard={raffleDetailsCard}
          poolActivitySection={poolActivitySection}
          isMobile={isMobile}
          isUnengaged={isUnengaged}
          defaultTab="activity"
          variant="nft"
        />
      </div>
    </div>
  );
};

export default NFTPoolLayout;
