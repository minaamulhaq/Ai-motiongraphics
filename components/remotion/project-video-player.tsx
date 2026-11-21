"use client";
import { useEffect, useState } from "react";
import type { Generation } from "@/lib/generation";
import type { Project } from "@/lib/studio";

export function ProjectVideoPlayer({ project, generation }: { project: Project; generation: Generation }) {
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
