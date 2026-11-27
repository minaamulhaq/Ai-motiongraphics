import { lintHyperframeHtml } from "@hyperframes/core/lint";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type HyperframesOutput = {
  html: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
};

/** Keep the composition's declared runtime locked to the duration selected in the UI. */
export function normalizeHyperframesDuration(html: string, durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return html;
  const root = html.match(/<([a-z][\w:-]*\b[^>]*\bdata-composition-id=["'][^"']+["'][^>]*)>/i);
  if (!root) return html;
  const openingTag = root[0];
  const normalizedTag = /\bdata-duration\s*=\s*(["'])[^"']*\1/i.test(openingTag)
    ? openingTag.replace(/\bdata-duration\s*=\s*(["'])[^"']*\1/i, `data-duration="${durationSeconds}"`)
    : openingTag.replace(/\s*>$/, ` data-duration="${durationSeconds}">`);
  const normalizedHtml = html.replace(openingTag, normalizedTag)
    .replace(/<script\b[^>]*\bdata-aivid-duration-fit[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  const fitTimeline = `<script data-aivid-duration-fit>(()=>{
const target=${durationSeconds};
const timeline=window.__timelines?.main;
if(!timeline||typeof timeline.duration!=="function"||typeof timeline.getChildren!=="function")return;
const source=timeline.duration();
if(!Number.isFinite(source)||source<=target+0.01)return;
const factor=target/source;
timeline.getChildren(false,true,true).forEach(animation=>{
 animation.startTime(animation.startTime()*factor);
 animation.duration(animation.duration()*factor);
});
document.querySelectorAll(".clip").forEach(clip=>{
 for(const name of ["data-start","data-duration"]){
  const value=Number(clip.getAttribute(name));
  if(Number.isFinite(value)&&value>0)clip.setAttribute(name,String(value*factor));
 }
});
timeline.pause(0);
timeline.invalidate();
timeline.time(0);
})();</script>`;
  return /<\/body\s*>/i.test(normalizedHtml)
    ? normalizedHtml.replace(/<\/body\s*>/i, `${fitTimeline}</body>`)
    : `${normalizedHtml}${fitTimeline}`;
}

export function hyperframesSystemPrompt() {
  return `You create complete, self-contained HyperFrames HTML video compositions. Return one HTML document only, with no markdown fences or explanation.

Composition requirements:
- Use the requested exact width, height, fps, and duration.
- The root composition element must use id="root" and data-composition-id="main", plus data-width, data-height, data-start="0", and data-duration equal to the requested duration in seconds.
- Every timed visual element must have class="clip", a unique id, data-start, data-duration, and a unique integer data-track-index.
- Create at least three distinct timed scenes that cover the full runtime, with clear opening, development, payoff, and ending.
- Use HTML, inline CSS, SVG, and GSAP for polished motion graphics. GSAP is provided locally as a global; do not add a script src. Create one paused GSAP timeline named main and register it last as window.__timelines["main"]. Use absolute-time tweens and finite repeats only.
- Keep all CSS and visuals in this document. Do not use network fetches, timers, Date.now, requestAnimationFrame, unseeded randomness, external images, fonts, audio, video, iframes, modules, forms, links, or user interaction handlers.
- Display audience-facing words only when requested in the brief; never show the production prompt or instructions.
- Use a generic system font stack (Arial, sans-serif). Ensure the layout fills the composition, has clear contrast, and remains legible at the specified aspect ratio.
- Return plain HTML beginning with <!doctype html>.`;
}

export async function validateHyperframesHtml(html: string, expected: { width: number; height: number; durationSeconds: number }) {
  const issues: string[] = [];
  if (html.length > 512_000) issues.push("Composition is too large (maximum 512 KB).");
  const root = html.match(/<([a-z][\w:-]*)\b[^>]*\bdata-composition-id=["']([^"']+)["'][^>]*>/i);
  if (!root) issues.push("The HTML needs a root element with data-composition-id.");
  const rootTag = root?.[0] ?? "";
  const attr = (name: string) => rootTag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1];
  if (Number(attr("data-width")) !== expected.width || Number(attr("data-height")) !== expected.height) {
    issues.push("Composition dimensions must match the requested output size.");
  }
  if (Number(attr("data-start")) !== 0) issues.push("The root composition must start at time 0.");
  if (Math.abs(Number(attr("data-duration")) - expected.durationSeconds) > 0.01) {
    issues.push("Composition duration must match the requested video duration.");
  }
  // Inspect HTML markup rather than inline script bodies. GSAP legitimately
  // uses options such as onComplete=..., which are not HTML event attributes.
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi, "$1$2");
  if (/<\s*(iframe|object|embed|form)\b/i.test(markup) || /<[a-z][^>]*\bon[a-z]+\s*=/i.test(markup) || /\b(?:href|src|action|formaction)\s*=\s*["']?\s*javascript\s*:/i.test(markup) || /(?:src|href)\s*=\s*["'](?:https?:|\/\/)|url\(\s*["']?(?:https?:|\/\/)|@import\s+url/i.test(markup)) {
    issues.push("Composition contains unsupported interactive or embedded markup.");
  }
  if (/<script\b[^>]*\bsrc=/i.test(html)) issues.push("Scripts must be bundled locally; external scripts are not allowed.");
  if (!/class=["'][^"']*\bclip\b/i.test(html)) issues.push("Composition must define timed clips using class=\"clip\".");
  if (issues.length) return issues;

  const lint = await lintHyperframeHtml(html, { host: "studio" });
  issues.push(...lint.findings.filter((finding) => finding.severity === "error").map((finding) => finding.message));
  return [...new Set(issues)];
}

export async function embedHyperframesGsap(html: string) {
  const cleanHtml = stripEmbeddedHyperframesGsap(html);
  if (/<script\b[^>]*\bsrc=/i.test(cleanHtml)) throw new Error("HyperFrames compositions cannot load external scripts.");
  const bundle = await readFile(join(process.cwd(), "node_modules", "gsap", "dist", "gsap.min.js"), "utf8");
  const script = `<script data-aivid-gsap>${bundle.replace(/<\/script/gi, "<\\/script")}</script>`;
  if (/<\/head>/i.test(cleanHtml)) return cleanHtml.replace(/<\/head>/i, `${script}</head>`);
  if (/<\/body>/i.test(cleanHtml)) return cleanHtml.replace(/<\/body>/i, `${script}</body>`);
  return `${script}${cleanHtml}`;
}

export function stripEmbeddedHyperframesGsap(html: string) {
  return html.replace(/<script\b(?=[^>]*\bdata-aivid-gsap\b)[^>]*>[\s\S]*?<\/script>/gi, "");
}
