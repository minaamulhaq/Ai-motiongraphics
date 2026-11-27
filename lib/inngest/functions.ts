import { validateComposition } from "@/lib/ai/validate-composition";
import { generateStructured } from "@/lib/ai/structured";
import { inngest } from "./client";
import { workerDatabase } from "@/lib/supabase/worker";
import { themeSchema, briefSchema, generateText } from "@/lib/ai/generate";
import { loadHyperframesMotionGuidance, loadRemotionCompositionSkill, remotionCompositionSystemPrompt, videoPromptRefinementSystemPrompt } from "@/lib/remotion/skill";
import { readCompositionConfig, renderProjectOnLambda } from "@/lib/remotion/lambda";
import { resolveMotionTheme } from "@/lib/motion-theme";
import { NonRetriableError } from "inngest";
import { generationIdentity } from "./job-identity";
import { embedHyperframesGsap, hyperframesSystemPrompt, normalizeHyperframesDuration } from "@/lib/hyperframes/composition";
import { renderHyperframesComposition } from "@/lib/hyperframes/render";
import { reviewCompositionAgainstBrief } from "@/lib/ai/review-composition";

export function validateTechnicalComposition(code: string): string[] {
  const issues = [...validateComposition(code)];
  if (issues.length) return issues;
  try {
    readCompositionConfig(code);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Invalid videoConfig settings.");
  }
  if (!/export\s+default\s+/m.test(code)) {
    issues.push("Composition must include a default export component for Remotion.");
  }
  return issues;
}

