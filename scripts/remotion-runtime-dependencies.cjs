const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_ROOTS = [
  "@remotion/bundler",
  "react",
  "react-dom",
  "remotion",
  "lucide-react",
];

function resolveInstalledPackage(name, fromDirectory) {
  let directory = fromDirectory;
  while (true) {
    const candidate = path.join(directory, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return candidate;
    }

    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function getRemotionRuntimePackages(projectRoot = path.resolve(__dirname, "..")) {
  const queue = RUNTIME_ROOTS.map((name) => ({
    name,
    fromDirectory: projectRoot,
  }));
  const visited = new Set();
  const packages = [];

  while (queue.length > 0) {
    const next = queue.shift();
    const packageDirectory = resolveInstalledPackage(next.name, next.fromDirectory);
    if (!packageDirectory) continue;

    const realDirectory = fs.realpathSync(packageDirectory);
    if (visited.has(realDirectory)) continue;
    visited.add(realDirectory);

    const manifestPath = path.join(packageDirectory, "package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const relativeDirectory = path.relative(projectRoot, packageDirectory).split(path.sep).join("/");
    packages.push({
      name: manifest.name,
      version: manifest.version,
      directory: packageDirectory,
      relativeDirectory,
    });

    // Remotion's Studio entry and generated compositions are resolved by
    // Webpack at runtime. Follow production, optional and installed peer
    // dependencies so all of their package exports and assets are traced.
    const dependencies = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    for (const name of dependencies) {
      queue.push({ name, fromDirectory: packageDirectory });
    }
  }

  return packages.sort((a, b) => a.relativeDirectory.localeCompare(b.relativeDirectory));
}

function getRemotionRuntimePackageIncludes(projectRoot) {
  return getRemotionRuntimePackages(projectRoot).map(
    ({ relativeDirectory }) => `./${relativeDirectory}/**/*`,
  );
}

module.exports = {
  getRemotionRuntimePackages,
  getRemotionRuntimePackageIncludes,
};
