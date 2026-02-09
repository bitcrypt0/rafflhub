-- Migration: Purchase Authorizations table for anti-bot signature verification
-- Used by the generate-purchase-auth edge function for pools WITHOUT social engagement requirements

-- =====================================================
-- 1. purchase_authorizations table
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_authorizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_address TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    signature TEXT NOT NULL,
    deadline BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ
);

-- =====================================================
-- 2. Indexes for performance
-- =====================================================

-- Primary lookup: rate limiting queries per wallet
CREATE INDEX idx_purchase_authorizations_user_created
    ON purchase_authorizations(user_address, created_at DESC);

-- Pool-specific lookups
CREATE INDEX idx_purchase_authorizations_pool
    ON purchase_authorizations(pool_address, chain_id);

-- Cleanup: find expired records efficiently
CREATE INDEX idx_purchase_authorizations_expires
    ON purchase_authorizations(expires_at)
    WHERE is_used = false;

-- =====================================================
-- 3. Row Level Security
-- =====================================================

ALTER TABLE purchase_authorizations ENABLE ROW LEVEL SECURITY;

-- Service role can insert (edge function uses service_role key)
CREATE POLICY "Service role can insert purchase authorizations"
    ON purchase_authorizations
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Service role can select (for rate limiting queries)
CREATE POLICY "Service role can select purchase authorizations"
    ON purchase_authorizations
    FOR SELECT
    TO service_role
    USING (true);

-- Service role can delete (for cleanup)
CREATE POLICY "Service role can delete purchase authorizations"
    ON purchase_authorizations
    FOR DELETE
    TO service_role
    USING (true);

-- =====================================================
-- 4. Add to cleanup function
-- =====================================================

-- Extend the existing cleanup function to include purchase_authorizations
CREATE OR REPLACE FUNCTION cleanup_expired_records(
    signature_retention_hours INTEGER DEFAULT 24,
    nonce_retention_days INTEGER DEFAULT 90,
    verification_retention_days INTEGER DEFAULT 180,
    event_retention_hours INTEGER DEFAULT 24,
    purchase_auth_retention_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
    signatures_deleted INTEGER,
    nonces_deleted INTEGER,
    verifications_deleted INTEGER,
    events_deleted INTEGER,
    purchase_auths_deleted INTEGER,
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
    auth_count INTEGER;
BEGIN
    -- Clean expired purchase signatures
    DELETE FROM purchase_signatures
    WHERE expires_at < NOW()
        OR created_at < NOW() - (signature_retention_hours || ' hours')::INTERVAL;
    GET DIAGNOSTICS sig_count = ROW_COUNT;

    -- Clean stale user nonces (table may have been dropped)
    nonce_count := 0;

    -- Clean old social media verifications
    DELETE FROM social_media_verifications
    WHERE created_at < NOW() - (verification_retention_days || ' days')::INTERVAL
        AND status = 'completed';
    GET DIAGNOSTICS verify_count = ROW_COUNT;

    -- Clean old verification events
    DELETE FROM verification_events
    WHERE created_at < NOW() - (event_retention_hours || ' hours')::INTERVAL;
    GET DIAGNOSTICS event_count = ROW_COUNT;

    -- Clean expired purchase authorizations
    DELETE FROM purchase_authorizations
    WHERE expires_at < NOW()
        OR created_at < NOW() - (purchase_auth_retention_hours || ' hours')::INTERVAL;
    GET DIAGNOSTICS auth_count = ROW_COUNT;

    -- Return statistics
    RETURN QUERY SELECT
        sig_count,
        nonce_count,
        verify_count,
        event_count,
        auth_count,
        sig_count + nonce_count + verify_count + event_count + auth_count;
END;
$$;

-- =====================================================
-- 5. Comments
-- =====================================================

COMMENT ON TABLE purchase_authorizations IS 'Audit trail and rate limiting for anti-bot purchase authorization signatures (PurchaseAuthorizer contract)';
COMMENT ON COLUMN purchase_authorizations.user_address IS 'Buyer wallet address (lowercase)';
COMMENT ON COLUMN purchase_authorizations.pool_address IS 'Pool contract address (lowercase)';
COMMENT ON COLUMN purchase_authorizations.chain_id IS 'Chain ID where the pool is deployed';
COMMENT ON COLUMN purchase_authorizations.signature IS 'EIP-712 signature for PurchaseAuthorization';
COMMENT ON COLUMN purchase_authorizations.deadline IS 'Unix timestamp deadline for signature validity (on-chain enforcement)';
COMMENT ON COLUMN purchase_authorizations.is_used IS 'Whether the signature has been used in a successful purchase transaction';
