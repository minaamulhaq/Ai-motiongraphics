import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { Config } from "@remotion/cli/config";

// Remotion's Lambda CLI reads process.env directly. Load only AWS credentials
// from Next.js' local env file so unrelated app secrets are never imported.
const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) {
  const localEnv = parse(readFileSync(localEnvPath));
  const credentials: Record<string, string> = {
    REMOTION_AWS_ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
    REMOTION_AWS_SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
  };

  for (const [remotionName, standardName] of Object.entries(credentials)) {
    const value = process.env[remotionName] || localEnv[remotionName] || process.env[standardName] || localEnv[standardName];
    if (value && !process.env[remotionName]) process.env[remotionName] = value;
  }
}

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
