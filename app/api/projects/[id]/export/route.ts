import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { studioDatabase } from "@/lib/supabase/admin";
import { workerDatabase } from "@/lib/supabase/worker";
import { inngest } from "@/lib/inngest/client";
import { getProjectDownloadUrl } from "@/lib/remotion/lambda";

export const maxDuration = 30;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
type Context = { params: Promise<{ id: string }> };
const hyperframesStorage = "supabase:hyperframes-videos";

async function downloadUrl(db: Awaited<ReturnType<typeof studioDatabase>>, bucket: string, key: string) {
  if (bucket !== hyperframesStorage) return getProjectDownloadUrl(bucket, key);
  const { data, error } = await db.storage.from("hyperframes-videos").createSignedUrl(key, 900);
  if (error) throw error;
  return data.signedUrl;
}

export async function POST(request: NextRequest, { params }: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);
  const user = await currentUser();
  if (!user) return json({ error: "Please sign in to export this video." }, 401);
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid project." }, 400);
    const db = await studioDatabase();
    const project = await db.from("projects").select("id,user_id,title,art,theme_config").eq("id", id).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data || project.data.user_id !== user.id) return json({ error: "Only the project owner can export this video." }, 403);
    const version = await db.from("project_video_versions").select("run_id,theme").eq("project_id", id).order("completed_at", { ascending: false }).limit(1).maybeSingle();
    if (version.error) throw version.error;
    if (!version.data) return json({ error: "This project does not have a completed video to export yet." }, 409);

    const prior = await db.from("project_video_exports").select("*").eq("project_id", id).eq("run_id", version.data.run_id)
      .in("status", ["queued", "rendering", "completed"]).maybeSingle();
    if (prior.error) throw prior.error;
    if (prior.data) {
      const signedUrl = prior.data.status === "completed" && prior.data.output_bucket && prior.data.output_key
        ? await downloadUrl(db, prior.data.output_bucket, prior.data.output_key) : null;
      return json({ export: prior.data, downloadUrl: signedUrl, reused: true });
    }

    const workerDb = workerDatabase();
    const created = await workerDb.from("project_video_exports").insert({
      project_id: id, owner_id: user.id, run_id: version.data.run_id, status: "queued", progress: 0,
    }).select("*").single();
    if (created.error) {
      if (created.error.code === "23505") {
        const concurrent = await db.from("project_video_exports").select("*").eq("project_id", id).eq("run_id", version.data.run_id)
          .in("status", ["queued", "rendering", "completed"]).maybeSingle();
        if (concurrent.data) return json({ export: concurrent.data, downloadUrl: null, reused: true });
      }
      throw created.error;
    }
    try {
      await inngest.send({ id: `export-${created.data.id}`, name: "video/export.requested", data: { exportId: created.data.id, projectId: id, runId: version.data.run_id, ownerId: user.id } });
    } catch (error) {
        await workerDb.from("project_video_exports").update({ status: "failed", error: "The export queue is unavailable. Click Export MP4 to retry.", updated_at: new Date().toISOString() }).eq("id", created.data.id);
      throw error;
    }
    return json({ export: created.data, downloadUrl: null, reused: false }, 202);
  } catch (error) {
    console.error("Could not queue project export:", error);
    const message = error instanceof Error && error.message.includes("not configured") ? error.message : "Could not start the video export. Please try again.";
    return json({ error: message }, 503);
  }
}

export async function GET(request: NextRequest, { params }: Context) {
  const user = await currentUser();
  if (!user) return json({ error: "Please sign in to view this export." }, 401);
  try {
    const { id } = await params;
    const exportId = request.nextUrl.searchParams.get("exportId");
    if (!/^[0-9a-f-]{36}$/i.test(id) || !exportId) return json({ error: "Invalid export request." }, 400);
    const db = await studioDatabase();
    const result = await db.from("project_video_exports").select("*").eq("id", exportId).eq("project_id", id).eq("owner_id", user.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return json({ error: "Export not found." }, 404);
    const signedUrl = result.data.status === "completed" && result.data.output_bucket && result.data.output_key
      ? await downloadUrl(db, result.data.output_bucket, result.data.output_key) : null;
    return json({ export: result.data, downloadUrl: signedUrl });
  } catch (error) {
    console.error("Could not load project export:", error);
    return json({ error: "Could not load the export status." }, 503);
  }
}
