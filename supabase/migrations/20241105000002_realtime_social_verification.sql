-- Migration: Real-Time Social Media Verification
-- Description: Enable real-time subscriptions for social media task completion
-- Date: 2024-11-05

-- =====================================================
-- 1. Enable real-time on social_media_verifications
-- =====================================================

-- Enable real-time replication for the table
ALTER PUBLICATION supabase_realtime ADD TABLE social_media_verifications;

-- Create index for efficient real-time queries
CREATE INDEX IF NOT EXISTS idx_social_verifications_user_raffle 
  ON social_media_verifications(user_address, raffle_id, status);

CREATE INDEX IF NOT EXISTS idx_social_verifications_updated 
  ON social_media_verifications(updated_at DESC);

-- =====================================================
-- 2. Create verification_events table for real-time notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS verification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,
  raffle_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'task_completed', 'all_completed', 'verification_ready'
  task_type TEXT, -- 'twitter_follow', 'twitter_like', 'twitter_retweet', 'discord_join'
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable real-time on verification_events
ALTER PUBLICATION supabase_realtime ADD TABLE verification_events;

-- Index for efficient queries
CREATE INDEX idx_verification_events_user_raffle 
  ON verification_events(user_address, raffle_id, created_at DESC);

CREATE INDEX idx_verification_events_created 
  ON verification_events(created_at DESC);

-- Index for cleanup queries (removed WHERE clause with NOW() as it's not immutable)
CREATE INDEX idx_verification_events_cleanup 
  ON verification_events(created_at);

-- =====================================================
-- 3. Create function to broadcast verification events
-- =====================================================

CREATE OR REPLACE FUNCTION broadcast_verification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  all_tasks_completed BOOLEAN;
  completed_count INTEGER;
  total_tasks INTEGER;
BEGIN
  -- Only process completed tasks
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Insert task completion event
    INSERT INTO verification_events (
      user_address,
      raffle_id,
      event_type,
      task_type,
      metadata
    ) VALUES (
      NEW.user_address,
      NEW.raffle_id,
      'task_completed',
      NEW.task_type,
      jsonb_build_object(
        'verification_id', NEW.id,
        'platform', NEW.platform,
        'completed_at', NEW.completed_at
      )
    );
    
    -- Check if all tasks are completed for this user-raffle pair
    SELECT 
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*)
    INTO completed_count, total_tasks
    FROM social_media_verifications
    WHERE user_address = NEW.user_address
      AND raffle_id = NEW.raffle_id;
    
    -- If all tasks completed, broadcast special event
    IF completed_count = total_tasks THEN
      INSERT INTO verification_events (
        user_address,
        raffle_id,
        event_type,
        metadata
      ) VALUES (
        NEW.user_address,
        NEW.raffle_id,
        'all_completed',
        jsonb_build_object(
          'total_tasks', total_tasks,
          'completed_at', NOW()
        )
      );
      
      -- Also broadcast that signature is ready
      INSERT INTO verification_events (
        user_address,
        raffle_id,
        event_type,
        metadata
      ) VALUES (
        NEW.user_address,
        NEW.raffle_id,
        'verification_ready',
        jsonb_build_object(
          'can_purchase', true,
          'ready_at', NOW()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- 4. Create trigger for verification events
-- =====================================================

DROP TRIGGER IF EXISTS trigger_broadcast_verification ON social_media_verifications;

CREATE TRIGGER trigger_broadcast_verification
  AFTER INSERT OR UPDATE ON social_media_verifications
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_verification_event();

-- =====================================================
-- 5. Create function to get verification progress
-- =====================================================

CREATE OR REPLACE FUNCTION get_verification_progress(
  p_user_address TEXT,
  p_raffle_id TEXT
)
RETURNS TABLE(
  total_tasks INTEGER,
  completed_tasks INTEGER,
  pending_tasks INTEGER,
  progress_percentage NUMERIC,
  all_completed BOOLEAN,
  tasks JSONB
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed_tasks,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending_tasks,
    ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC * 100), 2) as progress_percentage,
    (COUNT(*) FILTER (WHERE status = 'completed') = COUNT(*)) as all_completed,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'task_type', task_type,
        'platform', platform,
        'status', status,
        'completed_at', completed_at
      ) ORDER BY created_at
    ) as tasks
  FROM social_media_verifications
  WHERE user_address = p_user_address
    AND raffle_id = p_raffle_id;