function fallbackTheme(project: {art:string;theme_config:unknown}){
  const resolved=resolveMotionTheme(project.theme_config,project.art);
  return themeSchema.parse(resolved);
}
function fallbackVideoPrompt(prompt:string,{width,height,fps,durationInFrames}:{width:number;height:number;fps:number;durationInFrames:number}){
  return `Create a polished ${Math.round(durationInFrames/fps)}-second ${width>=height?"landscape":"portrait"} motion-graphics video based on the user's brief below. Make the requested subject and intent immediately clear. Build a visually distinct opening, development, payoff, and resolved ending across the full runtime. Turn the key idea into concrete visible actions: designed objects enter, move with purpose, transform, assemble, interact, and settle into a finished composition. Use a composed, continuously engaging frame with clear focal hierarchy, layered depth, strong contrast, and smooth transitions. Use the supplied saved theme consistently; do not hold on a blank screen, a lone dot, a static card, or a flat full-frame color. Show only audience-facing copy specifically requested in the brief, preserving its exact wording and order. Never display the full prompt or production instructions. End with a clean, intentional final hold.\n\nUSER'S ORIGINAL BRIEF (reference only; never display it verbatim):\n${prompt}`;
}
export function buildSafeComposition({prompt,brief,theme,width,height,fps,durationInFrames}:{prompt?:string;brief?:{title?:string;scenes?:{description?:string}[]};theme:ReturnType<typeof themeSchema.parse>;width:number;height:number;fps:number;durationInFrames:number}){
  const effectivePrompt=prompt||brief?.title||(brief?.scenes?.map(s=>s.description).join(" "))||"";
  const requestedLabels=[...effectivePrompt.matchAll(/[“"]([^”"]{1,80})[”"]/g)].map(match=>match[1].trim());
  const fallbackLabels=["IDEA","STORYBOARD","MOTION","PREVIEW","READY TO SHARE","From idea to motion."];
  const scenes=fallbackLabels.map((fallback,index)=>({
    start:Math.round(index*durationInFrames/fallbackLabels.length),
    end:Math.round((index+1)*durationInFrames/fallbackLabels.length),
    label:requestedLabels.find(label=>label.toLocaleLowerCase().replace(/[.!?]+$/g,"")===fallback.toLocaleLowerCase().replace(/[.!?]+$/g,""))||fallback,
    mode:index,
  }));
  const total=Math.max(1,durationInFrames-1);
  const config=JSON.stringify({width,height,fps,durationInFrames,colors:theme.colors,typography:theme.typography,scenes,total});
  const sequenceMarkup=scenes.map((_,index)=>`<Sequence key={${index}} from={design.scenes[${index}].start} durationInFrames={design.scenes[${index}].end-design.scenes[${index}].start}><Scene scene={design.scenes[${index}]} index={${index}} theme={theme}/></Sequence>`).join("");
  return `import React from "react";
import {AbsoluteFill, Easing, Interactive, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
type MotionTheme = {colors:{background:string;foreground:string;primary:string;secondary:string};typography:{fontFamily:string;headingWeight:number;bodySize:number};mood:string;motion:{intensity:"subtle"|"balanced"|"energetic";transitionFrames:number}};
const design=${config};
const defaultTheme:MotionTheme=${JSON.stringify(theme)};
function Scene({scene,index,theme}:{scene:typeof design.scenes[number];index:number;theme:MotionTheme}){
 const frame=useCurrentFrame(); const {fps}=useVideoConfig();
 const span=Math.max(1,scene.end-scene.start); const p=interpolate(frame,[0,span],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
 const enter=spring({frame,fps,config:{damping:18,stiffness:95,mass:0.8}});
 const accent=theme.colors.primary, violet=theme.colors.secondary, fg=theme.colors.foreground;
 const label=scene.label;
 return <AbsoluteFill style={{backgroundColor:theme.colors.background,overflow:"hidden",fontFamily:theme.typography.fontFamily,color:fg}}>
  <Interactive.Div name="Ambient gradient" style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 78% 24%, "+accent+"42, transparent 42%), radial-gradient(ellipse at 20% 80%, "+violet+"28, transparent 48%)"}}/>
  <Interactive.Div name="Orbit ring" style={{position:"absolute",left:"50%",top:"50%",width:"58vmin",height:"58vmin",border:"2px solid "+violet+"88",borderRadius:"50%",translate:"-50% -50%",rotate:(p*38+index*18)+"deg",scale:0.88+enter*0.12,opacity:0.58}}/>
  <Interactive.Div name="Orbit ring inner" style={{position:"absolute",left:"50%",top:"50%",width:"39vmin",height:"39vmin",border:"1px solid "+accent+"99",borderRadius:"50%",translate:"-50% -50%",rotate:(-p*62-index*13)+"deg",scale:0.84+enter*0.16,opacity:0.72}}/>
  {scene.mode===0&&<Interactive.Div name="Idea prompt capsule" style={{position:"absolute",left:"50%",top:"50%",translate:"-50% -50%",width:"min(54vw,860px)",height:"clamp(72px,10vw,128px)",border:"1px solid "+accent,borderRadius:24,background:"linear-gradient(110deg,#15131b,"+violet+"28)",boxShadow:"0 0 46px "+accent+"44",scale:0.86+0.14*enter,opacity:enter}}><div style={{position:"absolute",left:"7%",top:"50%",width:"9px",height:"9px",borderRadius:"50%",background:accent,translate:"0 -50%",boxShadow:"0 0 18px "+accent}}/><div style={{position:"absolute",left:"13%",top:"37%",width:"54%",height:10,borderRadius:8,background:fg,opacity:0.5}}/><div style={{position:"absolute",left:"13%",top:"57%",width:"34%",height:7,borderRadius:8,background:violet,opacity:0.75}}/></Interactive.Div>}
  {scene.mode===1&&<Interactive.Div name="Storyboard panels" style={{position:"absolute",left:"50%",top:"50%",display:"flex",gap:18,translate:"-50% -50%",opacity:interpolate(frame,[0,Math.min(12,span)],[0.12,0.98],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),scale:0.8+0.2*enter}}>{[0,1,2].map((n)=><div key={n} style={{position:"relative",width:"17vmin",height:"11vmin",border:"1px solid "+accent+"99",borderRadius:14,background:"linear-gradient(145deg,"+violet+"44,"+accent+"30)",transform:"translateY("+(Math.sin(frame/13+n)*12)+"px)"}}><div style={{position:"absolute",left:"16%",right:"16%",top:"25%",height:"2px",background:fg,opacity:0.65}}/><div style={{position:"absolute",left:"16%",width:"45%",bottom:"24%",height:"20%",borderRadius:8,background:n%2?accent:violet}}/></div>)}</Interactive.Div>}
  {scene.mode===3&&<Interactive.Div name="Composed motion preview" style={{position:"absolute",left:"50%",top:"50%",width:"min(52vw,820px)",height:"min(34vw,460px)",translate:"-50% -50%",border:"1px solid "+violet+"aa",borderRadius:22,background:"linear-gradient(135deg,#171520,"+accent+"20 55%,"+violet+"35)",boxShadow:"0 28px 90px #0009",scale:0.86+0.14*enter,opacity:enter}}><div style={{position:"absolute",width:"28%",aspectRatio:"1",borderRadius:"50%",left:"34%",top:"22%",background:"radial-gradient(circle at 35% 35%,"+fg+","+accent+" 36%,"+violet+" 68%,transparent 70%)",filter:"drop-shadow(0 0 30px "+accent+")",rotate:(frame*1.8)+"deg"}}/><div style={{position:"absolute",left:"18%",right:"18%",bottom:"18%",height:3,background:"linear-gradient(90deg,transparent,"+accent+","+violet+",transparent)"}}/></Interactive.Div>}
  {scene.mode===4&&<Interactive.Div name="Ready video file tile" style={{position:"absolute",left:"50%",top:"48%",translate:"-50% -50%",width:"min(32vw,480px)",height:"min(21vw,280px)",border:"1px solid "+accent+"99",borderRadius:22,background:"linear-gradient(145deg,"+violet+"36,#121116)",boxShadow:"0 22px 70px #000a,0 0 38px "+accent+"28",scale:0.82+0.18*enter,opacity:enter}}><div style={{position:"absolute",left:"50%",top:"50%",translate:"-50% -50%",width:0,height:0,borderTop:"22px solid transparent",borderBottom:"22px solid transparent",borderLeft:"34px solid "+fg,filter:"drop-shadow(0 0 16px "+accent+")"}}/></Interactive.Div>}
  <Interactive.Div name="Scene label" style={{position:"absolute",left:"50%",bottom:"13%",translate:"-50% 0",fontSize:"clamp(24px,4vw,52px)",fontWeight:theme.typography.headingWeight,letterSpacing:scene.mode===5?"0.02em":"0.16em",textAlign:"center",opacity:interpolate(frame,[0,Math.min(10,span)],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),textShadow:"0 0 28px "+accent+"88"}}>{label}</Interactive.Div>
  <Interactive.Div name="Animated progress stroke" style={{position:"absolute",left:"12%",bottom:"8%",height:4,width:"76%",transformOrigin:"left",transform:"scaleX("+p+")",background:"linear-gradient(90deg,"+accent+","+violet+")"}}/>
 </AbsoluteFill>;
}
export default function MotionVideo({theme}:{theme:MotionTheme}){return <AbsoluteFill>${sequenceMarkup}</AbsoluteFill>}
export const videoConfig={width:design.width,height:design.height,fps:design.fps,durationInFrames:design.durationInFrames,defaultProps:{theme:defaultTheme}};
`;
}
export function buildVisualQualityFallback(args: Parameters<typeof buildSafeComposition>[0]){
  return buildSafeComposition(args);
}

export function assessVisualComposition(code:string,prompt:string){
  const issues:string[]=[];
  const labels=[...prompt.matchAll(/[“"]([^”"]{1,80})[”"]/g)].map(match=>match[1].trim()).filter(label=>label.length>1);
  const distinctScenes=(code.match(/<Sequence\b/g)||[]).length;
  if(distinctScenes<Math.min(6,Math.max(3,labels.length)))issues.push("Implement each story beat as its own timed scene; do not collapse this multi-stage brief into a single card or background.");
  if((code.match(/<Interactive\./g)||[]).length<8||!/(?:radial-gradient|linear-gradient|<svg|<path|borderRadius|border:|<canvas|polygon|clipPath)/i.test(code))issues.push("The visual layer needs multiple deliberate designed shapes, depth, and composed graphics beyond a flat fill.");
  if(!/(?:interpolate|spring)\s*\(/.test(code))issues.push("Add visible frame-driven animation to key visual elements.");
  let lastLabelPosition=-1;
  const labelsOutOfOrder=labels.some(label=>{
    const position=code.toLocaleLowerCase().indexOf(label.toLocaleLowerCase());
    if(position<0||position<=lastLabelPosition)return true;
    lastLabelPosition=position;
    return false;
  });
  if(labels.length>=2&&labelsOutOfOrder){
    issues.push("Include all exact audience-facing labels requested by the user, in the requested order, and keep prompt instructions off screen.");
  }
  return issues;
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
    const message=event.data.error.message;
    const failure=message.includes("COMPOSITION_REVIEW_FAILED")
      ? "We couldn't match the animation to your brief after two corrections. Try a shorter, more specific prompt. Your reserved credits were returned."
      : message.includes("credits")
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
    const job=await db.from("project_generations").select("run_id,request_prompt,status,video_engine").eq("project_id",projectId).maybeSingle();
    if(job.error)throw job.error;
    if(!job.data||job.data.run_id!==runId||["completed","failed"].includes(job.data.status))throw new NonRetriableError("Generation request was superseded; exiting without retry.");
    await update("loading_project",5);
    const result=await db.from("projects").select("prompt,seconds,ratio,art,theme_config").eq("id",projectId).single();
    if(result.error)throw result.error;
    return {...result.data,prompt:job.data.request_prompt||result.data.prompt,videoEngine:job.data.video_engine as "remotion"|"hyperframes"};
  });
  const fps=30,durationInFrames=project.seconds*fps;
  const [rw,rh]=project.ratio.split(":").map(Number);
  const width=rw>rh?1920:1080,height=Math.round(width*rh/rw);
  const {refinedPrompt,theme,plan}=await step.run("refine-video-prompt-and-theme",async()=>{
    await update("generating_theme",35);
    const saved=themeSchema.safeParse(project.theme_config);
    let result:ReturnType<typeof themeSchema.parse>;
    if(saved.success)result=saved.data;
    else try{
      result=await generateStructured("theme", themeSchema,
        'Return JSON only. Design a dynamic motion theme with this exact shape: {colors:{background:"#hexhex",foreground:"#hexhex",primary:"#hexhex",secondary:"#hexhex"},typography:{fontFamily:"Arial"|"Georgia"|"Verdana"|"Trebuchet MS",headingWeight:400-900,bodySize:20-80},mood:string,motion:{intensity:"subtle"|"balanced"|"energetic",transitionFrames:3-45}}. Ensure legible text contrast.',
        instructions => generateText(instructions, JSON.stringify({project,originalPrompt:project.prompt}), true));
    }catch(error){
      console.warn("AI theme unavailable; using the saved studio palette.",error instanceof Error?error.message:"Unknown provider error");
      result=fallbackTheme(project);
    }
    await update("generating_theme",50,{theme:result});
    await update("generating_prompt",55);
    let productionPrompt:string;
    try{
      const refined=await generateText(
        videoPromptRefinementSystemPrompt(),
        JSON.stringify({userBrief:project.prompt,video:{seconds:project.seconds,width,height,fps},visualTheme:result}),
      );
      productionPrompt=refined.trim();
      if(productionPrompt.length<80)throw new Error("The refined video prompt was too short to guide composition generation.");
    }catch(error){
      console.warn("AI prompt refinement unavailable; using a production-ready prompt wrapper.",error instanceof Error?error.message:"Unknown provider error");
      productionPrompt=fallbackVideoPrompt(project.prompt,{width,height,fps,durationInFrames});
    }

    // Generate a structured, timed storyboard scene plan
    let scenePlan: import("zod").infer<typeof briefSchema>;
    try {
      scenePlan = await generateStructured(
        "scene planner",
        briefSchema,
        `You are a senior motion-graphics director. Break down the user's brief into a precise sequential storyboard plan with exact frame timestamps.
Total duration: ${durationInFrames} frames (${project.seconds} seconds at ${fps} fps).
Create 3 to 5 clear scenes across the timeline from frame 0 to frame ${durationInFrames}:
- Scene 1: Clear opening entrance
- Scene 2: Core action / development
- Scene 3: Feature reveal or visual payoff
- Scene 4: Resolved ending and final hold
Ensure scenes are strictly contiguous (each scene's startFrame equals the previous scene's endFrame), ending at exactly ${durationInFrames}.`,
        instructions => generateText(instructions, JSON.stringify({
          userPrompt: project.prompt,
          refinedPrompt: productionPrompt,
          video: { durationInFrames, fps, seconds: project.seconds, width, height },
          theme: result,
        }), true)
      );
    } catch(e) {
      console.warn("Structured scene plan fallback:", e instanceof Error ? e.message : "Error");
      const numScenes = 3;
      const sceneLen = Math.floor(durationInFrames / numScenes);
      scenePlan = {
        title: project.prompt.slice(0, 80),
        direction: "Kinetic motion graphics demonstration",
        scenes: [
          { headline: "Opening", description: "Scene introduces the main theme with centered animated entrance.", startFrame: 0, endFrame: sceneLen },
          { headline: "Action", description: "Core kinetic demonstration with active elements and smooth transforms.", startFrame: sceneLen, endFrame: sceneLen * 2 },
          { headline: "Outcome", description: "Final reveal and polished ending showcase.", startFrame: sceneLen * 2, endFrame: durationInFrames }
        ]
      };
    }

    await update("generating_prompt",60,{brief:{refinedPrompt:productionPrompt,storyboard:scenePlan}});
    return {refinedPrompt:productionPrompt,theme:result,plan:scenePlan};
  });
  const code=await step.run(`generate-${project.videoEngine}-composition`,async()=>{
    await update("generating_composition",55);
    if(project.videoEngine==="hyperframes"){
      return generateText(hyperframesSystemPrompt(),JSON.stringify({
        originalPrompt:project.prompt,refinedProductionPrompt:refinedPrompt,storyboardPlan:plan.scenes,
        theme,width,height,fps,durationSeconds:project.seconds,
      }));
    }
    const skill=await loadRemotionCompositionSkill();
    const hyperframesMotionGuidance=await loadHyperframesMotionGuidance();
    try{
      return await generateText(
        remotionCompositionSystemPrompt(skill,hyperframesMotionGuidance),
        JSON.stringify({
          originalPrompt:project.prompt,
          refinedProductionPrompt:refinedPrompt,
          storyboardPlan:plan.scenes,
          theme,
          width,
          height,
          fps,
          durationInFrames,
          requirement:"Follow the storyboardPlan closely: implement each planned scene as its own timed <Sequence from={startFrame} durationInFrames={endFrame - startFrame}> with its own clean React component. Center all layouts using flexbox. Do not scatter elements or overlap arbitrarily. Ensure smooth spring transitions between scenes."
        })
      );
    }catch(error){
      console.error("AI composition draft unavailable",error);
      throw error;
    }
  });
  await step.run("validate-and-save",async()=>{
    if(project.videoEngine!=="hyperframes")await update("validating",90);
    let validatedCode=project.videoEngine==="hyperframes"?await embedHyperframesGsap(normalizeHyperframesDuration(code,project.seconds)):code;
    if(project.videoEngine==="hyperframes"){
      // HyperFrames previews should not wait on technical or AI quality gates.
      // Normalize the selected runtime, embed the bundled GSAP, and save immediately.
      const completed=await workerDatabase().rpc("complete_project_generation",{target:projectId,target_run:runId,source_code:validatedCode,source_engine:"hyperframes"});
      if(completed.error)throw completed.error;
      if(!completed.data)throw new NonRetriableError("Generation request was superseded before save; exiting without retry.");
      return;
    }
    let problems=validateTechnicalComposition(validatedCode);

    // Keep deterministic source-level checks alongside the model review.
    const creativeNotes=assessVisualComposition(validatedCode,project.prompt);
    if(creativeNotes.length)console.info("Composition creative notes:",creativeNotes);

    let repairAttempts=0;
    while(true){
      problems=validateTechnicalComposition(validatedCode);
      if(problems.length){
        if(repairAttempts>=2)throw new NonRetriableError("COMPOSITION_REVIEW_FAILED: Remotion technical validation still fails after two corrections: "+problems.join("; "));
        repairAttempts++;
        console.warn(`Remotion technical repair (${repairAttempts}/2):`,problems);
        const repairSkill=await loadRemotionCompositionSkill();
        const hyperframesGuidance=await loadHyperframesMotionGuidance();
        validatedCode=await generateText(remotionCompositionSystemPrompt(repairSkill,hyperframesGuidance),JSON.stringify({
          originalPrompt:project.prompt,refinedProductionPrompt:refinedPrompt,theme,width,height,fps,durationInFrames,
          previousSource:validatedCode,validationErrors:problems,
          instruction:"Repair the exact compiler/syntax errors and preserve all requested visual content. Return complete TSX source only.",
        }));
        continue;
      }
      const quality=await reviewCompositionAgainstBrief({brief:project.prompt,storyboard:plan.scenes,source:validatedCode,engine:"remotion"});
      if(quality.passed)break;
      if(repairAttempts>=2)throw new NonRetriableError("COMPOSITION_REVIEW_FAILED: Remotion visual review still finds gaps after two corrections: "+quality.findings.map(item=>item.problem).join("; "));
      repairAttempts++;
      console.warn(`Remotion quality repair (${repairAttempts}/2):`,quality.findings);
      const repairSkill=await loadRemotionCompositionSkill();
      const hyperframesGuidance=await loadHyperframesMotionGuidance();
      validatedCode=await generateText(remotionCompositionSystemPrompt(repairSkill,hyperframesGuidance),JSON.stringify({
        originalPrompt:project.prompt,refinedProductionPrompt:refinedPrompt,storyboardPlan:plan.scenes,theme,width,height,fps,durationInFrames,
        previousSource:validatedCode,qualityFindings:quality.findings,
        instruction:"Revise the complete composition to satisfy every quality finding while preserving valid Remotion syntax and exact requested copy. Do not replace requested subject matter with generic motion graphics.",
      }));
    }
    const completed=await workerDatabase().rpc("complete_project_generation",{target:projectId,target_run:runId,source_code:validatedCode,source_engine:"remotion"});
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
    console.error("Project export failed", { exportId, runId, error: event.data.error });
    await workerDatabase().from("project_video_exports").update({
    status: "failed", error: "The video render failed. Click Export MP4 to start a new attempt.", updated_at: new Date().toISOString(),
    }).eq("id", exportId).eq("run_id", runId).in("status", ["queued", "rendering"]);
  },
}, { event: "video/export.requested" }, async ({ event, step }) => {
  const exportId = String(event.data.exportId), projectId = String(event.data.projectId);
  const loaded = await step.run("load-saved-composition", async () => {
    const db = workerDatabase();
    const [exportRow, projectResult, versionResult] = await Promise.all([
      db.from("project_video_exports").select("id,owner_id,status,run_id").eq("id", exportId).single(),
      db.from("projects").select("id,user_id,title,art,theme_config,seconds").eq("id", projectId).single(),
      db.from("project_video_versions").select("run_id,composition_code,theme,video_engine").eq("project_id", projectId).eq("run_id", String(event.data.runId)).single(),
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
      videoEngine: versionResult.data.video_engine as "remotion" | "hyperframes",
      ownerId: exportRow.data.owner_id,
      title: projectResult.data.title,
      theme: resolveMotionTheme(versionResult.data.theme ?? projectResult.data.theme_config, projectResult.data.art),
      durationSeconds: projectResult.data.seconds,
    };
  });
  if (loaded.alreadyComplete) return { exportId, status: "completed", reused: true };

  const result = await step.run(`render-mp4-${loaded.videoEngine}`, async () => {
    const db = workerDatabase();
    if (loaded.videoEngine === "hyperframes") {
      await db.from("project_video_exports").update({ progress: 3, updated_at: new Date().toISOString() }).eq("id", exportId);
      const output = await renderHyperframesComposition({
        html: normalizeHyperframesDuration(loaded.source, loaded.durationSeconds), fps: 30,
        onProgress: async (progress) => {
          await db.from("project_video_exports").update({ progress, updated_at: new Date().toISOString() }).eq("id", exportId).lt("progress", progress);
        },
      });
      const outputKey = `${loaded.ownerId}/${projectId}/${String(event.data.runId)}.mp4`;
      const uploaded = await db.storage.from("hyperframes-videos").upload(outputKey, output, { contentType: "video/mp4", upsert: true });
      if (uploaded.error) throw uploaded.error;
      const completed = await db.from("project_video_exports").update({
        status: "completed", progress: 100, output_bucket: "supabase:hyperframes-videos", output_key: outputKey,
        error: null, updated_at: new Date().toISOString(),
      }).eq("id", exportId).select("id").single();
      if (completed.error) throw completed.error;
      return { renderId: null, outputBucket: "supabase:hyperframes-videos" };
    }
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

