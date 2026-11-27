import { z } from "zod";
import { generateStructured } from "@/lib/ai/structured";
import { generateText } from "@/lib/ai/generate";

const reviewSchema = z.object({
  verdict: z.enum(["pass", "revise"]),
  findings: z.array(z.object({ requirement: z.string().min(1).max(240), problem: z.string().min(1).max(500) })).max(8),
});

function requiredQuotedCopy(brief: string) {
  return [...brief.matchAll(/[\"\u201c]([^\"\u201d]{2,100})[\"\u201d]/g)]
    .map((match) => match[1].trim())
    .filter((value) => value.length > 1 && !/^(?:https?:|\d+:\d+|\d+\s*(?:seconds?|sec))$/i.test(value));
}

export function findMissingQuotedCopy(brief: string, source: string) {
  const visibleSource = source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "");
  return requiredQuotedCopy(brief).filter((copy) => !visibleSource.toLocaleLowerCase().includes(copy.toLocaleLowerCase()));
}

/** A prompt-faithfulness gate in addition to the engine's technical validator. */
export async function reviewCompositionAgainstBrief({
  brief, storyboard, source, engine,
}: { brief: string; storyboard: unknown; source: string; engine: "remotion" | "hyperframes" }) {
  const visibleSource = engine === "hyperframes"
    ? source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    : source;
  const missingCopy = findMissingQuotedCopy(brief, source);
  const result = await generateStructured("visual composition review", reviewSchema,
    `You are a strict motion-design quality reviewer. Compare the source composition with the user's original brief and storyboard. Judge the actual implemented content, timing, and animation described by the source; do not assume a feature exists because a comment or variable name claims it. Check every requested subject, scene beat, exact title/copy, visual treatment, and motion direction. Pass only when the important requirements are visibly implemented and the animation has a clear opening, development, payoff, and ending. If source code is ambiguous or a prominent requirement is missing, request revision. Return JSON: {"verdict":"pass"|"revise","findings":[{"requirement":"specific user requirement","problem":"specific implementation gap"}]}. Keep findings actionable and concise.`,
    instructions => generateText(instructions, JSON.stringify({ engine, originalBrief: brief, storyboard, compositionSource: visibleSource }, null, 2), true));
  const findings = [...result.findings];
  if (result.verdict === "revise" && findings.length === 0) {
    findings.push({ requirement: "Overall brief fidelity", problem: "The reviewer could not confirm that the composition meets the brief; make the requested subject and motion explicit in the implementation." });
  }
  for (const copy of missingCopy) {
    findings.push({ requirement: `Exact on-screen copy: ${copy}`, problem: `The exact requested text “${copy}” is missing from the composition source.` });
  }
  return { passed: result.verdict === "pass" && findings.length === 0, findings };
}
