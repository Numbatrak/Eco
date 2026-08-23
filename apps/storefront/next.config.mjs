import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Gives `next dev` access to Cloudflare bindings (env vars, etc.) so local
// dev behaves like the deployed Worker. No-ops outside of `next dev`.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@platform/shared-types"],
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
};

export default nextConfig;
