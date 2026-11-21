import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { studioDatabase } from "@/lib/supabase/admin";
import { durations, ratios, motionStyle, type Project } from "@/lib/studio";

const getSupabase = studioDatabase;

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

const fail = (error: string, status = 400) => reply({ error }, status);
const unavailable = () => fail("The studio database is unavailable. Please try again.", 503);

export async function GET() {
  try {
    const user = await currentUser();
    const supabase = await getSupabase();

    const library = supabase.from("projects").select("id,title,prompt,art,seconds,ratio,hue,theme_config,user_id,collection_position,shared,created_at");

    const [list, reel] = await Promise.all([
      user
        ? library.eq("user_id", user.id).order("created_at", { ascending: false }).limit(60)
        : library.eq("shared", true).or("collection_position.is.null,collection_position.gt.0")
            .order("collection_position", { nullsFirst: true })
            .order("created_at", { ascending: false })
            .limit(60),
      supabase.from("projects").select("*").eq("collection_position", 0).maybeSingle(),
    ]);

    if (list.error || reel.error) {
      console.error("Database query error:", list.error || reel.error);
      if ((list.error || reel.error)?.code === "PGRST301") {
        return fail("Supabase cannot verify the Clerk session. Configure the Clerk Third Party Auth integration for social-falcon-250.clerk.accounts.dev in Supabase.", 503);
      }
      return unavailable();
    }

    const projectRows = list.data || [];
    const projectIds = projectRows.map((row) => row.id);
    const versions = projectIds.length
      ? await supabase
          .from("project_video_versions")
          .select("project_id,brief,theme,request_prompt,completed_at")
          .in("project_id", projectIds)
          .order("completed_at", { ascending: false })
      : { data: [], error: null };

    if (versions.error) {
      console.error("Saved video query error:", versions.error);
      return unavailable();
    }

    const latestPlayback = new Map<string, NonNullable<Project["playback"]>>();
    for (const version of versions.data || []) {
      if (!latestPlayback.has(version.project_id)) {
        latestPlayback.set(version.project_id, {
          brief: version.brief,
          theme: version.theme,
          request_prompt: version.request_prompt,
          completed_at: version.completed_at,
        });
      }
    }

    const projects: Project[] = projectRows.map((row) => ({
      id: row.id,
      title: row.title,
      prompt: row.prompt,
      art: row.art,
      seconds: row.seconds,
      ratio: row.ratio,
      hue: row.hue,
      theme_config: row.theme_config,
      created_at: row.created_at,
      playback: latestPlayback.get(row.id),
      creator: row.collection_position !== null ? "Studio collection" : user?.fullName || user?.firstName || "Community creator",
    }));

    const hero: Project | null = reel.data
      ? {
          id: reel.data.id,
          title: reel.data.title,
          prompt: reel.data.prompt,
          art: reel.data.art,
          seconds: reel.data.seconds,
          ratio: reel.data.ratio,
          hue: reel.data.hue,
          theme_config: reel.data.theme_config,
          creator: "Studio collection",
        }
      : null;

    return reply({
      name: user?.fullName || user?.firstName || null,
      projects,
      hero,
    });
  } catch (err) {
    console.error("GET /api/studio error:", err);
    return unavailable();
  }
}

export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail("Invalid request.");

  try {
    const user = await currentUser();
    const supabase = await getSupabase();

    if (data.action === "project") {
      if (!user) return fail("Please sign in to save a project.", 401);

      const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
      if (!prompt || prompt.length > 2000 || !ratios.includes(data.ratio) || !durations.includes(data.seconds)) {
        return fail("Check your prompt and settings (max 2000 characters).");
      }

      const style = motionStyle(prompt);
      const title = Array.from(prompt).slice(0, 64).join("");

      const { data: newProject, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title,
          prompt,
          art: style.art,
          hue: style.hue,
          ratio: data.ratio,
          seconds: data.seconds,
          shared: data.shared === true,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating project:", error);
        return fail(error.message || "Could not save project.", 500);
      }

      return reply({
        ok: true,
        project: newProject,
        projectId: newProject.id,
      });
    }

    if (data.action === "contact") {
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const body = typeof data.message === "string" ? data.message.trim() : "";
      if (!email || !body || body.length > 2000) return fail("Invalid contact submission.");

      const { error } = await supabase.from("contact_messages").insert({ email, body });
      if (error) return unavailable();
      return reply({ ok: true });
    }

    return fail("Unknown action.");
  } catch (err) {
    console.error("POST /api/studio error:", err);
    return unavailable();
  }
}
