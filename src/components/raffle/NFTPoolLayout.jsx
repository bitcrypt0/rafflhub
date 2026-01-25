/**
 * NFTPoolLayout Component
 *
 * A specialized layout for NFT-prized pools that showcases the NFT artwork
 * as the hero element. Designed for NFT Drop pools and LuckySale/Giveaway pools.
 *
 * Layout Structure:
 * - Hero Section: Sidebar (ticket purchase) | Artwork Showcase
 * - Bottom Grid: Pool Activity | Winners Section
 *
 * Note: RaffleDetails is NOT rendered in this layout (only in StandardPoolLayout)
 */

import React from 'react';

/**
 * Main NFT Pool Layout Component
 */
const NFTPoolLayout = ({
  raffle,
  prizeImageCard,
  ticketPurchaseSection,
  winnersSection,
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

        {/* Pool Activity */}
        {poolActivitySection && (
          <div className="pool-activity-section">
            {poolActivitySection}
          </div>
        )}

        {/* Winners Section - Hidden when Unengaged */}
        {!isUnengaged && (
          <div className="winners-section">
            {winnersSection}
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout: 2x2 Grid
  return (
    <div className={`nft-pool-layout ${className}`}>
      {/* Social Verification (if required) - Full width above grid */}
      {socialVerification && (
        <div className="social-verification-section mb-8">
          {socialVerification}
        </div>
      )}

      {/* Main 2x2 Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Left: Ticket Purchase Section */}
        <div className="ticket-purchase-section">
          {ticketPurchaseSection}
        </div>

        {/* Top Right: NFT Artwork Showcase */}
        <div className="flex items-start justify-center">
          {prizeImageCard}
        </div>

        {/* Bottom Left: Pool Activity */}
        {poolActivitySection && (
          <div className="pool-activity-section">
            {poolActivitySection}
          </div>
        )}

        {/* Bottom Right: Winners Section - Hidden when Unengaged */}
        {!isUnengaged && (
          <div className="winners-section">
            {winnersSection}
          </div>
        )}
      </div>
    </div>
  );
};

export default NFTPoolLayout;
