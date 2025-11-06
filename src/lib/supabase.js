import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
} else {
  try {
    // Create Supabase client with disabled analytics to avoid Sentry issues
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      // Disable analytics that might trigger Sentry
      global: {
        headers: {
          'X-Client-Info': 'raffle-protocol-frontend',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    });
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    supabase = null;
  }
}

export { supabase }; 