import { validateComposition } from "@/lib/ai/validate-composition";
import { generateStructured } from "@/lib/ai/structured";
import { inngest } from "./client";
import { workerDatabase } from "@/lib/supabase/worker";
import { briefSchema, themeSchema, generateText } from "@/lib/ai/generate";
import { loadRemotionCompositionSkill, remotionCompositionSystemPrompt, storyboardSystemPrompt } from "@/lib/remotion/skill";
import { renderProjectOnLambda } from "@/lib/remotion/lambda";
import { resolveMotionTheme } from "@/lib/motion-theme";
import { NonRetriableError } from "inngest";
import { generationIdentity } from "./job-identity";

function normalizeSceneTimings(brief:ReturnType<typeof briefSchema.parse>,durationInFrames:number){
  const alreadyValid=brief.scenes[0].startFrame===0
    && brief.scenes.at(-1)?.endFrame===durationInFrames
    && brief.scenes.every((scene,index)=>scene.endFrame>scene.startFrame
      && scene.endFrame<=durationInFrames
      && (index===0||scene.startFrame===brief.scenes[index-1].endFrame));
  if(alreadyValid)return brief;
  const count=brief.scenes.length;
  return {...brief,scenes:brief.scenes.map((scene,index)=>({
    ...scene,
    startFrame:Math.round(index*durationInFrames/count),
    endFrame:Math.round((index+1)*durationInFrames/count),
  }))};
}
function restrictHeadlinesToQuotedCopy(brief:ReturnType<typeof briefSchema.parse>,prompt:string){
  const quoted=[...prompt.matchAll(/["“]([^"”]{1,80})["”]/g)].map(match=>match[1].trim().toLocaleLowerCase().replace(/\s+/g," "));
  return {...brief,scenes:brief.scenes.map(scene=>{
    const headline=scene.headline?.trim()||"";
    const normalized=headline.toLocaleLowerCase().replace(/\s+/g," ");
    return {...scene,headline:quoted.includes(normalized)?headline:""};
  })};
}
function requestsTextFreeVideo(prompt:string){
  return /\b(?:no|without|remove|avoid|don't|do not)\b.{0,32}\b(?:on[- ]screen\s+)?text\b/i.test(prompt)
    || /\btext[- ]free\b/i.test(prompt);
}
function fallbackBrief(prompt:string,durationInFrames:number):ReturnType<typeof briefSchema.parse>{
  const subject=prompt.replace(/\s+/g," ").trim().slice(0,240)||"a futuristic visual idea";
  return {title:"Motion study",direction:"A clean, text-free motion-graphics interpretation of the visual idea.",scenes:[
    {description:`Establish an abstract visual world for: ${subject}. Introduce a luminous focal shape against a deep, restrained background.`,startFrame:0,endFrame:Math.max(1,Math.round(durationInFrames*.28))},
    {description:"Build energy as geometric elements orbit, align, and connect around the focal shape. Use clear spacing and smooth, purposeful movement.",startFrame:Math.max(1,Math.round(durationInFrames*.28)),endFrame:Math.max(2,Math.round(durationInFrames*.72))},
    {description:"Resolve the movement into a balanced, polished composition. Let the elements settle with a subtle glow and a clean ending hold.",startFrame:Math.max(2,Math.round(durationInFrames*.72)),endFrame:durationInFrames},
  ]};
}
function fallbackTheme(project: {art:string;theme_config:unknown}){
  const resolved=resolveMotionTheme(project.theme_config,project.art);
  return themeSchema.parse(resolved);
}
function buildSearchFeatureComposition({brief,theme,width,height,fps,durationInFrames}:{brief:ReturnType<typeof briefSchema.parse>;theme:ReturnType<typeof themeSchema.parse>;width:number;height:number;fps:number;durationInFrames:number}){
  const demo=brief.searchDemo;
  if(!demo)return null;
  const features=demo.features.slice(0,3);
  const featureData=JSON.stringify(features);
  const defaultTheme=JSON.stringify(theme);
  const scale=Math.min(width/1920,height/1080);
  const fieldWidth=Math.min(1200*scale,width-96*scale);
  const cardWidth=Math.min(480*scale,(width-180*scale)/3);
  const gap=Math.min(60*scale,Math.max(24*scale,(width-3*cardWidth)/4));
  const rowWidth=cardWidth*3+gap*2;
  const startX=(width-rowWidth)/2;
  const cardHeight=240*scale;
  const fieldY=300*scale;
  const headingY=430*scale;
  const cardsY=540*scale;
  const smallCanvas=scale<0.7;
  return `import React from "react";
import {AbsoluteFill, Interactive, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {BotMessageSquare, Headset, CalendarClock} from "lucide-react";

export type MotionTheme = {
  colors: {background: string; foreground: string; primary: string; secondary: string};
  typography: {fontFamily: string; headingWeight: number; bodySize: number};
  mood: string;
  motion: {intensity: "subtle" | "balanced" | "energetic"; transitionFrames: number};
};
const defaultTheme: MotionTheme = ${defaultTheme};
const query = ${JSON.stringify(demo.query)};
const features: string[] = ${featureData};
const layout = {scale:${scale}, fieldWidth:${fieldWidth}, cardWidth:${cardWidth}, gap:${gap}, rowWidth:${rowWidth}, startX:${startX}, cardHeight:${cardHeight}, fieldY:${fieldY}, headingY:${headingY}, cardsY:${cardsY}, smallCanvas:${smallCanvas}};

const FeatureIcon = ({index, color}: {index:number; color:string}) => {
  const Icon=[BotMessageSquare,Headset,CalendarClock][index%3];
  return <Icon size={34*layout.scale} color={color} strokeWidth={1.6} aria-hidden="true"/>;
};

const SearchBar = ({theme}:{theme:MotionTheme}) => {
  const frame=useCurrentFrame();
  return <Interactive.Div name="Search field" style={{position:"absolute",left:"50%",top:layout.fieldY,width:layout.fieldWidth,height:88*layout.scale,boxSizing:"border-box",translate:"-50% 0px",display:"flex",alignItems:"center",gap:22*layout.scale,padding:"0 "+(32*layout.scale)+"px",border:"1.5px solid "+theme.colors.primary,borderRadius:18*layout.scale,backgroundColor:"#17130f",boxShadow:"0 0 "+(18*layout.scale)+"px "+theme.colors.primary+"26, inset 0 0 18px "+theme.colors.primary+"0d",color:theme.colors.foreground,fontFamily:theme.typography.fontFamily}}>
    <Interactive.Div name="Search icon" style={{width:25*layout.scale,height:25*layout.scale,border:"2px solid "+theme.colors.secondary,borderRadius:"50%",position:"relative",opacity:0.9,flexShrink:0}}><span style={{position:"absolute",width:10*layout.scale,height:2*layout.scale,backgroundColor:theme.colors.secondary,right:-7*layout.scale,bottom:0,rotate:"45deg",transformOrigin:"left center"}}/></Interactive.Div>
    <Interactive.Span name="Search query" style={{fontSize:(layout.smallCanvas?30:38)*layout.scale,fontWeight:600,letterSpacing:-0.5*layout.scale,flex:1}}>{query}</Interactive.Span>
    <Interactive.Div name="Search status" style={{display:"flex",alignItems:"center",gap:10*layout.scale,color:theme.colors.secondary,fontSize:16*layout.scale,opacity:interpolate(frame,[0,20],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),whiteSpace:"nowrap"}}>
      <span style={{width:16*layout.scale,height:16*layout.scale,borderRadius:"50%",border:"2px solid "+theme.colors.primary+"55",borderTopColor:theme.colors.primary,rotate:(frame*12)+"deg"}}/>Searching...
    </Interactive.Div>
  </Interactive.Div>;
};

const FeatureCard = ({index,label,theme}:{index:number;label:string;theme:MotionTheme}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const entrance=25+index*12;
  const reveal=spring({frame:Math.max(0,frame-entrance),fps,config:{damping:22,stiffness:105,mass:0.85}});
  const opacity=interpolate(frame,[entrance,entrance+10],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const pulseStart=110+index*12;
  const pulse=interpolate(frame,[pulseStart,pulseStart+5,pulseStart+12],[0.42,1,0.48],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <Interactive.Div name={label+" feature card"} style={{position:"absolute",left:layout.startX+index*(layout.cardWidth+layout.gap),top:layout.cardsY,width:layout.cardWidth,height:layout.cardHeight,boxSizing:"border-box",padding:26*layout.scale,border:"1px solid "+theme.colors.primary+"55",borderRadius:16*layout.scale,backgroundColor:"#151311",boxShadow:"0 12px 34px #00000038, 0 0 18px "+theme.colors.primary+"12",color:theme.colors.foreground,fontFamily:theme.typography.fontFamily,opacity,translate:"0px "+((1-reveal)*42*layout.scale)+"px",scale:0.98+reveal*0.02,overflow:"hidden"}}>
    <Interactive.Div name={label+" amber top rule"} style={{position:"absolute",top:0,left:0,right:0,height:3*layout.scale,backgroundColor:theme.colors.primary,opacity:pulse,boxShadow:"0 0 "+(12*layout.scale)+"px "+theme.colors.primary+"88"}}/>
    <Interactive.Div name={label+" line icon"} style={{width:54*layout.scale,height:54*layout.scale,borderRadius:14*layout.scale,display:"flex",alignItems:"center",justifyContent:"center",backgroundColor:theme.colors.primary+"12",border:"1px solid "+theme.colors.primary+"32",marginBottom:26*layout.scale}}><FeatureIcon index={index} color={theme.colors.primary}/></Interactive.Div>
    <Interactive.Div name={label+" label"} style={{fontSize:(layout.smallCanvas?25:30)*layout.scale,lineHeight:1.15,fontWeight:650,letterSpacing:-0.4*layout.scale,maxWidth:"100%"}}>{label}</Interactive.Div>
    <Interactive.Div name={label+" ember edge"} style={{position:"absolute",left:0,bottom:0,width:4*layout.scale,height:"100%",background:"linear-gradient(180deg, transparent, "+theme.colors.primary+"55, transparent)",opacity:0.45}}/>
  </Interactive.Div>;
};

const SearchFeatureScene = ({theme}:{theme:MotionTheme}) => {
  const frame=useCurrentFrame();
  const headingOpacity=interpolate(frame,[15,25],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const underlineOpacity=interpolate(frame,[160,178],[0,0.58],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  return <AbsoluteFill style={{backgroundColor:theme.colors.background,color:theme.colors.foreground,fontFamily:theme.typography.fontFamily,overflow:"hidden"}}>
    <Interactive.Div name="Calmed ember backdrop" style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 38%, "+theme.colors.primary+"0c, transparent 48%), linear-gradient(180deg, "+theme.colors.background+", #0c0c0d)"}}/>
    <Interactive.Div name="Quiet upper ember glow" style={{position:"absolute",left:"50%",top:layout.fieldY-36*layout.scale,width:layout.fieldWidth*0.84,height:110*layout.scale,translate:"-50% 0px",borderRadius:"50%",backgroundColor:theme.colors.primary,filter:"blur("+(42*layout.scale)+"px)",opacity:0.055}}/>
    <SearchBar theme={theme}/>
    <Interactive.Div name="Features heading" style={{position:"absolute",left:0,right:0,top:layout.headingY,textAlign:"center",fontSize:22*layout.scale,fontWeight:600,letterSpacing:2.4*layout.scale,textTransform:"uppercase",color:theme.colors.secondary,opacity:headingOpacity}}>Features</Interactive.Div>
    {features.map((label,index)=><FeatureCard key={label+index} index={index} label={label} theme={theme}/>)}
    <Interactive.Div name="Subdued ember underline" style={{position:"absolute",left:layout.startX,top:layout.cardsY+layout.cardHeight+38*layout.scale,width:layout.rowWidth,height:1*layout.scale,background:"linear-gradient(90deg, transparent, "+theme.colors.primary+"88 12%, "+theme.colors.primary+"88 88%, transparent)",opacity:underlineOpacity}}/>
    <Interactive.Div name="Feature continuation ellipsis" style={{position:"absolute",left:layout.startX+layout.rowWidth-18*layout.scale,top:layout.cardsY+layout.cardHeight+48*layout.scale,color:theme.colors.secondary,fontSize:20*layout.scale,letterSpacing:6*layout.scale,opacity:interpolate(frame,[160,180],[0,0.38],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>···</Interactive.Div>
  </AbsoluteFill>;
};

export default function MotionVideo({theme}:{theme:MotionTheme}) {
  const {durationInFrames}=useVideoConfig();
  return <AbsoluteFill style={{backgroundColor:theme.colors.background}}><Sequence name="Search and features" from={0} durationInFrames={durationInFrames}><SearchFeatureScene theme={theme}/></Sequence></AbsoluteFill>;
}
export const videoConfig={width:${width},height:${height},fps:${fps},durationInFrames:${durationInFrames},defaultProps:{theme:defaultTheme}};
`;
}

function buildSafeComposition({brief,theme,width,height,fps,durationInFrames}:{brief:ReturnType<typeof briefSchema.parse>;theme:ReturnType<typeof themeSchema.parse>;width:number;height:number;fps:number;durationInFrames:number}){
  const scenes=JSON.stringify(brief.scenes.map((scene,index)=>({...scene,label:`${String(index+1).padStart(2,"0")} / ${brief.scenes.length}`})));
  const defaultTheme=JSON.stringify(theme);
  return `import React from "react";
import {AbsoluteFill, Easing, Interactive, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";

export type MotionTheme = {
  colors: {background: string; foreground: string; primary: string; secondary: string};
  typography: {fontFamily: "Arial" | "Georgia" | "Verdana" | "Trebuchet MS"; headingWeight: number; bodySize: number};
  mood: string;
  motion: {intensity: "subtle" | "balanced" | "energetic"; transitionFrames: number};
};
type SceneData = {description: string; headline?: string; startFrame: number; endFrame: number; label: string};
const scenes: SceneData[] = ${scenes};
const defaultTheme: MotionTheme = ${defaultTheme};
const SceneCard = ({scene, index, theme}: {scene: SceneData; index: number; theme: MotionTheme}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = scene.endFrame - scene.startFrame;
  const words = (scene.headline?.trim() || "").split(/\\s+/).slice(0, 5).join(" ");
  return <AbsoluteFill name={"Scene " + (index + 1)} style={{backgroundColor: theme.colors.background, color: theme.colors.foreground, fontFamily: theme.typography.fontFamily, opacity: interpolate(frame, [Math.max(0, duration - theme.motion.transitionFrames), duration], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 1, 1)}), overflow: "hidden"}}>
    <Interactive.Div name={"Scene " + (index + 1) + " glow"} style={{position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 25%, " + theme.colors.primary + "55, transparent 42%)"}} />
    <Interactive.Div name={"Scene " + (index + 1) + " orbit"} style={{position: "absolute", width: 520, height: 520, borderRadius: "50%", border: "2px solid " + theme.colors.secondary, right: interpolate(frame, [0, duration], [-124, -58], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), top: interpolate(frame, [0, duration], [-184, -118], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), scale: spring({frame, fps, config: {damping: 18, stiffness: theme.motion.intensity === "energetic" ? 170 : 110}}), opacity: 0.55}} />
    {words && <Interactive.Div name={"Scene " + (index + 1) + " message"} style={{position: "absolute", left: 96, right: 140, bottom: 120, translate: interpolate(frame, [0, Math.min(duration, Math.round(0.8 * fps))], ["0px 90px", "0px 0px"], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1)})}}>
      <Interactive.Div name={"Scene " + (index + 1) + " accent"} style={{height: 8, width: interpolate(frame, [0, Math.min(duration, Math.round(0.8 * fps))], [96, 276], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), backgroundColor: theme.colors.primary, marginBottom: 34}} />
      <Interactive.H1 name={"Scene " + (index + 1) + " title"} style={{fontSize: Math.max(64, theme.typography.bodySize * 1.8), lineHeight: 1.02, letterSpacing: -2.5, maxWidth: 1280, margin: 0, fontWeight: theme.typography.headingWeight, textTransform: "none"}}>{words}</Interactive.H1>
    </Interactive.Div>}
    <Interactive.Div name={"Scene " + (index + 1) + " progress"} style={{position: "absolute", left: 0, bottom: 0, height: 10, width: interpolate(frame, [0, duration], ["0%", "100%"], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), backgroundColor: theme.colors.primary}} />
  </AbsoluteFill>;
};

export default function MotionVideo({theme}: {theme: MotionTheme}) {
  return <AbsoluteFill style={{backgroundColor: theme.colors.background}}>{scenes.map((scene, index) => <Sequence key={scene.label} from={scene.startFrame} durationInFrames={scene.endFrame - scene.startFrame}><SceneCard scene={scene} index={index} theme={theme} /></Sequence>)}</AbsoluteFill>;
}

export const videoConfig = {width: ${width}, height: ${height}, fps: ${fps}, durationInFrames: ${durationInFrames}, defaultProps: {theme: defaultTheme}};
`;
}
export const generateMotion = inngest.createFunction({
  id:"generate-motion-composition",
  retries:2,
  concurrency:{limit:1,key:"event.data.projectId"},
  idempotency:"event.data.runId",
  onFailure:async({event})=>{
    const identity=generationIdentity(event.data.event?.data);
    if(!identity)return;
    const {projectId,runId}=identity;
    if(event.data.error.message.includes("superseded"))return;
    const failure=event.data.error.message.includes("credits")
      ? "The AI provider could not complete this request. Your reserved credits were returned."
      : "Generation could not finish. Your reserved credits were returned; retry when ready.";
    const result=await workerDatabase().rpc("fail_project_generation",{target:projectId,target_run:runId,failure_message:failure});
    if(result.error)throw result.error;
  },
},{event:"video/generation.requested"},async({event,step})=>{
  const identity=generationIdentity(event.data);
  if(!identity)throw new NonRetriableError("Invalid generation event: projectId and runId are required UUIDs.");
  const {projectId,runId}=identity;
  async function update(status:string,progress:number,extra:Record<string,unknown>={}){
    const result=await workerDatabase().from("project_generations").update({status,progress,updated_at:new Date().toISOString(),...extra}).eq("project_id",projectId).eq("run_id",runId).not("status","in","(completed,failed)").select("project_id").maybeSingle();
    if(result.error)throw result.error;
    if(!result.data)throw new NonRetriableError("Generation request was superseded; exiting without retry.");
  }
  const project=await step.run("load-project",async()=>{
    const db=workerDatabase();
    const job=await db.from("project_generations").select("run_id,request_prompt,status").eq("project_id",projectId).maybeSingle();
    if(job.error)throw job.error;
    if(!job.data||job.data.run_id!==runId||["completed","failed"].includes(job.data.status))throw new NonRetriableError("Generation request was superseded; exiting without retry.");
    await update("loading_project",5);
    const result=await db.from("projects").select("prompt,seconds,ratio,art,theme_config").eq("id",projectId).single();
    if(result.error)throw result.error;
    return {...result.data,prompt:job.data.request_prompt||result.data.prompt};
  });
  const fps=30,durationInFrames=project.seconds*fps;
  const [rw,rh]=project.ratio.split(":").map(Number);
  const width=rw>rh?1920:1080,height=Math.round(width*rh/rw);
  const context=JSON.stringify({...project,fps,durationInFrames,width,height});
  const brief=await step.run("expand-motion-prompt",async()=>{
    await update("generating_prompt",15);
    let parsed:ReturnType<typeof briefSchema.parse>;
    try{
      parsed=await generateStructured("scene plan", briefSchema,
        storyboardSystemPrompt(await loadRemotionCompositionSkill()),
        instructions => generateText(instructions, context, true));
    }catch(error){
      console.warn("AI storyboard unavailable; using a clean visual fallback.",error instanceof Error?error.message:"Unknown provider error");
      parsed=fallbackBrief(project.prompt,durationInFrames);
    }
    const timed=normalizeSceneTimings(parsed,durationInFrames);
    const result=requestsTextFreeVideo(project.prompt)
      ? {...timed,scenes:timed.scenes.map(scene=>({...scene,headline:""}))}
      : timed;
    await update("generating_prompt",30,{brief:result});
    return result;
  });
  const theme=await step.run("generate-theme-config",async()=>{
    await update("generating_theme",35);
    const saved=themeSchema.safeParse(project.theme_config);
    let result:ReturnType<typeof themeSchema.parse>;
    if(saved.success)result=saved.data;
    else try{
      result=await generateStructured("theme", themeSchema,
        'Return JSON only. Design a dynamic motion theme with this exact shape: {colors:{background:"#hexhex",foreground:"#hexhex",primary:"#hexhex",secondary:"#hexhex"},typography:{fontFamily:"Arial"|"Georgia"|"Verdana"|"Trebuchet MS",headingWeight:400-900,bodySize:20-80},mood:string,motion:{intensity:"subtle"|"balanced"|"energetic",transitionFrames:3-45}}. Ensure legible text contrast.',
        instructions => generateText(instructions, JSON.stringify({project,brief}), true));
    }catch(error){
      console.warn("AI theme unavailable; using the saved studio palette.",error instanceof Error?error.message:"Unknown provider error");
      result=fallbackTheme(project);
    }
    await update("generating_theme",50,{theme:result});
    return result;
  });
  const code=await step.run("generate-remotion-composition",async()=>{
    await update("generating_composition",55);
    const searchComposition=buildSearchFeatureComposition({brief,theme,width,height,fps,durationInFrames});
    if(searchComposition)return searchComposition;
    const skill=await loadRemotionCompositionSkill();
    try{
      return await generateText(
        remotionCompositionSystemPrompt(skill),
        JSON.stringify({originalPrompt:project.prompt,brief,theme,width,height,fps,durationInFrames,
          requirement:"Build distinct timed, visibly animated scenes for the full duration following the original prompt. Include the labels and closing copy requested by that prompt. Do not produce a background-only composition."}));
    }catch(error){
      console.error("AI composition draft unavailable",error);
      throw error;
    }
  });
  await step.run("validate-and-save",async()=>{
    await update("validating",90);
    let validatedCode=code;
    let problems=validateComposition(validatedCode);
    if(problems.length){
      console.warn("Generated composition requires repair:",problems);
      validatedCode=await generateText(
        remotionCompositionSystemPrompt(await loadRemotionCompositionSkill()),
        JSON.stringify({originalPrompt:project.prompt,brief,theme,width,height,fps,durationInFrames,
          previousSource:code,validationErrors:problems,instruction:"Repair the composition while preserving the requested visual scenes and motion. Return complete TSX source only."}));
      problems=validateComposition(validatedCode);
    }
    if(problems.length)throw new Error("Composition type validation failed: "+problems.join("; "));
    const completed=await workerDatabase().rpc("complete_project_generation",{target:projectId,target_run:runId,source_code:validatedCode});
    if(completed.error)throw completed.error;
    if(!completed.data)throw new NonRetriableError("Generation request was superseded before save; exiting without retry.");
  });
  return {projectId,runId,status:"completed"};
});

export const exportProjectVideo = inngest.createFunction({
  id: "export-project-video-with-remotion-lambda",
  retries: 0,
  concurrency: { limit: 2, key: "event.data.projectId" },
  idempotency: "event.data.exportId",
  onFailure: async ({ event }) => {
    const { exportId, runId } = event.data.event.data;
    await workerDatabase().from("project_video_exports").update({
      status: "failed", error: "The Lambda render failed. Click Export MP4 to start a new attempt.", updated_at: new Date().toISOString(),
    }).eq("id", exportId).eq("run_id", runId).in("status", ["queued", "rendering"]);
  },
}, { event: "video/export.requested" }, async ({ event, step }) => {
  const exportId = String(event.data.exportId), projectId = String(event.data.projectId);
  const loaded = await step.run("load-saved-composition", async () => {
    const db = workerDatabase();
    const [exportRow, projectResult, versionResult] = await Promise.all([
      db.from("project_video_exports").select("id,owner_id,status,run_id").eq("id", exportId).single(),
      db.from("projects").select("id,user_id,title,art,theme_config").eq("id", projectId).single(),
      db.from("project_video_versions").select("run_id,composition_code,theme").eq("project_id", projectId).eq("run_id", String(event.data.runId)).single(),
    ]);
    if (exportRow.error || projectResult.error || versionResult.error) throw exportRow.error || projectResult.error || versionResult.error;
    if (exportRow.data.owner_id !== event.data.ownerId || projectResult.data.user_id !== event.data.ownerId) {
      throw new NonRetriableError("Export ownership did not match.");
    }
    if(exportRow.data.run_id!==versionResult.data.run_id)throw new NonRetriableError("Export request was superseded; exiting without retry.");
    if (exportRow.data.status === "completed") return { alreadyComplete: true as const };
    if (!["queued", "rendering"].includes(exportRow.data.status)) throw new Error("This export request is no longer active.");
    const started = await db.from("project_video_exports").update({ status: "rendering", progress: 1, error: null, updated_at: new Date().toISOString() }).eq("id", exportId).select("id").single();
    if (started.error) throw started.error;
    return {
      alreadyComplete: false as const,
      source: versionResult.data.composition_code,
      title: projectResult.data.title,
      theme: resolveMotionTheme(versionResult.data.theme ?? projectResult.data.theme_config, projectResult.data.art),
    };
  });
  if (loaded.alreadyComplete) return { exportId, status: "completed", reused: true };

  const result = await step.run("render-mp4-on-aws-lambda", async () => {
    const db = workerDatabase();
    const rendered = await renderProjectOnLambda({
      source: loaded.source, projectId, title: loaded.title, theme: loaded.theme,
      onInit: async (renderId, bucketName) => {
        await db.from("project_video_exports").update({ render_id: renderId, output_bucket: bucketName, updated_at: new Date().toISOString() }).eq("id", exportId);
      },
      onProgress: async (progress) => {
        await db.from("project_video_exports").update({ progress, updated_at: new Date().toISOString() }).eq("id", exportId).lt("progress", progress);
      },
    });
    const completed = await db.from("project_video_exports").update({
      status: "completed", progress: 100, render_id: rendered.renderId, output_bucket: rendered.bucketName,
      output_key: rendered.outputKey, error: null, updated_at: new Date().toISOString(),
    }).eq("id", exportId).select("id").single();
    if (completed.error) throw completed.error;
    return { renderId: rendered.renderId, outputBucket: rendered.bucketName };
  });
  return { exportId, status: "completed", renderId: result.renderId, outputBucket: result.outputBucket };
});

