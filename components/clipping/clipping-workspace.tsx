"use client";

import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Upload,Film,Scissors,Download,Loader2,CheckCircle2,RefreshCw,Subtitles} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Progress} from '@/components/ui/progress';
import {Badge} from '@/components/ui/badge';
import {Alert,AlertDescription} from '@/components/ui/alert';
import {Skeleton} from '@/components/ui/skeleton';

type Job={id:string;source_name:string;status:string;stage:string;progress:number;error?:string;outputs:{title:string;duration:number;url:string}[]};
export function ClippingWorkspace(){
 const [jobs,setJobs]=useState<Job[]>([]);
 const [error,setError]=useState('');
 const [loadError,setLoadError]=useState('');
 const [loading,setLoading]=useState(true);
 const [available,setAvailable]=useState(false);
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState(0);
 const [file,setFile]=useState<File|null>(null);
 const [count,setCount]=useState('3');
 const [dragging,setDragging]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const uploadRequest=useRef<XMLHttpRequest|null>(null);
 const [refreshKey,setRefreshKey]=useState(0);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const response=await fetch('/api/clipping',{signal});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Your clips could not be loaded. Please try again.');
  setJobs(data.jobs);setAvailable(data.available!==false);setLoadError('');setLoading(false);
  return data.available!==false&&(data.jobs as Job[]).some(job=>['queued','processing'].includes(job.status));
 },[]);
 useEffect(()=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function poll(){try{if(await refresh(controller.signal))timer=setTimeout(poll,5000)}catch(e){if(!controller.signal.aborted){setLoadError(e instanceof Error?e.message:'Could not load clips.');setLoading(false)}}}
  void poll();return()=>{controller.abort();clearTimeout(timer)};
 },[refresh,refreshKey]);
 useEffect(()=>()=>{uploadRequest.current?.abort()},[]);
 const active=jobs.some(job=>['queued','processing'].includes(job.status));
 function choose(next?:File){if(active||!next)return;if(next.size>524288000||!next.size){setError('Choose a video under 500 MB.');return}if(!next.type.startsWith('video/')){setError('Please choose a video file.');return}setFile(next);setError('')}
 async function retryDelivery(id:string){
  try{
   const result=await fetch('/api/clipping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'complete',id})});
   if(!result.ok)throw Error((await result.json()).error);
   setError('');setRefreshKey(key=>key+1);
  }catch(e){setError(e instanceof Error?e.message:'Could not send job.')}
 }
 async function upload(event:FormEvent){
  event.preventDefault();if(!file||!available||busy||active)return;
  setBusy(true);setError('');setProgress(0);
  try{
   const response=await fetch('/api/clipping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,size:file.size,count:Number(count),ratio:'9:16'})});
   const data=await response.json();if(!response.ok)throw Error(data.error);
   await new Promise<void>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();uploadRequest.current=xhr;xhr.open('PUT',data.url);xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.timeout=900000;
    xhr.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(e.loaded/e.total*100))};
    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error('Upload failed. Please try again.'));
    xhr.onerror=xhr.ontimeout=xhr.onabort=()=>reject(Error('Upload interrupted. Please try again.'));xhr.send(file);
   });
   const complete=await fetch('/api/clipping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'complete',id:data.id})});
   if(!complete.ok)throw Error((await complete.json()).error);
   setJobs(previous=>[{id:data.id,source_name:file.name,status:'queued',stage:'Queued',progress:0,outputs:[]},...previous]);setFile(null);if(input.current)input.current.value='';setRefreshKey(key=>key+1);
  }catch(e){setRefreshKey(key=>key+1);setError(e instanceof Error?e.message:'Upload failed. Please try again.')}finally{setBusy(false);uploadRequest.current=null}
 }
 return <section className="space-y-8 text-foreground">
  <header className="space-y-3"><Badge variant="secondary"><Scissors className="size-3"/> Video clipping</Badge><h1 className="text-3xl font-semibold tracking-tight">Long videos. Standout clips.</h1><p className="max-w-xl text-sm leading-6 text-muted-foreground">Turn your spoken videos into shareable highlights, with captions included in every clip.</p></header>
  {!loading&&!available&&!loadError&&<Alert><AlertDescription>Clipping is temporarily unavailable. Please check back shortly.</AlertDescription></Alert>}
  <Card className="border border-border shadow-none"><CardHeader className="px-6 pt-2"><CardTitle>Create captioned clips</CardTitle><CardDescription>{active?'Wait for your current video to finish before uploading another.':'100 credits per video when queued, for 1 to 10 clips.'}</CardDescription></CardHeader><CardContent className="px-6 pb-2">
   <form onSubmit={upload} className="space-y-6">
    <input ref={input} id="clip-video" type="file" accept="video/*" className="sr-only" tabIndex={-1} disabled={active||busy||!available} onChange={e=>choose(e.target.files?.[0])}/>
    <button type="button" disabled={active||busy||!available} onClick={()=>input.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(!active&&!busy&&available)choose(e.dataTransfer.files[0])}} className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${dragging?'border-primary bg-primary/5':'border-border bg-muted/20 hover:border-primary/60'}`}>
     <span className="rounded-xl bg-muted p-3">{file?<Film className="size-6"/>:<Upload className="size-6"/>}</span><span className="max-w-full truncate text-sm font-medium">{file?file.name:'Drop your video here, or click to browse'}</span><span className="text-xs text-muted-foreground">{file?`${(file.size/1048576).toFixed(1)} MB - click to replace`:'MP4, MOV or WebM - up to 500 MB'}</span>
    </button>
    <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="clip-count">Number of clips</Label><Input id="clip-count" type="number" min={1} max={10} required value={count} disabled={busy} onChange={e=>setCount(e.target.value)} className="h-11"/><p className="text-xs text-muted-foreground">Choose 1 to 10 highlights.</p></div><div className="space-y-2"><Label>Video format</Label><div className="flex h-11 items-center rounded-md border border-input bg-background px-3 text-sm">Vertical (9:16)</div><p className="text-xs text-muted-foreground">Captioned vertical clips are rendered by the Modal worker.</p></div></div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Subtitles className="size-4"/> Styled captions included</p><Button type="submit" size="lg" className="h-11 px-6" disabled={active||busy||loading||!available||!file}>{busy?<Loader2 className="animate-spin"/>:<Scissors/>}{busy?'Uploading video...':'Create clips'}</Button></div>
    {busy&&<div className="space-y-2" aria-live="polite"><div className="flex justify-between text-xs"><span>{progress===100?'Preparing your job...':'Uploading your video'}</span><span>{progress}%</span></div><Progress value={progress} aria-label="Video upload progress"/></div>}
    {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
   </form>
  </CardContent></Card>
  <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Your clips</h2><Badge variant="outline">{jobs.reduce((sum,job)=>sum+job.outputs.length,0)} clips</Badge></div>
   {loadError?<Alert><AlertDescription className="flex items-center justify-between gap-4">{loadError}<Button variant="outline" onClick={()=>setRefreshKey(key=>key+1)}><RefreshCw/>Retry</Button></AlertDescription></Alert>:loading?<Skeleton className="h-40 w-full rounded-xl"/>:jobs.filter(job=>job.status!=='uploading').length===0?<Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center"><Film className="size-8 text-muted-foreground"/><h3 className="font-medium">Your next highlight starts here</h3><p className="max-w-sm text-sm text-muted-foreground">Upload a video above. Your captioned clips will appear here when they are ready.</p></CardContent></Card>:jobs.filter(job=>job.status!=='uploading').map(job=><Card key={job.id}><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="min-w-0 truncate">{job.source_name}</CardTitle><Badge variant={job.status==='failed'?'destructive':'secondary'}>{job.status==='completed'?<CheckCircle2 className="size-3"/>:null}{job.status}</Badge></div><CardDescription>{job.status==='failed'?job.error:job.stage}</CardDescription></CardHeader><CardContent className="space-y-5">{job.status==='queued'&&job.stage==='Queue delivery pending'&&<Button onClick={()=>void retryDelivery(job.id)}>Retry without another charge</Button>}{['queued','processing'].includes(job.status)&&<Progress value={job.progress} aria-label={job.stage}/>}<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{job.outputs.map((clip,index)=><div key={index} className="overflow-hidden rounded-xl border border-border"><video src={clip.url} controls preload="metadata" className="aspect-video w-full bg-black object-contain"/><div className="space-y-3 p-4"><h3 className="text-sm font-medium">{clip.title}</h3><p className="text-xs text-muted-foreground">{Math.round(clip.duration)} seconds - captions included</p><a href={clip.url} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><Download className="size-4"/>Download MP4</a></div></div>)}</div></CardContent></Card>)}
  </section>
 </section>
}
