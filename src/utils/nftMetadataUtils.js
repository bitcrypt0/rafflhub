/**
 * NFT Metadata URI Utilities
 * 
 * Shared utilities for constructing and processing NFT metadata URIs
 * across different components (PrizeImageCard, RaffleCard, etc.)
 */

/**
 * Generate multiple URI variants for NFT metadata fetching
 * Handles various URI patterns and formats commonly used in NFT collections
 * 
 * @param {string} baseUri - The base URI from contract (unrevealedBaseURI, tokenURI, etc.)
 * @param {number|string|BigInt} tokenId - The token ID
 * @param {number} standard - NFT standard (0 = ERC721, 1 = ERC1155)
 * @param {Object} opts - Optional configuration
 * @param {boolean} opts.prioritizeRoot - Whether to prioritize root candidates for ERC721
 * @returns {string[]} Array of URI variants to try
 */
export const constructMetadataURIs = (baseUri, tokenId, standard, opts = {}) => {
  const uriVariants = [];
  const hadTrailingSlash = /\/$/.test(baseUri);
  const cleanBaseUri = baseUri.replace(/\/$/, '');

  const tokenIdStr = (tokenId !== undefined && tokenId !== null) ? tokenId.toString() : '0';
  const tokenIdBig = (tokenId !== undefined && tokenId !== null) ? BigInt(tokenId) : 0n;
  const hexIdLower = tokenIdBig.toString(16).padStart(64, '0');
  const hexIdUpper = hexIdLower.toUpperCase();
  const isERC1155 = standard === 1;
  const isERC721 = standard === 0;

  const addRootCandidates = (uri) => {
    const candidates = [];
    const root = uri.replace(/\/?(?:[0-9]+|[a-fA-F0-9]{64})(?:\.json)?$/, '');
    if (root && root !== uri) {
      candidates.push(root);
      candidates.push(`${root}/`);
      candidates.push(`${root}/index.json`);
      candidates.push(`${root}/metadata.json`);
    }
    return candidates;
  };

  const alreadyContainsTokenId =
    baseUri.match(/\/(?:[0-9]+|[a-fA-F0-9]{64})(?:\.json)?$/) !== null;

  if (alreadyContainsTokenId) {
    if (isERC1155 || opts.prioritizeRoot) {
      uriVariants.push(...addRootCandidates(baseUri));
    }
    uriVariants.push(baseUri);
    if (!baseUri.includes('.json')) uriVariants.push(`${baseUri}.json`);
    if (isERC721) {
      uriVariants.push(...addRootCandidates(baseUri));
    }
    if (isERC1155) {
      const replaceDecimalWithHex = (uri, alsoJson = true) => {
        const out = [];
        if (uri.match(new RegExp(`/${tokenIdStr}(?:\\.json)?$`))) {
          out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdLower}`));
          if (alsoJson) out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdLower}.json`));
          out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdUpper}`));
          if (alsoJson) out.push(uri.replace(new RegExp(`/${tokenIdStr}(?:\\.json)?$`), `/${hexIdUpper}.json`));
        }
        if (uri.match(new RegExp(`${tokenIdStr}(?:\\.json)?$`))) {
          out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdLower}`));
          if (alsoJson) out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdLower}.json`));
          out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdUpper}`));
          if (alsoJson) out.push(uri.replace(new RegExp(`${tokenIdStr}(?:\\.json)?$`), `${hexIdUpper}.json`));
        }
        return out;
      };
      uriVariants.push(...replaceDecimalWithHex(baseUri, true));
    }
  } else {
    if (isERC1155) {
      uriVariants.push(baseUri);
      if (hadTrailingSlash) uriVariants.push(cleanBaseUri + '/');
      uriVariants.push(`${cleanBaseUri}.json`);
      uriVariants.push(`${cleanBaseUri}/index.json`);
      uriVariants.push(`${cleanBaseUri}/metadata.json`);
      uriVariants.push(`${cleanBaseUri}/${hexIdLower}`);
      uriVariants.push(`${cleanBaseUri}${hexIdLower}`);
      uriVariants.push(`${cleanBaseUri}/${hexIdLower}.json`);
      uriVariants.push(`${cleanBaseUri}${hexIdLower}.json`);
      uriVariants.push(`${cleanBaseUri}/${hexIdUpper}`);
      uriVariants.push(`${cleanBaseUri}${hexIdUpper}`);
      uriVariants.push(`${cleanBaseUri}/${hexIdUpper}.json`);
      uriVariants.push(`${cleanBaseUri}${hexIdUpper}.json`);
      uriVariants.push(`${cleanBaseUri}/${tokenIdStr}`);
      uriVariants.push(`${cleanBaseUri}${tokenIdStr}`);
      uriVariants.push(`${cleanBaseUri}/${tokenIdStr}.json`);
      uriVariants.push(`${cleanBaseUri}${tokenIdStr}.json`);
    } else {
      uriVariants.push(baseUri);
      if (hadTrailingSlash) uriVariants.push(cleanBaseUri + '/');
      uriVariants.push(`${cleanBaseUri}.json`);
      uriVariants.push(`${cleanBaseUri}/index.json`);
      uriVariants.push(`${cleanBaseUri}/metadata.json`);
      uriVariants.push(`${cleanBaseUri}/${tokenIdStr}`);
      uriVariants.push(`${cleanBaseUri}${tokenIdStr}`);
      uriVariants.push(`${cleanBaseUri}/${tokenIdStr}.json`);
      uriVariants.push(`${cleanBaseUri}${tokenIdStr}.json`);
    }

    if (baseUri.includes('{id}')) {
      uriVariants.push(baseUri.replace('{id}', hexIdLower));
      uriVariants.push(baseUri.replace('{id}', tokenIdStr));
      uriVariants.push(baseUri.replace('{id}', hexIdUpper));
    }
  }

  return [...new Set(uriVariants)];
};

/**
 * Classify URI format for appropriate processing
 * 
 * @param {string} uri - The URI to classify
 * @returns {string} Classification type
 */
export const classifyURI = (uri) => {
  if (!uri) return 'empty';
  if (uri.startsWith('data:')) return 'data_uri';
  if (uri.startsWith('ipfs://')) return 'ipfs';
  if (uri.startsWith('ipns://')) return 'ipns';
  if (uri.startsWith('ar://')) return 'arweave';
  if (uri.includes('/ipfs/') || uri.includes('/ipns/')) return 'gateway_url';
  if (uri.match(/\/\d+$/)) return 'numeric_endpoint';
  if (uri.includes('{id}')) return 'template_format';
  if (uri.endsWith('/')) return 'base_directory';
  return 'unknown_format';
};

export default {
  constructMetadataURIs,
  classifyURI
};
