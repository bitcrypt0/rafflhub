-- ================================================
-- COLLECTIONS & NFT METADATA SCHEMA
-- Tracks NFT collections and caches artwork/metadata
-- ================================================

-- Create collections table
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    creator TEXT NOT NULL,
    standard INTEGER NOT NULL,  -- 0=ERC721, 1=ERC1155
    drop_uri TEXT,
    unrevealed_uri TEXT,
    base_uri TEXT,
    drop_uri_hash TEXT,
    unrevealed_uri_hash TEXT,
    is_revealed BOOLEAN DEFAULT false,
    vesting_cliff_end BIGINT,
    vesting_num_unlocks INTEGER,
    vesting_duration_between_unlocks BIGINT,
    vesting_amount_per_unlock TEXT,
    max_supply INTEGER,
    creator_allocation INTEGER,
    current_supply INTEGER DEFAULT 0,
    deployed_block BIGINT,
    deployed_at TIMESTAMPTZ,
    last_synced_block BIGINT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(address, chain_id)
);

-- Indexes for collections
CREATE INDEX idx_collections_chain_id ON collections(chain_id);
CREATE INDEX idx_collections_creator ON collections(creator);
CREATE INDEX idx_collections_chain_creator ON collections(chain_id, creator);

-- Enable Row Level Security
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
CREATE POLICY "Public read access to collections"
    ON collections
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access"
    ON collections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create nft_metadata_cache table for caching NFT artwork and metadata
CREATE TABLE nft_metadata_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_address TEXT NOT NULL,
    chain_id INTEGER NOT NULL,
    token_id INTEGER,  -- NULL for collection-level metadata (unrevealed/drop artwork)

    -- Metadata source
    metadata_uri TEXT,           -- Original IPFS/Arweave/HTTP URI
    resolved_uri TEXT,           -- Resolved gateway URL that works

    -- Cached metadata (from JSON at metadata_uri)
    name TEXT,
    description TEXT,
    image_uri TEXT,              -- Original image URI from metadata
    resolved_image_uri TEXT,     -- Working gateway URL for image
    animation_uri TEXT,          -- For animated NFTs
    attributes JSONB,            -- NFT attributes/traits

    -- For collection-level entries
    metadata_type TEXT,          -- 'unrevealed', 'drop', 'revealed', 'token'

    -- Cache management
    fetch_status TEXT DEFAULT 'pending',  -- 'pending', 'success', 'failed', 'retrying'
    fetch_error TEXT,
    retry_count INTEGER DEFAULT 0,
    last_fetched_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,      -- Cache expiry (e.g., 7 days)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(collection_address, chain_id, token_id, metadata_type)
);

-- Indexes for fast artwork lookups
CREATE INDEX idx_nft_metadata_collection ON nft_metadata_cache(collection_address, chain_id);
CREATE INDEX idx_nft_metadata_type ON nft_metadata_cache(collection_address, chain_id, metadata_type);

-- Partial index for pending fetches (following supabase-postgres-best-practices)
CREATE INDEX idx_nft_metadata_pending ON nft_metadata_cache(fetch_status)
    WHERE fetch_status = 'pending';

-- Enable Row Level Security
ALTER TABLE nft_metadata_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
CREATE POLICY "Public read access to metadata cache"
    ON nft_metadata_cache
    FOR SELECT
    TO authenticated, anon
    USING (true);

-- RLS Policy: Only service role can write
CREATE POLICY "Service role only write access to metadata"
    ON nft_metadata_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enable real-time for metadata cache updates
ALTER PUBLICATION supabase_realtime ADD TABLE nft_metadata_cache;

-- Helper function to get collection artwork
CREATE OR REPLACE FUNCTION get_collection_artwork(
    p_collection_address TEXT,
    p_chain_id INTEGER,
    p_metadata_type TEXT DEFAULT 'unrevealed'
) RETURNS TABLE (
    metadata_uri TEXT,
    resolved_image_uri TEXT,
    name TEXT,
    description TEXT,
    fetch_status TEXT,
    cached_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        nmc.metadata_uri,
        nmc.resolved_image_uri,
        nmc.name,
        nmc.description,
        nmc.fetch_status,
        nmc.last_fetched_at
    FROM nft_metadata_cache nmc
    WHERE nmc.collection_address = p_collection_address
      AND nmc.chain_id = p_chain_id
      AND nmc.metadata_type = p_metadata_type
      AND nmc.token_id IS NULL
      AND nmc.fetch_status = 'success'
    LIMIT 1;
END;
$$;

-- Helper function to get token metadata
CREATE OR REPLACE FUNCTION get_token_metadata(
    p_collection_address TEXT,
    p_chain_id INTEGER,
    p_token_id INTEGER
) RETURNS TABLE (
    metadata_uri TEXT,
    resolved_image_uri TEXT,
    name TEXT,
    description TEXT,
    attributes JSONB,
    animation_uri TEXT,
    fetch_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        nmc.metadata_uri,
        nmc.resolved_image_uri,
        nmc.name,
        nmc.description,
        nmc.attributes,
        nmc.animation_uri,
        nmc.fetch_status
    FROM nft_metadata_cache nmc
    WHERE nmc.collection_address = p_collection_address
      AND nmc.chain_id = p_chain_id
      AND nmc.token_id = p_token_id
      AND nmc.metadata_type = 'token'
    LIMIT 1;
END;
$$;

-- Helper function to get collections by creator
CREATE OR REPLACE FUNCTION get_creator_collections(
    p_creator TEXT,
    p_chain_id INTEGER DEFAULT NULL
) RETURNS TABLE (
    address TEXT,
    chain_id INTEGER,
    standard INTEGER,
    is_revealed BOOLEAN,
    max_supply INTEGER,
    current_supply INTEGER,
    deployed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.address,
        c.chain_id,
        c.standard,
        c.is_revealed,
        c.max_supply,
        c.current_supply,
        c.deployed_at
    FROM collections c
    WHERE c.creator = p_creator
      AND (p_chain_id IS NULL OR c.chain_id = p_chain_id)
    ORDER BY c.deployed_at DESC NULLS LAST;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_collection_artwork TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_token_metadata TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_creator_collections TO authenticated, anon, service_role;

COMMENT ON TABLE collections IS 'NFT collection data indexed from blockchain';
COMMENT ON TABLE nft_metadata_cache IS 'Cached NFT artwork and metadata with IPFS/Arweave gateway fallbacks';
COMMENT ON COLUMN nft_metadata_cache.metadata_type IS 'Collection-level: unrevealed, drop, revealed; Token-level: token';
COMMENT ON COLUMN nft_metadata_cache.expires_at IS 'Cache expiry: 30 days for collection artwork, 14 days for token metadata';
