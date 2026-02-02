-- Pool Metadata Cache Migration
-- Creates table and infrastructure for caching PoolMetadataSet events from blockchain
-- This provides a persistent cache layer that can be used when the system is fully integrated
-- Currently, the frontend uses in-memory caching via poolMetadataService.js

-- =====================================================
-- 1. pool_metadata_cache table
-- =====================================================

CREATE TABLE IF NOT EXISTS pool_metadata_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pool_address TEXT NOT NULL UNIQUE,
    chain_id INTEGER NOT NULL,
    
    -- Metadata fields from PoolMetadataSet event
    description TEXT DEFAULT '',
    twitter_link TEXT DEFAULT '',
    discord_link TEXT DEFAULT '',
    telegram_link TEXT DEFAULT '',
    
    -- Event tracking
    block_number BIGINT NOT NULL,
    transaction_hash TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ,
    
    -- Cache metadata
    has_metadata BOOLEAN DEFAULT false,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT pool_metadata_cache_pool_chain_unique UNIQUE(pool_address, chain_id)
);

-- =====================================================
-- 2. Indexes for performance
-- =====================================================

-- Primary lookup index
CREATE INDEX IF NOT EXISTS idx_pool_metadata_cache_pool_address 
    ON pool_metadata_cache(pool_address);

-- Chain-specific queries
CREATE INDEX IF NOT EXISTS idx_pool_metadata_cache_chain_id 
    ON pool_metadata_cache(chain_id);

-- Composite index for pool + chain lookups
CREATE INDEX IF NOT EXISTS idx_pool_metadata_cache_pool_chain 
    ON pool_metadata_cache(pool_address, chain_id);

-- Index for finding pools with metadata
CREATE INDEX IF NOT EXISTS idx_pool_metadata_cache_has_metadata 
    ON pool_metadata_cache(has_metadata) 
    WHERE has_metadata = true;

-- Index for cache freshness queries
CREATE INDEX IF NOT EXISTS idx_pool_metadata_cache_last_updated 
    ON pool_metadata_cache(last_updated DESC);

-- Index for block number ordering (useful for event syncing)
CREATE INDEX IF NOT EXISTS idx_pool_metadata_cache_block_number 
    ON pool_metadata_cache(chain_id, block_number DESC);

-- =====================================================
-- 3. Helper functions
-- =====================================================

