import "server-only";
import { bundle } from "@remotion/bundler";
import { deleteSite } from "@remotion/lambda";
import { getRenderProgress, presignUrl, renderMediaOnLambdaAndStream } from "@remotion/lambda/client";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { deploySiteFromBundle } from "@remotion/lambda";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { validateComposition } from "@/lib/ai/validate-composition";
import { cleanCompositionSource } from "./clean-source";

function config() {
  const region = process.env.REMOTION_AWS_REGION;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const bucketName = process.env.REMOTION_LAMBDA_BUCKET;
  if (!region || !functionName || !bucketName) {
    throw new Error("Remotion Lambda is not configured. Set REMOTION_AWS_REGION, REMOTION_LAMBDA_FUNCTION_NAME and REMOTION_LAMBDA_BUCKET.");
  }
  return { region: region as Parameters<typeof getRenderProgress>[0]["region"], functionName, bucketName };
}

export function readCompositionConfig(source: string) {
  const parsed = ts.createSourceFile("SavedComposition.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = parsed.statements.find((statement): statement is ts.VariableStatement =>
    ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true &&
    statement.declarationList.declarations.some((item) => ts.isIdentifier(item.name) && item.name.text === "videoConfig"),
  );
  const initializer = declaration?.declarationList.declarations.find((item) => ts.isIdentifier(item.name) && item.name.text === "videoConfig")?.initializer;
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error("Saved video settings are invalid.");
  const values: Record<string, number> = {};
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || !["width", "height", "fps", "durationInFrames"].includes(property.name.text)) continue;
    if (ts.isNumericLiteral(property.initializer)) values[property.name.text] = Number(property.initializer.text);
  }
  const { width, height, fps, durationInFrames } = values;
  if (![width, height, fps, durationInFrames].every((value) => Number.isInteger(value) && value > 0) || durationInFrames! > 1800 || width! > 3840 || height! > 3840) {
    throw new Error("Saved video settings are outside supported export limits.");
  }
  return { width: width!, height: height!, fps: fps!, durationInFrames: durationInFrames! };
}

function logBundlerResolutionDiagnostics(entryPoint: string) {
  const localRequire = createRequire(join(process.cwd(), "package.json"));
  const packageLockPath = join(process.cwd(),"package-lock.json");
  let lockInfo: {lockfileVersion?:number;packages?:Record<string,{version?:string}>} | null = null;
  try { lockInfo = JSON.parse(readFileSync(packageLockPath,"utf8")); } catch {}
  let remotionEntryResolved: string | null = null;
  try { remotionEntryResolved = localRequire.resolve("@remotion/studio/renderEntry"); }
  catch (error) { remotionEntryResolved = `unresolved: ${error instanceof Error ? error.message : String(error)}`; }

  const inspectExport = (packageName: string, subpath: string) => {
    const packageRoot = join(process.cwd(), "node_modules", packageName);
    let manifest: { version?: string; exports?: Record<string, unknown> } | null = null;
    try { manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")); } catch {}

    let exportKey = subpath;
    let exportValue = manifest?.exports?.[exportKey];
    if (exportValue === undefined && manifest?.exports) {
      const matchingKey = Object.keys(manifest.exports).find((key) => {
        const wildcard = key.indexOf("*");
        return wildcard !== -1 && subpath.startsWith(key.slice(0, wildcard)) && subpath.endsWith(key.slice(wildcard + 1));
      });
      if (matchingKey) {
        exportKey = matchingKey;
        const starIndex = matchingKey.indexOf("*");
        const wildcardValue = subpath.slice(starIndex, subpath.length - (matchingKey.length - starIndex - 1));
        exportValue = manifest.exports[matchingKey];
        const replaceWildcard = (value: unknown): unknown => {
          if (typeof value === "string") return value.replaceAll("*", wildcardValue);
          if (Array.isArray(value)) return value.map(replaceWildcard);
          if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceWildcard(nested)]));
          return value;
        };
        exportValue = replaceWildcard(exportValue);
      }
    }

    const targets: Record<string, { target: string; exists: boolean }[]> = {};
    const visit = (value: unknown, condition: string) => {
      if (typeof value === "string" && value.startsWith("./")) {
        (targets[condition] ??= []).push({ target: value, exists: existsSync(join(packageRoot, value)) });
      } else if (Array.isArray(value)) {
        value.forEach((nested) => visit(nested, condition));
      } else if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value)) visit(nested, `${condition}.${key}`);
      }
    };
    visit(exportValue, "export");

    let manifestResolved: string | null = null;
    let requireResolved: string | null = null;
    try { manifestResolved = localRequire.resolve(`${packageName}/package.json`); } catch {}
    try { requireResolved = localRequire.resolve(`${packageName}${subpath.slice(1)}`); } catch {}
    return { packageName, version: manifest?.version ?? null, manifestResolved, exportKey, exportValue: exportValue ?? null, targets, requireResolved };
  };

  const packageExports = [
    inspectExport("@remotion/effects", "./brightness/preview"),
    inspectExport("@jridgewell/trace-mapping", "."),
    inspectExport("zod", "./mini"),
  ];
  console.info("Remotion Lambda bundler resolution diagnostics",{
    cwd:process.cwd(),node:process.version,vercelCommitSha:process.env.VERCEL_GIT_COMMIT_SHA??null,
    vercelEnvironment:process.env.VERCEL_ENV??null,entryPoint,remotionBundlerEntry:remotionEntryResolved,
    lockfileVersion:lockInfo?.lockfileVersion??null,
    packageLockSha256:existsSync(packageLockPath)?createHash("sha256").update(readFileSync(packageLockPath)).digest("hex"):null,
    lockedVersions:Object.fromEntries(["remotion","@remotion/effects","@remotion/bundler","@remotion/lambda","@remotion/studio","@jridgewell/trace-mapping","zod"].map((name)=>[
      name,lockInfo?.packages?.[`node_modules/${name}`]?.version??null,
    ])),
    packageExports:JSON.stringify(packageExports),
  });
}

