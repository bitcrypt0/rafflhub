// Supabase Cron Job Configuration for Database Cleanup
// This file defines the scheduled cleanup jobs

export const cleanupSchedule = {
  // Run cleanup every hour
  hourly: {
    schedule: '0 * * * *', // Every hour at minute 0
    function: 'cleanup-expired-records',
    description: 'Clean up expired signatures and stale records every hour'
  },
  
  // Run deep cleanup daily at 2 AM UTC
  daily: {
    schedule: '0 2 * * *', // Every day at 2:00 AM UTC
    function: 'cleanup-expired-records',
    description: 'Daily deep cleanup of old records'
  },
  
  // Run weekly cleanup on Sundays at 3 AM UTC
  weekly: {
    schedule: '0 3 * * 0', // Every Sunday at 3:00 AM UTC
    function: 'cleanup-expired-records',
    description: 'Weekly comprehensive cleanup'
  }
}

// Cron expression format:
// ┌───────────── minute (0 - 59)
// │ ┌───────────── hour (0 - 23)
// │ │ ┌───────────── day of month (1 - 31)
// │ │ │ ┌───────────── month (1 - 12)
// │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
// │ │ │ │ │
// * * * * *
