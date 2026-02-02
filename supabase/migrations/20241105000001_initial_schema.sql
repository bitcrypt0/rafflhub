-- Initial Schema Migration for Social Media Verification System
-- Creates core tables for social media authentication and verification

-- =====================================================
-- 1. user_social_accounts table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_social_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_address TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('twitter', 'discord', 'telegram')),
    platform_user_id TEXT NOT NULL,
    platform_username TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    account_data JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_address, platform),
    UNIQUE(platform, platform_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_user_address ON user_social_accounts(user_address);
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_platform ON user_social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_user_social_accounts_active ON user_social_accounts(is_active) WHERE is_active = true;

-- =====================================================
-- 2. social_media_verifications table
-- =====================================================

CREATE TABLE IF NOT EXISTS social_media_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_address TEXT NOT NULL,
    raffle_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('twitter', 'discord', 'telegram')),
    task_type TEXT NOT NULL,
    task_data JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'completed', 'failed', 'expired')
    ),
    verification_result JSONB DEFAULT '{}',
    error_message TEXT,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_address, raffle_id, platform, task_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_verifications_user_raffle ON social_media_verifications(user_address, raffle_id);
CREATE INDEX IF NOT EXISTS idx_social_verifications_status ON social_media_verifications(status);
CREATE INDEX IF NOT EXISTS idx_social_verifications_platform ON social_media_verifications(platform);
CREATE INDEX IF NOT EXISTS idx_social_verifications_expires ON social_media_verifications(expires_at) WHERE expires_at IS NOT NULL;

-- =====================================================
-- 3. purchase_signatures table
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_signatures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_address TEXT NOT NULL,
    raffle_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    nonce TEXT NOT NULL,
    deadline BIGINT NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Constraints
    UNIQUE(user_address, raffle_id, nonce)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_signatures_user_raffle ON purchase_signatures(user_address, raffle_id);
CREATE INDEX IF NOT EXISTS idx_purchase_signatures_used ON purchase_signatures(is_used) WHERE is_used = false;
-- Note: idx_purchase_signatures_expires_at is created in cleanup migration

-- =====================================================
-- 4. user_nonces table (for cleanup system)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_nonces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_address TEXT NOT NULL UNIQUE,
    current_nonce BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_nonces_address ON user_nonces(user_address);

-- =====================================================
-- 5. Update triggers
-- =====================================================

-- Function to update updated_at timestamp
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

-- Triggers for updated_at
CREATE TRIGGER update_user_social_accounts_updated_at BEFORE UPDATE ON user_social_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_media_verifications_updated_at BEFORE UPDATE ON social_media_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_nonces_updated_at BEFORE UPDATE ON user_nonces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
