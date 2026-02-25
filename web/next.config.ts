import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: true,
  },
  allowedDevOrigins: ["10.177.186.224", "localhost:3000"],
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
