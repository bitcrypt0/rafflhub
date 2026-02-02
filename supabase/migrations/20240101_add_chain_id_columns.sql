-- Migration: Add chain_id support for multi-network backend
-- This migration adds network tracking to all relevant tables

-- Add chain_id column to verification_records table
ALTER TABLE verification_records 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 84532 NOT NULL;

-- Add chain_id column to user_nonces table
ALTER TABLE user_nonces 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 84532 NOT NULL;

-- Add chain_id column to purchase_signatures table
ALTER TABLE purchase_signatures 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 84532 NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_records_chain_id 
ON verification_records(chain_id);

CREATE INDEX IF NOT EXISTS idx_user_nonces_chain_id 
ON user_nonces(chain_id);

CREATE INDEX IF NOT EXISTS idx_purchase_signatures_chain_id 
ON purchase_signatures(chain_id);

-- Drop old unique constraints if they exist
ALTER TABLE user_nonces DROP CONSTRAINT IF EXISTS user_nonces_user_address_pool_address_key;

-- Add new composite unique constraints to ensure data isolation per network
ALTER TABLE user_nonces 
ADD CONSTRAINT unique_user_pool_chain 
UNIQUE (user_address, pool_address, chain_id);

-- Add comments to document the changes
COMMENT ON COLUMN verification_records.chain_id IS 'Chain ID for multi-network support (84532 = Base Sepolia default)';
COMMENT ON COLUMN user_nonces.chain_id IS 'Chain ID for multi-network support (84532 = Base Sepolia default)';
COMMENT ON COLUMN purchase_signatures.chain_id IS 'Chain ID for multi-network support (84532 = Base Sepolia default)';

-- Create a view for easier querying of current network data
CREATE OR REPLACE VIEW current_network_data AS
SELECT 
  chain_id,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT raffle_id) as unique_raffles,
  COUNT(*) as total_records
FROM verification_records 
GROUP BY chain_id;

-- Grant permissions to the authenticated role
GRANT ALL ON current_network_data TO authenticated;
GRANT SELECT ON current_network_data TO anon;
