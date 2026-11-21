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
    "/api/inngest": [
      "./.agents/skills/remotion-best-practices/**/*.md",
      "./remotion/**/*.ts",
      "./remotion/**/*.tsx",
      // validateComposition uses TypeScript's compiler API at runtime. Its
      // lib files and React declarations are loaded dynamically and otherwise
      // omitted from Vercel's trace for this route.
      "./node_modules/typescript/lib/**/*",
      "./node_modules/@types/react/**/*",
      "./node_modules/@types/prop-types/**/*",
      "./node_modules/csstype/**/*",
    ],
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
