import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js" header.
  poweredByHeader: false,
  headers() {
    return Promise.resolve([
      {
        // The Content-Security-Policy (per-request nonce) is set in src/proxy.ts.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Nothing here needs device features or cross-origin resources.
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]);
  },
};

export default nextConfig;
