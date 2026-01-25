/**
 * StandardPoolLayout Component
 *
 * The standard layout for non-NFT pools including:
 * - Whitelist pools
 * - Native coin prize pools
 * - ERC20 token prize pools
 *
 * Layout Structure:
 * - Top Row: Ticket Purchase Section | Winners Section (hidden when Unengaged)
 * - Bottom Row: Raffle Details | Pool Activity
 */

import React from 'react';

/**
 * Main Standard Pool Layout Component
 */
const StandardPoolLayout = ({
  raffle,
  ticketPurchaseSection,
  winnersSection,
  raffleDetailsCard,
  poolActivitySection,
  prizeImageCard,
  socialVerification,
  isMobile = false,
  className = '',
}) => {
  if (!raffle) return null;

  // Check if pool is in Unengaged state (stateNum === 7)
  const isUnengaged = raffle.stateNum === 7;

  return (
    <div className={`standard-pool-layout ${className}`}>
      {/* Social Media Verification Section */}
      {socialVerification && (
        <div className="mb-8">
          {socialVerification}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Row: TicketPurchaseSection and WinnersSection */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Ticket Purchase Section */}
          <div className="ticket-purchase-section">
            {ticketPurchaseSection}
          </div>

          {/* Winners Section - Hidden when Unengaged */}
          {!isUnengaged && (
            <div className="winners-section">
              {winnersSection}
            </div>
          )}

          {/* Empty space for grid alignment when WinnersSection is hidden */}
          {isUnengaged && !isMobile && (
            <div className="hidden lg:block" />
          )}
        </div>

        {/* Bottom Row: Raffle Details and Pool Activity */}
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Raffle Details Card */}
          <div className="raffle-details-section">
            {raffleDetailsCard}
          </div>

          {/* Pool Activity Section */}
          {poolActivitySection && (
            <div className="pool-activity-section">
              {poolActivitySection}
            </div>
          )}

          {/* If no pool activity, show prize image if available */}
          {!poolActivitySection && prizeImageCard && (
            <div className="prize-image-section">
              {prizeImageCard}
            </div>
          )}

          {/* Empty space for grid alignment */}
          {!poolActivitySection && !prizeImageCard && !isMobile && (
            <div className="hidden lg:block" />
          )}
        </div>
      </div>
    </div>
  );
};

export default StandardPoolLayout;