-- Function to upsert pool metadata from blockchain event
CREATE OR REPLACE FUNCTION upsert_pool_metadata(
    p_pool_address TEXT,
    p_chain_id INTEGER,
    p_description TEXT,
    p_twitter_link TEXT,
    p_discord_link TEXT,
    p_telegram_link TEXT,
    p_block_number BIGINT,
    p_transaction_hash TEXT,
    p_event_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_id UUID;
    v_has_metadata BOOLEAN;
BEGIN
    -- Determine if pool has any metadata
    v_has_metadata := (
        COALESCE(p_description, '') != '' OR
        COALESCE(p_twitter_link, '') != '' OR
        COALESCE(p_discord_link, '') != '' OR
        COALESCE(p_telegram_link, '') != ''
    );
    
    -- Insert or update metadata
    INSERT INTO pool_metadata_cache (
        pool_address,
        chain_id,
        description,
        twitter_link,
        discord_link,
        telegram_link,
        block_number,
        transaction_hash,
        event_timestamp,
        has_metadata,
        last_updated
    ) VALUES (
        LOWER(p_pool_address),
        p_chain_id,
        p_description,
        p_twitter_link,
        p_discord_link,
        p_telegram_link,
        p_block_number,
        p_transaction_hash,
        p_event_timestamp,
        v_has_metadata,
        NOW()
    )
    ON CONFLICT (pool_address, chain_id) 
    DO UPDATE SET
        description = EXCLUDED.description,
        twitter_link = EXCLUDED.twitter_link,
        discord_link = EXCLUDED.discord_link,
        telegram_link = EXCLUDED.telegram_link,
        block_number = EXCLUDED.block_number,
        transaction_hash = EXCLUDED.transaction_hash,
        event_timestamp = EXCLUDED.event_timestamp,
        has_metadata = EXCLUDED.has_metadata,
        last_updated = NOW()
    WHERE pool_metadata_cache.block_number <= EXCLUDED.block_number
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Function to get pool metadata by address
CREATE OR REPLACE FUNCTION get_pool_metadata(
    p_pool_address TEXT,
    p_chain_id INTEGER
)
RETURNS TABLE (
    description TEXT,
    twitter_link TEXT,
    discord_link TEXT,
    telegram_link TEXT,
    has_metadata BOOLEAN,
    block_number BIGINT,
    last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pmc.description,
        pmc.twitter_link,
        pmc.discord_link,
        pmc.telegram_link,
        pmc.has_metadata,
        pmc.block_number,
        pmc.last_updated
    FROM pool_metadata_cache pmc
    WHERE pmc.pool_address = LOWER(p_pool_address)
        AND pmc.chain_id = p_chain_id;
END;
$$;

-- Function to batch get pool metadata
CREATE OR REPLACE FUNCTION batch_get_pool_metadata(
    p_pool_addresses TEXT[],
    p_chain_id INTEGER
)
RETURNS TABLE (
    pool_address TEXT,
    description TEXT,
    twitter_link TEXT,
    discord_link TEXT,
    telegram_link TEXT,
    has_metadata BOOLEAN,
    block_number BIGINT,
    last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pmc.pool_address,
        pmc.description,
        pmc.twitter_link,
        pmc.discord_link,
        pmc.telegram_link,
        pmc.has_metadata,
        pmc.block_number,
        pmc.last_updated
    FROM pool_metadata_cache pmc
    WHERE pmc.pool_address = ANY(
        SELECT LOWER(unnest(p_pool_addresses))
    )
    AND pmc.chain_id = p_chain_id;
END;
$$;

-- Function to clean up old cache entries (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_metadata_cache(
    p_days_old INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM pool_metadata_cache
    WHERE last_updated < NOW() - (p_days_old || ' days')::INTERVAL
        AND has_metadata = false;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- 4. Row Level Security (RLS) - Read-only public access
-- =====================================================

-- Enable RLS
ALTER TABLE pool_metadata_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (metadata is public blockchain data)
CREATE POLICY "Allow public read access to pool metadata"
    ON pool_metadata_cache
    FOR SELECT
    TO public
    USING (true);

-- Only service role can insert/update (for event indexer)
CREATE POLICY "Service role can insert/update pool metadata"
    ON pool_metadata_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 5. Comments for documentation
-- =====================================================

COMMENT ON TABLE pool_metadata_cache IS 
'Caches PoolMetadataSet events from blockchain for faster metadata retrieval. This table is populated by an event indexer service and provides a persistent cache layer independent of the frontend in-memory cache.';

COMMENT ON COLUMN pool_metadata_cache.pool_address IS 
'Ethereum address of the pool (stored in lowercase for consistency)';

COMMENT ON COLUMN pool_metadata_cache.chain_id IS 
'Chain ID where the pool is deployed (e.g., 1 for Ethereum, 8453 for Base)';

COMMENT ON COLUMN pool_metadata_cache.has_metadata IS 
'Quick flag to check if pool has any metadata without checking individual fields';

COMMENT ON COLUMN pool_metadata_cache.block_number IS 
'Block number where the PoolMetadataSet event was emitted';

COMMENT ON FUNCTION upsert_pool_metadata IS 
'Inserts or updates pool metadata from a PoolMetadataSet event. Only updates if the new event is from a later block number.';

COMMENT ON FUNCTION get_pool_metadata IS 
'Retrieves metadata for a single pool by address and chain ID';

COMMENT ON FUNCTION batch_get_pool_metadata IS 
'Retrieves metadata for multiple pools in a single query for better performance';

COMMENT ON FUNCTION cleanup_old_metadata_cache IS 
'Removes cache entries older than specified days that have no metadata (maintenance function)';
