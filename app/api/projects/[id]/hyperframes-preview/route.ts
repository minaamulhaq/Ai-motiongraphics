import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { studioDatabase } from "@/lib/supabase/admin";
import { normalizeHyperframesDuration } from "@/lib/hyperframes/composition";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser().catch(() => null);
  try {
    const db = await studioDatabase();
    const project = await db.from("projects").select("user_id,shared,seconds").eq("id", id).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data || (!project.data.shared && project.data.user_id !== user?.id)) {
      return new NextResponse("Project unavailable.", { status: 404 });
    }

    const runId = request.nextUrl.searchParams.get("runId");
    let query = db.from("project_video_versions").select("composition_code,video_engine").eq("project_id", id);
    if (runId) query = query.eq("run_id", runId);
    else query = query.order("completed_at", { ascending: false }).limit(1);
    const version = await query.maybeSingle();
    if (version.error) throw version.error;
    if (!version.data?.composition_code || version.data.video_engine !== "hyperframes") {
      return new NextResponse("HyperFrames composition unavailable.", { status: 404 });
    }

    const playerBridge = `<script data-aivid-player-bridge>(()=>{
const channel="aivid-hyperframes-preview";
const send=(type,data={})=>parent.postMessage({source:channel,type,...data},"*");
const deadline=performance.now()+8000;
let timeline=null,ready=false,acknowledged=false;
const update=()=>timeline&&send("time",{time:timeline.time()});
window.addEventListener("message",event=>{
 if(event.source!==parent||event.data?.source!=="aivid-hyperframes-host")return;
 if(event.data.type==="ack"){acknowledged=true;return}
 if(event.data.type==="play"&&timeline){timeline.play();send("playing",{value:true})}
 if(event.data.type==="pause"&&timeline){timeline.pause();send("playing",{value:false})}
 if(event.data.type==="seek"&&timeline){timeline.pause();timeline.time(Math.max(0,Math.min(Number(event.data.value)||0,timeline.duration())));send("playing",{value:false});update()}
});
const findTimeline=()=>{
 if(ready)return;
 timeline=window.__timelines?.main;
 if(timeline&&typeof timeline.time==="function"&&typeof timeline.duration==="function"&&timeline.duration()>0){
  ready=true;timeline.pause(0);timeline.eventCallback("onUpdate",update);
  const announce=()=>{if(acknowledged)return;send("ready",{duration:timeline.duration()});setTimeout(announce,300)};
  announce();return;
 }
 if(performance.now()>=deadline){send("error",{message:"The animation did not register its main timeline."});return}
 setTimeout(findTimeline,50);
};
findTimeline();
})();</script>`;
    const fittedHtml = normalizeHyperframesDuration(version.data.composition_code, project.data.seconds);
    const html = /<\/body\s*>/i.test(fittedHtml)
      ? fittedHtml.replace(/<\/body\s*>/i, `${playerBridge}</body>`)
      : `${fittedHtml}${playerBridge}`;
    return new NextResponse(html, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("HyperFrames preview failed:", error);
    return new NextResponse("Could not prepare the HyperFrames preview.", { status: 503 });
  }
}
