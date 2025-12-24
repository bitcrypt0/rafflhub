import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if we're in development mode with placeholder values
const isPlaceholderConfig = supabaseUrl === 'https://your-project-id.supabase.co' || 
                          supabaseAnonKey === 'your-supabase-anon-key';

// Create Supabase client or mock client
export const supabase = !supabaseUrl || !supabaseAnonKey ? 
  // Mock client that won't crash the app
  {
    from: () => {
      const mockQuery = {
        select: () => mockQuery,
        eq: () => mockQuery,
        order: () => mockQuery,
        limit: () => mockQuery,
        gt: () => mockQuery,
        lt: () => mockQuery,
        maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        then: (resolve) => resolve({ data: [], error: { message: 'Supabase not configured' } })
      };
      
      return {
        select: () => mockQuery,
        eq: () => mockQuery,
        upsert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
          })
        }),
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
        }),
        delete: () => ({
          eq: () => mockQuery,
          lt: () => ({
            select: () => Promise.resolve({ data: [], error: { message: 'Supabase not configured' } })
          })
        }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
      };
    },
    auth: { 
      getSession: () => ({ session: null, error: { message: 'Supabase not configured' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    functions: { invoke: () => ({ data: null, error: { message: 'Supabase not configured' } }) },
    realtime: { channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }) }
  } :
  // Real Supabase client
  createClient(supabaseUrl, supabaseAnonKey, {
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

// Log warnings/errors for configuration issues
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables. Please check your Vercel environment variables.');
} else if (isPlaceholderConfig) {
  console.warn('⚠️ Using placeholder Supabase configuration. Social media features will be limited until you configure your actual Supabase project.');
}

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
    // Check if we're using placeholder or missing configuration
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`❌ Cannot call edge function '${functionName}' - missing Supabase environment variables.`);
      return { 
        data: null, 
        error: { message: 'Supabase not configured. Please set up your environment variables in Vercel.' }
      };
    }
    
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
    // Check if we're using placeholder or missing configuration
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Cannot get session - missing Supabase environment variables.');
      return { 
        session: null, 
        error: { message: 'Supabase not configured. Please set up your environment variables in Vercel.' }
      };
    }
    
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