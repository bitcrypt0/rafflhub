-- ================================================
-- INDEXER SYNC STATE SCHEMA
-- Tracks blockchain indexing progress per chain/contract
-- ================================================

-- Create indexer_sync_state table
CREATE TABLE indexer_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id INTEGER NOT NULL,
    contract_type TEXT NOT NULL, -- 'pool_deployer', 'nft_factory', 'rewards_flywheel', 'pool'
    contract_address TEXT NOT NULL,
    last_indexed_block BIGINT NOT NULL DEFAULT 0,
    last_block_hash TEXT,
    last_indexed_at TIMESTAMPTZ,
    is_healthy BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, contract_type, contract_address)
);

-- Add indexes for fast lookups (following supabase-postgres-best-practices)
CREATE INDEX idx_sync_state_chain_contract ON indexer_sync_state(chain_id, contract_type);
CREATE INDEX idx_sync_state_health ON indexer_sync_state(is_healthy) WHERE is_healthy = false;

-- Enable Row Level Security (following supabase-best-practices rls-always-enable)
ALTER TABLE indexer_sync_state ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access (blockchain data is public)
CREATE POLICY "Public read access to sync state"
    ON indexer_sync_state
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write (following supabase-best-practices rls-specify-roles)
CREATE POLICY "Service role only write access"
    ON indexer_sync_state
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create function to update sync state with proper error handling
CREATE OR REPLACE FUNCTION update_indexer_sync_state(
    p_chain_id INTEGER,
    p_contract_type TEXT,
    p_contract_address TEXT,
    p_last_block BIGINT,
    p_block_hash TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO indexer_sync_state (
        chain_id,
        contract_type,
        contract_address,
        last_indexed_block,
        last_block_hash,
        last_indexed_at,
        is_healthy,
        updated_at
    ) VALUES (
        p_chain_id,
        p_contract_type,
        p_contract_address,
        p_last_block,
        p_block_hash,
        NOW(),
        true,
        NOW()
    )
    ON CONFLICT (chain_id, contract_type, contract_address)
    DO UPDATE SET
        last_indexed_block = EXCLUDED.last_indexed_block,
        last_block_hash = EXCLUDED.last_block_hash,
        last_indexed_at = NOW(),
        is_healthy = true,
        error_message = NULL,
        updated_at = NOW();
END;
$$;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION update_indexer_sync_state TO service_role;

-- Create function to mark indexer as unhealthy
CREATE OR REPLACE FUNCTION mark_indexer_unhealthy(
    p_chain_id INTEGER,
    p_contract_type TEXT,
    p_contract_address TEXT,
    p_error_message TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE indexer_sync_state
    SET
        is_healthy = false,
        error_message = p_error_message,
        updated_at = NOW()
    WHERE chain_id = p_chain_id
      AND contract_type = p_contract_type
      AND contract_address = p_contract_address;
END;
$$;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION mark_indexer_unhealthy TO service_role;

COMMENT ON TABLE indexer_sync_state IS 'Tracks blockchain event indexing progress and health status per chain and contract';
COMMENT ON COLUMN indexer_sync_state.contract_type IS 'Type of contract being indexed: pool_deployer, nft_factory, rewards_flywheel, pool';
COMMENT ON COLUMN indexer_sync_state.last_block_hash IS 'Hash of last indexed block for reorg detection';
