import "server-only";
import { createRenderJob, executeRenderJob } from "@hyperframes/producer";
import { getFfmpegBinary, getFfprobeBinary, resolveHeadlessShellPath } from "@hyperframes/engine";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function renderHyperframesComposition({
  html,
  fps,
  onProgress,
}: {
  html: string;
  fps: number;
  onProgress?: (progress: number) => Promise<void>;
}) {
  const browserPath = resolveHeadlessShellPath();
  if (!browserPath || !existsSync(browserPath)) {
    throw new Error("HyperFrames export needs its headless Chrome browser. Install it with `npx hyperframes browser ensure` or set HYPERFRAMES_BROWSER_PATH.");
  }
  if (!existsSync(getFfmpegBinary()) || !existsSync(getFfprobeBinary())) {
    throw new Error("HyperFrames export needs FFmpeg 7+ and FFprobe 7+. Install both tools or set HYPERFRAMES_FFMPEG_PATH and HYPERFRAMES_FFPROBE_PATH.");
  }
  const projectDir = await mkdtemp(join(tmpdir(), "aivid-hyperframes-"));
  const outputPath = join(projectDir, "output.mp4");
  try {
    await writeFile(join(projectDir, "index.html"), html, { encoding: "utf8", flag: "wx" });
    const job = createRenderJob({ fps, quality: "standard", format: "mp4", workers: 1 });
    await executeRenderJob(job, projectDir, outputPath, async (current) => {
      if (onProgress) await onProgress(Math.max(1, Math.min(99, Math.round(current.progress))));
    });
    if (job.status !== "complete") throw new Error(job.error || "HyperFrames did not complete the video render.");
    return await readFile(outputPath);
  } finally {
    await rm(projectDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
