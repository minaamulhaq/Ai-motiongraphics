"use client";
import {useEffect,useState} from "react";
import type {Generation} from "@/lib/generation";
import type {Project} from "@/lib/studio";
export function ProjectVideoPlayer({project,generation}:{project:Project;generation:Generation}) {
  const [html,setHtml]=useState(""),[error,setError]=useState("");
  useEffect(()=>{
    const abort=new AbortController();setHtml("");setError("");
    fetch(`/api/projects/${project.id}/preview?runId=${encodeURIComponent(generation.run_id)}`,{signal:abort.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.error);if(!abort.signal.aborted)setHtml(data.html);
    }).catch(error=>{if(!abort.signal.aborted)setError(error.message)});
    return ()=>abort.abort();
  },[project.id,generation.run_id]);
  return <div className="remotion-player-shell" style={{aspectRatio:project.ratio.replace(":","/")}}>{error?<p role="alert">{error}</p>:html?<iframe title="Project animation" srcDoc={html} sandbox="allow-scripts" allow="fullscreen" allowFullScreen style={{width:"100%",height:"100%",border:0,display:"block"}}/>:<p role="status">Preparing your animation…</p>}</div>;
}
