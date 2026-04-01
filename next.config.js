const defaultPwaRuntimeCaching = require("next-pwa/cache");

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Cache `/` on first install (register.js + Workbox) so the installed app can open offline.
  cacheStartUrl: true,
  dynamicStartUrl: true,
  // Cache same-origin navigations from next/link while online for offline clerking.
  cacheOnFrontEndNav: true,
  // When a page was never cached, serve branded HTML instead of the browser error UI.
  fallbacks: {
    document: "/offline.html",
  },
  // Stale-while-revalidate: offline uses last cached shell; online refreshes in background.
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        request.mode === "navigate" && url.origin === self.origin,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "clerkbid-documents",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    ...defaultPwaRuntimeCaching,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

module.exports = withPWA(nextConfig);
