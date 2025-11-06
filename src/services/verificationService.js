import { supabase, PLATFORMS, TABLES, TASK_TYPES, VERIFICATION_STATUS, callEdgeFunction } from '../config/supabase';
import socialAuthService from './socialAuthService';

class VerificationService {
  constructor() {
    this.verificationCache = new Map();
  }

  /**
   * Verify a Twitter task
   * @param {string} walletAddress - User's wallet address
   * @param {string} raffleAddress - Raffle contract address
   * @param {string} taskType - Type of task (follow, like, retweet, etc.)
   * @param {Object} taskData - Task configuration data
   * @returns {Promise<{success: boolean, verificationId: string|null, error: string|null}>}
   */
  async verifyTwitterTask(walletAddress, raffleAddress, taskType, taskData) {
    try {
      // Check if user has authenticated Twitter account
      const { isAuthenticated, account } = await socialAuthService.isAuthenticated(walletAddress, PLATFORMS.TWITTER);
      
      if (!isAuthenticated) {
        throw new Error('Twitter account not authenticated. Please connect your Twitter account first.');
      }

      // Create verification record
      const verificationRecord = await this.createVerificationRecord({
        walletAddress,
        raffleAddress,
        platform: PLATFORMS.TWITTER,
        taskType,  // Use the taskType parameter instead of taskData.type
        taskData
      });

      // Call Twitter verification edge function
      const { data, error } = await callEdgeFunction('verify-twitter', {
        user_address: walletAddress,
        raffle_id: raffleAddress,
        verification_id: verificationRecord.id,
        task_type: taskType,  // Use the taskType parameter instead of taskData.type
        task_data: taskData,
        twitter_user_id: account.platform_user_id,
        access_token: account.access_token
      });

      if (error) {
        await this.updateVerificationStatus(verificationRecord.id, VERIFICATION_STATUS.FAILED, error.message);
        throw error;
      }

      // Update verification status
      await this.updateVerificationStatus(verificationRecord.id, VERIFICATION_STATUS.VERIFIED);

      return { 
        success: true, 
        verificationId: verificationRecord.id, 
        error: null,
        details: data
      };
    } catch (error) {
      console.error('Twitter verification failed:', error);
      return { success: false, verificationId: null, error: error.message };
    }
  }

  /**
   * Verify a Discord task
   * @param {string} walletAddress - User's wallet address
   * @param {string} raffleAddress - Raffle contract address
   * @param {string} taskType - Type of task
   * @param {Object} taskData - Task configuration data
   * @returns {Promise<{success: boolean, verificationId: string|null, error: string|null}>}
   */
  async verifyDiscordTask(walletAddress, raffleAddress, taskType, taskData) {
    try {
      // Check if user has authenticated Discord account
      const { isAuthenticated, account } = await socialAuthService.isAuthenticated(walletAddress, PLATFORMS.DISCORD);
      
      if (!isAuthenticated) {
        throw new Error('Discord account not authenticated. Please connect your Discord account first.');
      }

      // Create verification record
      const verificationRecord = await this.createVerificationRecord({
        walletAddress,
        raffleAddress,
        platform: PLATFORMS.DISCORD,
        taskType,  // Use the taskType parameter instead of taskData.type
        taskData
      });

      // Call Discord verification edge function
      const { data, error } = await callEdgeFunction('verify-discord', {
        user_address: walletAddress,
        raffle_id: raffleAddress,
        verification_id: verificationRecord.id,
        task_type: taskType,  // Use the taskType parameter instead of taskData.type
        task_data: taskData,
        discord_user_id: account.platform_user_id,
        access_token: account.access_token
      });

      if (error) {
        await this.updateVerificationStatus(verificationRecord.id, VERIFICATION_STATUS.FAILED, error.message);
        throw error;
      }

      // Update verification status
      await this.updateVerificationStatus(verificationRecord.id, VERIFICATION_STATUS.VERIFIED);

      return { 
        success: true, 
        verificationId: verificationRecord.id, 
        error: null,
        details: data
      };
    } catch (error) {
      console.error('Discord verification failed:', error);
      return { success: false, verificationId: null, error: error.message };
    }
  }

