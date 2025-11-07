import React, { useState } from 'react';
import { Switch } from './ui/switch';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import { CheckCircle, Twitter, MessageCircle, Send, Plus, Trash2 } from 'lucide-react';
import { useMobileBreakpoints } from '../hooks/useMobileBreakpoints';
import { SOCIAL_TASK_CONSTANTS } from '../constants/socialTasks';

// Maximum number of social media tasks allowed
const MAX_SOCIAL_TASKS = SOCIAL_TASK_CONSTANTS.MAX_TASKS;

const SocialMediaTaskSection = ({
  socialEngagementEnabled,
  onSocialEngagementChange,
  setSocialEngagementEnabled,
  formData,
  handleChange,
  required = false,
  useFormDataEnabled = false
}) => {
  const { isMobile } = useMobileBreakpoints();
  
  // Use either separate state or formData.socialEngagementEnabled
  const isEnabled = useFormDataEnabled ? formData.socialEngagementEnabled : socialEngagementEnabled;
  const handleToggleChange = useFormDataEnabled
    ? (value) => handleChange('socialEngagementEnabled', value)
    : (onSocialEngagementChange || setSocialEngagementEnabled || (() => {
        console.warn('No toggle change handler provided to SocialMediaTaskSection');
      }));

  // Initialize tasks if not present
  const tasks = formData.socialTasks || [];
  
  const addTask = () => {
    // Check if maximum task limit reached
    if (tasks.length >= MAX_SOCIAL_TASKS) {
      console.warn(`Maximum of ${MAX_SOCIAL_TASKS} social media tasks allowed`);
      return;
    }
    
    const newTasks = [...tasks, {
      id: Date.now(),
      platform: 'twitter',
      action: 'follow',
      target: '',
      description: ''
    }];
    handleChange('socialTasks', newTasks);
  };

  const removeTask = (taskId) => {
    const newTasks = tasks.filter(task => task.id !== taskId);
    handleChange('socialTasks', newTasks);
  };

  const updateTask = (taskId, field, value) => {
    const newTasks = tasks.map(task => 
      task.id === taskId ? { ...task, [field]: value } : task
    );
    handleChange('socialTasks', newTasks);
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'twitter':
        return <Twitter className="h-4 w-4" />;
      case 'discord':
        return <MessageCircle className="h-4 w-4" />;
      case 'telegram':
        return <Send className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getActionOptions = (platform) => {
    switch (platform) {
      case 'twitter':
        return [
          { value: 'follow', label: 'Follow Account' },
          { value: 'like', label: 'Like Tweet' },
          { value: 'retweet', label: 'Retweet' },
          { value: 'comment', label: 'Comment on Tweet' },
          { value: 'quote', label: 'Quote Tweet' }
        ];
      case 'discord':
        return [
          { value: 'join', label: 'Join Server' },
          { value: 'react', label: 'React to Message' }
        ];
      case 'telegram':
        return [
          { value: 'join', label: 'Join Channel/Group' },
          { value: 'follow', label: 'Follow Channel' }
        ];
      default:
        return [];
    }
  };

  // Generate task description for smart contract
  const generateTaskDescription = () => {
    if (tasks.length === 0) return '';
    
    const descriptions = tasks.map(task => {
      const actionText = getActionOptions(task.platform).find(opt => opt.value === task.action)?.label || task.action;
      return `${task.platform.toUpperCase()}: ${actionText} - ${task.target}`;
    });
    
    return descriptions.join(SOCIAL_TASK_CONSTANTS.TASK_SEPARATOR);
  };
  
  // Validate task description against smart contract limits
  const validateTaskDescription = (description) => {
    if (!description) return true;
    
    // Check length limit (matching smart contract)
    if (description.length > SOCIAL_TASK_CONSTANTS.MAX_DESCRIPTION_LENGTH) {
      console.warn(`Task description too long (max ${SOCIAL_TASK_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters)`);
      return false;
    }
    
    // Count tasks to ensure we don't exceed limit
    const taskCount = description.split(SOCIAL_TASK_CONSTANTS.TASK_SEPARATOR).length;
    if (taskCount > SOCIAL_TASK_CONSTANTS.MAX_TASKS) {
      console.warn(`Too many tasks (${taskCount}/${SOCIAL_TASK_CONSTANTS.MAX_TASKS})`);
      return false;
    }
    
    return true;
  };

  // Update the contract description whenever tasks change
  React.useEffect(() => {
    if (isEnabled) {
      const description = generateTaskDescription();
      if (validateTaskDescription(description)) {
        handleChange('socialTaskDescription', description);
      } else {
        console.warn('Generated task description failed validation');
        // Don't update if validation fails
      }
    } else {
      handleChange('socialTaskDescription', '');
    }
  }, [tasks, isEnabled]);

  return (
    <>
      {/* Social Media Task Toggle */}
      {isMobile ? (
        <div className="p-4 bg-card/50 rounded-xl border border-border/50 mb-4 shadow-sm">
          <div
            className="flex items-center justify-between gap-4 cursor-pointer select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-muted/10 active:bg-muted/20 rounded-lg p-1 -m-1"
            onClick={() => handleToggleChange(!isEnabled)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleChange(!isEnabled);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${isEnabled ? 'Disable' : 'Enable'} social media tasks`}
          >
            <div className="flex-1">
              <label className="font-medium block cursor-pointer text-base mb-1">
                Enable Social Media Tasks
              </label>
              <p className="text-xs text-muted-foreground">
                Require participants to complete social media engagement tasks
              </p>
            </div>
            <CheckCircle
              className={`h-6 w-6 transition-colors duration-200 ${
                isEnabled
                  ? 'text-green-600'
                  : 'text-muted-foreground/40'
              }`}
            />
          </div>
        </div>
      ) : (
        <div className="mb-2">
          <div className="flex items-center gap-3">
            <Switch
              checked={isEnabled}
              onCheckedChange={handleToggleChange}
              size="default"
            />
            <div
              className="flex-1 cursor-pointer select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:text-foreground/80 active:text-foreground"
              onClick={() => handleToggleChange(!isEnabled)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleChange(!isEnabled);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${isEnabled ? 'Disable' : 'Enable'} social media tasks`}
            >
              <label className="font-medium block cursor-pointer text-sm">
                Enable Social Media Tasks
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Social Media Task Configuration */}
      {isEnabled && (
        <div className={`p-4 border rounded-lg bg-muted/10 mb-4`}>
          <div className="space-y-4">
            {/* Task List */}
            {tasks.map((task, index) => (
              <div key={task.id} className="p-3 border rounded-lg bg-background/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(task.platform)}
                    <span className="font-medium text-sm">Task {index + 1}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className={`${isMobile ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-3 gap-3'}`}>
                  {/* Platform Selection */}
                  <div>
                    <label className="block font-medium mb-1 text-sm">
                      Platform
                    </label>
                    <Select
                      value={task.platform}
                      onValueChange={(value) => updateTask(task.id, 'platform', value)}
                    >
                      <SelectTrigger className={`w-full border border-border rounded-lg bg-background ${
                        isMobile ? 'px-3 py-2 text-base h-10' : 'px-3 py-2 text-sm'
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twitter">
                          <div className="flex items-center gap-2">
                            <Twitter className="h-4 w-4" />
                            Twitter
                          </div>
                        </SelectItem>
                        <SelectItem value="discord">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4" />
                            Discord
                          </div>
                        </SelectItem>
                        <SelectItem value="telegram">
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4" />
                            Telegram
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Selection */}
                  <div>
                    <label className="block font-medium mb-1 text-sm">
                      Action
                    </label>
                    <Select
                      value={task.action}
                      onValueChange={(value) => updateTask(task.id, 'action', value)}
                    >
                      <SelectTrigger className={`w-full border border-border rounded-lg bg-background ${
                        isMobile ? 'px-3 py-2 text-base h-10' : 'px-3 py-2 text-sm'
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getActionOptions(task.platform).map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target Input */}
                  <div>
                    <label className="block font-medium mb-1 text-sm">
                      Target
                    </label>
                    <input
                      type="text"
                      value={task.target}
                      onChange={(e) => updateTask(task.id, 'target', e.target.value)}
                      className={`w-full border border-border rounded-lg bg-background ${
                        isMobile ? 'px-3 py-2 text-base' : 'px-3 py-2 text-sm'
                      }`}
                      placeholder={
                        task.platform === 'twitter' 
                          ? '@username or tweet URL'
                          : task.platform === 'discord'
                          ? 'Server invite or message URL'
                          : 'Channel username or URL'
                      }
                      required={required && isEnabled}
                    />
                  </div>
                </div>

                {/* Task Description */}
                <div className="mt-3">
                  <label className="block font-medium mb-1 text-sm">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={task.description}
                    onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                    className={`w-full border border-border rounded-lg bg-background ${
                      isMobile ? 'px-3 py-2 text-base' : 'px-3 py-2 text-sm'
                    }`}
                    placeholder="Additional instructions for participants"
                  />
                </div>
              </div>
            ))}

            {/* Add Task Button */}
            <button
              type="button"
              onClick={addTask}
              disabled={tasks.length >= MAX_SOCIAL_TASKS}
              className={`w-full p-3 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 transition-colors ${
                tasks.length >= MAX_SOCIAL_TASKS
                  ? 'border-border/50 bg-muted/10 text-muted-foreground/50 cursor-not-allowed'
                  : 'border-border hover:border-primary/50 hover:bg-muted/20 text-muted-foreground hover:text-foreground cursor-pointer'
              }`}
            >
              <Plus className="h-4 w-4" />
              {tasks.length >= MAX_SOCIAL_TASKS 
                ? `Maximum ${MAX_SOCIAL_TASKS} tasks reached`
                : `Add Social Media Task (${tasks.length}/${MAX_SOCIAL_TASKS})`
              }
            </button>

            {/* Task Summary */}
            {tasks.length > 0 && (
              <div className="mt-4 p-3 bg-muted/20 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Task Summary:</h4>
                <p className="text-xs text-muted-foreground">
                  {generateTaskDescription() || 'No tasks configured'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SocialMediaTaskSection;