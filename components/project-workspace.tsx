"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowUpRight, Check, Clock3, Download, Frame, Loader2, MessageSquare, Palette, Send, Sparkles, Type } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GenerationPanel } from "@/components/generation-panel";
import { ProjectVideoPlayer } from "@/components/remotion/project-video-player";
import { useStudioUser } from "@/components/user-provider";
import { AccountMenu } from "@/components/account-menu";
import type { Generation } from "@/lib/generation";
import { motionFonts, motionIntensities, resolveMotionTheme, type MotionTheme } from "@/lib/motion-theme";
import { durations, ratioOptions, ratios, type Project } from "@/lib/studio";

type Message={id:string;role:"user"|"assistant";content:string};
const durationItems=durations.map(value=>({value,label:value+" seconds"}));
const weightItems=[400,500,600,700,800,900];
const sizeItems=[24,32,40,48,64,80];

export default function ProjectWorkspace({id}:{id:string}){
  const {isSignedIn,isLoaded}=useUser(),{openSignIn}=useClerk();
  const {dbUser,refetchUser}=useStudioUser();
  const [project,setProject]=useState<Project|null>(null),[messages,setMessages]=useState<Message[]>([]);
  const [generation,setGeneration]=useState<Generation|null>(null),[playback,setPlayback]=useState<Generation|null>(null);
  const [canEdit,setCanEdit]=useState(false),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [input,setInput]=useState(""),[chatBusy,setChatBusy]=useState(false),[modifyBusy,setModifyBusy]=useState(false),[error,setError]=useState("");
  const [themeConfig,setThemeConfig]=useState<MotionTheme>(()=>resolveMotionTheme(null)),[seconds,setSeconds]=useState(5),[ratio,setRatio]=useState("16:9"),[saving,setSaving]=useState(false),[saved,setSaved]=useState("");
  const [tab,setTab]=useState<string>("chat");
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
  const bottom=useRef<HTMLDivElement>(null),chatRequest=useRef<AbortController|null>(null);

  useEffect(()=>{
    if(!isLoaded)return;
    const abort=new AbortController();
    setLoading(true);setLoadError("");
    fetch("/api/projects/"+id,{signal:abort.signal,cache:"no-store"}).then(async r=>{
      const result=await r.json();if(!r.ok)throw new Error(result.error);
      setProject(result.project);setMessages(result.messages);setCanEdit(result.canEdit);
      setThemeConfig(resolveMotionTheme(result.project.theme_config,result.project.art));setSeconds(result.project.seconds);setRatio(result.project.ratio==="10:19"?"9:16":result.project.ratio==="19:6"?"16:9":result.project.ratio);
    }).catch(e=>{if(e.name!=="AbortError")setLoadError(e.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});
    return ()=>abort.abort();
  },[id,isLoaded,isSignedIn]);
  useEffect(()=>()=>{chatRequest.current?.abort()},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:"nearest"})},[messages,chatBusy]);
  useEffect(()=>{
    if(project&&!project.theme_config&&generation?.status==="completed"&&generation.theme)setThemeConfig(resolveMotionTheme(generation.theme,project.art));
  },[generation?.run_id,generation?.status,project]);
  async function send(e:FormEvent){
    e.preventDefault();if(!input.trim()||chatBusy)return;setChatBusy(true);setError("");
    const text=input.trim(),abort=new AbortController();chatRequest.current=abort;
    try{
      const r=await fetch("/api/projects/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"chat",content:text}),signal:abort.signal});
      const result=await r.json();if(!r.ok)throw new Error(result.error);
      setMessages(m=>[...m,...result.messages]);setInput(result.editPrompt||"");
    }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Could not send your message.")}
    finally{if(!abort.signal.aborted)setChatBusy(false)}
  }
  async function modifyVideo(){
    const text=input.trim();if(!text||modifyBusy||!canEdit)return;
    if(dbUser&&dbUser.credit<10){setError("You need 10 credits to modify this video.");return}
    setModifyBusy(true);setError("");
    try{
      const r=await fetch("/api/projects/"+id+"/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:text})});
      const result=await r.json();if(!r.ok)throw new Error(result.error);
      setMessages(current=>[...current,
        {id:"modify-user-"+result.generation.run_id,role:"user",content:text},
        {id:"modify-ai-"+result.generation.run_id,role:"assistant",content:"Your modification is queued. Follow the live status above the video."},
      ]);
      setInput("");await refetchUser();
      window.dispatchEvent(new CustomEvent("generation:refresh",{detail:{id,generation:result.generation}}));
    }catch(e){setError(e instanceof Error?e.message:"Could not modify the video.")}
    finally{setModifyBusy(false)}
  }
  async function saveTheme(){
    setSaving(true);setError("");setSaved("");
    try{
      const r=await fetch("/api/projects/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"theme",themeConfig,seconds,ratio})});
      const result=await r.json();if(!r.ok)throw new Error(result.error);
      setProject(result.project);setSaved("Creative settings saved. The preview is updated; use a modification prompt to regenerate the source with them.");
    }catch(e){setError(e instanceof Error?e.message:"Could not save your theme.")}
    finally{setSaving(false)}
  }
  async function exportVideo(){
    if(!project||!playableGeneration?.composition_code||exporting)return;
    setExporting(true);setExportError("");
    try{
      const response=await fetch(`/api/projects/${id}/export`,{method:"POST"});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Could not start the video export.");
      let exportJob=result.export,downloadUrl=result.downloadUrl;
      for(let attempt=0;!downloadUrl&&exportJob?.status!=="failed"&&attempt<180;attempt++){
        await new Promise(resolve=>setTimeout(resolve,2000));
        const statusResponse=await fetch(`/api/projects/${id}/export?exportId=${encodeURIComponent(exportJob.id)}`,{cache:"no-store"});
        const status=await statusResponse.json();
        if(!statusResponse.ok)throw new Error(status.error||"Could not check the export status.");
        exportJob=status.export;downloadUrl=status.downloadUrl;
      }
      if(exportJob?.status==="failed")throw new Error(exportJob.error||"The Lambda render failed. Click Export MP4 to retry.");
      if(!downloadUrl)throw new Error("The export is still rendering. Please check again in a moment.");
      const link=document.createElement("a");link.href=downloadUrl;link.download=project.title.replace(/[^a-z0-9-_]+/gi,"-")||"aivid-video";link.rel="noreferrer";link.click();
    }catch(e){setExportError(e instanceof Error?e.message:"Could not export this video.")}
    finally{setExporting(false)}
  }
  const savedTheme=project?resolveMotionTheme(project.theme_config??generation?.theme,project.art):resolveMotionTheme(null);
  const normalizedProjectRatio=project?.ratio==="10:19"?"9:16":project?.ratio==="19:6"?"16:9":project?.ratio;
  const dirty=project&&(project.seconds!==seconds||normalizedProjectRatio!==ratio||JSON.stringify(savedTheme)!==JSON.stringify(themeConfig));
  const generationComplete=generation?.status==="completed";
  const playableGeneration=generationComplete?generation:playback;
  return <div className="studio workspace">
    <header className="workspace-header">
      <div className="workspace-brand"><Link href="/" className="back-link" aria-label="Back to studio"><ArrowLeft size={17}/></Link><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span>AI Vid<span className="brand-period">.</span></Link><span className="header-divider"/><span className="project-title">{project?.title??"Project workspace"}</span></div>
      <div className="workspace-account">{project&&<button className="start export-project" disabled={!playableGeneration?.composition_code||exporting} title={playableGeneration?.composition_code?"Render and download MP4 with Remotion Lambda":"Export is available when generation finishes"} onClick={()=>void exportVideo()}>{exporting?<Loader2 size={14} className="spin"/>:<Download size={14}/>} {exporting?"Rendering…":"Export MP4"}</button>}<Link href="/" className="text-btn">My projects <ArrowUpRight size={14}/></Link>{isSignedIn?<AccountMenu compact/>:<button className="start" onClick={()=>openSignIn()}>Sign in</button>}</div>
    </header>
    {loading?<div className="workspace-state" role="status"><Loader2 className="spin"/><p>Loading your workspace…</p></div>:loadError||!project?<div className="workspace-state"><p role="alert">{loadError||"Project unavailable."}</p><Link className="start" href="/">Return to studio</Link></div>:
    <div className="workspace-body">
      <aside className="workspace-sidebar" aria-label="Project tools">
        <Tabs value={tab} onValueChange={value=>{setTab(String(value));setError("")}} className="workspace-tabs">
          <TabsList className="workspace-tab-list"><TabsTrigger value="chat"><MessageSquare/>Chat</TabsTrigger><TabsTrigger value="themes"><Palette/>Themes</TabsTrigger></TabsList>
          <TabsContent value="chat" className="chat-panel">
            <div className="conversation">
              <div className="assistant-intro"><span className="assistant-symbol"><Sparkles size={19}/></span><h2>Your scene starts here.</h2><p>Shape the lighting, explore a style, or find the right movement.</p><span className="assistant-mode">AI scene assistant</span></div>
              <article className="chat-message original"><span>YOUR SCENE</span><p>{project.prompt}</p></article>
              {messages.map(m=><article key={m.id} className={"chat-message "+m.role}><span>{m.role==="user"?"YOU":"SCENE ASSISTANT"}</span><p>{m.content}</p></article>)}
              {chatBusy&&<p className="thinking" role="status"><Loader2 size={14} className="spin"/>Preparing scene guidance…</p>}
              <div ref={bottom}/>
            </div>
            <form className="workspace-composer" onSubmit={send}><label htmlFor="workspace-prompt">Message the scene assistant</label><div className="chat-input-row"><textarea id="workspace-prompt" rows={3} maxLength={2000} value={input} disabled={!canEdit||chatBusy||modifyBusy} placeholder={canEdit?"Describe a change to the motion, scene, or typography.":"Chat is available to the project owner."} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/><button className="send-message" type="submit" aria-label="Send message" disabled={!canEdit||chatBusy||modifyBusy||!input.trim()}>{chatBusy?<Loader2 size={16} className="spin"/>:<Send size={16}/>}</button></div><p>Chat is free. Applying this prompt as a video modification costs 10 credits.</p><div className="modify-row"><button className="start" type="button" onClick={modifyVideo} disabled={!canEdit||chatBusy||modifyBusy||!input.trim()||(dbUser?.credit??10)<10}>{modifyBusy?<Loader2 size={14} className="spin"/>:<Sparkles size={14}/>}Modify video · 10 credits</button><span>{dbUser?.credit??"—"} credits available</span></div>{tab==="chat"&&error&&<p role="alert" className="error">{error}</p>}</form>
          </TabsContent>
          <TabsContent value="themes" className="themes-panel"><div className="theme-intro"><span className="theme-kicker">VIDEO STYLE</span><h2>Creative direction</h2><p>Fine-tune how your generated video looks, moves and fits each platform.</p></div>
            <fieldset disabled={!canEdit||saving} className="creative-settings">
              <section className="settings-card"><header className="settings-card-head"><span><Palette size={15}/></span><div><h3>Color system</h3><p>Build the composition palette.</p></div></header>
                <div className="color-grid">{(["background","foreground","primary","secondary"] as const).map(key=><label className="color-control" key={key}><input type="color" value={themeConfig.colors[key]} aria-label={key+" color"} onChange={event=>{setThemeConfig(current=>({...current,colors:{...current.colors,[key]:event.target.value}}));setSaved("")}}/><span><strong>{key}</strong><code>{themeConfig.colors[key]}</code></span></label>)}</div>
              </section>
              <section className="settings-card"><header className="settings-card-head"><span><Type size={15}/></span><div><h3>Typography</h3><p>Set the voice and reading scale.</p></div></header>
                <div className="control-grid"><label className="select-field full">Font family<Select value={themeConfig.typography.fontFamily} onValueChange={value=>{if(value)setThemeConfig(current=>({...current,typography:{...current.typography,fontFamily:value as MotionTheme["typography"]["fontFamily"]}}))}}><SelectTrigger aria-label="Font family"><SelectValue/></SelectTrigger><SelectContent>{motionFonts.map(font=><SelectItem value={font} key={font}>{font}</SelectItem>)}</SelectContent></Select></label>
                <label className="select-field">Heading weight<Select value={themeConfig.typography.headingWeight} onValueChange={value=>{if(value!==null)setThemeConfig(current=>({...current,typography:{...current.typography,headingWeight:value}}))}}><SelectTrigger aria-label="Heading weight"><SelectValue/></SelectTrigger><SelectContent>{weightItems.map(weight=><SelectItem value={weight} key={weight}>{weight}</SelectItem>)}</SelectContent></Select></label>
                <label className="select-field">Text size<Select value={themeConfig.typography.bodySize} onValueChange={value=>{if(value!==null)setThemeConfig(current=>({...current,typography:{...current.typography,bodySize:value}}))}}><SelectTrigger aria-label="Text size"><SelectValue/></SelectTrigger><SelectContent>{sizeItems.map(size=><SelectItem value={size} key={size}>{size}px</SelectItem>)}</SelectContent></Select></label></div>
              </section>
              <section className="settings-card"><header className="settings-card-head"><span><Sparkles size={15}/></span><div><h3>Motion direction</h3><p>Define the feeling and pace.</p></div></header>
                <label className="mood-field">Mood<textarea rows={3} maxLength={300} placeholder="Describe the visual mood…" value={themeConfig.mood} onChange={event=>{setThemeConfig(current=>({...current,mood:event.target.value}));setSaved("")}}/></label>
                <div className="control-grid motion-controls"><label className="select-field full">Animation energy<Select value={themeConfig.motion.intensity} onValueChange={value=>{if(value)setThemeConfig(current=>({...current,motion:{...current.motion,intensity:value as MotionTheme["motion"]["intensity"]}}))}}><SelectTrigger aria-label="Animation energy"><SelectValue/></SelectTrigger><SelectContent>{motionIntensities.map(intensity=><SelectItem value={intensity} key={intensity}>{intensity[0].toUpperCase()+intensity.slice(1)}</SelectItem>)}</SelectContent></Select></label>
                <label className="range-setting full"><span>Scene transition <b>{themeConfig.motion.transitionFrames} frames</b></span><input type="range" min="3" max="45" step="1" value={themeConfig.motion.transitionFrames} onChange={event=>setThemeConfig(current=>({...current,motion:{...current.motion,transitionFrames:Number(event.target.value)}}))}/></label></div>
              </section>
              <section className="settings-card output-card"><header className="settings-card-head"><span><Frame size={15}/></span><div><h3>Output</h3><p>Choose timing and platform size.</p></div></header>
                <div className="control-grid"><label className="select-field">Duration<Select items={durationItems} value={seconds} onValueChange={v=>{if(v!==null)setSeconds(v)}}><SelectTrigger aria-label="Video duration"><Clock3/><SelectValue/></SelectTrigger><SelectContent>{durationItems.map(o=><SelectItem value={o.value} key={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></label>
                <label className="select-field">Format<Select value={ratio} onValueChange={v=>{if(v!==null&&ratios.includes(v as typeof ratios[number]))setRatio(v)}}><SelectTrigger aria-label="Output format"><SelectValue/></SelectTrigger><SelectContent>{ratioOptions.map(option=><SelectItem key={option.value} value={option.value}>{option.label} · {option.value}</SelectItem>)}</SelectContent></Select></label></div>
                <div className="format-summary"><span className="format-shape" style={{aspectRatio:ratio.replace(":","/")}}/><div><strong>{ratioOptions.find(option=>option.value===ratio)?.label}</strong><small>{ratioOptions.find(option=>option.value===ratio)?.detail}</small></div><code>{ratio}</code></div>
              </section>
            <button className="primary apply-theme" disabled={!dirty||saving} onClick={saveTheme}>{saving?<Loader2 size={15} className="spin"/>:<Check size={15}/>}Save creative settings</button></fieldset>
            {saved&&<p role="status" className="save-message">{saved}</p>}{tab==="themes"&&error&&<p role="alert" className="error">{error}</p>}{!canEdit&&<p className="preview-note">Only the creator can edit this project.</p>}
          </TabsContent>
        </Tabs>
      </aside>
      <main className="workspace-main"><div className="preview-heading"><div><div className="eyebrow"><span className="bar"/>THE CANVAS</div><h1>From prompt to <em>picture.</em></h1></div><span className={"render-badge "+(playableGeneration?"ready":"")}><span/>{playableGeneration?"Ready to play":generation?.status==="failed"?"Generation failed":"Generating"}</span></div>
        <div className="video-stage">{exportError&&<p className="error" role="alert">{exportError}</p>}<div className="video-frame" style={{aspectRatio:project.ratio.replace(":","/"),maxWidth:["9:16","10:19"].includes(project.ratio)?"300px":"100%"}}>
          {playableGeneration?<ProjectVideoPlayer project={project} generation={playableGeneration}/>:<img src={"/art/"+project.art+".webp"} alt={project.prompt} style={{filter:"hue-rotate("+project.hue+"deg)"}}/>}
        </div><GenerationPanel id={id} canEdit={canEdit} hasPlayback={!!playableGeneration} onGenerationChange={setGeneration} onPlaybackChange={setPlayback}/></div>
      </main>
    </div>}
  </div>
}
