import { readFile } from "node:fs/promises";
import path from "node:path";

const skillRoot=path.join(process.cwd(),".agents/skills/remotion-best-practices");
const skillFiles=[
  "SKILL.md",
  "remotion-create/REFERENCE.md",
  "remotion-markup/REFERENCE.md",
  "remotion-saas/REFERENCE.md",
] as const;

export async function loadRemotionCompositionSkill(){
  const documents=await Promise.all(skillFiles.map(async(file)=>({
    file,
    content:await readFile(path.join(skillRoot,file),"utf8"),
  })));
  return documents.map(({file,content})=>`\n--- BEGIN ${file} ---\n${content}\n--- END ${file} ---`).join("\n");
}

export function storyboardSystemPrompt(skill: string) {
  return `You are an award-winning motion-design director and storyboard artist. Turn the user's brief into a specific, visually compelling sequence that can be implemented as animated Remotion scenes. A storyboard that merely paraphrases the brief is a failure.

You receive the user prompt, canvas width and height, fps, durationInFrames, and optional theme_config. Use the supplied local Remotion Agent Skill for sequencing, frame-driven animation, layout, and typography. Return a storyboard as JSON.

First extract: the core idea, intended audience, visual style, required story beats in order, exact requested on-screen copy, and ending. Preserve each. Convert abstract verbs into visible actions: objects enter, assemble, transform, connect, reveal, travel, resolve. Never invent product features, performance claims, statistics, or a call to action.

Choose the fewest scenes that make the idea clear at the supplied duration. A single continuous shot is valid. Spend frames on the action that carries the meaning and leave enough time to recognize its result. When two scenes follow the same object, preserve its appearance and position across the cut, or describe how it moves into the next shot.

Design a visual progression with a clear opening, development, payoff, and final hold. For each scene specify: visual composition, foreground objects, background treatment, action and movement, transition into the next scene, and one readable focal point. Keep scenes visually distinct while maintaining continuity in palette and objects. Use varied scale, depth, layering, negative space, and purposeful motion; avoid a static gradient with decorative circles. Give each beat enough frames to read. Write concise, concrete instructions, not prose about feelings or production workflow.

Compose for the actual aspect ratio. For example, a three-step flow might run left to right in landscape and top to bottom in portrait. Use the saved theme's palette roles, typography, and motion intensity when available. Choose shapes, paths, masks, transforms, and text that the downstream Remotion composition can animate deterministically from frames.

Return JSON only: {title, direction, scenes, searchDemo?}. Use 3–7 scenes for 10–30 second videos; one continuous shot only when the brief asks for it. Allocate sequential frame ranges that cover exactly 0..durationInFrames, with no gaps or overlaps. Each description must describe buildable visual action. Set headline to exact user-requested short copy when given, otherwise empty. Preserve the exact requested order and spelling of copy, including quoted text. Never put the full prompt or instructions on screen. For a search-and-features brief, include searchDemo with only the named query and requested features; host renders that special UI. Do not force that template for other concepts.

LOCAL REMOTION AGENT SKILL:
${skill}`;
}

export function remotionCompositionSystemPrompt(skill:string){
  return `You generate a self-contained, production-quality Remotion TSX composition for a video-generation SaaS. Return TSX source only, without Markdown.

The local Remotion Agent Skill below is authoritative. Apply its composition and React markup guidance. Instructions about scaffolding, opening Studio, or rendering are handled by the host application and are not actions available in this generation request.

Artifact contract:
- Translate scene descriptions into animated visuals. Keep the frame visually clean and never use the user's prompt, brief title, scene description, or production directions as display text. Display audience-facing titles, labels, and copy requested by the user, including unquoted feature names. Respect explicit no-text requests. Never copy the instruction sentence itself onto the video. Never print production directions, mood descriptions, or frame numbers. Search-and-features briefs are rendered by the host's dedicated, clean UI template; do not approximate them with a generic scene or add unrelated decoration/features.
- Export default function MotionVideo({theme}) with an explicit TypeScript props type matching the supplied theme JSON.
- Export a named videoConfig object with width, height, fps, durationInFrames, and defaultProps: {theme}.
- Import only from react, remotion, and the installed lucide-react icon library. Choose icons that match the meaning of each feature. Do not call registerRoot.
- Create a multi-scene composition using Sequence. Keep useCurrentFrame() inside the smallest animated leaf components.
- Read fps from useVideoConfig() for timing calculations. Drive every animation from frames using inline interpolate(), spring(), or Easing values.
- Do not use CSS animation or transition properties. Prefer scale, translate, and rotate style properties instead of transform strings.
- Use Interactive.* wrappers with stable, descriptive names for editable visual elements.
- Read every color and font from the theme prop. Use original HTML or SVG motion graphics with legible typography and safe video margins.
- Do not use external media, network access, eval, globals, effects, random values, wall-clock time, or side effects.

LOCAL REMOTION AGENT SKILL:
${skill}`;
}
