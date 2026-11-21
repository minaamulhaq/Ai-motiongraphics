import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { studioDatabase } from "@/lib/supabase/admin";
import { resolveMotionTheme } from "@/lib/motion-theme";
import { cleanCompositionSource } from "@/lib/remotion/clean-source";
import { build } from "esbuild";
import { randomBytes } from "node:crypto";

export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    const db=await studioDatabase(),user=await currentUser().catch(()=>null);
    const project=await db.from("projects").select("user_id,shared,art,theme_config").eq("id",id).maybeSingle();
    if(!project.data||(!project.data.shared&&project.data.user_id!==user?.id)) {
      return NextResponse.json({error:"Project unavailable."},{status:404});
    }

    const runId = req.nextUrl.searchParams.get("runId");
    let versionQuery = db.from("project_video_versions").select("composition_code,theme").eq("project_id",id);
    if (runId) {
      versionQuery = versionQuery.eq("run_id", runId);
    } else {
      versionQuery = versionQuery.order("created_at", { ascending: false }).limit(1);
    }
    const version = await versionQuery.maybeSingle();
    if(!version.data?.composition_code) {
      return NextResponse.json({error:"Saved video unavailable."},{status:404});
    }

    const source=cleanCompositionSource(version.data.composition_code);
    const theme=resolveMotionTheme(version.data.theme??project.data.theme_config,project.data.art);

    const result=await build({
      stdin:{
        contents:`import React from 'react';
import {createRoot} from 'react-dom/client';
import {Player} from '@remotion/player';
import Video,{videoConfig} from 'saved-video';

class Boundary extends React.Component {
  state={error:false, errorMessage:""};
  static getDerivedStateFromError(error){
    return {error:true, errorMessage: error?.message || "Render error"};
  }
  componentDidCatch(error, info) {
    console.error("Player runtime error:", error, info);
  }
  render(){
    if(this.state.error) {
      return React.createElement('div', {
        role: 'alert',
        style: {
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'sans-serif',
          fontSize: 14,
          color: '#ff9990',
          backgroundColor: '#101110'
        }
      }, 'This saved animation could not play: ' + this.state.errorMessage);
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  React.createElement(Boundary, null,
    React.createElement(Player, {
      component: Video,
      inputProps: { ...(videoConfig?.defaultProps || {}), theme: ${JSON.stringify(theme)} },
      compositionWidth: videoConfig?.width || 1920,
      compositionHeight: videoConfig?.height || 1080,
      durationInFrames: videoConfig?.durationInFrames || 150,
      fps: videoConfig?.fps || 30,
      controls: true,
      clickToPlay: true,
      errorFallback: ({ error }) => React.createElement("div", {
        role: "alert",
        style: {
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          fontFamily: "sans-serif",
          fontSize: 14,
          color: "#ff9990",
          backgroundColor: "#101110"
        }
      }, "This saved animation could not play: " + (error?.message || "Unknown error")),
      style: { width: '100%', height: '100%' }
    })
  )
);`,
        resolveDir: process.cwd(),
        loader: "tsx"
      },
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      minify: true,
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [{
        name: "saved-video",
        setup(builder) {
          builder.onResolve({ filter: /^saved-video$/ }, () => ({ path: "saved-video", namespace: "saved" }));
          builder.onLoad({ filter: /.*/, namespace: "saved" }, () => ({ contents: source, loader: "tsx", resolveDir: process.cwd() }));
          builder.onResolve({ filter: /.*/, namespace: "saved" }, args => {
            if (
              args.path === "react" ||
              args.path.startsWith("react/") ||
              args.path === "remotion" ||
              args.path.startsWith("remotion/") ||
              args.path.startsWith("@remotion/") ||
              args.path === "lucide-react" ||
              args.path.startsWith("lucide-react/")
            ) {
              return undefined;
            }
            return { errors: [{ text: "Unsupported video import: " + args.path }] };
          });
        }
      }],
    });

    const nonce=randomBytes(16).toString("base64");
    const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; media-src blob:; connect-src 'none'"><style>html,body,#root{box-sizing:border-box;margin:0;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:#111;color:white}#root>div{box-sizing:border-box;width:100%!important;height:100%!important;min-width:0;min-height:0}</style></head><body><div id="root"></div><script nonce="${nonce}">${result.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")}</script></body></html>`;
    return NextResponse.json({html},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) {
    console.error("Video preview failed:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Could not prepare the saved animation: " + detail }, { status: 503 });
  }
}
