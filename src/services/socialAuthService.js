import { supabase, PLATFORMS, TABLES, callEdgeFunction } from '../config/supabase';

class SocialAuthService {
  constructor() {
    this.authenticatedAccounts = new Map();
  }

  /**
   * Initialize OAuth flow for Twitter/X
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{url: string, error: null} | {url: null, error: string}>}
   */
  async initiateTwitterAuth(walletAddress) {
    try {
      const { data, error } = await callEdgeFunction('oauth-twitter', {
        user_address: walletAddress,
        action: 'initiate'
      });

      if (error) {
        throw error;
      }

      return { success: true, authUrl: data.auth_url, error: null };
    } catch (error) {
      console.error('Twitter OAuth initiation failed:', error);
      return { success: false, authUrl: null, error: error.message };
    }
  }

  /**
   * Handle Twitter OAuth callback
   * @param {string} code - OAuth authorization code
   * @param {string} state - OAuth state parameter
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async handleTwitterCallback(code, state, walletAddress) {
    try {
      const { data, error } = await callEdgeFunction('oauth-twitter', {
        code,
        state,
        user_address: walletAddress,
        action: 'callback'
      });

      if (error) {
        throw error;
      }

      // Backend already stores the account — just update local cache
      this.authenticatedAccounts.set(`${walletAddress}_${PLATFORMS.TWITTER}`, {
        user_id: data.user_id,
        username: data.username
      });

      return { success: true, error: null };
    } catch (error) {
      console.error('Twitter OAuth callback failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize OAuth flow for Discord
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{url: string, error: null} | {url: null, error: string}>}
   */
  async initiateDiscordAuth(walletAddress) {
    try {
      const { data, error } = await callEdgeFunction('oauth-discord', {
        user_address: walletAddress,
        action: 'initiate'
      });

      if (error) {
        throw error;
      }

      return { success: true, authUrl: data.auth_url, error: null };
    } catch (error) {
      console.error('Discord OAuth initiation failed:', error);
      return { success: false, authUrl: null, error: error.message };
    }
  }

  /**
   * Handle Discord OAuth callback
   * @param {string} code - OAuth authorization code
   * @param {string} state - OAuth state parameter
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async handleDiscordCallback(code, state, walletAddress) {
    try {
      const { data, error } = await callEdgeFunction('oauth-discord', {
        code,
        state,
        user_address: walletAddress,
        action: 'callback'
      });

      if (error) {
        throw error;
      }

      // Backend already stores the account — just update local cache
      this.authenticatedAccounts.set(`${walletAddress}_${PLATFORMS.DISCORD}`, {
        user_id: data.user_id,
        username: data.username
      });

      return { success: true, error: null };
    } catch (error) {
      console.error('Discord OAuth callback failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate with Telegram (using bot-based approach)
   * @param {string} walletAddress - User's wallet address
   * @param {string} telegramUsername - User's Telegram username
   * @returns {Promise<{success: boolean, verificationCode: string, error: string|null}>}
   */
  async initiateTelegramAuth(walletAddress, telegramUsername) {
    try {
      const { data, error } = await callEdgeFunction('oauth-telegram', {
        user_address: walletAddress,
        telegram_username: telegramUsername,
        action: 'initiate'
      });

      if (error) {
        throw error;
      }

      return { 
        success: true, 
        verificationCode: data.verification_code,
        botUsername: data.bot_username,
        error: null 
      };
    } catch (error) {
      console.error('Telegram auth initiation failed:', error);
      return { success: false, verificationCode: null, error: error.message };
    }
  }

