-- Fix search_path security issues properly
-- The previous approach didn't work because we need to use ALTER FUNCTION after creation

-- =====================================================
-- Fix all functions with proper search_path setting
-- =====================================================

-- 1. update_updated_at_column
ALTER FUNCTION update_updated_at_column() SET search_path = 'public', 'pg_temp';

-- 2. broadcast_verification_event
ALTER FUNCTION broadcast_verification_event() SET search_path = 'public', 'pg_temp';

-- 3. cleanup_old_verification_events
ALTER FUNCTION cleanup_old_verification_events() SET search_path = 'public', 'pg_temp';

-- 4. get_verification_progress
ALTER FUNCTION get_verification_progress(TEXT, TEXT) SET search_path = 'public', 'pg_temp';

-- 5. cleanup_expired_records (multiple signatures exist, fix all)
DO $$
DECLARE
    func_signature text;
BEGIN
    -- Find all cleanup_expired_records function signatures
    FOR func_signature IN 
        SELECT pg_get_function_identity_arguments(oid)
        FROM pg_proc
        WHERE proname = 'cleanup_expired_records'
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE format('ALTER FUNCTION cleanup_expired_records(%s) SET search_path = ''public'', ''pg_temp''', func_signature);
    END LOOP;
END $$;

-- 6. get_cleanup_stats
ALTER FUNCTION get_cleanup_stats() SET search_path = 'public', 'pg_temp';

-- 7. manual_cleanup
ALTER FUNCTION manual_cleanup() SET search_path = 'public', 'pg_temp';

-- =====================================================
-- Verify the fixes
-- =====================================================

-- Create a verification view
CREATE OR REPLACE VIEW function_search_path_status AS
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    CASE 
        WHEN array_to_string(p.proconfig, ', ') LIKE '%search_path%' 
        THEN array_to_string(p.proconfig, ', ')
        ELSE 'NOT SET'
    END as search_path_config,
    CASE 
        WHEN array_to_string(p.proconfig, ', ') LIKE '%search_path%' 
        THEN 'SECURED'
        ELSE 'VULNERABLE'
    END as security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname IN (
    'update_updated_at_column',
    'broadcast_verification_event',
    'cleanup_old_verification_events',
    'get_verification_progress',
    'cleanup_expired_records',
    'get_cleanup_stats',
    'manual_cleanup'
  )
ORDER BY p.proname;

-- Grant access to view
GRANT SELECT ON function_search_path_status TO authenticated;

-- =====================================================
-- Summary
-- =====================================================

-- All 7 functions should now have search_path set to 'public, pg_temp'
-- Run: SELECT * FROM function_search_path_status;
-- All should show security_status = 'SECURED'
