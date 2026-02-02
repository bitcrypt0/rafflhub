-- ================================================
-- USER ACTIVITY, BLOCKCHAIN EVENTS & REWARDS SCHEMA
-- Activity feed, raw event log, and rewards tracking
-- ================================================

-- Create user_activity table for activity feed
CREATE TABLE user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL,
    -- Activity types:
    --   'slot_purchase'          - User purchased slots (SlotsPurchased event)
    --   'randomness_requested'   - User requested randomness for winner selection (RandomRequested event)
    --   'prize_won'              - User was selected as winner (WinnersSelected event)
    --   'prize_claimed'          - User claimed their prize (PrizeClaimed event)
    --   'refund_claimed'         - User claimed refund (RefundClaimed event)
    --   'raffle_created'         - User created a raffle (PoolCreated event)
    --   'revenue_withdrawn'      - User withdrew revenue
    --   'rewards_claimed'        - User claimed rewards (RewardsClaimed event)
    pool_address TEXT,
    pool_name TEXT,
    quantity INTEGER,
    amount TEXT,
    token_id INTEGER,
    request_id TEXT,  -- For randomness_requested: the VRF request ID
    block_number BIGINT NOT NULL,
    transaction_hash TEXT NOT NULL,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, transaction_hash, activity_type, user_address)
);

-- Indexes for user activity lookups
CREATE INDEX idx_activity_user ON user_activity(user_address, timestamp DESC NULLS LAST);
CREATE INDEX idx_activity_user_chain ON user_activity(user_address, chain_id, timestamp DESC NULLS LAST);
CREATE INDEX idx_activity_pool ON user_activity(pool_address, chain_id);
CREATE INDEX idx_activity_type ON user_activity(activity_type);

-- Enable Row Level Security
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access (blockchain data is public)
CREATE POLICY "Public read access to activity"
    ON user_activity
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access to activity"
    ON user_activity
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create blockchain_events table for raw event log
CREATE TABLE blockchain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id INTEGER NOT NULL,
    contract_address TEXT NOT NULL,
    event_name TEXT NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    event_data JSONB NOT NULL,
    block_timestamp TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, transaction_hash, log_index)
);

-- Indexes for event queries
CREATE INDEX idx_events_chain_block ON blockchain_events(chain_id, block_number DESC);
CREATE INDEX idx_events_contract ON blockchain_events(contract_address, event_name);
CREATE INDEX idx_events_contract_block ON blockchain_events(contract_address, block_number DESC);

-- Enable Row Level Security
ALTER TABLE blockchain_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
CREATE POLICY "Public read access to events"
    ON blockchain_events
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access to events"
    ON blockchain_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create rewards_claims table
CREATE TABLE rewards_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id INTEGER NOT NULL,
    pool_address TEXT NOT NULL,
    claim_type TEXT NOT NULL,  -- 'creator_rewards', 'participant_rewards', 'points_reward'
    claimant_address TEXT NOT NULL,
    token_address TEXT,
    amount TEXT NOT NULL,
    points_claimed TEXT,
    fill_percentage INTEGER,
    block_number BIGINT NOT NULL,
    transaction_hash TEXT NOT NULL,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id, transaction_hash, claimant_address, claim_type)
);

-- Indexes for rewards queries
CREATE INDEX idx_rewards_claimant ON rewards_claims(claimant_address, chain_id);
CREATE INDEX idx_rewards_pool ON rewards_claims(pool_address, chain_id);
CREATE INDEX idx_rewards_type ON rewards_claims(claim_type);

-- Enable Row Level Security
ALTER TABLE rewards_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
CREATE POLICY "Public read access to rewards"
    ON rewards_claims
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access to rewards"
    ON rewards_claims
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Helper function to get user activity feed
CREATE OR REPLACE FUNCTION get_user_activity(
    p_user_address TEXT,
    p_chain_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    activity_type TEXT,
    pool_address TEXT,
    pool_name TEXT,
    quantity INTEGER,
    amount TEXT,
    token_id INTEGER,
    request_id TEXT,
    transaction_hash TEXT,
    timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ua.activity_type,
        ua.pool_address,
        ua.pool_name,
        ua.quantity,
        ua.amount,
        ua.token_id,
        ua.request_id,
        ua.transaction_hash,
        ua.timestamp
    FROM user_activity ua
    WHERE ua.user_address = p_user_address
      AND (p_chain_id IS NULL OR ua.chain_id = p_chain_id)
    ORDER BY ua.timestamp DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Helper function to get pool events
CREATE OR REPLACE FUNCTION get_pool_events(
    p_pool_address TEXT,
    p_chain_id INTEGER,
    p_event_names TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
    event_name TEXT,
    event_data JSONB,
    block_number BIGINT,
    transaction_hash TEXT,
    block_timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        be.event_name,
        be.event_data,
        be.block_number,
        be.transaction_hash,
        be.block_timestamp
    FROM blockchain_events be
    WHERE be.contract_address = p_pool_address
      AND be.chain_id = p_chain_id
      AND (p_event_names IS NULL OR be.event_name = ANY(p_event_names))
    ORDER BY be.block_number DESC, be.log_index DESC
    LIMIT p_limit;
END;
$$;

-- Helper function to get user rewards
CREATE OR REPLACE FUNCTION get_user_rewards(
    p_user_address TEXT,
    p_chain_id INTEGER DEFAULT NULL
) RETURNS TABLE (
    claim_type TEXT,
    pool_address TEXT,
    token_address TEXT,
    amount TEXT,
    points_claimed TEXT,
    timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rc.claim_type,
        rc.pool_address,
        rc.token_address,
        rc.amount,
        rc.points_claimed,
        rc.timestamp
    FROM rewards_claims rc
    WHERE rc.claimant_address = p_user_address
      AND (p_chain_id IS NULL OR rc.chain_id = p_chain_id)
    ORDER BY rc.timestamp DESC NULLS LAST;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_pool_events TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_rewards TO authenticated, anon, service_role;

COMMENT ON TABLE user_activity IS 'User activity feed aggregated from blockchain events';
COMMENT ON TABLE blockchain_events IS 'Raw blockchain event log for debugging and auditing';
COMMENT ON TABLE rewards_claims IS 'Rewards flywheel claims tracking';
COMMENT ON COLUMN user_activity.request_id IS 'VRF request ID for randomness_requested activity type';
