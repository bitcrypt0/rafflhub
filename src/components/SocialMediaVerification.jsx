import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CheckCircle, ExternalLink, Twitter, Instagram, Youtube, Facebook, Linkedin, Globe, AlertCircle, Clock, Shield, Link as LinkIcon, ChevronDown, ChevronUp, MessageCircle, Send, Heart, Repeat, UserPlus, AtSign, Lock, Loader, RefreshCw, XCircle, MessageSquare } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { toast } from './ui/sonner';

// Import Supabase services
import socialAuthService from '../services/socialAuthService';
import verificationService from '../services/verificationService';
import { realtimeVerificationService } from '../services/realtimeVerificationService';
import { callEdgeFunction } from '../config/supabase';
import eventTaskService from '../services/eventTaskService';

// Platform icon mapping
const PLATFORM_ICONS = {
  twitter: Twitter,
  discord: MessageCircle,
  telegram: Send,
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
  default: Globe
};

// Action icon mapping
const ACTION_ICONS = {
  follow: UserPlus,
  like: Heart,
  retweet: Repeat,
  comment: MessageSquare,
  mention: AtSign,
  join: UserPlus,
  share: ExternalLink,
  default: ExternalLink
};

// Enhanced task parsing function
const parseTaskDescription = (description) => {
  if (!description) return [];

  try {
    // Try to parse as JSON first (structured format)
    const tasks = JSON.parse(description);
    console.log('Parsed JSON tasks:', tasks);
    const enhancedTasks = Array.isArray(tasks) ? tasks.map(enhanceTaskWithActionData) : [];
    console.log('Enhanced JSON tasks:', enhancedTasks);
    return enhancedTasks;
  } catch {
    // Fallback: parse text-based descriptions
    console.log('Parsing text-based tasks from:', description);
    const textTasks = parseTextBasedTasks(description);
    console.log('Parsed text tasks:', textTasks);
    return textTasks;
  }
};

