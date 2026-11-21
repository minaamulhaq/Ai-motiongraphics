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
      // Remotion's bundler resolves Mediabunny's conditional package exports
      // while packaging a render. Include the complete dist targets in Vercel.
      "./node_modules/mediabunny/**/*",
      "./node_modules/@remotion/studio/**/*",
      "./node_modules/@remotion/studio-shared/**/*",
      "./node_modules/@remotion/studio-protocol/**/*",
      "./node_modules/lucide-react/**/*",
      "./node_modules/react/**/*",
      "./node_modules/react-dom/**/*",
      "./node_modules/scheduler/**/*",
      "./public/**/*",
      "./.agents/skills/remotion-best-practices/**/*.md",
      "./remotion/**/*.ts",
      "./remotion/**/*.tsx",
      // validateComposition uses TypeScript's compiler API at runtime. Its
      // lib files and React declarations are loaded dynamically and otherwise
      // omitted from Vercel's trace for this route.
      "./node_modules/typescript/lib/**/*",
      // Generated TSX imports Remotion directly. Keep its shipped declaration
      // files in the serverless trace for the runtime TypeScript compiler.
      "./node_modules/remotion/**/*",
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
