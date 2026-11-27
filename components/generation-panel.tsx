"use client";
import { useEffect, useState } from "react";
import { Check, Circle, Loader2, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useStudioUser } from "@/components/user-provider";
import { generationStages, type Generation } from "@/lib/generation";

export function GenerationPanel({id,canEdit,hasPlayback,onGenerationChange,onPlaybackChange}:{id:string;canEdit:boolean;hasPlayback?:boolean;onGenerationChange?:(generation:Generation|null)=>void;onPlaybackChange?:(generation:Generation|null)=>void}){
  const {refetchUser}=useStudioUser();
  const [job,setJob]=useState<Generation|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>;
    let submitted=false;
    async function poll(){
      try{
        const r=await fetch("/api/projects/"+id+"/generate",{cache:"no-store",signal:abort.signal});
        const data=await r.json();if(!r.ok)throw new Error(data.error);setError("");
        setJob(data.generation);onGenerationChange?.(data.generation);onPlaybackChange?.(data.playback??null);
        if(canEdit&&!data.generation&&!submitted){
          submitted=true;
          const start=await fetch("/api/projects/"+id+"/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",signal:abort.signal});
          const result=await start.json();if(!start.ok)throw new Error(result.error);
          setJob(result.generation);onGenerationChange?.(result.generation);await refetchUser();
        }
        if(!["completed","failed"].includes(data.generation?.status))timer=setTimeout(poll,2500);
      }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Generation is unavailable.")}
    }
    void poll();
    return ()=>{abort.abort();clearTimeout(timer)};
  },[id,canEdit,refresh,onGenerationChange,onPlaybackChange,refetchUser]);
  useEffect(()=>{
    const onRefresh=(event:Event)=>{
      const detail=(event as CustomEvent<{id:string;generation?:Generation}>).detail;
      if(detail?.id!==id)return;
      if(detail.generation){setJob(detail.generation);onGenerationChange?.(detail.generation)}
      setRefresh(value=>value+1);
    };
    window.addEventListener("generation:refresh",onRefresh);
    return ()=>window.removeEventListener("generation:refresh",onRefresh);
  },[id,onGenerationChange]);
  async function retry(){
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/projects/"+id+"/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({retry:job?.status==="failed"})});
      const data=await r.json();if(!r.ok)throw new Error(data.error);
      setJob(data.generation);onGenerationChange?.(data.generation);await refetchUser();setRefresh(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:"Could not retry.")}
    finally{setBusy(false)}
  }
  const complete=job?.status==="completed",failed=job?.status==="failed",queued=job?.status==="queued";
  const current=generationStages.findIndex(s=>s.status===job?.status);
  if(complete)return null;
  return <section className={"generation-panel"+(hasPlayback?"":" generation-overlay")} aria-labelledby="ai-generation-title">
    <div className="generation-heading"><div><Loader2 size={18} className={failed?"":"spin"}/><h2 id="ai-generation-title">{failed?"Generation needs a retry":"Creating your video"}</h2></div><span>{job?.progress??0}%</span></div>
    <Progress value={job?.progress??0} aria-label="AI composition generation progress"/>
    <ol className="ai-stages">{generationStages.map((s,i)=>{
      const done=i<current,active=!failed&&i===current;
      return <li key={s.status} className={done?"complete":active?"current":""}>{done?<Check size={14}/>:active?<Loader2 size={14} className="spin"/>:<Circle size={14}/>}<span>{s.label}</span>{active&&<small>In progress</small>}</li>
    })}</ol>
    <p className="render-status" role="status">{failed&&job?.error?`${job.error}${hasPlayback?" Your last completed video is still available above.":""}`:failed&&hasPlayback?"The latest attempt failed. Your last completed video is still available above.":failed&&job?.credit_cost===0?"This project was saved, but its first video never completed. There is no previous video to play, and this attempt charged no credits.":failed?"The video could not be created. Please retry or choose another motion model.":job?.status==="queued"?"Your request is queued.":!job?"Preparing your request…":generationStages.find(s=>s.status===job.status)?.label}</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {(error||failed||queued)&&canEdit&&<button className="start" disabled={busy} onClick={retry}><RefreshCw size={14}/>{queued?"Resume queued job":"Retry generation"}</button>}
  </section>
}

