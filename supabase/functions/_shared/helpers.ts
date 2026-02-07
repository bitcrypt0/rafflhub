import { ethers } from 'https://esm.sh/ethers@5.7.2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verifies the request carries the Supabase service role key.
 * Returns a 401 Response if unauthorized, null if the request is valid.
 */
export function verifyInternalAuth(req: Request): Response | null {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!serviceKey || token !== serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

/**
 * Fetches blocks in batch, deduplicating block numbers to avoid
 * redundant RPC calls when multiple events share the same block.
 * Returns a map keyed by block number.
 */
export async function fetchBlockMap(
  provider: ethers.providers.JsonRpcProvider,
  blockNumbers: number[]
): Promise<Map<number, ethers.providers.Block>> {
  const unique = [...new Set(blockNumbers)];
  const blocks = await Promise.all(unique.map((n) => provider.getBlock(n)));
  const map = new Map<number, ethers.providers.Block>();
  unique.forEach((n, i) => map.set(n, blocks[i]));
  return map;
}
