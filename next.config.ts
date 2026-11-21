import type { NextConfig } from "next";
import { getRemotionRuntimePackageIncludes } from "./scripts/remotion-runtime-dependencies.cjs";

const remotionRuntimePackageIncludes = getRemotionRuntimePackageIncludes();
const remotionRuntimeTraceIncludes = [
  ...remotionRuntimePackageIncludes,
  "./public/**/*",
  "./remotion/**/*.ts",
  "./remotion/**/*.tsx",
  "./node_modules/typescript/lib/**/*",
  "./node_modules/@types/react/**/*",
  "./node_modules/@types/prop-types/**/*",
  "./node_modules/csstype/**/*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "typescript",
    "@remotion/bundler",
    "@remotion/lambda",
    "@remotion/lambda-client",
    "esbuild",
  ],
  outputFileTracingIncludes: {
    "/api/projects/*/preview": [
      // The preview route uses esbuild to bundle saved compositions at runtime;
      // these imports are resolved dynamically and must be present in Vercel's
      // serverless function trace.
      "./node_modules/esbuild/**/*",
      "./node_modules/@esbuild/**/*",
      "./node_modules/@remotion/player/**/*",
      "./node_modules/remotion/**/*",
      "./node_modules/react/**/*",
      "./node_modules/react-dom/**/*",
      "./node_modules/scheduler/**/*",
      "./node_modules/lucide-react/**/*",
    ],
    "/api/inngest": [
      // @remotion/bundler invokes Webpack dynamically after Vercel has traced
      // this route. NFT follows Node's CommonJS conditions, while Webpack
      // resolves ESM/browser exports from Remotion Studio and generated TSX.
      // Include the installed runtime dependency closure so both export targets
      // and their transitive modules are present without copying all node_modules.
      ...remotionRuntimeTraceIncludes,
      "./.agents/skills/remotion-best-practices/**/*.md",
      "./.agents/skills/hyperframes/SKILL.md",
      "./.agents/skills/hyperframes/references/motion.md",
    ],
    "/api/internal/remotion-bundle-smoke": remotionRuntimeTraceIncludes,
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
