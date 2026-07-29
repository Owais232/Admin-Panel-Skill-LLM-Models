/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root here so Next ignores stray lockfiles elsewhere on
  // the machine (a stray ~/package-lock.json otherwise changes module
  // resolution in confusing ways).
  outputFileTracingRoot: import.meta.dirname,
  images: {
    // Admin panels routinely render user-uploaded images from object storage.
    // Narrow this to the real bucket hostname before going to production.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
