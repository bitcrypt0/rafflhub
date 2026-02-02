-- Remove nonce requirement from purchase_signatures table
-- This migration supports the removal of the nonce system from social engagement verification

-- First, make the nonce column nullable
ALTER TABLE purchase_signatures ALTER COLUMN nonce DROP NOT NULL;

-- Drop the unique constraint that includes nonce
ALTER TABLE purchase_signatures DROP CONSTRAINT IF EXISTS purchase_signatures_user_address_raffle_id_nonce_key;

-- Add a new unique constraint without nonce
ALTER TABLE purchase_signatures ADD CONSTRAINT purchase_signatures_user_raffle_unique 
    UNIQUE(user_address, raffle_id);

-- Update existing records to set nonce to null (cleanup)
UPDATE purchase_signatures SET nonce = NULL WHERE nonce IS NOT NULL;

-- Drop the user_nonces table as it's no longer needed
DROP TABLE IF EXISTS user_nonces;
