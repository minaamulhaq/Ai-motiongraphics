import { NonRetriableError } from "inngest";
import { z } from "zod";

async function request(path: string, body?: object) {
  const base = process.env.PODCAST_WORKER_URL?.replace(/\/+$/, "");
  const token = process.env.PODCAST_WORKER_TOKEN;
  if (!base || !token) throw new NonRetriableError("Podcast worker configuration is incomplete.");
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Podcast worker returned HTTP ${response.status}`);
  return response.json();
}

export async function submitPodcast(source: string, count: number) {
  return z.object({ id: z.string().min(1) }).parse(await request("/jobs", { s3_key: source, count })).id;
}

export async function pollPodcast(id: string, source: string) {
  const result = await request("/jobs/" + encodeURIComponent(id));
  if (result.status === "processing") return null;
  if (result.status !== "completed") throw new NonRetriableError("Podcast processing failed. Check the Modal run log.");
  const prefix = source.slice(0, source.lastIndexOf("/") + 1);
  return z.array(z.object({
    key: z.string().refine(key => key.startsWith(prefix) && /^clip_\d+\.mp4$/.test(key.slice(prefix.length))),
    title: z.string(), duration: z.number().positive(),
  })).min(1).max(10).parse(result.outputs);
}
