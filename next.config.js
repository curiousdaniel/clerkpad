const defaultPwaRuntimeCaching = require("next-pwa/cache");

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Avoid precaching `/` as a single revision; auth and HTML must stay fresh when online.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  // First match wins: short-lived HTML cache so deploys/auth apply; then default next-pwa rules.
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        request.mode === "navigate" && url.origin === self.origin,
      handler: "NetworkFirst",
      options: {
        cacheName: "clerkbid-documents",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 120,
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
