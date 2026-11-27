"use client";

import { Player } from "@remotion/player";
import {useEffect,useState} from "react";
import type { Project } from "@/lib/studio";
import { resolveMotionTheme } from "@/lib/motion-theme";
import { ProjectMotionVideo, type ProjectMotionVideoProps, type RuntimeScene } from "./project-motion-video";

function runtimeScenes(value: unknown, durationInFrames: number, prompt: string): RuntimeScene[] {
  const raw = value && typeof value === "object" && Array.isArray((value as { scenes?: unknown }).scenes)
    ? (value as { scenes: unknown[] }).scenes
    : [];
  const scenes = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const scene = item as Record<string, unknown>;
    if (typeof scene.description !== "string" || typeof scene.startFrame !== "number" || typeof scene.endFrame !== "number") return [];
    return [{
      description: scene.description,
      startFrame: Math.max(0, Math.round(scene.startFrame)),
      endFrame: Math.min(durationInFrames, Math.round(scene.endFrame)),
    }];
  }).filter((scene) => scene.endFrame > scene.startFrame);
  return scenes.length ? scenes : [{ description: prompt, startFrame: 0, endFrame: durationInFrames }];
}

function searchDemo(prompt: string, brief: unknown) {
  const data = brief as { searchDemo?: { query?: string; features?: string[] } } | null;
  const requested = /search|searc/i.test(prompt) && /feature|chatbot|cahtbot/i.test(prompt);
  const query = prompt.match(/(?:text|query)\s*["“]([^"”]+)["”]/i)?.[1];
  const labels = [
    [/\b(?:chatbot|cahtbot)s?\b/i, "AI Chatbots"],
    [/\bcustomer\s+sup+p?o?r?t\b/i, "AI Customer Support"],
    [/\b(?:schedul|scadual)\w*\b/i, "AI Scheduling"],
  ] as const;
  const features = labels.filter(([pattern]) => pattern.test(prompt)).map(([, label]) => label);
  if (requested && query && features.length) return { query, features };
  return data?.searchDemo?.query && data.searchDemo.features?.length ? data.searchDemo : undefined;
}

export function ProjectThumbnail({ project }: { project: Project }) {
  const fps = 30;
  const durationInFrames = Math.max(1, project.seconds * fps);
  const [rw, rh] = project.ratio.split(":").map(Number);
  const compositionWidth = rw > rh ? 1920 : 1080;
  const compositionHeight = Math.round(compositionWidth * rh / rw);

  if (!project.playback?.composition_code || project.playback.video_engine === "hyperframes") {
    return <div className="poster-art" style={{ backgroundImage: `url(/art/${project.art}.webp)`, filter: `hue-rotate(${project.hue}deg)` }} />;
  }

  return (
    <div className="project-first-frame" aria-hidden="true">
      <SavedCompositionThumbnail project={project} fps={fps} durationInFrames={durationInFrames} compositionWidth={compositionWidth} compositionHeight={compositionHeight}/>
    </div>
  );
}

function SavedCompositionThumbnail({project,fps,durationInFrames,compositionWidth,compositionHeight}:{project:Project;fps:number;durationInFrames:number;compositionWidth:number;compositionHeight:number}) {
  const [html,setHtml]=useState("");
  useEffect(()=>{
    const abort=new AbortController();
    fetch(`/api/projects/${project.id}/preview?thumbnail=1`,{signal:abort.signal,cache:"no-store"})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"Thumbnail unavailable");if(typeof data.html==="string")setHtml(data.html)})
      .catch(()=>{});
    return()=>abort.abort();
  },[project.id]);

  if(html)return <iframe title={`${project.title} first frame`} srcDoc={html} sandbox="allow-scripts" tabIndex={-1} aria-hidden="true"/>;
  if(project.playback?.brief){
    const prompt=project.playback.request_prompt||project.prompt;
    const props:ProjectMotionVideoProps={title:project.title,prompt,art:project.art,theme:resolveMotionTheme(project.theme_config??project.playback.theme,project.art),scenes:runtimeScenes(project.playback.brief,durationInFrames,prompt),searchDemo:searchDemo(prompt,project.playback.brief)};
    return <Player component={ProjectMotionVideo} inputProps={props} durationInFrames={durationInFrames} compositionWidth={compositionWidth} compositionHeight={compositionHeight} fps={fps} initialFrame={0} controls={false} clickToPlay={false} style={{width:"100%",height:"100%",backgroundColor:props.theme.colors.background}}/>;
  }
  return null;
}
