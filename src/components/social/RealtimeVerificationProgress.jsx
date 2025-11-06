import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, Loader, Zap } from 'lucide-react';
import { realtimeVerificationService } from '../../services/realtimeVerificationService';
import { toast } from '../ui/sonner';

/**
 * Real-Time Verification Progress Component
 * Shows live updates as user completes social media tasks
 */
const RealtimeVerificationProgress = ({ userAddress, raffleId, onAllCompleted }) => {
  const [progress, setProgress] = useState({
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    progress_percentage: 0,
    all_completed: false,
    tasks: []
  });
  const [loading, setLoading] = useState(true);
  const [recentEvent, setRecentEvent] = useState(null);

  // Fetch initial progress
  const fetchProgress = useCallback(async () => {
    if (!userAddress || !raffleId) return;

    const result = await realtimeVerificationService.getVerificationProgress(
      userAddress,
      raffleId
    );

    if (result.success) {
      setProgress(result.data);
    }
    setLoading(false);
  }, [userAddress, raffleId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!userAddress || !raffleId) return;

    // Fetch initial data
    fetchProgress();

    // Subscribe to real-time updates
    const unsubscribe = realtimeVerificationService.subscribeToVerification(
      userAddress,
      raffleId,
      {
        onTaskCompleted: (data) => {
          console.log('Task completed:', data);
          
          // Show success notification
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Task completed: {formatTaskType(data.taskType)}</span>
            </div>,
            { duration: 3000 }
          );

          // Set recent event for animation
          setRecentEvent({
            type: 'task_completed',
            taskType: data.taskType,
            timestamp: Date.now()
          });

          // Refresh progress
          fetchProgress();
        },

        onAllTasksCompleted: (data) => {
          console.log('All tasks completed:', data);
          
          // Show celebration notification
          toast.success(
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold">All tasks completed! 🎉</span>
            </div>,
            { duration: 5000 }
          );

          // Refresh progress
          fetchProgress();

          // Notify parent component
          if (onAllCompleted) {
            onAllCompleted(data);
          }
        },

        onVerificationReady: (data) => {
          console.log('Verification ready:', data);
          
          toast.success(
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>You can now purchase slots!</span>
            </div>,
            { duration: 4000 }
          );
        },

        onUpdate: (event) => {
          console.log('Verification update:', event);
        }
      }
    );

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [userAddress, raffleId, fetchProgress, onAllCompleted]);

  // Clear recent event after animation
  useEffect(() => {
    if (recentEvent) {
      const timer = setTimeout(() => {
        setRecentEvent(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [recentEvent]);

  const formatTaskType = (taskType) => {
    const taskNames = {
      twitter_follow: 'Twitter Follow',
      twitter_like: 'Twitter Like',
      twitter_retweet: 'Twitter Retweet',
      discord_join: 'Discord Join'
    };
    return taskNames[taskType] || taskType;
  };

  const getTaskIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading verification status...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Social Media Verification
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-700">Live</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Progress: {progress.completed_tasks} / {progress.total_tasks} tasks
          </span>
          <span className="text-sm font-semibold text-blue-600">
            {progress.progress_percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.progress_percentage}%` }}
          />
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {progress.tasks && progress.tasks.length > 0 ? (
          progress.tasks.map((task, index) => (
            <div
              key={task.id || index}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                task.status === 'completed'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              } ${
                recentEvent?.taskType === task.task_type
                  ? 'ring-2 ring-green-400 animate-pulse'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {getTaskIcon(task.status)}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatTaskType(task.task_type)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {task.platform || 'Social Media'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {task.status === 'completed' ? (
                  <span className="text-xs font-medium text-green-600">
                    Completed ✓
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">Pending</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">
            No tasks available
          </div>
        )}
      </div>

      {/* Completion Status */}
      {progress.all_completed && (
        <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">
                All Tasks Completed! 🎉
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">
                You can now purchase slots for this raffle
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Real-time indicator */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Updates automatically when you complete tasks
        </p>
      </div>
    </div>
  );
};

export default RealtimeVerificationProgress;