async function createCompositionBundle(source: string, theme: unknown, composition: ReturnType<typeof readCompositionConfig>) {
  const tempRoot = await mkdtemp(join(tmpdir(), "aivid-remotion-"));
  try {
    const entryDir = join(tempRoot, "remotion");
    const generatedDir = join(entryDir, "src");
    const generatedPath = join(generatedDir, "generated-project.tsx");
    const entryPoint = join(entryDir, "index.ts");
    const indexTemplate = await readFile(join(process.cwd(), "remotion/index.ts"), "utf8");
    const entryTemplate = await readFile(join(process.cwd(), "remotion/src/export-composition.tsx"), "utf8");
    const rootTemplate = await readFile(join(process.cwd(), "remotion/src/root.tsx"), "utf8");
    const settingsSource = `export const settings = ${JSON.stringify(composition)};\nexport const theme = ${JSON.stringify(theme ?? {})};\n`;
    await mkdir(generatedDir, { recursive: true });
    await writeFile(generatedPath, source, { encoding: "utf8", flag: "wx" });
    await writeFile(join(generatedDir, "export-composition.tsx"), entryTemplate, { encoding: "utf8", flag: "wx" });
    await writeFile(join(generatedDir, "root.tsx"), rootTemplate, { encoding: "utf8", flag: "wx" });
    await writeFile(join(generatedDir, "export-settings.ts"), settingsSource, { encoding: "utf8", flag: "wx" });
    await writeFile(entryPoint, indexTemplate, { encoding: "utf8", flag: "wx" });

    logBundlerResolutionDiagnostics(entryPoint);
    const bundleDir = await bundle({
      entryPoint, outDir: join(tempRoot, "bundle"), enableCaching: false,
      rootDir: process.cwd(), publicDir: join(process.cwd(), "public"),
      // Generated files are in /tmp, so point Webpack's resolver back at the
      // deployed app's traced runtime packages.
      webpackOverride: (config) => {
        console.info("Remotion Webpack resolve context",{
          context:config.context,entry:config.entry,target:config.target,
          resolve:{modules:config.resolve?.modules,conditionNames:config.resolve?.conditionNames,
            mainFields:config.resolve?.mainFields,extensions:config.resolve?.extensions,
            exportsFields:config.resolve?.exportsFields,aliasFields:config.resolve?.aliasFields,
            webpackDefaultConditions:"ESM: import,module,...; CommonJS: require,module,..."},
        });
        return {...config,resolve:{...config.resolve,
          modules:[join(process.cwd(),"node_modules"),...(config.resolve?.modules??["node_modules"])],
        }};
      },
    });
    return { tempRoot, bundleDir };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function getDirectoryStats(directory: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await getDirectoryStats(fullPath);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += (await stat(fullPath)).size;
    }
  }
  return { files, bytes };
}

