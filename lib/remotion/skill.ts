import { readFile } from "node:fs/promises";
import path from "node:path";

const skillRoot=path.join(process.cwd(),".agents/skills/remotion-best-practices");
const hyperframesSkillRoot=path.join(process.cwd(),".agents/skills/hyperframes");
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

export async function loadHyperframesMotionGuidance(){
  const [skill,motion]=await Promise.all([
    readFile(path.join(hyperframesSkillRoot,"SKILL.md"),"utf8"),
    readFile(path.join(hyperframesSkillRoot,"references/motion.md"),"utf8"),
  ]);
  return `--- HyperFrames skill identity ---\n${skill}\n--- HyperFrames motion craft reference ---\n${motion}`;
}

export function videoPromptRefinementSystemPrompt(){
  return `You are a senior motion-graphics creative director. Rewrite the user's request into one clear, detailed production prompt that another AI will use to generate the finished Remotion video code.

This is prompt refinement, not video planning output and not code generation. Do not return JSON, a storyboard object, a scene table, analysis, commentary, or TSX. Return only the improved video prompt itself, written as direct instructions to the video-composition generator.

Preserve the user's core idea, audience, desired style, runtime, aspect ratio, every explicit constraint, and exact requested on-screen wording. Expand vague asks into concrete visual direction: what the viewer sees, what objects appear, how they move or transform, how the layout develops, how moments connect, and how the ending resolves. Ensure visible, purposeful motion and a composed frame throughout; do not permit blank holds, a lone decorative dot, a flat full-frame color, or a static card to stand in for the requested animation.

When the user specifies a sequence or timestamps, preserve its order and timing. When the user does not, create a concise temporal progression appropriate to the duration, with a clear opening, development, visual payoff, and ending. Describe visual actions in ordinary production language, not implementation details. Avoid inventing product features, claims, metrics, or labels. If the user limits on-screen text, repeat that restriction clearly and list only the permitted copy. Instruct the downstream generator to keep the original prompt, production directions, and this refined prompt off-screen.

The result should be specific enough to guide polished motion design without becoming unnecessarily verbose. Return the finished prompt only.`;
}

export function remotionCompositionSystemPrompt(skill:string,hyperframesMotionGuidance:string){
  return `You generate a self-contained, production-quality Remotion TSX composition for a video-generation SaaS. Return TSX source only, without Markdown.

REQUIRED SKILL USE:
- Read and apply the complete local Remotion Agent Skill included below before writing TSX. Its Remotion composition rules and React markup guidance are authoritative for this output.
- Apply the skill's recommendations for composition, timing, transitions, typography, visual hierarchy, accessibility, and render-safe implementation wherever relevant.
- Do not return or summarize the skill. Follow it while producing only the requested composition source.
- The host handles project scaffolding, Studio, bundling, and rendering; those are not actions for this generation request.

HYPERFRAMES MOTION REFERENCE:
- Use the installed HyperFrames skill below as a secondary source for visual craft: varied movement and easing by role, clear motion handoffs, deliberate overlap and stagger, readable title holds, contrast in pacing, and resolved transitions.
- This app outputs Remotion TSX. Translate only compatible motion-design ideas into Remotion frame-driven code; the Remotion skill and artifact contract below control implementation.
- Ignore HyperFrames-specific HTML markup, data attributes, GSAP timelines, CLI instructions, runtime, rendering process, telemetry, and workflow steps. Do not import or invoke HyperFrames. Do not use its wall-clock-based animation tools in this TSX composition.

Artifact contract:
- Translate scene descriptions into animated visuals. Keep the frame visually clean and never use the user's prompt, brief title, scene description, or production directions as display text. Display audience-facing titles, labels, and copy requested by the user, including unquoted feature names. Respect explicit no-text requests. Never copy the instruction sentence itself onto the video. Never print production directions, mood descriptions, or frame numbers. Search-and-features briefs are rendered by the host's dedicated, clean UI template; do not approximate them with a generic scene or add unrelated decoration/features.
- Export default function MotionVideo({theme}) with an explicit TypeScript props type matching the supplied theme JSON.
- Export a named videoConfig object with width, height, fps, durationInFrames, and defaultProps: {theme}.
- Import only from react, remotion, and the installed lucide-react icon library. Lucide icons are named without an 'Icon' prefix (e.g. use 'Search', 'Sparkles', 'MessageCircle', 'Clapperboard' — NEVER 'IconSearch', 'IconSparkles'). Use a Lucide icon only when it communicates a requested object or feature; choose semantically accurate icons, size them for the output resolution, and animate them only with Remotion frame values. Avoid decorative or unrelated icons. Do not call registerRoot.
- Create a multi-scene composition using Sequence. Keep useCurrentFrame() inside the smallest animated leaf components.
- Read fps from useVideoConfig() for timing calculations. Drive every animation from frames using inline interpolate(), spring(), or Easing values.
- Every interpolate inputRange must be strictly increasing after frame expressions are evaluated. Never repeat an endpoint (for example [600,630,630]). For zero-length holds, remove the duplicate input and its output together; keep the final value at that frame. Keep inputRange and outputRange lengths equal.
- Do not use CSS animation or transition properties. Prefer scale, translate, and rotate style properties instead of transform strings.
- Use Interactive.* wrappers with stable, descriptive names for editable visual elements.
- Read every color and font from the theme prop. Use original HTML or SVG motion graphics with legible typography and safe video margins.
- Do not use external media, network access, eval, globals, effects, random values, wall-clock time, or side effects.
- This application renders React/TSX through Remotion Player and Remotion Lambda. Do not import HyperFrames or use its HTML project format, CLI, runtime, or timeline APIs inside this TSX module. Do not use GSAP or any animation library with its own wall-clock ticker; translate the visual intent into the Remotion APIs above so preview and exported frames stay synchronized.

LOCAL REMOTION AGENT SKILL:
${skill}

LOCAL HYPERFRAMES SKILL AND MOTION REFERENCE (visual-design guidance only):
${hyperframesMotionGuidance}`;
}
