import { supabase, EDGE_FUNCTIONS } from '../config/supabase.js';

/**
 * Service for generating signatures for slot purchases
 * Integrates with Supabase Edge Functions for secure signature generation
 */

/**
 * Generate signature for slot purchase
 * @param {string} userAddress - User's wallet address
 * @param {string} raffleId - Raffle ID or address
 * @param {number} slotCount - Number of slots to purchase
 * @param {Object} additionalData - Additional data for signature (optional)
 * @returns {Promise<Object>} Signature data and metadata
 */
export const generatePurchaseSignature = async (userAddress, raffleId, slotCount = 1, additionalData = {}) => {
  try {
    if (!userAddress || !raffleId) {
      throw new Error('User address and raffle ID are required');
    }

    // Validate user address format (basic Ethereum address validation)
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw new Error('Invalid user address format');
    }

    const signatureData = {
      user_address: userAddress.toLowerCase(),
      raffle_id: raffleId,
      raffle_address: raffleId, // Pool address
      slot_count: slotCount,
      ...additionalData
    };

    // Call Supabase Edge Function to generate signature with deadline
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.GENERATE_SIGNATURE, {
      body: signatureData
    });

    if (error) {
      console.error('Signature generation error:', error);
      throw new Error(`Failed to generate signature: ${error.message}`);
    }

    // Store signature record in database for tracking
    await storePurchaseSignature({
      userAddress: signatureData.user_address,
      raffleId: signatureData.raffle_id,
      slotCount: signatureData.slot_count,
      signature: data.signature,
      deadline: data.deadline,
      signatureData: JSON.stringify(signatureData),
      expiresAt: new Date(Date.now() + (15 * 60 * 1000)) // 15 minutes expiry
    });

    return {
      success: true,
      signature: data.signature,
      deadline: data.deadline,
      signatureData,
      expiresAt: data.expires_at,
      metadata: data.metadata || {}
    };

  } catch (error) {
    console.error('Error generating purchase signature:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Verify signature validity
 * @param {string} signature - The signature to verify
 * @param {Object} signatureData - Original signature data
 * @returns {Promise<Object>} Verification result
 */
export const verifyPurchaseSignature = async (signature, signatureData) => {
  try {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.VERIFY_SIGNATURE, {
      body: {
        signature,
        signatureData
      }
    });

    if (error) {
      throw new Error(`Signature verification failed: ${error.message}`);
    }

    return {
      success: true,
      isValid: data.isValid,
      metadata: data.metadata || {}
    };

  } catch (error) {
    console.error('Error verifying signature:', error);
    return {
      success: false,
      error: error.message,
      isValid: false
    };
  }
};

/**
 * Get signature history for a user
 * @param {string} userAddress - User's wallet address
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} Array of signature records
 */
export const getUserSignatureHistory = async (userAddress, limit = 10) => {
  try {
    // Check if supabase is properly configured
    if (!supabase || !supabase.from || typeof supabase.from !== 'function') {
      console.warn('Supabase not configured, returning empty signature history');
      return [];
    }

    const { data, error } = await supabase
      .from('purchase_signatures')
      .select('*')
      .eq('user_address', userAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch signature history: ${error.message}`);
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching signature history:', error);
    return [];
  }
};

/**
 * Get signature for a specific raffle and user
 * @param {string} userAddress - User's wallet address
 * @param {string} raffleId - Raffle ID
 * @returns {Promise<Object|null>} Latest valid signature or null
 */
export const getExistingSignature = async (userAddress, raffleId) => {
  try {
    // Check if supabase is properly configured
    if (!supabase || !supabase.from || typeof supabase.from !== 'function') {
      console.warn('Supabase not configured, returning no existing signature');
      return null;
    }

    const { data, error } = await supabase
      .from('purchase_signatures')
      .select('*')
      .eq('user_address', userAddress.toLowerCase())
      .eq('raffle_id', raffleId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch existing signature: ${error.message}`);
    }

    return data && data.length > 0 ? data[0] : null;

  } catch (error) {
    console.error('Error fetching existing signature:', error);
    return null;
  }
};

/**
 * Store purchase signature in database
 * @param {Object} signatureRecord - Signature record to store
 * @returns {Promise<Object>} Database insert result
 */
const storePurchaseSignature = async (signatureRecord) => {
  try {
    const { data, error } = await supabase
      .from('purchase_signatures')
      .insert([{
        user_address: signatureRecord.userAddress,
        raffle_id: signatureRecord.raffleId,
        slot_count: signatureRecord.slotCount,
        signature: signatureRecord.signature,
        signature_data: signatureRecord.signatureData,
        expires_at: signatureRecord.expiresAt,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      throw new Error(`Failed to store signature: ${error.message}`);
    }

    return data[0];

  } catch (error) {
    console.error('Error storing signature:', error);
    throw error;
  }
};


/**
 * Check if signature is expired
 * @param {string} expiresAt - Expiration timestamp
 * @returns {boolean} True if expired
 */
export const isSignatureExpired = (expiresAt) => {
  return new Date() > new Date(expiresAt);
};

/**
 * Batch generate signatures for multiple purchases
 * @param {Array} purchases - Array of purchase objects {userAddress, raffleId, slotCount}
 * @returns {Promise<Array>} Array of signature results
 */
export const batchGenerateSignatures = async (purchases) => {
  try {
    const results = await Promise.allSettled(
      purchases.map(purchase => 
        generatePurchaseSignature(purchase.userAddress, purchase.raffleId, purchase.slotCount)
      )
    );

    return results.map((result, index) => ({
      purchase: purchases[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));

  } catch (error) {
    console.error('Error in batch signature generation:', error);
    throw error;
  }
};

/**
 * Clean up expired signatures from database
 * @returns {Promise<number>} Number of cleaned up records
 */
export const cleanupExpiredSignatures = async () => {
  try {
    const { data, error } = await supabase
      .from('purchase_signatures')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      throw new Error(`Failed to cleanup expired signatures: ${error.message}`);
    }

    return data ? data.length : 0;

  } catch (error) {
    console.error('Error cleaning up expired signatures:', error);
    return 0;
  }
};

// Export all functions as default object for easier importing
export default {
  generatePurchaseSignature,
  verifyPurchaseSignature,
  getUserSignatureHistory,
  getExistingSignature,
  isSignatureExpired,
  batchGenerateSignatures,
  cleanupExpiredSignatures
};