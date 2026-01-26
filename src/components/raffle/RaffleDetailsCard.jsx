/**
 * RaffleDetailsCard Component
 *
 * Displays detailed information about a raffle/pool including:
 * - Creator address
 * - Contract address
 * - Start time and duration
 * - Token gating requirements
 * - Prize information (native, ERC20, NFT)
 */

import React from 'react';
import { ethers } from 'ethers';
import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { useNativeCurrency } from '../../hooks/useNativeCurrency';

// Helper to format duration
function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0 || days > 0) formatted += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m`;
  if (!formatted) formatted = '0m';
  return formatted.trim();
}

// ERC20 Prize Amount display component
function ERC20PrizeAmount({ token, amount }) {
  const [symbol, setSymbol] = React.useState('TOKEN');

  React.useEffect(() => {
    let isMounted = true;
    async function fetchSymbol() {
      try {
        if (!window.__erc20SymbolCache) window.__erc20SymbolCache = {};
        if (window.__erc20SymbolCache[token]) {
          setSymbol(window.__erc20SymbolCache[token]);
          return;
        }
        const provider = window.ethereum
          ? new ethers.providers.Web3Provider(window.ethereum)
          : ethers.getDefaultProvider();
        const erc20Abi = ["function symbol() view returns (string)"];
        const contract = new ethers.Contract(token, erc20Abi, provider);
        const sym = await contract.symbol();
        if (isMounted) {
          setSymbol(sym);
          window.__erc20SymbolCache[token] = sym;
        }
      } catch {
        if (isMounted) setSymbol('TOKEN');
      }
    }
    fetchSymbol();
    return () => { isMounted = false; };
  }, [token]);

  return (
    <div className="flex justify-between">
      <span className="text-foreground/80 dark:text-foreground">Prize Amount:</span>
      <span>{ethers.utils.formatUnits(amount, 18)} {symbol}</span>
    </div>
  );
}

// Explorer link generator
function getExplorerLink(addressOrTx, chainIdOverride, isTransaction = false) {
  let chainId = 1;
  if (typeof chainIdOverride === 'number') {
    chainId = chainIdOverride;
  } else if (window.ethereum && window.ethereum.chainId) {
    chainId = parseInt(window.ethereum.chainId, 16);
  }
  const explorerMap = {
    1: 'https://etherscan.io',
    5: 'https://goerli.etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    80001: 'https://mumbai.polygonscan.com',
    10: 'https://optimistic.etherscan.io',
    420: 'https://goerli-optimism.etherscan.io',
    42161: 'https://arbiscan.io',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    43114: 'https://snowtrace.io',
    43113: 'https://testnet.snowtrace.io',
    8453: 'https://basescan.org',
    84531: 'https://goerli.basescan.org',
    84532: 'https://sepolia.basescan.org',
    11155420: 'https://sepolia-optimism.etherscan.io',
  };
  const baseUrl = explorerMap[chainId] || explorerMap[1];
  const path = isTransaction ? 'tx' : 'address';
  return `${baseUrl}/${path}/${addressOrTx}`;
}

const RaffleDetailsCard = ({
  raffle,
  isEscrowedPrize,
  raffleCollectionName,
  gatingTokenName,
  isMobile = false,
  variant = 'default', // 'default' | 'compact' | 'sidebar' | 'tab'
  className = '',
}) => {
  const { formatPrizeAmount } = useNativeCurrency();

  if (!raffle) return null;

  const isCompact = variant === 'compact' || variant === 'sidebar';
  const isTabVariant = variant === 'tab';
  
  // Tab variant: no outer card styling, content flows directly
  const cardClasses = isTabVariant
    ? `raffle-details-tab-content h-full ${className}`
    : isCompact
      ? `bg-card/80 backdrop-blur-sm border border-border rounded-xl p-4 ${className}`
      : `detail-beige-card bg-card/80 text-foreground backdrop-blur-sm border border-border rounded-xl p-6 shadow-lg h-full ${className}`;

  // Tab variant uses 2-column distributed grid layout matching TicketsPurchaseSection
  if (isTabVariant) {
    return (
      <div className={cardClasses}>
        {/* 2-column grid matching TicketsPurchaseSection layout and padding */}
        <div className="grid grid-cols-2 gap-4 text-sm p-6">
          {/* Creator */}
          <div>
            <span className="text-muted-foreground">Creator:</span>
            <p className="font-mono font-medium truncate" title={raffle.creator}>
              {raffle.creator.slice(0, 6)}...{raffle.creator.slice(-4)}
            </p>
          </div>

          {/* Pool Contract */}
          <div>
            <span className="text-muted-foreground">Pool Contract:</span>
            <a
              href={getExplorerLink(raffle.address, raffle.chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-medium text-blue-600 hover:text-blue-800 truncate block"
              title={raffle.address}
            >
              {raffle.address.slice(0, 6)}...{raffle.address.slice(-4)}
            </a>
          </div>

          {/* Start Time */}
          <div>
            <span className="text-muted-foreground">Start Time:</span>
            <p className="font-medium">{new Date(raffle.startTime * 1000).toLocaleString()}</p>
          </div>

          {/* Duration */}
          <div>
            <span className="text-muted-foreground flex items-center gap-1">
              Duration:
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center cursor-help">
                    <Info className="h-3.5 w-3.5 opacity-70" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  Shows the default duration until the raffle ends, then shows the actual duration taken.
                </TooltipContent>
              </Tooltip>
            </span>
            <p className="font-medium">
              {(() => {
                const ended = [2, 3, 4, 5, 6, 7, 8].includes(raffle.stateNum);
                const actual = raffle?.actualDuration &&
                  (raffle.actualDuration.toNumber ? raffle.actualDuration.toNumber() : Number(raffle.actualDuration));
                const original = raffle?.duration;
                const displaySeconds = ended && actual && actual > 0
                  ? (actual > original ? original : actual)
                  : original;
                return formatDuration(displaySeconds);
              })()}
            </p>
          </div>

          {/* Token Gating Requirement */}
          {raffle.holderTokenAddress &&
            raffle.holderTokenAddress !== ethers.constants.AddressZero &&
            raffle.holderTokenStandard !== undefined && (
              <div>
                <span className="text-muted-foreground">Gating Requirement:</span>
                <p className="font-medium flex items-center gap-2">
                  <span>
                    {(() => {
                      let requiredBalance = 1;
                      try {
                        const balance = raffle.minHolderTokenBalance;
                        if (balance) {
                          if (balance.toString) {
                            const balanceStr = balance.toString();
                            if (balanceStr.length > 10) {
                              requiredBalance = parseFloat(ethers.utils.formatUnits(balance, 18));
                            } else {
                              requiredBalance = balance.toNumber ? balance.toNumber() : Number(balance);
                            }
                          } else {
                            requiredBalance = Number(balance);
                          }
                        }
                      } catch (error) {
                        requiredBalance = 1;
                      }
                      let tokenName = '';
                      if (raffle.holderTokenStandard === 1) {
                        tokenName = `${raffle.holderTokenAddress.slice(0, 6)}...${raffle.holderTokenAddress.slice(-4)}`;
                      } else {
                        tokenName = gatingTokenName ||
                          `${raffle.holderTokenAddress.slice(0, 6)}...${raffle.holderTokenAddress.slice(-4)}`;
                      }
                      return `${requiredBalance} ${tokenName}`;
                    })()}
                  </span>
                  <a
                    href={getExplorerLink(raffle.holderTokenAddress, raffle.chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                    title={raffle.holderTokenAddress}
                  >
                    <Info className="h-3.5 w-3.5 opacity-70" />
                  </a>
                </p>
              </div>
            )}

          {/* Native Prize Amount */}
          {raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0) && (
            <div>
              <span className="text-muted-foreground">Prize Amount:</span>
              <p className="font-medium">{formatPrizeAmount(raffle.nativePrizeAmount)}</p>
            </div>
          )}

          {/* ERC20 Prize Amount */}
          {raffle.erc20PrizeToken &&
            raffle.erc20PrizeToken !== ethers.constants.AddressZero &&
            raffle.erc20PrizeAmount &&
            raffle.erc20PrizeAmount.gt &&
            raffle.erc20PrizeAmount.gt(0) && (
              <div>
                <span className="text-muted-foreground">Prize Amount:</span>
                <div className="font-medium">
                  <ERC20PrizeAmount token={raffle.erc20PrizeToken} amount={raffle.erc20PrizeAmount} />
                </div>
              </div>
            )}

          {/* Prize Collection (NFT) */}
          {raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero && (
            <>
              <div>
                <span className="text-muted-foreground">Prize Collection:</span>
                <a
                  href={getExplorerLink(raffle.prizeCollection, raffle.chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 underline hover:text-blue-800 truncate block"
                  title={raffle.prizeCollection}
                >
                  {raffleCollectionName ||
                    `${raffle.prizeCollection.slice(0, 8)}...${raffle.prizeCollection.slice(-6)}`}
                </a>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {isEscrowedPrize ? 'Prize Type:' : 'Collection Type:'}
                </span>
                <p className="font-medium">
                  {(() => {
                    if (typeof isEscrowedPrize === 'boolean' && typeof raffle.standard !== 'undefined') {
                      if (!isEscrowedPrize && raffle.standard === 0) return 'Mintable ERC721';
                      if (!isEscrowedPrize && raffle.standard === 1) return 'Mintable ERC1155';
                      if (isEscrowedPrize && raffle.standard === 0) return 'Escrowed ERC721';
                      if (isEscrowedPrize && raffle.standard === 1) return 'Escrowed ERC1155';
                    }
                    return 'Unknown';
                  })()}
                </p>
              </div>
              {/* Prize Token ID for escrowed NFTs */}
              {isEscrowedPrize && raffle.prizeTokenId !== undefined && raffle.prizeTokenId !== null && (
                <div>
                  <span className="text-muted-foreground">Prize Token ID:</span>
                  <p className="font-mono font-medium">
                    {raffle.prizeTokenId.toString ? raffle.prizeTokenId.toString() : raffle.prizeTokenId}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Default/compact/sidebar variant - original layout
  return (
    <div className={cardClasses}>
      <h3 className={`font-display font-semibold mb-4 ${isMobile ? 'text-base' : 'text-lg'}`}>
        Raffle Details
      </h3>
      <div className="space-y-3 text-sm">
        {/* Creator */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Creator:</span>
          <span className="font-mono text-foreground" title={raffle.creator}>
            {isMobile ? `${raffle.creator.slice(0, 12)}...` : `${raffle.creator.slice(0, 16)}...`}
          </span>
        </div>

        {/* Pool Contract */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Pool Contract:</span>
          <a
            href={getExplorerLink(raffle.address, raffle.chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            title={raffle.address}
          >
            {isMobile ? `${raffle.address.slice(0, 12)}...` : `${raffle.address.slice(0, 16)}...`}
          </a>
        </div>

        {/* Start Time */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Start Time:</span>
          <span>{new Date(raffle.startTime * 1000).toLocaleString()}</span>
        </div>

        {/* Duration */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            Raffle Duration
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center cursor-help" aria-label="Raffle Duration info">
                  <Info className="h-3.5 w-3.5 opacity-70" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                Shows the default duration until the raffle ends, then shows the actual duration taken.
              </TooltipContent>
            </Tooltip>
          </span>
          <span>
            {(() => {
              const ended = [2, 3, 4, 5, 6, 7, 8].includes(raffle.stateNum);
              const actual = raffle?.actualDuration &&
                (raffle.actualDuration.toNumber ? raffle.actualDuration.toNumber() : Number(raffle.actualDuration));
              const original = raffle?.duration;
              const displaySeconds = ended && actual && actual > 0
                ? (actual > original ? original : actual)
                : original;
              return formatDuration(displaySeconds);
            })()}
          </span>
        </div>

        {/* Token Gating Requirement */}
        {raffle.holderTokenAddress &&
          raffle.holderTokenAddress !== ethers.constants.AddressZero &&
          raffle.holderTokenStandard !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gating Requirement:</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground">
                  {(() => {
                    let requiredBalance = 1;
                    try {
                      const balance = raffle.minHolderTokenBalance;
                      if (balance) {
                        if (balance.toString) {
                          const balanceStr = balance.toString();
                          if (balanceStr.length > 10) {
                            requiredBalance = parseFloat(ethers.utils.formatUnits(balance, 18));
                          } else {
                            requiredBalance = balance.toNumber ? balance.toNumber() : Number(balance);
                          }
                        } else {
                          requiredBalance = Number(balance);
                        }
                      }
                    } catch (error) {
                      requiredBalance = 1;
                    }

                    let tokenName = '';
                    if (raffle.holderTokenStandard === 1) {
                      tokenName = `${raffle.holderTokenAddress.slice(0, 8)}...${raffle.holderTokenAddress.slice(-6)}`;
                    } else {
                      tokenName = gatingTokenName ||
                        `${raffle.holderTokenAddress.slice(0, 8)}...${raffle.holderTokenAddress.slice(-6)}`;
                    }

                    return `${requiredBalance} ${tokenName}`;
                  })()}
                </span>
                <a
                  href={getExplorerLink(raffle.holderTokenAddress, raffle.chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                  title={raffle.holderTokenAddress}
                >
                  <Info className="h-3.5 w-3.5 opacity-70" />
                </a>
              </div>
            </div>
          )}

        {/* Native Prize Amount */}
        {raffle.nativePrizeAmount && raffle.nativePrizeAmount.gt && raffle.nativePrizeAmount.gt(0) && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Prize Amount:</span>
            <span>{formatPrizeAmount(raffle.nativePrizeAmount)}</span>
          </div>
        )}

        {/* ERC20 Prize Amount */}
        {raffle.erc20PrizeToken &&
          raffle.erc20PrizeToken !== ethers.constants.AddressZero &&
          raffle.erc20PrizeAmount &&
          raffle.erc20PrizeAmount.gt &&
          raffle.erc20PrizeAmount.gt(0) && (
            <ERC20PrizeAmount token={raffle.erc20PrizeToken} amount={raffle.erc20PrizeAmount} />
          )}

        {/* Prize Collection (NFT) */}
        {raffle.prizeCollection && raffle.prizeCollection !== ethers.constants.AddressZero && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prize Collection:</span>
              <a
                href={getExplorerLink(raffle.prizeCollection, raffle.chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200"
                title={raffle.prizeCollection}
              >
                {raffleCollectionName ||
                  `${raffle.prizeCollection.slice(0, 10)}...${raffle.prizeCollection.slice(-8)}`}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/80 dark:text-foreground">
                {isEscrowedPrize ? 'Prize Type:' : 'Collection Type:'}
              </span>
              <span className="font-semibold">
                {(() => {
                  if (typeof isEscrowedPrize === 'boolean' && typeof raffle.standard !== 'undefined') {
                    if (!isEscrowedPrize && raffle.standard === 0) return 'Mintable ERC721';
                    if (!isEscrowedPrize && raffle.standard === 1) return 'Mintable ERC1155';
                    if (isEscrowedPrize && raffle.standard === 0) return 'Escrowed ERC721';
                    if (isEscrowedPrize && raffle.standard === 1) return 'Escrowed ERC1155';
                  }
                  return 'Unknown';
                })()}
              </span>
            </div>

            {/* Prize Token ID for escrowed NFTs */}
            {isEscrowedPrize && raffle.prizeTokenId !== undefined && raffle.prizeTokenId !== null && (
              <div className="flex justify-between">
                <span className="text-foreground/80 dark:text-foreground">Prize Token ID:</span>
                <span className="font-mono font-semibold">
                  {raffle.prizeTokenId.toString ? raffle.prizeTokenId.toString() : raffle.prizeTokenId}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RaffleDetailsCard;
