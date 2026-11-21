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
    const db=await studioDatabase(),user=await currentUser();
    const project=await db.from("projects").select("user_id,shared,art,theme_config").eq("id",id).maybeSingle();
    if(!project.data||(!project.data.shared&&project.data.user_id!==user?.id))return NextResponse.json({error:"Project unavailable."},{status:404});
    const version=await db.from("project_video_versions").select("composition_code,theme").eq("project_id",id).eq("run_id",req.nextUrl.searchParams.get("runId")||"").maybeSingle();
    if(!version.data)return NextResponse.json({error:"Saved video unavailable."},{status:404});
    const source=cleanCompositionSource(version.data.composition_code);
    const theme=resolveMotionTheme(version.data.theme??project.data.theme_config,project.data.art);
    const result=await build({
      stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {Player} from '@remotion/player';import Video,{videoConfig} from 'saved-video';
      class Boundary extends React.Component {state={error:false};static getDerivedStateFromError(){return {error:true}}render(){return this.state.error?React.createElement('p',null,'This saved animation could not play.'):this.props.children}}
      createRoot(document.getElementById('root')).render(React.createElement(Boundary,null,React.createElement(Player,{component:Video,inputProps:{...videoConfig.defaultProps,theme:${JSON.stringify(theme)}},compositionWidth:videoConfig.width,compositionHeight:videoConfig.height,durationInFrames:videoConfig.durationInFrames,fps:videoConfig.fps,controls:true,clickToPlay:true,errorFallback:({error})=>React.createElement("div",{role:"alert",style:{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center",fontFamily:"Arial",fontSize:16}},"This saved animation could not play: "+error.message),style:{width:'100%',height:'100%'}})));`,resolveDir:process.cwd(),loader:"tsx"},
      bundle:true,write:false,platform:"browser",format:"iife",minify:true,define:{"process.env.NODE_ENV":'"production"'},
      plugins:[{name:"saved-video",setup(builder){
        builder.onResolve({filter:/^saved-video$/},()=>({path:"saved-video",namespace:"saved"}));
        builder.onLoad({filter:/.*/,namespace:"saved"},()=>({contents:source,loader:"tsx",resolveDir:process.cwd()}));
        builder.onResolve({filter:/.*/,namespace:"saved"},args=>["react","react/jsx-runtime","remotion","lucide-react"].includes(args.path)?undefined:{errors:[{text:"Unsupported video import"}]});
      }}],
    });
    const nonce=randomBytes(16).toString("base64");
    const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; media-src blob:; connect-src 'none'"><style>html,body,#root{box-sizing:border-box;margin:0;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:#111;color:white}#root>div{box-sizing:border-box;width:100%!important;height:100%!important;min-width:0;min-height:0}</style></head><body><div id="root"></div><script nonce="${nonce}">${result.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")}</script></body></html>`;
    return NextResponse.json({html},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){console.error("Video preview failed",error);return NextResponse.json({error:"Could not prepare the saved animation."},{status:503})}
}
