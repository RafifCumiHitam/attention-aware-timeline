import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Keep MediaPipe out of the server/Turbopack analysis graph.
  // The engine loads the ESM build from CDN at runtime instead.
  serverExternalPackages: ["@mediapipe/tasks-vision"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "commondatastorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  webpack: (config) => {
    // Soften dynamic-import analysis for packages like MediaPipe (webpack mode).
    config.module = config.module ?? {};
    // @ts-expect-error webpack types vary by Next version
    config.module.exprContextCritical = false;
    // @ts-expect-error webpack types vary by Next version
    config.module.unknownContextCritical = false;
    return config;
  },
};

export default nextConfig;
