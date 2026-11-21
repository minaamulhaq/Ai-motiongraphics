const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const ts = require('typescript');
const { bundle } = require('@remotion/bundler');

async function main() {
  await bundle({ entryPoint: path.resolve('remotion/src/export-composition.tsx'), outDir: path.resolve('.studio-data/remotion-bundle-check'), enableCaching: false });
  console.log('Manual deployment entry: bundle passed.');

  // Run the actual export function with AWS operations stubbed. The real bundler
  // still processes the generated temporary files and resolves dependencies.
  const source = await fs.readFile('lib/remotion/lambda.ts', 'utf8');
  const code = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const cleanModule = { exports: {} };
  const cleanCode = ts.transpileModule(await fs.readFile('lib/remotion/clean-source.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', cleanCode)(require, cleanModule.exports);
  const bindings = {
    cleanCompositionSource: cleanModule.exports.cleanCompositionSource,
    ...fs, ...path, tmpdir: os.tmpdir, randomUUID: crypto.randomUUID, ts,
    bundle, validateComposition: () => [],
    deploySiteFromBundle: async ({ bundleDir }) => {
      await fs.access(path.join(bundleDir, 'index.html'));
      return { serveUrl: 'https://example.invalid/local-test' };
    },
    renderMediaOnLambdaAndStream: async (options) => {
      assert.equal(options.composition, 'ProjectExport');
      return { renderId: 'local-test', outBucket: 'test', outKey: 'video.mp4' };
    },
    deleteSite: async () => {},
  };
  const moduleExports = {};
  new Function('exports', ...Object.keys(bindings), code)(moduleExports, ...Object.values(bindings));
  process.env.REMOTION_AWS_REGION = 'us-east-1';
  process.env.REMOTION_LAMBDA_FUNCTION_NAME = 'local-test';
  process.env.REMOTION_LAMBDA_BUCKET = 'local-test';
  const generated = `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Sparkles } from 'lucide-react';
export const videoConfig = { width: 1080, height: 1920, fps: 24, durationInFrames: 48 };
export default function Video({theme}) { return <AbsoluteFill style={{backgroundColor: theme.background}}><Sparkles/>Generated export</AbsoluteFill>; }`;
  assert.deepEqual(moduleExports.readCompositionConfig(generated), { width: 1080, height: 1920, fps: 24, durationInFrames: 48 });
  const result = await moduleExports.renderProjectOnLambda({ source: generated, projectId: 'local-test', title: 'Check', theme: { background: '#123456', label: '$& test' } });
  assert.equal(result.outputKey, 'video.mp4');
  console.log('Automatic export entry: temporary bundle passed (AWS calls stubbed).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