  /**
   * Verify Telegram authentication
   * @param {string} walletAddress - User's wallet address
   * @param {string} verificationCode - Verification code sent to bot
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async verifyTelegramAuth(walletAddress, verificationCode) {
    try {
      const { data, error } = await callEdgeFunction('oauth-telegram', {
        user_address: walletAddress,
        verification_code: verificationCode,
        action: 'verify'
      });

      if (error) {
        throw error;
      }

      // Backend already stores the account — just update local cache
      this.authenticatedAccounts.set(`${walletAddress}_${PLATFORMS.TELEGRAM}`, {
        user_id: data.user_id,
        username: data.username
      });

      return { success: true, error: null };
    } catch (error) {
      console.error('Telegram auth verification failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store social account information in database
   * @param {Object} accountData - Account data to store
   * @returns {Promise<void>}
   */
  async storeSocialAccount(accountData) {
    const {
      walletAddress,
      platform,
      platformUserId,
      platformUsername,
      accessToken,
      refreshToken,
      expiresAt
    } = accountData;

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from(TABLES.USER_SOCIAL_ACCOUNTS)
      .select('id')
      .eq('user_address', walletAddress)
      .eq('platform', platform)
      .single();

    const accountRecord = {
      user_address: walletAddress,
      platform,
      platform_user_id: platformUserId,
      platform_username: platformUsername,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    };

    if (existingAccount) {
      // Update existing account
      const { error } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .update(accountRecord)
        .eq('id', existingAccount.id);

      if (error) {
        throw error;
      }
    } else {
      // Insert new account
      const { error } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .insert(accountRecord);

      if (error) {
        throw error;
      }
    }
  }