// Parse text-based task descriptions
const parseTextBasedTasks = (description) => {
  const tasks = [];
  const taskPatterns = [
    // Twitter patterns
    {
      pattern: /twitter[:\s]+follow(?:\s+account)?[:\s\-]+@?([a-zA-Z0-9_]+)/gi,
      platform: 'twitter',
      action: 'follow',
      extractTarget: (match) => match[1]
    },
    {
      pattern: /twitter[:\s]+like[:\s\-]+(https?:\/\/(?:twitter\.com|x\.com)\/[^\s]+)/gi,
      platform: 'twitter',
      action: 'like',
      extractTarget: (match) => match[1]
    },
    {
      pattern: /twitter[:\s]+retweet[:\s\-]+(https?:\/\/(?:twitter\.com|x\.com)\/[^\s]+)/gi,
      platform: 'twitter',
      action: 'retweet',
      extractTarget: (match) => match[1]
    },
    {
      pattern: /twitter[:\s]+comment(?:\s+on\s+tweet)?[:\s\-]+(https?:\/\/(?:twitter\.com|x\.com)\/[^\s]+)/gi,
      platform: 'twitter',
      action: 'comment',
      extractTarget: (match) => match[1]
    },
    // Discord patterns
    {
      pattern: /discord[:\s]+join[:\s]+(https?:\/\/discord\.gg\/[^\s]+)/gi,
      platform: 'discord',
      action: 'join',
      extractTarget: (match) => match[1]
    },
    // Telegram patterns
    {
      pattern: /telegram[:\s]+join[:\s]+(https?:\/\/t\.me\/[^\s]+)/gi,
      platform: 'telegram',
      action: 'join',
      extractTarget: (match) => match[1]
    },
    {
      pattern: /telegram[:\s]+join[:\s]+@?([a-zA-Z0-9_]+)/gi,
      platform: 'telegram',
      action: 'join',
      extractTarget: (match) => match[1]
    }
  ];

  let taskId = 1;
  taskPatterns.forEach(({ pattern, platform, action, extractTarget }) => {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const target = extractTarget(match);
      tasks.push({
        id: `${platform}_${action}_${taskId++}`,
        platform,
        action,
        target,
        title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${target}`,
        actionData: generateActionData(platform, action, target)
      });
    }
  });

  // If no patterns matched, create a generic task
  if (tasks.length === 0) {
    tasks.push({
      id: 'generic_task',
      platform: 'default',
      action: 'complete',
      target: '',
      title: 'Social Media Engagement',
      description: description,
      actionData: null
    });
  }

  return tasks;
};

// Enhance task with action data
const enhanceTaskWithActionData = (task) => {
  console.log('Enhancing task with action data:', task);
  const actionData = generateActionData(task.platform, task.action || task.type, task.target || task.data);
  console.log('Generated action data:', actionData);
  const enhancedTask = {
    ...task,
    actionData: actionData
  };
  console.log('Enhanced task:', enhancedTask);
  return enhancedTask;
};

// Generate action data for direct task completion
const generateActionData = (platform, action, target) => {
  switch (platform?.toLowerCase()) {
    case 'twitter':
      return generateTwitterActionData(action, target);
    case 'discord':
      return generateDiscordActionData(action, target);
    case 'telegram':
      return generateTelegramActionData(action, target);
    default:
      return null;
  }
};

const generateTwitterActionData = (action, target) => {
  switch (action?.toLowerCase()) {
    case 'follow':
      return {
        type: 'follow',
        url: `https://twitter.com/${target.replace('@', '')}`,
        buttonText: 'Follow on Twitter',
        icon: 'follow'
      };
    case 'like':
    case 'twitter_like':
      const tweetId = extractTweetId(target);
      return {
        type: 'like',
        url: target.startsWith('http') ? target : `https://twitter.com/i/status/${tweetId}`,
        buttonText: 'Like Tweet',
        icon: 'like'
      };
    case 'retweet':
    case 'twitter_retweet':
      const retweetId = extractTweetId(target);
      return {
        type: 'retweet',
        url: target.startsWith('http') ? target : `https://twitter.com/i/status/${retweetId}`,
        buttonText: 'Retweet',
        icon: 'retweet'
      };
    case 'comment':
    case 'twitter_comment':
      const commentTweetId = extractTweetId(target);
      return {
        type: 'comment',
        url: target.startsWith('http') ? target : `https://twitter.com/i/status/${commentTweetId}`,
        buttonText: 'Comment on Tweet',
        icon: 'comment'
      };
    case 'mention':
    case 'twitter_mention':
      return {
        type: 'mention',
        url: `https://twitter.com/compose/tweet?text=${encodeURIComponent(`@${target.replace('@', '')} `)}`,
        buttonText: 'Create Mention Tweet',
        icon: 'mention'
      };
    default:
      return {
        type: 'generic',
        url: `https://twitter.com/${target.replace('@', '')}`,
        buttonText: 'Open on Twitter',
        icon: 'default'
      };
  }
};

const generateDiscordActionData = (action, target) => {
  switch (action?.toLowerCase()) {
    case 'join':
    case 'discord_join':
      return {
        type: 'join',
        url: target.startsWith('http') ? target : `https://discord.gg/${target}`,
        buttonText: 'Join Discord Server',
        icon: 'join'
      };
    default:
      return {
        type: 'generic',
        url: target.startsWith('http') ? target : `https://discord.gg/${target}`,
        buttonText: 'Open Discord',
        icon: 'default'
      };
  }
};

const generateTelegramActionData = (action, target) => {
  switch (action?.toLowerCase()) {
    case 'join':
    case 'telegram_join':
      return {
        type: 'join',
        url: target.startsWith('http') ? target : `https://t.me/${target.replace('@', '')}`,
        buttonText: 'Join Telegram',
        icon: 'join'
      };
    default:
      return {
        type: 'generic',
        url: target.startsWith('http') ? target : `https://t.me/${target.replace('@', '')}`,
        buttonText: 'Open Telegram',
        icon: 'default'
      };
  }
};

// Helper function to extract tweet ID from URL
const extractTweetId = (url) => {
  if (typeof url !== 'string') return '';
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : url;
};

// Enhanced Task Display Component with direct action buttons
const TaskDisplayComponent = ({ task, onComplete, onAuthenticate, isCompleted, isVerifying, isAuthenticated, userAddress, raffleId, taskStatus, onRetry, authenticatedAccounts }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const IconComponent = PLATFORM_ICONS[task.platform?.toLowerCase()] || PLATFORM_ICONS.default;
  const ActionIcon = ACTION_ICONS[task.actionData?.icon] || ACTION_ICONS.default;
  
  // Determine current verification status
  const isVerifyingTask = taskStatus?.status === 'verifying';
  const hasFailed = taskStatus?.status === 'failed';

  const handleAuthenticate = async () => {
    if (!userAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsAuthenticating(true);
    try {
      let authResult;
      
      switch (task.platform?.toLowerCase()) {
        case 'twitter':
          authResult = await socialAuthService.initiateTwitterAuth(userAddress);
          break;
        case 'discord':
          authResult = await socialAuthService.initiateDiscordAuth(userAddress);
          break;
        case 'telegram':
          authResult = await socialAuthService.initiateTelegramAuth(userAddress);
          break;
        default:
          throw new Error(`Unsupported platform: ${task.platform}`);
      }

      if (authResult.success) {
        if (authResult.authUrl) {
          console.log('Opening OAuth popup for platform:', task.platform);
          // Open OAuth URL in popup and listen for completion
          const popup = window.open(authResult.authUrl, '_blank', 'width=600,height=600');
          toast.success('Authentication window opened. Please complete the OAuth process.');
          
          // Listen for popup closure
          const checkClosed = setInterval(() => {
            console.log('Checking if popup is closed...', popup?.closed);
            if (popup && popup.closed) {
              console.log('Popup closed, refreshing authentication status for:', task.platform);
              clearInterval(checkClosed);
              // Use the onAuthenticate prop passed from parent component
              onAuthenticate(task.platform);
            }
          }, 1000);
          
          // Fallback: check after 5 minutes max
          setTimeout(() => {
            console.log('Fallback timeout reached, forcing popup close and refresh');
            clearInterval(checkClosed);
            if (popup && !popup.closed) {
              popup.close();
              onAuthenticate(task.platform);
            }
          }, 300000);
        }
        // Don't call onAuthenticate here - wait for popup to close
      } else {
        toast.error(authResult.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Failed to initiate authentication');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDirectAction = () => {
    if (task.actionData?.url) {
      // Open in new tab without noopener to maintain session continuity
      window.open(task.actionData.url, '_blank', 'noreferrer');
      toast.success('Task page opened in new tab. Complete the action and return to verify.');
    }
  };

  const handleDisconnect = async () => {
    if (!userAddress || !task.platform) {
      toast.error('Missing required information');
      return;
    }

    setIsDisconnecting(true);
    try {
      const result = await socialAuthService.disconnectAccount(userAddress, task.platform.toLowerCase());
      
      if (result.success) {
        toast.success(`${task.platform.charAt(0).toUpperCase() + task.platform.slice(1)} account disconnected successfully!`);
        
        // Trigger authentication status refresh to update UI
        if (onAuthenticate) {
          onAuthenticate(task.platform.toLowerCase());
        }
      } else {
        toast.error(result.error || 'Failed to disconnect account');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect account');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleVerifyTask = async () => {
    if (!userAddress || !raffleId) {
      toast.error('Missing required information');
      return;
    }

    // Debug: Log task structure
    console.log('Task data for verification:', {
      task,
      taskType: task.type,
      taskAction: task.action,
      taskData: task.data,
      taskTarget: task.target
    });

    try {
      let verificationResult;
      
      switch (task.platform?.toLowerCase()) {
        case 'twitter':
          let taskType = task.type || task.action || 'follow'; // Default to 'follow' if missing
          
          // Normalize task type to match edge function expectations
          if (taskType === 'following') {
            taskType = 'follow';
          } else if (taskType === 'liking') {
            taskType = 'like';
          } else if (taskType === 'retweeting') {
            taskType = 'retweet';
          }
          
          const taskData = task.data || { target: task.target };
          
          console.log('Calling verification with:', {
            userAddress,
            raffleId,
            taskType,
            taskData
          });
          
          verificationResult = await verificationService.verifyTwitterTask(userAddress, raffleId, taskType, taskData);
          break;
        case 'discord':
          const discordTaskType = task.type || task.action || 'follow'; // Default to 'follow' if missing
          const discordTaskData = task.data || { target: task.target };
          verificationResult = await verificationService.verifyDiscordTask(userAddress, raffleId, discordTaskType, discordTaskData);
          break;
        case 'telegram':
          const telegramTaskType = task.type || task.action || 'follow'; // Default to 'follow' if missing
          const telegramTaskData = task.data || { target: task.target };
          verificationResult = await verificationService.verifyTelegramTask(userAddress, raffleId, telegramTaskType, telegramTaskData);
          break;
        default:
          throw new Error(`Unsupported platform: ${task.platform}`);
      }

      if (verificationResult.success) {
        toast.success('Task verified successfully!');
        onComplete(task.id, verificationResult.data);
      } else {
        toast.error(verificationResult.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify task');
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      {/* Main horizontal layout: Icon + Description + Buttons + Status */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <IconComponent className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        
        {/* Task Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {task.platform && (
              <Badge variant="outline" className="text-xs">
                {task.platform.charAt(0).toUpperCase() + task.platform.slice(1)}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{task.description?.replace(/^(TWITTER|DISCORD|TELEGRAM|INSTAGRAM|YOUTUBE|FACEBOOK|LINKEDIN):\s*/i, '')}</p>
          
          {/* Authentication Status Indicator (compact) */}
          {task.platform && ['twitter', 'discord', 'telegram'].includes(task.platform.toLowerCase()) && (
            <div className="flex items-center gap-1 mt-1">
              {isAuthenticated ? (
                <>
                  <Shield className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-foreground">
                    {authenticatedAccounts[task.platform.toLowerCase()]?.platform_username === 'pending' 
                      ? 'Connecting...' 
                      : 'Authenticated'
                    }
                  </span>
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3 text-orange-600" />
                  <span className="text-xs text-foreground">Auth Required</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons (horizontal) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isCompleted && (
            <>
              {/* Connect Button (if not authenticated) */}
              {(() => {
                const shouldShow = task.platform && 
                  ['twitter', 'discord', 'telegram'].includes(task.platform.toLowerCase()) && 
                  !isAuthenticated;
                console.log('Connect button display check:', {
                  taskPlatform: task.platform,
                  platformIncluded: task.platform && ['twitter', 'discord', 'telegram'].includes(task.platform.toLowerCase()),
                  isAuthenticated,
                  shouldShow
                });
                return shouldShow;
              })() && (
                <Button
                  onClick={handleAuthenticate}
                  disabled={isAuthenticating}
                  size="sm"
                  variant="outline"
                  className="text-xs whitespace-nowrap"
                >
                  {isAuthenticating ? 'Connecting...' : `Connect`}
                </Button>
              )}

              {/* Action Button (if authenticated) */}
              {isAuthenticated && task.actionData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDirectAction}
                  className="text-xs whitespace-nowrap"
                >
                  <ActionIcon className="h-3 w-3 mr-1" />
                  {task.actionData.buttonText.replace('on Twitter', '').replace('on Discord', '').replace('on Telegram', '').trim()}
                </Button>
              )}

              {/* Disconnect Button (if authenticated) */}
              {isAuthenticated && task.platform && ['twitter', 'discord', 'telegram'].includes(task.platform.toLowerCase()) && (
                <Button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  size="sm"
                  variant="outline"
                  className="text-xs whitespace-nowrap text-red-600 hover:text-red-700 hover:border-red-300"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              )}

              {/* Verify Button (if authenticated and not completed) */}
              {isAuthenticated && !isCompleted && task.platform && ['twitter', 'discord', 'telegram'].includes(task.platform.toLowerCase()) && (
                <Button
                  onClick={handleVerifyTask}
                  disabled={isVerifying}
                  size="sm"
                  variant="default"
                  className="text-xs whitespace-nowrap bg-green-600 hover:bg-green-700"
                >
                  {isVerifying ? 'Verifying...' : 'Verify Task'}
                </Button>
              )}

              {/* Legacy action URL support */}
              {isAuthenticated && task.actionUrl && !task.actionData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(task.actionUrl, '_blank')}
                  className="text-xs whitespace-nowrap"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Complete
                </Button>
              )}

              {/* Note: Real-time verification is also active as backup */}
            </>
          )}
        </div>

        {/* Status Badge with verification states */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasFailed && (
            <Button
              onClick={() => onRetry(task.id)}
              size="sm"
              variant="ghost"
              className="text-xs h-6 px-2"
              title="Retry verification"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          
          <Badge 
            variant={isCompleted ? "default" : hasFailed ? "destructive" : isVerifyingTask ? "secondary" : "secondary"} 
            className="text-xs"
          >
            {isCompleted ? (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Done
              </div>
            ) : hasFailed ? (
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Failed
              </div>
            ) : isVerifyingTask ? (
              <div className="flex items-center gap-1">
                <Loader className="h-3 w-3 animate-spin" />
                Verifying
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </div>
            )}
          </Badge>
        </div>
      </div>
      
      {/* Error message for failed verification */}
      {hasFailed && taskStatus?.error && (
        <div className="mt-2 flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
          <AlertCircle className="h-3 w-3 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
                <p className="text-sm text-foreground">{taskStatus.error}</p>
            <button 
              onClick={() => onRetry(task.id)}
              className="text-red-600 dark:text-red-400 underline hover:no-underline mt-1"
            >
              Click to retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SocialMediaVerification = ({ 
  raffle, 
  userAddress, 
  socialEngagementRequired, 
  hasCompletedSocialEngagement,
  onVerificationComplete 
}) => {
  const { connected, provider } = useWallet();
  const { contracts, executeTransaction } = useContract();
  const [socialTasks, setSocialTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [verifying, setVerifying] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [authenticatedAccounts, setAuthenticatedAccounts] = useState({});
  const [verificationRecords, setVerificationRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState({}); // Track verification status per task
  const [retryingTasks, setRetryingTasks] = useState(new Set());

  // Load tasks from events when raffle address is available
  useEffect(() => {
    if (raffle?.address && provider && contracts?.socialEngagementManager) {
      loadTasksFromEvents();
    }
  }, [raffle?.address, provider, contracts?.socialEngagementManager]);

  // Fallback: Try to get tasks from raffle data if event fetching fails
  useEffect(() => {
    if (socialTasks.length === 0 && !loading && raffle?.socialTaskDescription) {
      console.log('Using fallback: parsing tasks from raffle data');
      const parsedTasks = parseTaskDescription(raffle.socialTaskDescription);
      setSocialTasks(parsedTasks);
    }
  }, [socialTasks.length, loading, raffle?.socialTaskDescription]);

  // Function to load tasks from events
  const loadTasksFromEvents = async () => {
    try {
      setLoading(true);
      
      // If social engagement is not required, don't fetch tasks
      if (!raffle?.socialEngagementRequired) {
        setSocialTasks([]);
        return;
      }
      
      const tasks = await eventTaskService.getSocialTasksFromEvents(
        raffle.address,
        provider,
        contracts.socialEngagementManager.address
      );
      
      setSocialTasks(tasks);
    } catch (error) {
      console.error('Failed to load tasks from events:', error);
      setSocialTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Load authenticated accounts and verification records
  useEffect(() => {
    if (connected && userAddress) {
      loadUserData();
    }
  }, [connected, userAddress, raffle?.address]);

  // Check user's completion status from both blockchain and Supabase
  useEffect(() => {
    if (connected && userAddress && contracts?.socialEngagementManager && contracts?.getContractInstance) {
      checkCompletionStatus();
    }
  }, [connected, userAddress, contracts?.socialEngagementManager, contracts?.getContractInstance, raffle?.address, verificationRecords]);

  // Set up real-time subscription for verification updates
  useEffect(() => {
    if (!userAddress || !raffle?.address) return;

    const unsubscribe = realtimeVerificationService.subscribeToVerification(
      userAddress,
      raffle.address,
      {
        onTaskCompleted: (data) => {
          toast.success(`Task completed: ${data.taskType}`);
          // Update task status
          setTaskStatuses(prev => ({
            ...prev,
            [data.taskId]: { status: 'completed', timestamp: Date.now() }
          }));
          loadUserData(); // Refresh data
        },
        onAllTasksCompleted: (data) => {
          toast.success('🎉 All tasks completed! You can now purchase slots.');
          loadUserData();
          if (onVerificationComplete) {
            onVerificationComplete();
          }
        },
        onVerificationReady: () => {
          toast.success('✅ Verification complete! Purchase slots button is now active.');
        },
        onTaskFailed: (data) => {
          // Update task status to show failure
          setTaskStatuses(prev => ({
            ...prev,
            [data.taskId]: { status: 'failed', error: data.error, timestamp: Date.now() }
          }));
          toast.error(`Task verification failed: ${data.error}`);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userAddress, raffle?.address, onVerificationComplete]);

  const loadUserData = async () => {
    if (!userAddress) return;
    
    setLoading(true);
    try {
      // Get authenticated social accounts with improved error handling
      const accountsResult = await socialAuthService.getAuthenticatedAccounts(userAddress);
      
      console.log('Accounts result from service:', accountsResult);
      
      // Handle the correct response format: { accounts: [...], error: null }
      if (accountsResult && !accountsResult.error && Array.isArray(accountsResult.accounts)) {
        const accountsMap = {};
        accountsResult.accounts.forEach(account => {
          accountsMap[account.platform] = account;
        });
        setAuthenticatedAccounts(accountsMap);
      } else if (accountsResult && accountsResult.error) {
        console.warn('Failed to load authenticated accounts:', accountsResult.error);
        setAuthenticatedAccounts({});
        // Don't show error toast for missing accounts as this is expected for new users
      } else {
        console.warn('Unexpected response format from getAuthenticatedAccounts');
        setAuthenticatedAccounts({});
      }

      // Load verification records for this raffle with error handling
      if (raffle?.address) {
        try {
          const recordsResult = await verificationService.getVerificationRecords(userAddress, raffle.address);
          
          console.log('Verification records result:', recordsResult);
          
          // Handle the correct response format: { records: [...], error: null }
          if (recordsResult && !recordsResult.error && Array.isArray(recordsResult.records)) {
            setVerificationRecords(recordsResult.records);
            
            // Update completed tasks based on verification records
            const completedTaskIds = new Set();
            recordsResult.records.forEach(record => {
              if (record.status === 'completed') {
                // Find matching task by platform and type
                const matchingTask = socialTasks.find(task => 
                  task.platform === record.platform && 
                  task.type === record.task_type
                );
                if (matchingTask) {
                  completedTaskIds.add(matchingTask.id);
                }
              }
            });
            setCompletedTasks(completedTaskIds);
          } else {
            console.warn('No verification records found or invalid format');
            setVerificationRecords([]);
          }
        } catch (verificationError) {
          console.error('Error loading verification records:', verificationError);
          setVerificationRecords([]);
          // Only show error if it's a connection issue, not missing data
          if (verificationError.message && verificationError.message.includes('fetch')) {
            toast.error('Unable to connect to verification service. Please check your connection.');
          }
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setAuthenticatedAccounts({});
      setVerificationRecords([]);
      
      // Show user-friendly error message based on error type
      if (error.message && error.message.includes('fetch')) {
        toast.error('Unable to connect to backend services. Please check your internet connection.');
      } else if (error.message && error.message.includes('Supabase')) {
        toast.error('Backend service temporarily unavailable. Please try again later.');
      } else {
        toast.error('Failed to load verification data. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkCompletionStatus = async () => {
    try {
      if (!raffle?.address || !userAddress) return;

      // Check blockchain completion status
      let isCompleted = false;
      try {
        // Get the pool contract instance to check completion status
        const poolContract = contracts?.getContractInstance?.(raffle.address, 'pool');
        
        if (poolContract && typeof poolContract.hasCompletedSocialEngagement === 'function') {
          isCompleted = await poolContract.hasCompletedSocialEngagement(userAddress);
        } else {
          console.warn('Pool contract not available or hasCompletedSocialEngagement method not found', {
            hasContracts: !!contracts,
            hasGetContractInstance: !!contracts?.getContractInstance,
            hasPoolContract: !!poolContract,
            poolAddress: raffle?.address,
            hasMethod: poolContract ? typeof poolContract.hasCompletedSocialEngagement === 'function' : false
          });
        }
      } catch (blockchainError) {
        console.error('Error checking blockchain completion status:', blockchainError);
        // Continue with Supabase check even if blockchain check fails
      }

      // Also check Supabase verification status
      let supabaseAllVerified = { success: false };
      try {
        supabaseAllVerified = await verificationService.checkAllTasksVerified(userAddress, raffle.address);
      } catch (supabaseError) {
        console.error('Error checking Supabase verification status:', supabaseError);
        if (supabaseError.message && supabaseError.message.includes('fetch')) {
          console.warn('Unable to connect to verification service');
        }
      }

      if (isCompleted || supabaseAllVerified.success) {
        // If user has completed all tasks, mark all as completed
        setCompletedTasks(new Set(socialTasks.map(task => task.id)));
      }
    } catch (error) {
      console.error('Error checking completion status:', error);
      // Don't show user-facing error for this background check
    }
  };

  const handleAuthentication = async (platform) => {
    // Refresh authentication status for the platform
    console.log('Starting authentication status refresh for platform:', platform);
    
    try {
      console.log('Fetching authenticated accounts for user:', userAddress);
      const accountsResult = await socialAuthService.getAuthenticatedAccounts(userAddress);
      
      console.log('Received accounts result:', accountsResult);
      
      // Handle response properly with error checking
      if (accountsResult && !accountsResult.error && Array.isArray(accountsResult.accounts)) {
        const accountsMap = {};
        accountsResult.accounts.forEach(account => {
          console.log('Found authenticated account:', account.platform, account);
          accountsMap[account.platform] = account;
        });
        console.log('Setting authenticated accounts map:', accountsMap);
        setAuthenticatedAccounts(accountsMap);
        
        // Check if the specific platform is now authenticated
        try {
          console.log('Checking if platform is authenticated:', platform);
          const isAuthenticated = await socialAuthService.isAuthenticated(userAddress, platform);
          console.log('Authentication check result:', isAuthenticated);
          if (isAuthenticated.success && isAuthenticated.isAuthenticated) {
            toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} account connected successfully!`);
          } else if (isAuthenticated.error) {
            console.warn('Authentication check failed:', isAuthenticated.error);
          }
        } catch (authCheckError) {
          console.error('Error checking authentication status:', authCheckError);
          // Don't show error toast as the main authentication might have succeeded
        }
      } else if (accountsResult && accountsResult.error) {
        console.warn('Failed to refresh authenticated accounts:', accountsResult.error);
        if (accountsResult.error.includes('fetch')) {
          toast.error('Unable to verify authentication status. Please check your connection.');
        }
      }
    } catch (error) {
      console.error('Error refreshing authentication status:', error);
      if (error.message && error.message.includes('fetch')) {
        toast.error('Unable to connect to authentication service. Please try again.');
      }
    } finally {
      console.log('Authentication status refresh completed for platform:', platform);
    }
  };

  // Retry handler for failed verifications
  const handleRetryVerification = async (taskId) => {
    const task = socialTasks.find(t => t.id === taskId);
    if (!task) return;

    // Set task status to verifying
    setTaskStatuses(prev => ({
      ...prev,
      [taskId]: { status: 'verifying', timestamp: Date.now() }
    }));

    setRetryingTasks(prev => new Set([...prev, taskId]));
    
    try {
      // Trigger verification through the service
      let verificationResult;
      
      switch (task.platform?.toLowerCase()) {
        case 'twitter':
          verificationResult = await verificationService.verifyTwitterTask(
            userAddress, 
            raffle.address, 
            task.type || task.action, 
            task.data || { target: task.target }
          );
          break;
        case 'discord':
          verificationResult = await verificationService.verifyDiscordTask(
            userAddress, 
            raffle.address, 
            task.type || task.action, 
            task.data || { target: task.target }
          );
          break;
        case 'telegram':
          verificationResult = await verificationService.verifyTelegramTask(
            userAddress, 
            raffle.address, 
            task.type || task.action, 
            task.data || { target: task.target }
          );
          break;
        default:
          throw new Error(`Unsupported platform: ${task.platform}`);
      }

      if (verificationResult.success) {
        setTaskStatuses(prev => ({
          ...prev,
          [taskId]: { status: 'completed', timestamp: Date.now() }
        }));
        toast.success('Task verified successfully!');
        loadUserData();
      } else {
        setTaskStatuses(prev => ({
          ...prev,
          [taskId]: { status: 'failed', error: verificationResult.error, timestamp: Date.now() }
        }));
        toast.error(verificationResult.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Retry verification error:', error);
      setTaskStatuses(prev => ({
        ...prev,
        [taskId]: { status: 'failed', error: error.message, timestamp: Date.now() }
      }));
      toast.error('Failed to retry verification');
    } finally {
      setRetryingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const handleTaskComplete = async (taskId, proofData) => {
    if (!connected || !userAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    setSubmittingProof(true);
    try {
      // Find the task
      const task = socialTasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Handle Supabase-verified task completion
      if (typeof proofData === 'object' && proofData.verified) {
        setCompletedTasks(prev => new Set([...prev, taskId]));
        
        // Refresh verification records with error handling
        try {
          await loadUserData();
        } catch (loadError) {
          console.warn('Failed to refresh user data after task completion:', loadError);
          // Don't fail the entire operation if refresh fails
        }
        
        // Check if all tasks are now completed
        const allCompleted = socialTasks.every(task => 
          completedTasks.has(task.id) || task.id === taskId
        );
        
        if (allCompleted && onVerificationComplete) {
          onVerificationComplete();
        }
        
        toast.success('Task verification completed!');
        return;
      }
    } catch (error) {
      console.error('Error completing task:', error);
      
      // Provide specific error messages based on error type
      if (error.message && error.message.includes('fetch')) {
        toast.error('Unable to connect to verification service. Please check your connection and try again.');
      } else if (error.message && error.message.includes('Task not found')) {
        toast.error('Task not found. Please refresh the page and try again.');
      } else {
        toast.error('Failed to complete task. Please try again.');
      }
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleVerifyCompletion = async () => {
    if (!connected || !userAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    setVerifying(true);
    try {
      // Check if all tasks are verified in Supabase
      let supabaseVerification;
      try {
        supabaseVerification = await verificationService.checkAllTasksVerified(userAddress, raffle.address);
      } catch (verificationError) {
        console.error('Error checking Supabase verification:', verificationError);
        if (verificationError.message && verificationError.message.includes('fetch')) {
          toast.error('Unable to connect to verification service. Please check your connection and try again.');
          return;
        }
        throw verificationError;
      }
      
      if (!supabaseVerification.success) {
        toast.error('Please complete all social media tasks first');
        return;
      }

      // All tasks verified - verification is complete!
      // The signature will be generated automatically when user attempts to purchase slots
      toast.success('All social media tasks completed! You can now purchase slots.');
      
      if (onVerificationComplete) {
        onVerificationComplete();
      }
    } catch (error) {
      console.error('Error verifying engagement:', error);
      
      // Provide specific error messages
      if (error.message && error.message.includes('fetch')) {
        toast.error('Connection failed. Please check your internet connection and try again.');
      } else {
        toast.error('Verification failed. Please ensure all tasks are completed.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnectAccount = async (platform) => {
    try {
      const result = await socialAuthService.disconnectAccount(userAddress, platform);
      if (result.success) {
        setAuthenticatedAccounts(prev => {
          const updated = { ...prev };
          delete updated[platform];
          return updated;
        });
        toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} account disconnected`);
      } else {
        // Handle specific error cases
        if (result.error && result.error.includes('fetch')) {
          toast.error('Unable to connect to authentication service. Please check your connection and try again.');
        } else {
          toast.error(result.error || 'Failed to disconnect account');
        }
      }
    } catch (error) {
      console.error('Error disconnecting account:', error);
      
      // Provide specific error messages
      if (error.message && error.message.includes('fetch')) {
        toast.error('Connection failed. Please check your internet connection and try again.');
      } else {
        toast.error('Failed to disconnect account. Please try again.');
      }
    }
  };

  // Don't render if social engagement is not required
  if (!socialEngagementRequired) {
    return null;
  }

  // Don't render if user has already completed verification
  if (hasCompletedSocialEngagement) {
    return (
      <Card className="detail-beige-card bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-foreground">
                Social Media Tasks Completed
              </h3>
              <p className="text-sm text-muted-foreground">
                You have successfully completed all required social media tasks for this raffle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="detail-beige-card bg-card/80 text-foreground backdrop-blur-sm border border-border">
      <CardHeader className={isExpanded ? "pb-1" : "py-3"}>
        <CardTitle 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-medium">Complete the following social media tasks to participate in this raffle</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className={isExpanded ? "pt-2 space-y-3" : "hidden"}>

        {isExpanded && (
          <>
            {/* Connected Accounts Summary */}
            {Object.keys(authenticatedAccounts).length > 0 && (
              <div className="border border-border rounded-lg p-3">
                <h4 className="text-sm font-medium text-foreground mb-2">Connected Accounts:</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(authenticatedAccounts).map(([platform, account]) => (
                    <div key={platform} className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full px-3 py-1 text-xs">
                      <Shield className="h-3 w-3 text-green-600" />
                      <span className="text-muted-foreground">{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                      <span className="text-muted-foreground">@{account.platform_username}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnectAccount(platform)}
                        className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading verification data...</p>
              </div>
            )}

            {/* Progress Indicator - moved above task cards */}
            {socialTasks.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">
                    Progress: {completedTasks.size} of {socialTasks.length} tasks completed
                  </p>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${(completedTasks.size / socialTasks.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {socialTasks.map((task) => (
                <TaskDisplayComponent
                  key={task.id}
                  task={task}
                  onComplete={handleTaskComplete}
                  onAuthenticate={handleAuthentication}
                  isCompleted={completedTasks.has(task.id)}
                  isVerifying={submittingProof}
                  isAuthenticated={(() => {
                    const platform = task.platform?.toLowerCase();
                    const isAuth = platform ? !!authenticatedAccounts[platform] : false;
                    console.log('Task authentication check:', {
                      taskPlatform: task.platform,
                      normalizedPlatform: platform,
                      authenticatedAccounts: Object.keys(authenticatedAccounts),
                      isAuthenticated: isAuth
                    });
                    return isAuth;
                  })()}
                  userAddress={userAddress}
                  raffleId={raffle?.address}
                  taskStatus={taskStatuses[task.id]}
                  onRetry={handleRetryVerification}
                  authenticatedAccounts={authenticatedAccounts}
                />
              ))}
            </div>

          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SocialMediaVerification;
export { TaskDisplayComponent };