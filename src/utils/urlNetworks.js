import { SUPPORTED_NETWORKS } from '../networks';

// slug -> chainId, supports both name-based slugs and numeric chainId strings
export function resolveChainIdFromSlug(slug) {
  if (!slug) return null;
  // If numeric
  if (/^\d+$/.test(slug)) return parseInt(slug, 10);
  const entries = Object.entries(SUPPORTED_NETWORKS);
  const normalized = slug.toLowerCase();
  for (const [id, net] of entries) {
    const s = net.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (s === normalized) return parseInt(id, 10);
  }
  return null;
}

