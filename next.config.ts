import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize @napi-rs/canvas to prevent webpack from trying to bundle native modules
      config.externals = config.externals || [];
      config.externals.push('@napi-rs/canvas');
    }
    return config;
  },
};

export default nextConfig;
