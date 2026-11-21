import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "typescript",
    "@remotion/bundler",
    "@remotion/lambda",
    "@remotion/lambda-client",
    "esbuild",
  ],
  outputFileTracingIncludes: {
    "/api/inngest": ["./.agents/skills/remotion-best-practices/**/*.md", "./remotion/**/*.ts", "./remotion/**/*.tsx"],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
