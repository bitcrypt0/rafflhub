/**
 * Pool Metadata Fields Component
 * 
 * Reusable collapsible component for pool description and social media links
 * Used across all raffle creation forms
 */

import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

const PoolMetadataFields = ({ formData, handleChange, isMobile = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    handleChange(name, value);
  };

  const inputClass = `w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground ${
    isMobile ? 'text-base' : ''
  }`;

  const labelClass = "block text-sm font-medium text-foreground mb-2";

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Pool Information (Optional)</h3>
          <Info className="h-4 w-4 text-muted-foreground" title="Add description and social links to help participants learn more about your raffle" />
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="px-6 pb-6 space-y-6 border-t border-border pt-6">

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClass}>
          Description
          <span className="text-muted-foreground text-xs ml-2">(Max 1000 characters)</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleInputChange}
          placeholder="Describe your raffle, prizes, or any special details..."
          maxLength={1000}
          rows={4}
          className={`${inputClass} resize-none`}
        />
        <div className="text-xs text-muted-foreground mt-1 text-right">
          {(formData.description || '').length} / 1000
        </div>
      </div>

      {/* Social Media Links */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">Social Media Links</h4>
        
        {/* Twitter/X Link */}
        <div>
          <label htmlFor="twitterLink" className={labelClass}>
            Twitter / X
            <span className="text-muted-foreground text-xs ml-2">(Max 200 characters)</span>
          </label>
          <input
            type="url"
            id="twitterLink"
            name="twitterLink"
            value={formData.twitterLink || ''}
            onChange={handleInputChange}
            placeholder="https://twitter.com/yourhandle or https://x.com/yourhandle"
            maxLength={200}
            className={inputClass}
          />
        </div>

        {/* Discord Link */}
        <div>
          <label htmlFor="discordLink" className={labelClass}>
            Discord
            <span className="text-muted-foreground text-xs ml-2">(Max 200 characters)</span>
          </label>
          <input
            type="url"
            id="discordLink"
            name="discordLink"
            value={formData.discordLink || ''}
            onChange={handleInputChange}
            placeholder="https://discord.gg/yourinvite"
            maxLength={200}
            className={inputClass}
          />
        </div>

        {/* Telegram Link */}
        <div>
          <label htmlFor="telegramLink" className={labelClass}>
            Telegram
            <span className="text-muted-foreground text-xs ml-2">(Max 200 characters)</span>
          </label>
          <input
            type="url"
            id="telegramLink"
            name="telegramLink"
            value={formData.telegramLink || ''}
            onChange={handleInputChange}
            placeholder="https://t.me/yourchannel"
            maxLength={200}
            className={inputClass}
          />
        </div>
      </div>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <Info className="h-3 w-3 inline mr-1" />
            These fields are optional but recommended. They help participants learn more about your project and connect with your community.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoolMetadataFields;
