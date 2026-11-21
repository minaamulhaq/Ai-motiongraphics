import type { ZodType } from "zod";

export async function generateStructured<T>(
  name: string,
  schema: ZodType<T>,
  system: string,
  request: (instructions: string) => Promise<string>,
): Promise<T> {
  let instructions = system;
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      text = await request(instructions);
    } catch (error) {
      // Some providers intermittently return an empty choices array/content.
      // Give the corrective request below a chance before failing the job.
      if (!(error instanceof Error) || !error.message.includes("empty response") || attempt === 1) throw error;
      instructions = system + "\nThe previous response was empty. Return the complete requested JSON object now.";
      continue;
    }
    try {
      const result = schema.safeParse(JSON.parse(text));
      if (result.success) return result.data;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    instructions = system + "\nRegenerate the complete JSON object from the original brief. Keep descriptions concise, escape any quotation marks inside strings, and close every string, array and object.";
  }
  throw new Error(`The AI returned incomplete or invalid JSON for the ${name} twice.`);
}
