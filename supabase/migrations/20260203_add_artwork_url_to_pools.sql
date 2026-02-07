-- Add artwork_url column to pools table for caching NFT prize artwork
-- This reduces RPC calls in RaffleCard and PrizeImageCard components

ALTER TABLE pools
ADD COLUMN IF NOT EXISTS artwork_url TEXT;

-- Add comment
COMMENT ON COLUMN pools.artwork_url IS 'Cached artwork URL for NFT prize (first successful image URL from metadata)';