  /**
   * Get authenticated social accounts for a wallet
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<{accounts: Array, error: string|null}>}
   */
  async getAuthenticatedAccounts(walletAddress) {
    try {
      console.log('Fetching authenticated accounts for wallet:', walletAddress);
      
      // Check if supabase is properly configured
      if (!supabase || !supabase.from || typeof supabase.from !== 'function') {
        console.warn('Supabase not configured, returning empty accounts');
        return { accounts: [], error: 'Supabase not configured' };
      }

      const { data, error } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .select('*')
        .eq('user_address', walletAddress);

      console.log('Supabase query result:', { data, error });

      // If error indicates Supabase not configured, return empty accounts without throwing
      if (error && error.message === 'Supabase not configured') {
        console.warn('Supabase not configured, returning empty accounts');
        return { accounts: [], error: null };
      }

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      // Ensure data is an array
      const accountsData = Array.isArray(data) ? data : [];

      // Auto-refresh expired tokens instead of filtering them out
      const validAccounts = [];
      for (const account of accountsData) {
        if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
          // Token expired — try refresh
          if (account.refresh_token) {
            const refreshResult = await this._attemptTokenRefresh(walletAddress, account.platform, account);
            if (refreshResult.success) {
              // Re-fetch the updated account
              const { data: refreshed } = await supabase
                .from(TABLES.USER_SOCIAL_ACCOUNTS)
                .select('*')
                .eq('user_address', walletAddress)
                .eq('platform', account.platform)
                .maybeSingle();
              if (refreshed) {
                validAccounts.push(refreshed);
                continue;
              }
            }
          }
          // Refresh failed — skip this expired account
          continue;
        }
        validAccounts.push(account);
      }

      console.log('Valid accounts found:', validAccounts.length);
      return { accounts: validAccounts, error: null };
    } catch (error) {
      console.error('Failed to load authenticated accounts:', error);
      return { accounts: [], error: error.message };
    }
  }

  /**
   * Check if user has authenticated a specific platform
   * @param {string} walletAddress - User's wallet address
   * @param {string} platform - Social media platform
   * @returns {Promise<{isAuthenticated: boolean, account: Object|null}>}
   */
  async isAuthenticated(walletAddress, platform) {
    try {
      console.log('Checking authentication for platform:', platform, 'wallet:', walletAddress);
      
      // Check if supabase is properly configured
      if (!supabase || !supabase.from || typeof supabase.from !== 'function') {
        console.warn('Supabase not configured, returning not authenticated');
        return { success: true, isAuthenticated: false, account: null };
      }

      const { data, error } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .select('*')
        .eq('user_address', walletAddress)
        .eq('platform', platform)
        .maybeSingle();

      console.log('Authentication check result:', { data, error });

      // If error indicates Supabase not configured, return not authenticated
      if (error && error.message === 'Supabase not configured') {
        console.warn('Supabase not configured, returning not authenticated');
        return { success: true, isAuthenticated: false, account: null };
      }

      if (error && error.code !== 'PGRST116') {
        console.error('Authentication check error:', error);
        return { success: false, error: error.message, isAuthenticated: false };
      }

      if (!data) {
        return { success: true, isAuthenticated: false, account: null };
      }

      // Check if token is expired — attempt auto-refresh
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
        if (data.refresh_token) {
          const refreshResult = await this._attemptTokenRefresh(walletAddress, platform, data);
          if (refreshResult.success) {
            // Re-fetch the updated account
            const { data: refreshed } = await supabase
              .from(TABLES.USER_SOCIAL_ACCOUNTS)
              .select('*')
              .eq('user_address', walletAddress)
              .eq('platform', platform)
              .maybeSingle();
            if (refreshed) {
              return { success: true, isAuthenticated: true, account: refreshed };
            }
          }
        }
        // Refresh failed or no refresh token — expired
        return { success: true, isAuthenticated: false, account: null };
      }

      // Account is authenticated (even if pending profile due to rate limiting)
      return { success: true, isAuthenticated: true, account: data };
    } catch (error) {
      console.error('Failed to check authentication status:', error);
      return { success: false, error: error.message, isAuthenticated: false };
    }
  }

  /**
   * Refresh access token for a platform
   * @param {string} walletAddress - User's wallet address
   * @param {string} platform - Social media platform
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  /**
   * Internal: attempt token refresh using account data directly (no recursive isAuthenticated call)
   */
  async _attemptTokenRefresh(walletAddress, platform, accountData) {
    try {
      if (!accountData?.refresh_token) {
        return { success: false, error: 'No refresh token' };
      }

      const { data, error } = await callEdgeFunction(`oauth-${platform}`, {
        user_address: walletAddress,
        refresh_token: accountData.refresh_token,
        action: 'refresh'
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Backend edge function updates the DB directly — no need for frontend storeSocialAccount
      return { success: true, error: null };
    } catch (error) {
      console.error(`Token refresh failed for ${platform}:`, error);
      return { success: false, error: error.message };
    }
  }

  async refreshToken(walletAddress, platform) {
    try {
      // Get account data directly from DB
      const { data: account } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .select('*')
        .eq('user_address', walletAddress)
        .eq('platform', platform)
        .maybeSingle();
      
      if (!account || !account.refresh_token) {
        throw new Error('No refresh token available');
      }

      return await this._attemptTokenRefresh(walletAddress, platform, account);
    } catch (error) {
      console.error('Token refresh failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect a social media account
   * @param {string} walletAddress - User's wallet address
   * @param {string} platform - Social media platform
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async disconnectAccount(walletAddress, platform) {
    try {
      const { error } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .delete()
        .eq('user_address', walletAddress)
        .eq('platform', platform);

      if (error) {
        throw error;
      }

      // Remove from local cache
      this.authenticatedAccounts.delete(`${walletAddress}_${platform}`);

      return { success: true, error: null };
    } catch (error) {
      console.error('Failed to disconnect account:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get platform-specific authentication instructions
   * @param {string} platform - Social media platform
   * @returns {Object} Instructions for the platform
   */
  getAuthInstructions(platform) {
    const instructions = {
      [PLATFORMS.TWITTER]: {
        title: 'Connect Twitter/X Account',
        description: 'Connect your Twitter/X account to verify social media tasks',
        steps: [
          'Click "Connect Twitter" button',
          'You will be redirected to Twitter/X',
          'Authorize Dropr to access your account',
          'You will be redirected back to complete the connection'
        ]
      },
      [PLATFORMS.DISCORD]: {
        title: 'Connect Discord Account',
        description: 'Connect your Discord account to verify server membership and roles',
        steps: [
          'Click "Connect Discord" button',
          'You will be redirected to Discord',
          'Authorize Dropr to access your account',
          'You will be redirected back to complete the connection'
        ]
      },
      [PLATFORMS.TELEGRAM]: {
        title: 'Connect Telegram Account',
        description: 'Connect your Telegram account to verify group membership',
        steps: [
          'Enter your Telegram username',
          'Click "Connect Telegram" button',
          'Send the verification code to our bot',
          'Your account will be connected automatically'
        ]
      }
    };

    return instructions[platform] || null;
  }
}

export default new SocialAuthService();