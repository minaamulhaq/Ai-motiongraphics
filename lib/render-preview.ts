import type { Project } from "./studio";
export type RenderStage = "scenes" | "video" | "finalize";
export async function renderPreview(project:Project,signal:AbortSignal,onProgress:(stage:RenderStage,percent:number)=>void) {
  if(typeof MediaRecorder==="undefined" || !HTMLCanvasElement.prototype.captureStream)throw new Error("Video rendering is unavailable in this browser. Try Chrome or Edge.");
  onProgress("scenes",8);
  const image=new Image();
  image.src="/art/"+project.art+".webp";
  await image.decode();
  signal.throwIfAborted();
  const [w,h]=project.ratio.split(":").map(Number),canvas=document.createElement("canvas");
  canvas.width=w>h?960:Math.round(640*w/h);canvas.height=w>h?Math.round(960*h/w):640;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Could not create the video canvas.");
  function draw(t:number){
    const fit=Math.max(canvas.width/image.width,canvas.height/image.height)*(1.05+.08*Math.sin(t*Math.PI));
    const width=image.width*fit,height=image.height*fit;
    ctx!.filter="hue-rotate("+project.hue+"deg)";
    ctx!.drawImage(image,(canvas.width-width)/2+Math.sin(t*Math.PI*2)*12,(canvas.height-height)/2,width,height);
  }
  draw(0);
  const stream=canvas.captureStream(30);
  const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime){stream.getTracks().forEach(t=>t.stop());throw new Error("Your browser does not support video export.");}
  const chunks:Blob[]=[];
  let recorder:MediaRecorder;
  try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000})}catch(e){stream.getTracks().forEach(t=>t.stop());throw e}
  return await new Promise<Blob>((resolve,reject)=>{
    let frame=0,started=0,finished=false;
    function cleanup(){cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());signal.removeEventListener("abort",abort)}
    function fail(error:unknown){if(finished)return;finished=true;if(recorder.state!=="inactive")recorder.stop();cleanup();reject(error)}
    function abort(){fail(new DOMException("Render cancelled","AbortError"))}
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onerror=()=>fail(new Error("Video rendering failed. Please retry."));
    recorder.onstop=()=>{if(finished)return;finished=true;cleanup();const blob=new Blob(chunks,{type:mime});if(!blob.size){reject(new Error("No video frames were produced."));return}onProgress("finalize",100);resolve(blob)};
    signal.addEventListener("abort",abort,{once:true});
    if(signal.aborted){abort();return}
    onProgress("video",15);
    recorder.start(200);
    function tick(now:number){
      if(!started)started=now;
      const t=Math.min(1,(now-started)/(project.seconds*1000));
      draw(t);onProgress("video",Math.round(15+t*79));
      if(t>=1){onProgress("finalize",97);recorder.stop()}else frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  });
}
