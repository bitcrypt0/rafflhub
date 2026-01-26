/**
 * StandardPoolLayout Component
 *
 * The standard layout for non-NFT pools including:
 * - Whitelist pools
 * - Native coin prize pools
 * - ERC20 token prize pools
 *
 * Layout Structure (Redesigned):
 * - Side by side: RaffleInfoTabs (left) | TicketPurchaseSection (right)
 * - Mobile: Stacked vertically
 */

import React from 'react';
import RaffleInfoTabs from './RaffleInfoTabs';

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

      {/* Main Content - Side by Side Grid (Desktop) / Stacked (Mobile) with equal height */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left: Ticket Purchase Section */}
        <div className="ticket-purchase-section h-full">
          {ticketPurchaseSection}
        </div>

        {/* Right: Tabbed Info Section - Activity, Winners, Details (matches left height) */}
        <div className="raffle-info-tabs-section h-full">
          <RaffleInfoTabs
            raffle={raffle}
            winnersSection={winnersSection}
            raffleDetailsCard={raffleDetailsCard}
            poolActivitySection={poolActivitySection}
            isMobile={isMobile}
            isUnengaged={isUnengaged}
            defaultTab="activity"
            variant="standard"
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default StandardPoolLayout;
