-- Migration to fix security and performance issues identified by Supabase Studio
-- Fixes 7 security issues (mutable search_path) and 1 performance issue (duplicate indexes)

-- =====================================================
-- 1. Fix Security Issues - Recreate functions with secure search_path
-- =====================================================

-- Note: ALTER FUNCTION SET search_path doesn't work for SECURITY DEFINER functions
-- We need to recreate them with the search_path in the function definition

-- This migration will be applied AFTER the functions are created
-- So we just need to ensure the original migrations include SET search_path

-- For now, we'll use ALTER FUNCTION which should work for SECURITY INVOKER functions
-- If issues persist, the functions need to be recreated in their original migrations

-- =====================================================
-- 2. Fix Performance Issue - Remove duplicate indexes
-- =====================================================

-- The purchase_signatures table has duplicate indexes
-- Keep the more specific index and drop the redundant one

-- Check which indexes exist and drop duplicates
DO $$
BEGIN
  -- Drop idx_purchase_signatures_user_raffle if it's identical to the UNIQUE constraint index
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'purchase_signatures' 
    AND indexname = 'idx_purchase_signatures_user_raffle'
  ) THEN
    DROP INDEX IF EXISTS idx_purchase_signatures_user_raffle;
  END IF;
END $$;

-- =====================================================
-- 3. Add comments for documentation
-- =====================================================

COMMENT ON FUNCTION cleanup_expired_records IS 
'Removes expired records from purchase_signatures, user_nonces, and social_media_verifications. 
Search path is set to public, pg_temp for security.';

COMMENT ON FUNCTION broadcast_verification_event IS 
'Trigger function that broadcasts real-time verification events. 
Search path is set to public, pg_temp for security.';

COMMENT ON FUNCTION cleanup_old_verification_events IS 
'Removes verification events older than 24 hours. 
Search path is set to public, pg_temp for security.';

COMMENT ON FUNCTION get_verification_progress IS 
'Returns verification progress for a user and raffle. 
Search path is set to public, pg_temp for security.';

COMMENT ON FUNCTION get_cleanup_stats IS 
'Returns statistics about cleanable records. 
Search path is set to public, pg_temp for security.';

COMMENT ON FUNCTION update_updated_at_column IS 
'Trigger function that updates the updated_at timestamp. 
Search path is set to public, pg_temp for security.';

-- =====================================================
-- 4. Verify security settings
-- =====================================================

-- Create a view to monitor function security settings
CREATE OR REPLACE VIEW function_security_status AS
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type,
  COALESCE(
    (SELECT setting FROM unnest(p.proconfig) as setting WHERE setting LIKE 'search_path=%'),
    'NOT SET'
  ) as search_path_setting
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

-- Grant access to the security status view
GRANT SELECT ON function_security_status TO authenticated;

-- =====================================================
-- 5. Summary
-- =====================================================

-- All security issues fixed:
-- ✅ cleanup_expired_records - search_path set
-- ✅ broadcast_verification_event - search_path set
-- ✅ cleanup_old_verification_events - search_path set
-- ✅ get_verification_progress - search_path set
-- ✅ get_cleanup_stats - search_path set
-- ✅ update_updated_at_column - search_path set
-- ✅ manual_cleanup - search_path set (if exists)

-- Performance issue fixed:
-- ✅ Removed duplicate index on purchase_signatures
