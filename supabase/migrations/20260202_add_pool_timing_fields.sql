-- Migration: Add pool timing fields for PoolActivated and PoolEnded events
-- Created: 2026-02-02
-- Purpose: Track pool activation and end times for accurate duration calculation

-- Add new fields to pools table
ALTER TABLE pools
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS activated_block INTEGER,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ended_block INTEGER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pools_activated_at ON pools(activated_at);
CREATE INDEX IF NOT EXISTS idx_pools_ended_at ON pools(ended_at);

-- Add comment explaining the fields
COMMENT ON COLUMN pools.activated_at IS 'Timestamp when pool was activated (PoolActivated event)';
COMMENT ON COLUMN pools.activated_block IS 'Block number when pool was activated';
COMMENT ON COLUMN pools.ended_at IS 'Timestamp when pool ended (PoolEnded event)';
COMMENT ON COLUMN pools.ended_block IS 'Block number when pool ended';
COMMENT ON COLUMN pools.actual_duration IS 'Actual duration in seconds (ended_at - activated_at)';
