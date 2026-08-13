const rawAssetBaseUrl = import.meta.env.VITE_ASSET_BASE_URL?.trim() ?? '';
const rawAssetVersion = import.meta.env.VITE_ASSET_VERSION?.trim() ?? '20260724-2';
const appBasePath = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export const ASSET_BASE_URL = rawAssetBaseUrl.replace(/\/+$/, '');
export const ASSET_VERSION = rawAssetVersion;

function versionedMediaPath(path: string) {
  if (!ASSET_VERSION || !/\.(?:mp4|webm|mp3|wav|png|jpe?g|webp|svg)(?:[?#]|$)/i.test(path)) {
    return path;
  }

  if (/[?&]av=/.test(path)) return path;
  return `${path}${path.includes('?') ? '&' : '?'}av=${encodeURIComponent(ASSET_VERSION)}`;
}

export function assetUrl(path: string) {
  if (!path) return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const resolvedPath = ASSET_BASE_URL
    ? `${ASSET_BASE_URL}${normalizedPath}`
    : `${appBasePath}${normalizedPath}`;
  return versionedMediaPath(resolvedPath);
}
