import "server-only";
import { bundle } from "@remotion/bundler";
import { deleteSite } from "@remotion/lambda";
import { getRenderProgress, presignUrl, renderMediaOnLambdaAndStream } from "@remotion/lambda/client";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { deploySiteFromBundle } from "@remotion/lambda";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  const effectsManifestPath = join(process.cwd(), "node_modules/@remotion/effects/package.json");
  let effectsManifest: {version?:string;exports?:Record<string,unknown>} | null = null;
  try { effectsManifest = JSON.parse(readFileSync(effectsManifestPath,"utf8")); } catch {}
  let effectsManifestResolved: string | null = null;
  let effectsSubpathResolved: string | null = null;
  let remotionEntryResolved: string | null = null;
  let packageJsonResolveError: string | null = null;
  try { effectsManifestResolved = localRequire.resolve("@remotion/effects/package.json"); }
  catch (error) { packageJsonResolveError = error instanceof Error ? error.message : String(error); }
  try { effectsSubpathResolved = localRequire.resolve("@remotion/effects/brightness/preview"); }
  catch (error) { effectsSubpathResolved = `unresolved under CommonJS conditions: ${error instanceof Error ? error.message : String(error)}`; }
  try { remotionEntryResolved = localRequire.resolve("@remotion/studio/renderEntry"); }
  catch (error) { remotionEntryResolved = `unresolved: ${error instanceof Error ? error.message : String(error)}`; }
  const wildcardExport = effectsManifest?.exports?.["./*/preview"] as Record<string,string> | undefined;
  const targetRelative = wildcardExport?.import?.replace("*","brightness") ?? null;
  const targetAbsolute = targetRelative ? join(process.cwd(),"node_modules/@remotion/effects",targetRelative) : null;
  console.info("Remotion Lambda bundler resolution diagnostics",{
    cwd:process.cwd(),node:process.version,vercelCommitSha:process.env.VERCEL_GIT_COMMIT_SHA??null,
    vercelEnvironment:process.env.VERCEL_ENV??null,entryPoint,remotionBundlerEntry:remotionEntryResolved,
    effectsManifestPath,effectsManifestResolved,packageJsonResolveError,
    effectsVersion:effectsManifest?.version??null,
    brightnessPreviewExport:wildcardExport??null,targetRelative,targetAbsolute,
    targetExists:targetAbsolute?existsSync(targetAbsolute):false,effectsSubpathResolved,
  });
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

  const tempRoot = await mkdtemp(join(tmpdir(), "aivid-remotion-"));
  let deployedSite: { siteName: string } | null = null;
  try {
    const entryDir = join(tempRoot, "remotion");
    const generatedDir = join(entryDir, "src");
    const generatedPath = join(generatedDir, "generated-project.tsx");
    const entryPoint = join(entryDir, "index.ts");
    const compositionEntryPoint = join(generatedDir, "export-composition.tsx");
    const indexTemplate = await readFile(join(process.cwd(), "remotion/index.ts"), "utf8");
    const entryTemplate = await readFile(join(process.cwd(), "remotion/src/export-composition.tsx"), "utf8");
    const rootTemplate = await readFile(join(process.cwd(), "remotion/src/root.tsx"), "utf8");
    const settingsSource = `export const settings = ${JSON.stringify(composition)};\nexport const theme = ${JSON.stringify(theme ?? {})};\n`;
    await mkdir(generatedDir, { recursive: true });
    await writeFile(generatedPath, source, { encoding: "utf8", flag: "wx" });
    await writeFile(compositionEntryPoint, entryTemplate, { encoding: "utf8", flag: "wx" });
    await writeFile(join(generatedDir, "root.tsx"), rootTemplate, { encoding: "utf8", flag: "wx" });
    await writeFile(join(generatedDir, "export-settings.ts"), settingsSource, { encoding: "utf8", flag: "wx" });
    await writeFile(entryPoint, indexTemplate, { encoding: "utf8", flag: "wx" });

    logBundlerResolutionDiagnostics(entryPoint);
    const bundleDir = await bundle({
      entryPoint, outDir: join(tempRoot, "bundle"), enableCaching: false,
      rootDir: process.cwd(), publicDir: join(process.cwd(), "public"),
      // Temporary sources live outside the app's node_modules ancestry. Log
      // Webpack's actual export conditions and lookup paths for this run.
      webpackOverride: (config) => {
        console.info("Remotion Webpack resolve context",{
          context:config.context,entry:config.entry,
          resolve:{modules:config.resolve?.modules,conditionNames:config.resolve?.conditionNames,
            mainFields:config.resolve?.mainFields,extensions:config.resolve?.extensions,
            exportsFields:config.resolve?.exportsFields,aliasFields:config.resolve?.aliasFields},
        });
        return {...config,resolve:{...config.resolve,
          modules:[join(process.cwd(),"node_modules"),...(config.resolve?.modules??["node_modules"])],
        }};
      },
    });
    if(process.env.REMOTION_BUNDLER_DIAGNOSTICS_ONLY==="1"){
      throw new Error("Remotion diagnostics-only mode: bundle completed; Lambda deployment and rendering were skipped.");
    }
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
