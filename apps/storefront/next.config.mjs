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
