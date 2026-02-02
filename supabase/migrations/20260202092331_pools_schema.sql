-- ================================================
-- POOLS SCHEMA
-- Cached pool/raffle data from blockchain
-- ================================================

-- Create pools table
CREATE TABLE pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    name TEXT,
    creator TEXT NOT NULL,
    start_time BIGINT NOT NULL,
    duration BIGINT NOT NULL,
    actual_duration BIGINT,
    created_at_block BIGINT NOT NULL,
    created_at_timestamp TIMESTAMPTZ,
    slot_fee TEXT NOT NULL,
    slot_limit INTEGER NOT NULL,
    winners_count INTEGER NOT NULL,
    max_slots_per_address INTEGER NOT NULL,
    state INTEGER NOT NULL DEFAULT 0,  -- Pool state enum (0-8)
    slots_sold INTEGER DEFAULT 0,
    winners_selected INTEGER DEFAULT 0,
    is_prized BOOLEAN DEFAULT false,
    prize_collection TEXT,
    prize_token_id INTEGER,
    erc20_prize_token TEXT,
    erc20_prize_amount TEXT,
    native_prize_amount TEXT,
    standard INTEGER,  -- ERC721=0, ERC1155=1
    is_escrowed_prize BOOLEAN,
    is_collab_pool BOOLEAN DEFAULT false,
    uses_custom_fee BOOLEAN DEFAULT false,
    revenue_recipient TEXT,
    is_external_collection BOOLEAN DEFAULT false,
    is_refundable BOOLEAN DEFAULT false,
    holder_token_address TEXT,
    holder_token_standard INTEGER,
    min_holder_token_balance TEXT,
    last_synced_block BIGINT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(address, chain_id)
);

-- Critical indexes for performance (following supabase-postgres-best-practices query-missing-indexes)
CREATE INDEX idx_pools_chain_id ON pools(chain_id);
CREATE INDEX idx_pools_creator ON pools(creator);
CREATE INDEX idx_pools_state ON pools(state);
CREATE INDEX idx_pools_created_at ON pools(created_at_timestamp DESC NULLS LAST);
CREATE INDEX idx_pools_chain_state ON pools(chain_id, state);

-- Partial index for active pools only (following supabase-postgres-best-practices schema-partial-indexes)
CREATE INDEX idx_pools_active ON pools(chain_id, created_at_timestamp DESC)
    WHERE state IN (0, 1);  -- pending or active

-- Enable Row Level Security (following supabase-best-practices rls-always-enable)
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access (blockchain data is public)
CREATE POLICY "Public read access to pools"
    ON pools
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access"
    ON pools
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable real-time for live pool updates
ALTER PUBLICATION supabase_realtime ADD TABLE pools;

-- Helper function to get pool details with participants and winners count
CREATE OR REPLACE FUNCTION get_pool_details(
    p_pool_address TEXT,
    p_chain_id INTEGER
) RETURNS TABLE (
    pool_data jsonb,
    participants_count bigint,
    winners_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_jsonb(p.*) as pool_data,
        COALESCE(
            (SELECT COUNT(DISTINCT participant_address)
             FROM pool_participants pp
             WHERE pp.pool_address = p.address
               AND pp.chain_id = p.chain_id),
            0
        ) as participants_count,
        COALESCE(
            (SELECT COUNT(*)
             FROM pool_winners pw
             WHERE pw.pool_address = p.address
               AND pw.chain_id = p.chain_id),
            0
        ) as winners_count
    FROM pools p
    WHERE p.address = p_pool_address
      AND p.chain_id = p_chain_id;
END;
$$;

-- Helper function to get pools by creator
CREATE OR REPLACE FUNCTION get_creator_pools(
    p_creator TEXT,
    p_chain_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    address TEXT,
    chain_id INTEGER,
    name TEXT,
    state INTEGER,
    slots_sold INTEGER,
    slot_limit INTEGER,
    created_at_timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.address,
        p.chain_id,
        p.name,
        p.state,
        p.slots_sold,
        p.slot_limit,
        p.created_at_timestamp
    FROM pools p
    WHERE p.creator = p_creator
      AND (p_chain_id IS NULL OR p.chain_id = p_chain_id)
    ORDER BY p.created_at_timestamp DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Helper function to get pools with pagination and filtering
CREATE OR REPLACE FUNCTION get_pools_paginated(
    p_chain_id INTEGER DEFAULT NULL,
    p_state INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 30,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    address TEXT,
    chain_id INTEGER,
    name TEXT,
    creator TEXT,
    state INTEGER,
    slots_sold INTEGER,
    slot_limit INTEGER,
    winners_count INTEGER,
    slot_fee TEXT,
    created_at_timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.address,
        p.chain_id,
        p.name,
        p.creator,
        p.state,
        p.slots_sold,
        p.slot_limit,
        p.winners_count,
        p.slot_fee,
        p.created_at_timestamp
    FROM pools p
    WHERE (p_chain_id IS NULL OR p.chain_id = p_chain_id)
      AND (p_state IS NULL OR p.state = p_state)
    ORDER BY p.created_at_timestamp DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pool_details TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_creator_pools TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_pools_paginated TO authenticated, anon, service_role;

COMMENT ON TABLE pools IS 'Cached pool/raffle data indexed from blockchain events';
COMMENT ON COLUMN pools.state IS 'Pool state: 0=pending, 1=active, 2=ended, 3=drawing, 4=completed, 5=deleted, 6=allPrizesClaimed, 7=unengaged';
COMMENT ON COLUMN pools.standard IS 'NFT standard: 0=ERC721, 1=ERC1155';
