const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");
const { bundle } = require("@remotion/bundler");

async function main() {
  const source = fs.readFileSync("lib/remotion/lambda.ts", "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const cleanSourceModule = { exports: {} };
  const cleanSource = ts.transpileModule(
    fs.readFileSync("lib/remotion/clean-source.ts", "utf8").replace(/^import .*;\r?\n/gm, ""),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  new Function("exports", "ts", cleanSource)(cleanSourceModule.exports, ts);

  const validatorModule = { exports: {} };
  const validatorSource = ts.transpileModule(
    fs.readFileSync("lib/ai/validate-composition.ts", "utf8").replace(/^import .*;\r?\n/gm, ""),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  new Function("exports", "ts", "path", validatorSource)(validatorModule.exports, ts, path);

  const runtime = { exports: {} };
  const bindings = {
    ts,
    bundle,
    cleanCompositionSource: cleanSourceModule.exports.cleanCompositionSource,
    validateComposition: validatorModule.exports.validateComposition,
    createHash: crypto.createHash,
    randomUUID: crypto.randomUUID,
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    createRequire: require("node:module").createRequire,
    ...fsp,
    tmpdir: os.tmpdir,
    join: path.join,
    deleteSite: async () => {},
    deploySiteFromBundle: async () => { throw new Error("The bundling smoke must not deploy an AWS site."); },
    getRenderProgress: async () => { throw new Error("The bundling smoke must not contact AWS."); },
    presignUrl: async () => { throw new Error("The bundling smoke must not contact AWS."); },
    renderMediaOnLambdaAndStream: async () => { throw new Error("The bundling smoke must not render on AWS."); },
  };
  new Function("exports", ...Object.keys(bindings), compiled)(runtime.exports, ...Object.values(bindings));

  const result = await runtime.exports.runRemotionBundlingSmoke();
  assert.equal(result.ok, true);
  assert.ok(result.bundleFiles > 0, "Webpack should produce bundle files");
  assert.ok(result.bundleBytes > 0, "Webpack output should not be empty");
  console.log("Remotion bundle-only smoke passed:", result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
