-- Corrective migration: fix references from non-existent 'verification_records' table
-- The original 20240101_add_chain_id_columns.sql referenced 'verification_records' 
-- but the actual table is 'social_media_verifications'.
-- This migration ensures chain_id exists on the correct table and cleans up stale objects.

-- =====================================================
-- 1. Add chain_id to social_media_verifications if not present
-- =====================================================

ALTER TABLE social_media_verifications
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 84532 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_media_verifications_chain_id
    ON social_media_verifications(chain_id);

COMMENT ON COLUMN social_media_verifications.chain_id IS 'Chain ID for multi-network support (84532 = Base Sepolia default)';

-- =====================================================
-- 2. Drop stale view that references non-existent table
-- =====================================================

DROP VIEW IF EXISTS current_network_data;

-- =====================================================
-- 3. Drop stale indexes on non-existent table (safe no-ops)
-- =====================================================

-- These will silently succeed even if the indexes don't exist
DROP INDEX IF EXISTS idx_verification_records_chain_id;