END;
$$;

-- =====================================================
-- 6. Create view for real-time verification status
-- =====================================================

CREATE OR REPLACE VIEW verification_status_realtime AS
SELECT 
  smv.user_address,
  smv.raffle_id,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE smv.status = 'completed') as completed_tasks,
  COUNT(*) FILTER (WHERE smv.status = 'pending') as pending_tasks,
  ROUND((COUNT(*) FILTER (WHERE smv.status = 'completed')::NUMERIC / COUNT(*)::NUMERIC * 100), 2) as progress_percentage,
  (COUNT(*) FILTER (WHERE smv.status = 'completed') = COUNT(*)) as all_completed,
  MAX(smv.updated_at) as last_updated
FROM social_media_verifications smv
GROUP BY smv.user_address, smv.raffle_id;

-- Note: Views cannot be added to real-time publications
-- Real-time updates will come from the underlying social_media_verifications table

-- =====================================================
-- 7. Grant permissions
-- =====================================================

GRANT SELECT ON verification_events TO authenticated;
GRANT SELECT ON verification_status_realtime TO authenticated;
GRANT EXECUTE ON FUNCTION get_verification_progress TO authenticated;

-- =====================================================
-- 8. Row Level Security for verification_events
-- =====================================================

ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own verification events
CREATE POLICY "Users can view own verification events"
  ON verification_events
  FOR SELECT
  TO authenticated
  USING (user_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Service role can insert events
CREATE POLICY "Service role can insert verification events"
  ON verification_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- 9. Create cleanup function for old events
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_verification_events()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM verification_events
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Add to cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_records(
  signature_retention_hours INTEGER DEFAULT 24,
  nonce_retention_days INTEGER DEFAULT 90,
  verification_retention_days INTEGER DEFAULT 180,
  event_retention_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  signatures_deleted INTEGER,
  nonces_deleted INTEGER,
  verifications_deleted INTEGER,
  events_deleted INTEGER,
  total_deleted INTEGER
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  sig_count INTEGER;
  nonce_count INTEGER;
  verify_count INTEGER;
  event_count INTEGER;
BEGIN
  -- Clean expired purchase signatures
  DELETE FROM purchase_signatures
  WHERE expires_at < NOW()
    OR created_at < NOW() - (signature_retention_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS sig_count = ROW_COUNT;

  -- Clean stale user nonces
  DELETE FROM user_nonces
  WHERE updated_at < NOW() - (nonce_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS nonce_count = ROW_COUNT;

  -- Clean old social media verifications
  DELETE FROM social_media_verifications
  WHERE created_at < NOW() - (verification_retention_days || ' days')::INTERVAL
    AND status = 'completed';
  GET DIAGNOSTICS verify_count = ROW_COUNT;

  -- Clean old verification events
  DELETE FROM verification_events
  WHERE created_at < NOW() - (event_retention_hours || ' hours')::INTERVAL;
  GET DIAGNOSTICS event_count = ROW_COUNT;

  -- Return statistics
  RETURN QUERY SELECT 
    sig_count,
    nonce_count,
    verify_count,
    event_count,
    sig_count + nonce_count + verify_count + event_count;
END;
$$;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE verification_events IS 'Real-time events for social media verification progress';
COMMENT ON FUNCTION broadcast_verification_event IS 'Automatically broadcasts verification events when tasks are completed';
COMMENT ON FUNCTION get_verification_progress IS 'Get detailed verification progress for a user-raffle pair';
COMMENT ON VIEW verification_status_realtime IS 'Real-time view of verification status for all user-raffle pairs';
