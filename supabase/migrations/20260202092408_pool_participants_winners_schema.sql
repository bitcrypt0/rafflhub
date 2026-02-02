-- ================================================
-- POOL PARTICIPANTS & WINNERS SCHEMA
-- Tracks user participation and winner selection
-- ================================================

-- Create pool_participants table
CREATE TABLE pool_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    participant_address TEXT NOT NULL,
    slots_purchased INTEGER NOT NULL DEFAULT 0,
    total_spent TEXT NOT NULL DEFAULT '0',
    wins_count INTEGER DEFAULT 0,
    prizes_claimed INTEGER DEFAULT 0,
    refund_claimed BOOLEAN DEFAULT false,
    refundable_amount TEXT DEFAULT '0',
    first_purchase_block BIGINT,
    first_purchase_at TIMESTAMPTZ,
    last_purchase_block BIGINT,
    last_purchase_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pool_address, chain_id, participant_address)
);

-- Indexes for fast lookups
CREATE INDEX idx_participants_pool ON pool_participants(pool_address, chain_id);
CREATE INDEX idx_participants_user ON pool_participants(participant_address);
CREATE INDEX idx_participants_user_chain ON pool_participants(participant_address, chain_id);

-- Enable Row Level Security
ALTER TABLE pool_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
CREATE POLICY "Public read access to participants"
    ON pool_participants
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access"
    ON pool_participants
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable real-time for live participation updates
ALTER PUBLICATION supabase_realtime ADD TABLE pool_participants;

-- Create pool_winners table
CREATE TABLE pool_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    winner_address TEXT NOT NULL,
    winner_index INTEGER NOT NULL,
    selection_batch INTEGER,
    prize_claimed BOOLEAN DEFAULT false,
    prize_claimed_at TIMESTAMPTZ,
    prize_claimed_block BIGINT,
    prize_claimed_tx_hash TEXT,
    minted_token_id INTEGER,
    minting_failed BOOLEAN DEFAULT false,
    minting_failed_reason TEXT,
    selected_block BIGINT NOT NULL,
    selected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pool_address, chain_id, winner_address, winner_index)
);

-- Indexes for fast lookups
CREATE INDEX idx_winners_pool ON pool_winners(pool_address, chain_id);
CREATE INDEX idx_winners_user ON pool_winners(winner_address);
CREATE INDEX idx_winners_user_chain ON pool_winners(winner_address, chain_id);

-- Partial index for unclaimed prizes (following supabase-postgres-best-practices)
CREATE INDEX idx_winners_unclaimed ON pool_winners(pool_address, chain_id)
    WHERE prize_claimed = false;

-- Enable Row Level Security
ALTER TABLE pool_winners ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
CREATE POLICY "Public read access to winners"
    ON pool_winners
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access"
    ON pool_winners
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable real-time for live winner updates
ALTER PUBLICATION supabase_realtime ADD TABLE pool_winners;

-- Helper function to get pool participants with stats
CREATE OR REPLACE FUNCTION get_pool_participants(
    p_pool_address TEXT,
    p_chain_id INTEGER,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    participant_address TEXT,
    slots_purchased INTEGER,
    total_spent TEXT,
    wins_count INTEGER,
    prizes_claimed INTEGER,
    is_winner BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.participant_address,
        pp.slots_purchased,
        pp.total_spent,
        pp.wins_count,
        pp.prizes_claimed,
        EXISTS(
            SELECT 1
            FROM pool_winners pw
            WHERE pw.pool_address = pp.pool_address
              AND pw.chain_id = pp.chain_id
              AND pw.winner_address = pp.participant_address
        ) as is_winner
    FROM pool_participants pp
    WHERE pp.pool_address = p_pool_address
      AND pp.chain_id = p_chain_id
    ORDER BY pp.slots_purchased DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Helper function to get pool winners
CREATE OR REPLACE FUNCTION get_pool_winners(
    p_pool_address TEXT,
    p_chain_id INTEGER
) RETURNS TABLE (
    winner_address TEXT,
    winner_index INTEGER,
    prize_claimed BOOLEAN,
    minted_token_id INTEGER,
    selected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pw.winner_address,
        pw.winner_index,
        pw.prize_claimed,
        pw.minted_token_id,
        pw.selected_at
    FROM pool_winners pw
    WHERE pw.pool_address = p_pool_address
      AND pw.chain_id = p_chain_id
    ORDER BY pw.winner_index;
END;
$$;

-- Helper function to get user participations across all pools
CREATE OR REPLACE FUNCTION get_user_participations(
    p_user_address TEXT,
    p_chain_id INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    pool_address TEXT,
    chain_id INTEGER,
    pool_name TEXT,
    slots_purchased INTEGER,
    total_spent TEXT,
    wins_count INTEGER,
    prizes_claimed INTEGER,
    last_purchase_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.pool_address,
        pp.chain_id,
        p.name as pool_name,
        pp.slots_purchased,
        pp.total_spent,
        pp.wins_count,
        pp.prizes_claimed,
        pp.last_purchase_at
    FROM pool_participants pp
    JOIN pools p ON p.address = pp.pool_address AND p.chain_id = pp.chain_id
    WHERE pp.participant_address = p_user_address
      AND (p_chain_id IS NULL OR pp.chain_id = p_chain_id)
    ORDER BY pp.last_purchase_at DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pool_participants TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_pool_winners TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_user_participations TO authenticated, anon, service_role;

COMMENT ON TABLE pool_participants IS 'Tracks user participation in pools/raffles';
COMMENT ON TABLE pool_winners IS 'Tracks selected winners and prize claim status';
