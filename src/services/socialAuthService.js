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

      // Store the authenticated account
      await this.storeSocialAccount({
        walletAddress,
        platform: PLATFORMS.TWITTER,
        platformUserId: data.user_id,
        platformUsername: data.username,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at
      });

      this.authenticatedAccounts.set(`${walletAddress}_${PLATFORMS.TWITTER}`, data);

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

      // Store the authenticated account
      await this.storeSocialAccount({
        walletAddress,
        platform: PLATFORMS.DISCORD,
        platformUserId: data.user_id,
        platformUsername: data.username,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at
      });

      this.authenticatedAccounts.set(`${walletAddress}_${PLATFORMS.DISCORD}`, data);

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

      // Store the authenticated account
      await this.storeSocialAccount({
        walletAddress,
        platform: PLATFORMS.TELEGRAM,
        platformUserId: data.user_id,
        platformUsername: data.username,
        accessToken: null, // Telegram doesn't use traditional OAuth tokens
        refreshToken: null,
        expiresAt: null
      });

      this.authenticatedAccounts.set(`${walletAddress}_${PLATFORMS.TELEGRAM}`, data);

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
      
      const { data, error } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .select('*')
        .eq('user_address', walletAddress);

      console.log('Supabase query result:', { data, error });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      // Filter out expired accounts but allow pending ones (rate limited)
      const validAccounts = data.filter(account => {
        // Filter out expired accounts
        if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
          return false;
        }
        
        // Allow pending accounts (rate limited) - they're still authenticated
        // The profile will be updated when rate limits reset
        return true;
      });

      console.log('Valid accounts found:', validAccounts.length);
      return { accounts: validAccounts, error: null };
    } catch (error) {
      console.error('Failed to get authenticated accounts:', error);
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
      
      const { data, error } = await supabase
        .from(TABLES.USER_SOCIAL_ACCOUNTS)
        .select('*')
        .eq('user_address', walletAddress)
        .eq('platform', platform)
        .maybeSingle();

      console.log('Authentication check result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Authentication check error:', error);
        return { success: false, error: error.message, isAuthenticated: false };
      }

      if (!data) {
        return { success: true, isAuthenticated: false, account: null };
      }

      // Check if token is expired
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
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
  async refreshToken(walletAddress, platform) {
    try {
      const { account } = await this.isAuthenticated(walletAddress, platform);
      
      if (!account || !account.refresh_token) {
        throw new Error('No refresh token available');
      }

      const { data, error } = await callEdgeFunction(`oauth-${platform}`, {
        user_address: walletAddress,
        refresh_token: account.refresh_token,
        action: 'refresh'
      });

      if (error) {
        throw error;
      }

      // Update stored tokens
      await this.storeSocialAccount({
        walletAddress,
        platform,
        platformUserId: account.platform_user_id,
        platformUsername: account.platform_username,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || account.refresh_token,
        expiresAt: data.expires_at
      });

      return { success: true, error: null };
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
          'Authorize FairPad to access your account',
          'You will be redirected back to complete the connection'
        ]
      },
      [PLATFORMS.DISCORD]: {
        title: 'Connect Discord Account',
        description: 'Connect your Discord account to verify server membership and roles',
        steps: [
          'Click "Connect Discord" button',
          'You will be redirected to Discord',
          'Authorize FairPad to access your account',
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