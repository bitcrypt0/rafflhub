import { ethers } from 'ethers';
import { contractABIs } from '../contracts/contractABIs';

class EventTaskService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getSocialTasksFromEvents(poolAddress, provider, socialEngagementManagerAddress) {
    try {
      // Check cache first
      const cached = this.cache.get(poolAddress);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.tasks;
      }

      // Get SocialEngagementManager contract
      const socialEngagementManager = new ethers.Contract(
        socialEngagementManagerAddress,
        contractABIs.socialEngagementManager,
        provider
      );

      // Get latest block number
      const latestBlock = await provider.getBlockNumber();
      
      // Search last 10000 blocks for SocialTasksEnabled events (same pattern as RaffleDetailPage)
      const fromBlock = Math.max(0, latestBlock - 10000);
      console.log(`Searching SocialTasksEnabled events for pool ${poolAddress} in blocks ${fromBlock} to ${latestBlock}`);
      
      // Query for SocialTasksEnabled event for this pool with block range
      const filter = socialEngagementManager.filters.SocialTasksEnabled(poolAddress);
      const events = await socialEngagementManager.queryFilter(filter, fromBlock, latestBlock);
      
      console.log(`Found ${events?.length || 0} SocialTasksEnabled events`);

      if (events.length === 0) {
        console.log('No SocialTasksEnabled events found in last 10000 blocks');
        return [];
      }

      // Get the most recent event (should only be one)
      const latestEvent = events[events.length - 1];
      const taskDescription = latestEvent.args.taskDescription;
      
      console.log('Task description from event:', taskDescription);

      // Parse the task description into tasks
      const tasks = this.parseTaskDescription(taskDescription);

      // Cache the result
      this.cache.set(poolAddress, {
        tasks,
        timestamp: Date.now()
      });

      return tasks;
    } catch (error) {
      console.error('Failed to fetch tasks from events:', error);
      return [];
    }
  }

  parseTaskDescription(description) {
    if (!description) return [];

    // Parse tasks separated by common separators
    const tasks = [];
    const separators = ['|', ',', ';', '\n'];
    
    // Split by the first found separator
    let taskStrings = [description];
    for (const sep of separators) {
      if (description.includes(sep)) {
        taskStrings = description.split(sep);
        break;
      }
    }

    // Parse each task string
    taskStrings.forEach((taskStr, index) => {
      taskStr = taskStr.trim();
      if (!taskStr) return;

      // Try to parse platform and action
      const platform = this.detectPlatform(taskStr);
      const action = this.detectAction(taskStr);
      
      tasks.push({
        id: `task-${index}`,
        platform,
        type: action,
        description: taskStr,
        required: true
      });
    });

    return tasks;
  }

  detectPlatform(taskStr) {
    const lowerStr = taskStr.toLowerCase();
    if (lowerStr.includes('twitter') || lowerStr.includes('x.com') || lowerStr.includes('tweet')) {
      return 'twitter';
    } else if (lowerStr.includes('discord')) {
      return 'discord';
    } else if (lowerStr.includes('telegram')) {
      return 'telegram';
    }
    return 'unknown';
  }

  detectAction(taskStr) {
    const lowerStr = taskStr.toLowerCase();
    if (lowerStr.includes('follow')) {
      return 'follow';
    } else if (lowerStr.includes('like') || lowerStr.includes('retweet')) {
      return 'engage';
    } else if (lowerStr.includes('join') || lowerStr.includes('subscribe')) {
      return 'join';
    }
    return 'custom';
  }

  // Clear cache for a specific pool
  clearCache(poolAddress) {
    this.cache.delete(poolAddress);
  }

  // Clear all cache
  clearAllCache() {
    this.cache.clear();
  }
}

export default new EventTaskService();
