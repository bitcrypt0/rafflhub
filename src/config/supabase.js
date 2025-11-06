import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we're in development mode with placeholder values
const isPlaceholderConfig = supabaseUrl === 'https://your-project-id.supabase.co' || 
                           supabaseAnonKey === 'your-supabase-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

if (isPlaceholderConfig) {
  console.warn('⚠️ Using placeholder Supabase configuration. Social media features will be limited until you configure your actual Supabase project.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Database table names
export const TABLES = {
  USER_SOCIAL_ACCOUNTS: 'user_social_accounts',
  VERIFICATION_RECORDS: 'social_media_verifications',
  PURCHASE_SIGNATURES: 'purchase_signatures'
};

// Social media platforms
export const PLATFORMS = {
  TWITTER: 'twitter',
  DISCORD: 'discord',
  TELEGRAM: 'telegram'
};

// Verification statuses
export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired'
};

// Task types
export const TASK_TYPES = {
  TWITTER_LIKE: 'twitter_like',
  TWITTER_RETWEET: 'twitter_retweet',
  TWITTER_FOLLOW: 'twitter_follow',
  TWITTER_MENTION: 'twitter_mention',
  TWITTER_COMMENT: 'twitter_comment',
  DISCORD_JOIN: 'discord_join',
  DISCORD_ROLE: 'discord_role',
  TELEGRAM_JOIN: 'telegram_join'
};

// Edge function endpoints
export const EDGE_FUNCTIONS = {
  VERIFY_TWITTER: 'verify-twitter',
  VERIFY_DISCORD: 'verify-discord',
  VERIFY_TELEGRAM: 'verify-telegram',
  GENERATE_SIGNATURE: 'generate-signature',
  OAUTH_TWITTER: 'oauth-twitter',
  OAUTH_DISCORD: 'oauth-discord'
};

// Helper function to call edge functions
export const callEdgeFunction = async (functionName, payload = {}) => {
  try {
    // Check if we're using placeholder configuration
    if (isPlaceholderConfig) {
      console.warn(`⚠️ Cannot call edge function '${functionName}' with placeholder Supabase configuration.`);
      return { 
        data: null, 
        error: { message: 'Supabase not configured. Please set up your Supabase project credentials.' }
      };
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error(`Error calling edge function ${functionName}:`, error);
    return { data: null, error };
  }
};

// Helper function to get user session
export const getCurrentSession = async () => {
  try {
    // Check if we're using placeholder configuration
    if (isPlaceholderConfig) {
      console.warn('⚠️ Cannot get session with placeholder Supabase configuration.');
      return { 
        session: null, 
        error: { message: 'Supabase not configured. Please set up your Supabase project credentials.' }
      };
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  } catch (error) {
    console.error('Error getting session:', error);
    return { session: null, error };
  }
};

export default supabase;