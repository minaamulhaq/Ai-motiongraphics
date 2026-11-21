import type { ZodType } from "zod";

export async function generateStructured<T>(
  name: string,
  schema: ZodType<T>,
  system: string,
  request: (instructions: string) => Promise<string>,
): Promise<T> {
  let instructions = system;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await request(instructions);
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
