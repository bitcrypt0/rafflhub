/**
 * Pool Metadata Display Component
 * 
 * Displays pool description and social media links on RaffleDetailPage
 */

import React from 'react';
import { Twitter, MessageCircle, Send, ExternalLink } from 'lucide-react';
import { formatSocialLink } from '../utils/poolMetadataService';

const PoolMetadataDisplay = ({ metadata, loading }) => {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
        <div className="h-20 bg-muted rounded"></div>
      </div>
    );
  }

  if (!metadata || (!metadata.description && !metadata.twitterLink && !metadata.discordLink && !metadata.telegramLink)) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Description - no header, directly displayed */}
      {metadata.description && (
        <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed text-base">
          {metadata.description}
        </p>
      )}

      {/* Social Media Links - all on one line */}
      {(metadata.twitterLink || metadata.discordLink || metadata.telegramLink) && (
        <div className="flex flex-wrap gap-2">
          {/* Twitter/X */}
          {metadata.twitterLink && (
            <a
              href={metadata.twitterLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg transition-colors text-sm"
            >
              <Twitter className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {formatSocialLink(metadata.twitterLink, 'twitter')}
              </span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Discord */}
          {metadata.discordLink && (
            <a
              href={metadata.discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-lg transition-colors text-sm"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {formatSocialLink(metadata.discordLink, 'discord')}
              </span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Telegram */}
          {metadata.telegramLink && (
            <a
              href={metadata.telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0088cc] hover:bg-[#0077b3] text-white rounded-lg transition-colors text-sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                {formatSocialLink(metadata.telegramLink, 'telegram')}
              </span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default PoolMetadataDisplay;
