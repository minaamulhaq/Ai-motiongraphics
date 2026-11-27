"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { Generation } from "@/lib/generation";
import type { Project } from "@/lib/studio";

function HyperframesProjectPlayer({ project, generation }: { project: Project; generation: Generation }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDuration(0);
    setTime(0);
    setPlaying(false);
    setError("");
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.source !== "aivid-hyperframes-preview") return;
      if (event.data.type === "ready") {
        setDuration(Number(event.data.duration) || 0);
        frame.current?.contentWindow?.postMessage({ source: "aivid-hyperframes-host", type: "ack" }, "*");
      }
      if (event.data.type === "time") setTime(Number(event.data.time) || 0);
      if (event.data.type === "playing") setPlaying(Boolean(event.data.value));
      if (event.data.type === "error") {
        console.error("HyperFrames preview failed:", event.data.message || "Timeline unavailable");
        setError("This animation preview could not start. Retry or regenerate the video.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [project.id, generation.run_id, attempt]);

  function send(type: "play" | "pause" | "seek", value?: number) {
    frame.current?.contentWindow?.postMessage({ source: "aivid-hyperframes-host", type, value }, "*");
  }

  return <div className="remotion-player-shell hyperframes-player-shell" style={{ aspectRatio: project.ratio.replace(":", "/") }}>
    {error ? <div className="preview-load-error" role="alert"><span>{error}</span><button type="button" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={14}/>Retry preview</button></div> : <>
      <iframe ref={frame} key={attempt} title="Motion preview" src={`/api/projects/${project.id}/hyperframes-preview?runId=${encodeURIComponent(generation.run_id)}&attempt=${attempt}`} sandbox="allow-scripts" allow="fullscreen" allowFullScreen />
      {duration > 0 && <div className="hyperframes-preview-controls" aria-label="Preview controls">
        <button type="button" aria-label={playing ? "Pause preview" : "Play preview"} onClick={() => send(playing ? "pause" : "play")}>
          {playing ? <Pause size={17}/> : <Play size={17} fill="currentColor"/>}
        </button>
        <input aria-label="Seek preview" type="range" min={0} max={duration} step={0.01} value={Math.min(time, duration)} onChange={event => send("seek", Number(event.target.value))}/>
        <span>{time.toFixed(1)}s / {duration.toFixed(1)}s</span>
      </div>}
      {duration === 0 && <p className="hyperframes-preview-loading" role="status">Preparing animation preview…</p>}
    </>}
  </div>;
}

function RemotionProjectVideoPlayer({ project, generation }: { project: Project; generation: Generation }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setHtml("");
    setError("");
    fetch(`/api/projects/${project.id}/preview?runId=${encodeURIComponent(generation.run_id)}`, { signal: abort.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null) as { error?: unknown; html?: unknown } | null;
        if (!response.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : `Preview request failed (HTTP ${response.status}).`);
        }
        if (typeof data?.html !== "string" || !data.html) {
          throw new Error("The preview response did not contain a playable animation.");
        }
        if (!abort.signal.aborted) setHtml(data.html);
      })
      .catch((cause) => {
        if (!abort.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "The animation preview could not be loaded.");
        }
      });

    return () => abort.abort();
  }, [project.id, generation.run_id, attempt]);

  return (
    <div className="remotion-player-shell" style={{ aspectRatio: project.ratio.replace(":", "/") }}>
      {error ? (
        <div className="preview-load-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry preview</button>
        </div>
      ) : html ? (
        <iframe
          title="Project animation"
          srcDoc={html}
          sandbox="allow-scripts"
          allow="fullscreen"
          allowFullScreen
        />
      ) : (
        <p role="status">Preparing your animation…</p>
      )}
    </div>
  );
}

export function ProjectVideoPlayer({ project, generation }: { project: Project; generation: Generation }) {
  return generation.video_engine === "hyperframes"
    ? <HyperframesProjectPlayer project={project} generation={generation} />
    : <RemotionProjectVideoPlayer project={project} generation={generation} />;
}
