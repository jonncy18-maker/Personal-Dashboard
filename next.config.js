/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // App Router, file-based routing — one route per domain under app/.
  // No SPA-shell rewrite hack here: unlike the NextGen-Immersion gold standard
  // (a HashRouter SPA migrated into a Next shell), this is a greenfield App
  // Router app, so deep links resolve to real server-rendered routes directly.
};

export default nextConfig;
