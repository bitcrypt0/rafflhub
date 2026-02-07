-- ================================================
-- ADD is_external COLUMN TO COLLECTIONS TABLE
-- Distinguishes external collections from protocol-native ones
-- ================================================

-- Add is_external column to collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;

-- Add name and symbol columns if they don't exist (for external collections)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS symbol TEXT;

-- Create index for filtering external collections
CREATE INDEX IF NOT EXISTS idx_collections_is_external ON collections(is_external);
CREATE INDEX IF NOT EXISTS idx_collections_chain_external ON collections(chain_id, is_external);