  /**
   * Verify a Telegram task
   * @param {string} walletAddress - User's wallet address
   * @param {string} raffleAddress - Raffle contract address
   * @param {string} taskType - Type of task
   * @param {Object} taskData - Task configuration data
   * @returns {Promise<{success: boolean, verificationId: string|null, error: string|null}>}
   */
  async verifyTelegramTask(walletAddress, raffleAddress, taskType, taskData) {
    try {
      // Check if user has authenticated Telegram account
      const { isAuthenticated, account } = await socialAuthService.isAuthenticated(walletAddress, PLATFORMS.TELEGRAM);
      
      if (!isAuthenticated) {
        throw new Error('Telegram account not authenticated. Please connect your Telegram account first.');
      }

      // Create verification record
      const verificationRecord = await this.createVerificationRecord({
        walletAddress,
        raffleAddress,
        platform: PLATFORMS.TELEGRAM,
        taskType,  // Use the taskType parameter instead of taskData.type
        taskData
      });

      // Call Telegram verification edge function
      const { data, error } = await callEdgeFunction('verify-telegram', {
        user_address: walletAddress,
        raffle_id: raffleAddress,
        verification_id: verificationRecord.id,
        task_type: taskType,  // Use the taskType parameter instead of taskData.type
        task_data: taskData,
        telegram_user_id: account.platform_user_id
      });

      if (error) {
        await this.updateVerificationStatus(verificationRecord.id, VERIFICATION_STATUS.FAILED, error.message);
        throw error;
      }

      // Update verification status
      await this.updateVerificationStatus(verificationRecord.id, VERIFICATION_STATUS.VERIFIED);

      return { 
        success: true, 
        verificationId: verificationRecord.id, 
        error: null,
        details: data
      };
    } catch (error) {
      console.error('Telegram verification failed:', error);
      return { success: false, verificationId: null, error: error.message };
    }
  }

