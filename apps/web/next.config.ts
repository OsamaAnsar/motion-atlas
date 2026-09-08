import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Internal packages (packages/*) are consumed as TypeScript source.
  transpilePackages: [],
  eslint: {
    // Type-checking is the gate (`pnpm typecheck`); lint is advisory in CI.
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
