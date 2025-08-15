import { SUPPORTED_NETWORKS } from '../networks';

// Generate a stable, URL-safe slug from a chainId
export function chainIdToSlug(chainId) {
  const net = SUPPORTED_NETWORKS?.[chainId];
  if (!net?.name) return String(chainId);
  return net.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