  /**
   * Create a verification record in the database
   * @param {Object} recordData - Verification record data
   * @returns {Promise<Object>} Created verification record
   */
  async createVerificationRecord(recordData) {
    const {
      walletAddress,
      raffleAddress,
      platform,
      taskType,
      taskData
    } = recordData;

    const record = {
      user_address: walletAddress,
      raffle_id: raffleAddress,
      platform,
      task_type: taskType,
      task_data: taskData,
      status: VERIFICATION_STATUS.PENDING,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString() // Will be updated by upsert if record exists
    };

    // Use upsert to handle existing records (update or insert)
    const { data, error } = await supabase
      .from(TABLES.VERIFICATION_RECORDS)
      .upsert(record, {
        onConflict: 'user_address,raffle_id,platform,task_type',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Update verification status
   * @param {string} verificationId - Verification record ID
   * @param {string} status - New verification status
   * @param {string} errorMessage - Error message if failed
   * @returns {Promise<void>}
   */
  async updateVerificationStatus(verificationId, status, errorMessage = null) {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (status === VERIFICATION_STATUS.VERIFIED) {
      updateData.verified_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from(TABLES.VERIFICATION_RECORDS)
      .update(updateData)
      .eq('id', verificationId);

    if (error) {
      throw error;
    }
  }

  /**
   * Get verification records for a user and raffle
   * @param {string} walletAddress - User's wallet address
   * @param {string} raffleAddress - Raffle contract address
   * @returns {Promise<{records: Array, error: string|null}>}
   */
  async getVerificationRecords(walletAddress, raffleAddress) {
    try {
      const { data, error } = await supabase
        .from(TABLES.VERIFICATION_RECORDS)
        .select('*')
        .eq('user_address', walletAddress)
        .eq('raffle_id', raffleAddress)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return { records: data, error: null };
    } catch (error) {
      console.error('Failed to get verification records:', error);
      return { records: [], error: error.message };
    }
  }

  /**
   * Check if all required tasks are verified for a raffle
   * @param {string} walletAddress - User's wallet address
   * @param {string} raffleAddress - Raffle contract address
   * @param {Array} requiredTasks - Array of required task configurations
   * @returns {Promise<{allVerified: boolean, verifiedTasks: Array, missingTasks: Array}>}
   */
  async checkAllTasksVerified(walletAddress, raffleAddress, requiredTasks) {
    try {
      const { records } = await this.getVerificationRecords(walletAddress, raffleAddress);
      
      const verifiedTasks = records.filter(record => 
        record.status === VERIFICATION_STATUS.VERIFIED
      );

      const verifiedTaskKeys = verifiedTasks.map(task => 
        `${task.platform}_${task.task_type}_${JSON.stringify(task.task_data)}`
      );

      const missingTasks = requiredTasks.filter(task => {
        const taskKey = `${task.platform}_${task.type}_${JSON.stringify(task.data)}`;
        return !verifiedTaskKeys.includes(taskKey);
      });

      return {
        allVerified: missingTasks.length === 0,
        verifiedTasks,
        missingTasks
      };
    } catch (error) {
      console.error('Failed to check task verification status:', error);
      return {
        allVerified: false,
        verifiedTasks: [],
        missingTasks: requiredTasks
      };
    }
  }

  /**
   * Verify a task based on platform
   * @param {string} platform - Social media platform
   * @param {string} walletAddress - User's wallet address
   * @param {string} raffleAddress - Raffle contract address
   * @param {Object} taskData - Task configuration data
   * @returns {Promise<{success: boolean, verificationId: string|null, error: string|null}>}
   */
  async verifyTask(platform, walletAddress, raffleAddress, taskData) {
    switch (platform) {
      case PLATFORMS.TWITTER:
        return await this.verifyTwitterTask(walletAddress, raffleAddress, taskData);
      case PLATFORMS.DISCORD:
        return await this.verifyDiscordTask(walletAddress, raffleAddress, taskData);
      case PLATFORMS.TELEGRAM:
        return await this.verifyTelegramTask(walletAddress, raffleAddress, taskData);
      default:
        return { 
          success: false, 
          verificationId: null, 
          error: `Unsupported platform: ${platform}` 
        };
    }
  }

  /**
   * Get task verification instructions
   * @param {string} platform - Social media platform
   * @param {string} taskType - Type of task
   * @returns {Object} Task instructions
   */
  getTaskInstructions(platform, taskType) {
    const instructions = {
      [PLATFORMS.TWITTER]: {
        [TASK_TYPES.TWITTER_LIKE]: {
          title: 'Like Tweet',
          description: 'Like the specified tweet to complete this task',
          steps: [
            'Click the heart icon on the tweet',
            'Ensure the heart is filled (red color)',
            'Click "Verify" to check completion'
          ]
        },
        [TASK_TYPES.TWITTER_RETWEET]: {
          title: 'Retweet',
          description: 'Retweet the specified tweet to complete this task',
          steps: [
            'Click the retweet icon on the tweet',
            'Choose "Retweet" or "Quote Tweet"',
            'Click "Verify" to check completion'
          ]
        },
        [TASK_TYPES.TWITTER_FOLLOW]: {
          title: 'Follow Account',
          description: 'Follow the specified Twitter account',
          steps: [
            'Visit the Twitter profile',
            'Click the "Follow" button',
            'Click "Verify" to check completion'
          ]
        },
        [TASK_TYPES.TWITTER_MENTION]: {
          title: 'Mention in Tweet',
          description: 'Create a tweet mentioning the specified account',
          steps: [
            'Create a new tweet',
            'Include the required mention (@username)',
            'Post the tweet',
            'Click "Verify" to check completion'
          ]
        }
      },
      [PLATFORMS.DISCORD]: {
        [TASK_TYPES.DISCORD_JOIN]: {
          title: 'Join Discord Server',
          description: 'Join the specified Discord server',
          steps: [
            'Click the Discord invite link',
            'Accept the server invitation',
            'Ensure you remain in the server',
            'Click "Verify" to check membership'
          ]
        },
        [TASK_TYPES.DISCORD_ROLE]: {
          title: 'Obtain Discord Role',
          description: 'Get the specified role in the Discord server',
          steps: [
            'Join the Discord server first',
            'Follow server instructions to get the role',
            'Check that you have the required role',
            'Click "Verify" to check role assignment'
          ]
        }
      },
      [PLATFORMS.TELEGRAM]: {
        [TASK_TYPES.TELEGRAM_JOIN]: {
          title: 'Join Telegram Group',
          description: 'Join the specified Telegram group or channel',
          steps: [
            'Click the Telegram invite link',
            'Join the group or channel',
            'Ensure you remain a member',
            'Click "Verify" to check membership'
          ]
        }
      }
    };

    return instructions[platform]?.[taskType] || {
      title: 'Unknown Task',
      description: 'Task instructions not available',
      steps: ['Contact support for assistance']
    };
  }

  /**
   * Clear verification cache
   */
  clearCache() {
    this.verificationCache.clear();
  }

  /**
   * Get cached verification result
   * @param {string} key - Cache key
   * @returns {Object|null} Cached result
   */
  getCachedResult(key) {
    return this.verificationCache.get(key) || null;
  }

  /**
   * Set cached verification result
   * @param {string} key - Cache key
   * @param {Object} result - Verification result
   * @param {number} ttl - Time to live in milliseconds
   */
  setCachedResult(key, result, ttl = 300000) { // 5 minutes default
    this.verificationCache.set(key, result);
    setTimeout(() => {
      this.verificationCache.delete(key);
    }, ttl);
  }
}

export default new VerificationService();