import { timingSafeEqual } from "node:crypto";
import { runRemotionBundlingSmoke } from "@/lib/remotion/lambda";

export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.REMOTION_BUNDLE_SMOKE_SECRET;
  if (!secret) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function POST(request: Request) {
  if (!process.env.REMOTION_BUNDLE_SMOKE_SECRET) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runRemotionBundlingSmoke();
    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error("Production Remotion bundling smoke failed", error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown bundling error",
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    }, { status: 500 });
  }
}
