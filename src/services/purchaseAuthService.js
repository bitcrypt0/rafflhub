import { supabase, EDGE_FUNCTIONS } from '../config/supabase.js';

/**
 * Service for generating purchase authorization signatures for anti-bot verification.
 * Used for pools where socialEngagementRequired = false.
 * Calls the generate-purchase-auth Supabase Edge Function which produces
 * EIP-712 PurchaseAuthorization signatures verified by the PurchaseAuthorizer contract.
 */

/**
 * Generate a purchase authorization signature for a non-social-engagement pool.
 * @param {string} userAddress - Buyer's wallet address
 * @param {string} poolAddress - Pool contract address
 * @param {number} chainId - Chain ID for network-specific signatures
 * @returns {Promise<Object>} { success, signature, deadline, error }
 */
export const generatePurchaseAuthorization = async (userAddress, poolAddress, chainId) => {
  try {
    if (!userAddress || !poolAddress) {
      throw new Error('User address and pool address are required');
    }

    if (chainId === undefined || chainId === null) {
      throw new Error('Chain ID is required for purchase authorization');
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw new Error('Invalid user address format');
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(poolAddress)) {
      throw new Error('Invalid pool address format');
    }

    const requestBody = {
      user_address: userAddress.toLowerCase(),
      pool_address: poolAddress.toLowerCase(),
      chain_id: chainId
    };

    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.GENERATE_PURCHASE_AUTH, {
      body: requestBody
    });

    if (error) {
      console.error('Purchase authorization error:', error);
      throw new Error(`Failed to generate purchase authorization: ${error.message}`);
    }

    if (!data || !data.success) {
      const errorMsg = data?.error || 'Unknown error generating purchase authorization';
      throw new Error(errorMsg);
    }

    return {
      success: true,
      signature: data.signature,
      deadline: data.deadline,
      expiresAt: data.expires_at
    };

  } catch (error) {
    console.error('Error generating purchase authorization:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  generatePurchaseAuthorization
};
