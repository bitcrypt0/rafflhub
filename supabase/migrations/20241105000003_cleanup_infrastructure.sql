-- Migration: Database Cleanup Infrastructure
-- Description: Creates tables and functions for automated cleanup of expired records
-- Date: 2024-11-05

-- =====================================================
-- 1. Create cleanup_logs table for monitoring
-- =====================================================
CREATE TABLE IF NOT EXISTS cleanup_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cleanup_type TEXT NOT NULL, -- 'scheduled', 'manual', 'emergency'
  stats JSONB NOT NULL, -- Cleanup statistics
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying recent cleanup runs
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_executed_at ON cleanup_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_type ON cleanup_logs(cleanup_type);

-- =====================================================
-- 2. Add updated_at to user_nonces if not exists
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_nonces' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE user_nonces ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- =====================================================
-- 3. Create trigger to auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_user_nonces_updated_at ON user_nonces;
CREATE TRIGGER update_user_nonces_updated_at
  BEFORE UPDATE ON user_nonces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. Create efficient cleanup function
-- =====================================================

-- Drop existing function if it exists (handles any signature)
DROP FUNCTION IF EXISTS cleanup_expired_records CASCADE;

CREATE OR REPLACE FUNCTION cleanup_expired_records(
  signature_retention_hours INTEGER DEFAULT 24,
  nonce_retention_days INTEGER DEFAULT 90,
  verification_retention_days INTEGER DEFAULT 180
)
RETURNS TABLE(
  signatures_deleted INTEGER,
  nonces_deleted INTEGER,
  verifications_deleted INTEGER,
  total_deleted INTEGER
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  sig_count INTEGER;
  nonce_count INTEGER;
  verify_count INTEGER;
BEGIN
  -- Clean expired purchase signatures
  DELETE FROM purchase_signatures
  WHERE expires_at < NOW()
    OR created_at < NOW() - (signature_retention_hours || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS sig_count = ROW_COUNT;

  -- Clean stale user nonces (not updated in X days)
  DELETE FROM user_nonces
  WHERE updated_at < NOW() - (nonce_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS nonce_count = ROW_COUNT;

  -- Clean old social media verifications (completed ones only)
  DELETE FROM social_media_verifications
  WHERE created_at < NOW() - (verification_retention_days || ' days')::INTERVAL
    AND status = 'completed';
  
  GET DIAGNOSTICS verify_count = ROW_COUNT;

  -- Return statistics
  RETURN QUERY SELECT 
    sig_count,
    nonce_count,
    verify_count,
    sig_count + nonce_count + verify_count;
END;
$$;

-- =====================================================
-- 5. Create function to get cleanup statistics
-- =====================================================
CREATE OR REPLACE FUNCTION get_cleanup_stats()
RETURNS TABLE(
  expired_signatures_count BIGINT,
  stale_nonces_count BIGINT,
  old_verifications_count BIGINT,
  total_cleanable_records BIGINT
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM purchase_signatures WHERE expires_at < NOW()) AS expired_signatures_count,
    (SELECT COUNT(*) FROM user_nonces WHERE updated_at < NOW() - INTERVAL '90 days') AS stale_nonces_count,
    (SELECT COUNT(*) FROM social_media_verifications 
     WHERE created_at < NOW() - INTERVAL '180 days' AND status = 'completed') AS old_verifications_count,
    (SELECT COUNT(*) FROM purchase_signatures WHERE expires_at < NOW()) +
    (SELECT COUNT(*) FROM user_nonces WHERE updated_at < NOW() - INTERVAL '90 days') +
    (SELECT COUNT(*) FROM social_media_verifications 
     WHERE created_at < NOW() - INTERVAL '180 days' AND status = 'completed') AS total_cleanable_records;
END;
$$;

-- =====================================================
-- 6. Create indexes for efficient cleanup queries
-- =====================================================

-- Index on purchase_signatures for cleanup (removed WHERE clause with NOW())
CREATE INDEX IF NOT EXISTS idx_purchase_signatures_expires_at 
  ON purchase_signatures(expires_at);

CREATE INDEX IF NOT EXISTS idx_purchase_signatures_created_at 
  ON purchase_signatures(created_at);

-- Index on user_nonces for cleanup
CREATE INDEX IF NOT EXISTS idx_user_nonces_updated_at 
  ON user_nonces(updated_at);

-- Index on social_media_verifications for cleanup
CREATE INDEX IF NOT EXISTS idx_social_verifications_cleanup 
  ON social_media_verifications(created_at, status)
  WHERE status = 'completed';

-- =====================================================
-- 7. Grant necessary permissions
-- =====================================================

-- Grant execute permissions on cleanup functions
GRANT EXECUTE ON FUNCTION cleanup_expired_records(INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_cleanup_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_cleanup_stats() TO authenticated;

-- Grant access to cleanup_logs
GRANT SELECT ON cleanup_logs TO authenticated;
GRANT ALL ON cleanup_logs TO service_role;

-- =====================================================
-- 8. Create view for cleanup monitoring dashboard
-- =====================================================
CREATE OR REPLACE VIEW cleanup_monitoring AS
SELECT 
  cl.id,
  cl.cleanup_type,
  cl.executed_at,
  cl.execution_time_ms,
  (cl.stats->>'signatures_deleted')::INTEGER as signatures_deleted,
  (cl.stats->>'old_nonces_deleted')::INTEGER as nonces_deleted,
  (cl.stats->>'old_verifications_deleted')::INTEGER as verifications_deleted,
  (cl.stats->>'total_deleted')::INTEGER as total_deleted,
  cl.error_message
FROM cleanup_logs cl
ORDER BY cl.executed_at DESC;

GRANT SELECT ON cleanup_monitoring TO authenticated;

-- =====================================================
-- 9. Insert initial cleanup log entry
-- =====================================================
INSERT INTO cleanup_logs (cleanup_type, stats, executed_at, execution_time_ms)
VALUES (
  'initialization',
  '{"signatures_deleted": 0, "old_nonces_deleted": 0, "old_verifications_deleted": 0, "total_deleted": 0}'::JSONB,
  NOW(),
  0
);

-- =====================================================
-- 10. Create manual cleanup procedure
-- =====================================================
CREATE OR REPLACE FUNCTION manual_cleanup()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  stats JSONB
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cleanup_result RECORD;
  start_time TIMESTAMP;
  end_time TIMESTAMP;
BEGIN
  start_time := clock_timestamp();
  
  -- Execute cleanup
  SELECT * INTO cleanup_result FROM cleanup_expired_records();
  
  end_time := clock_timestamp();
  
  -- Log the cleanup
  INSERT INTO cleanup_logs (cleanup_type, stats, executed_at, execution_time_ms)
  VALUES (
    'manual',
    jsonb_build_object(
      'signatures_deleted', cleanup_result.signatures_deleted,
      'old_nonces_deleted', cleanup_result.nonces_deleted,
      'old_verifications_deleted', cleanup_result.verifications_deleted,
      'total_deleted', cleanup_result.total_deleted
    ),
    NOW(),
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER
  );
  
  -- Return result
  RETURN QUERY SELECT 
    TRUE as success,
    format('Cleaned up %s records in %s ms', 
           cleanup_result.total_deleted,
           EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER
    ) as message,
    jsonb_build_object(
      'signatures_deleted', cleanup_result.signatures_deleted,
      'nonces_deleted', cleanup_result.nonces_deleted,
      'verifications_deleted', cleanup_result.verifications_deleted,
      'total_deleted', cleanup_result.total_deleted,
      'execution_time_ms', EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER
    ) as stats;
END;
$$;

GRANT EXECUTE ON FUNCTION manual_cleanup TO service_role;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE cleanup_logs IS 'Tracks all database cleanup operations for monitoring and auditing';
COMMENT ON FUNCTION cleanup_expired_records IS 'Removes expired records from purchase_signatures, user_nonces, and social_media_verifications';
COMMENT ON FUNCTION get_cleanup_stats IS 'Returns count of records eligible for cleanup without deleting them';
COMMENT ON FUNCTION manual_cleanup IS 'Manually trigger cleanup and return statistics';
COMMENT ON VIEW cleanup_monitoring IS 'Formatted view of cleanup logs for monitoring dashboard';
