/**
 * Subdomain routing utilities
 * Handles the split between www.dropr.fun (homepage) and app.dropr.fun (dapp)
 */

export const isAppSubdomain = () => {
  return window.location.hostname.startsWith('app.');
};

export const isLocalDev = () => {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

/**
 * Get the base domain without any subdomain prefix (www. or app.)
 */
const getBaseDomain = () => {
  return window.location.hostname.replace(/^(www\.|app\.)/, '');
};

/**
 * Get the correct URL for navigating to the app root.
 * - localhost:       '/app'
 * - app.dropr.fun:   '/'
 * - www.dropr.fun:   'https://app.dropr.fun'
 */
export const getAppRootUrl = () => {
  if (isLocalDev()) return '/app';
  if (isAppSubdomain()) return '/';
  return `${window.location.protocol}//app.${getBaseDomain()}`;
};

/**
 * Get the correct URL for navigating to the homepage.
 * - localhost:       '/'
 * - www.dropr.fun:   '/'
 * - app.dropr.fun:   'https://www.dropr.fun'
 */
export const getHomepageUrl = () => {
  if (isLocalDev()) return '/';
  if (!isAppSubdomain()) return '/';
  return `${window.location.protocol}//www.${getBaseDomain()}`;
};

/**
 * Get the correct href for any app route.
 * On app subdomain or localhost: returns the path as-is (internal, use with <Link>).
 * On www subdomain:              returns an absolute URL    (external, use with <a>).
 */
export const getAppHref = (path) => {
  if (isLocalDev() || isAppSubdomain()) return path;
  return `${window.location.protocol}//app.${getBaseDomain()}${path}`;
};

/**
 * Returns true when the URL is absolute (starts with http:// or https://).
 */
export const isExternalUrl = (url) => {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
};
