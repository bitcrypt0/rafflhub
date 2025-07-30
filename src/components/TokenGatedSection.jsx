import React from 'react';
import { Switch } from './ui/switch';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';

const TokenGatedSection = ({
  tokenGatedEnabled,
  onTokenGatedChange,
  formData,
  handleChange,
  required = false,
  useFormDataEnabled = false
}) => {
  const { isMobile } = useMobileBreakpoints();

  // Use either separate state or formData.tokenGatedEnabled
  const isEnabled = useFormDataEnabled ? formData.tokenGatedEnabled : tokenGatedEnabled;
  const handleToggleChange = useFormDataEnabled
    ? (value) => handleChange('tokenGatedEnabled', value)
    : onTokenGatedChange;
  return (
    <>
      {/* Token-Gated Toggle */}
      <div className={`flex items-center gap-3 ${isMobile ? 'mb-4' : 'mb-2'}`}>
        <label className={`font-medium ${isMobile ? 'text-base' : 'text-sm'}`}>
          Enable Token-Gated Access
        </label>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggleChange}
        />
      </div>

      {/* Token-Gated Fields */}
      {isEnabled && (
        <div className={`p-4 border rounded-lg bg-muted/10 mb-4`}>
          <div className={`${isMobile ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}`}>
            {/* Token Address */}
            <div>
              <label className={`block font-medium mb-1 ${isMobile ? 'text-base' : 'text-base'}`}>
                Token Address
              </label>
              <input
                type="text"
                value={formData.holderTokenAddress || ''}
                onChange={e => handleChange('holderTokenAddress', e.target.value)}
                className={`w-full border border-border rounded-lg bg-background font-mono ${
                  isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2.5 text-base'
                }`}
                placeholder="0x..."
                required={required && isEnabled}
              />
            </div>

            {/* Token Standard */}
            <div>
              <label className={`block font-medium mb-1 ${isMobile ? 'text-base' : 'text-base'}`}>
                Token Standard
              </label>
              <Select
                value={formData.holderTokenStandard || '0'}
                onValueChange={value => handleChange('holderTokenStandard', value)}
                required={required && isEnabled}
              >
                <SelectTrigger className={`w-full border border-border rounded-lg bg-background ${
                  isMobile ? 'px-4 py-3 text-base h-12' : 'px-3 py-2.5 text-base'
                }`}>
                  <SelectValue placeholder="Select Token Standard" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">ERC721</SelectItem>
                  <SelectItem value="1">ERC1155</SelectItem>
                  <SelectItem value="2">ERC20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Min Balance */}
            <div>
              <label className={`block font-medium mb-1 ${isMobile ? 'text-base' : 'text-base'}`}>
                Minimum Holder Balance
              </label>
              <input
                type="number"
                value={formData.minHolderTokenBalance || ''}
                onChange={e => handleChange('minHolderTokenBalance', e.target.value)}
                className={`w-full border border-border rounded-lg bg-background ${
                  isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2.5 text-base'
                }`}
                placeholder="Minimum balance required to enter"
                required={required && isEnabled}
              />
            </div>

            {/* Token ID - Only show for ERC1155 */}
            {formData.holderTokenStandard === '1' && (
              <div>
                <label className={`block font-medium mb-1 ${isMobile ? 'text-base' : 'text-base'}`}>
                  Token ID
                </label>
                <input
                  type="number"
                  value={formData.holderTokenId || ''}
                  onChange={e => handleChange('holderTokenId', e.target.value)}
                  className={`w-full border border-border rounded-lg bg-background ${
                    isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2.5 text-base'
                  }`}
                  placeholder="Token ID (for ERC1155)"
                  required={required && isEnabled}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TokenGatedSection;