export async function runRemotionBundlingSmoke() {
  const source = `import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Sparkles } from "lucide-react";
export const videoConfig = { width: 320, height: 180, fps: 24, durationInFrames: 48 };
export default function SmokeComposition({ theme }: { theme: any }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ backgroundColor: theme.colors.background, color: theme.colors.foreground, alignItems: "center", justifyContent: "center", fontFamily: theme.typography.fontFamily }}>
    <Sequence from={0} durationInFrames={durationInFrames}><div style={{ opacity }}><Sparkles /> Remotion bundle smoke</div></Sequence>
  </AbsoluteFill>;
}`;
  const issues = validateComposition(source);
  if (issues.length) throw new Error(`Bundling smoke composition failed validation: ${issues.join("; ")}`);

  const startedAt = Date.now();
  const bundleResult = await createCompositionBundle(source, {
    colors: { background: "#101018", foreground: "#ffffff", primary: "#ff7139", secondary: "#8c5cff" },
    typography: { fontFamily: "Arial", headingWeight: 700, bodySize: 24 },
  }, readCompositionConfig(source));
  try {
    const stats = await getDirectoryStats(bundleResult.bundleDir);
    if (!existsSync(join(bundleResult.bundleDir, "index.html"))) {
      throw new Error("Remotion bundling smoke completed without an index.html output.");
    }
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      bundleFiles: stats.files,
      bundleBytes: stats.bytes,
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    };
  } finally {
    await rm(bundleResult.tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function renderProjectOnLambda({ source, projectId, title, theme, onInit, onProgress }: {
  source: string; projectId: string; title: string; theme: unknown;
  onInit?: (renderId: string, bucketName: string) => Promise<void>;
  onProgress?: (progress: number) => Promise<void>;
}) {
  const aws = config();
  source = cleanCompositionSource(source);
  const issues = validateComposition(source);
  if (issues.length) throw new Error("The saved composition did not pass export validation.");
  const composition = readCompositionConfig(source);

  const { tempRoot, bundleDir } = await createCompositionBundle(source, theme, composition);
  let deployedSite: { siteName: string } | null = null;
  try {
    const siteName = `aivid-${projectId}-${randomUUID()}`;
    const site = await deploySiteFromBundle({
      region: aws.region,
      bucketName: aws.bucketName,
      siteName,
      bundleDir,
      privacy: "public",
      throwIfSiteExists: true,
    });
    deployedSite = { siteName };
    const outName = `${title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").slice(0, 64) || "aivid-video"}.mp4`;
    const render = await renderMediaOnLambdaAndStream({
      region: aws.region,
      functionName: aws.functionName,
      serveUrl: site.serveUrl,
      composition: "ProjectExport",
      codec: "h264",
      // Keep parallel invocations within the low default concurrency quota
      // that new AWS accounts commonly receive.
      concurrency: 5,
      outName,
      privacy: "private",
      logLevel: "error",
      onInit: async (started) => onInit?.(started.renderId, started.bucketName),
      onProgress: async (progress) => onProgress?.(Math.max(0, Math.min(99, Math.round(progress.overallProgress * 100)))),
    });
    return { renderId: render.renderId, bucketName: render.outBucket, outputKey: render.outKey };
  } finally {
    if (deployedSite) await deleteSite({ region: aws.region, bucketName: aws.bucketName, siteName: deployedSite.siteName }).catch((error) => console.error("Could not remove temporary Remotion site:", error));
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function getProjectRenderProgress(renderId: string, outputBucket: string) {
  const aws = config();
  const progress = await getRenderProgress({ region: aws.region, functionName: aws.functionName, renderId, bucketName: outputBucket });
  const downloadUrl = progress.done && progress.outKey ? await presignUrl({ region: aws.region, bucketName: outputBucket, objectKey: progress.outKey, expiresInSeconds: 900 }) : null;
  return { done: progress.done, overallProgress: progress.overallProgress, outputKey: progress.outKey, downloadUrl, errors: progress.errors.map((error) => error.message) };
}

export async function getProjectDownloadUrl(outputBucket: string, outputKey: string) {
  const aws = config();
  return presignUrl({ region: aws.region, bucketName: outputBucket, objectKey: outputKey, expiresInSeconds: 900 });
}
