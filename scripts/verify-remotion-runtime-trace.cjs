const fs = require("node:fs");
const path = require("node:path");
const { getRemotionRuntimePackages } = require("./remotion-runtime-dependencies.cjs");

const projectRoot = path.resolve(__dirname, "..");
const tracePath = path.join(projectRoot, ".next/server/app/api/inngest/route.js.nft.json");
if (!fs.existsSync(tracePath)) {
  throw new Error("Inngest output trace is missing. Run the production build before this check.");
}

const traceDirectory = path.dirname(tracePath);
const tracedFiles = new Set(JSON.parse(fs.readFileSync(tracePath, "utf8")).files.map((file) => path.resolve(traceDirectory, file)));
const packages = getRemotionRuntimePackages(projectRoot);
const missing = [];

function visitPackageFiles(packageInfo, directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visitPackageFiles(packageInfo, fullPath);
    } else if (entry.isFile() && !tracedFiles.has(path.resolve(fullPath))) {
      missing.push(path.relative(projectRoot, fullPath).split(path.sep).join("/"));
    }
  }
}

for (const packageInfo of packages) visitPackageFiles(packageInfo, packageInfo.directory);

const requiredExports = [
  "node_modules/@remotion/effects/dist/esm/preview/brightness.mjs",
  "node_modules/@jridgewell/trace-mapping/dist/trace-mapping.mjs",
  "node_modules/zod/mini/index.js",
];
for (const relativePath of requiredExports) {
  if (!tracedFiles.has(path.resolve(projectRoot, relativePath))) missing.push(relativePath);
}

if (missing.length > 0) {
  console.error(`Inngest trace is missing ${missing.length} Remotion runtime files.`);
  console.error(missing.slice(0, 40).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Inngest trace includes all files from ${packages.length} Remotion runtime packages, including the effects, trace-mapping, and zod ESM export targets.`);
}
