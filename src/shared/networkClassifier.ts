export type NetworkCategory = 'business' | 'third-party' | 'analytics' | 'noise';

const ANALYTICS_HOST_HINTS = [
  'analytics',
  'googletagmanager',
  'google-analytics',
  'doubleclick',
  'segment',
  'mixpanel',
  'hotjar',
  'fullstory',
  'amplitude',
  'intercom',
  'clarity',
  'sentry',
  'tracking',
  'collect',
  'pixel',
  'beacon'
];

const ANALYTICS_PATH_HINTS = [
  '/analytics',
  '/collect',
  '/tracking',
  '/beacon',
  '/telemetry',
  '/metrics',
  '/gtag',
  '/tag',
  '/log',
  '/stats'
];

const BUSINESS_PATH_HINTS = [
  '/api',
  '/graphql',
  '/auth',
  '/login',
  '/logout',
  '/checkout',
  '/orders',
  '/payment',
  '/session',
  '/user',
  '/users',
  '/me',
  '/search',
  '/admin',
  '/tenant',
  '/v1',
  '/v2'
];

const NOISE_EXTENSIONS = ['.css', '.js', '.map', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.mp4', '.mp3', '.json'];
const NOISE_PATH_HINTS = [
  '/favicon',
  '/robots.txt',
  '/manifest',
  '/service-worker',
  '/sw.js',
  '/assets/',
  '/static/',
  '/img/',
  '/images/',
  '/fonts/',
  '/media/'
];

export function classifyNetworkUrl(url: string | null | undefined, pageOrigin?: string | null): NetworkCategory {
  if (!url || typeof url !== 'string') return 'noise';

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url, pageOrigin || 'https://example.invalid');
  } catch {
    return 'noise';
  }

  const host = parsedUrl.host.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  const fullTarget = `${host}${pathname}`;

  if (ANALYTICS_HOST_HINTS.some((hint) => host.includes(hint)) || ANALYTICS_PATH_HINTS.some((hint) => pathname.includes(hint))) {
    return 'analytics';
  }

  if (NOISE_EXTENSIONS.some((ext) => pathname.endsWith(ext)) || NOISE_PATH_HINTS.some((hint) => pathname.includes(hint))) {
    return 'noise';
  }

  if (pageOrigin) {
    try {
      const pageUrl = new URL(pageOrigin);
      if (pageUrl.host === host) {
        return 'business';
      }
    } catch {
      // Ignore invalid page origin.
    }
  }

  if (BUSINESS_PATH_HINTS.some((hint) => pathname.includes(hint)) || host.includes('api')) {
    return 'business';
  }

  return 'third-party';
}
