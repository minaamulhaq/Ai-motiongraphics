import { NonRetriableError } from "inngest";
import { clipDatabase } from "@/lib/clipping/server";
import { inngest } from "./client";
import { pollPodcast, submitPodcast } from "@/lib/clipping/podcast";

export const processClippingJob = inngest.createFunction(
  {
    id: "process-captioned-video-clips",
    retries: 2,
    concurrency: { limit: 4, key: "event.data.ownerId" },
    idempotency: "event.data.jobId",
    onFailure: async ({ event }) => {
      const { jobId } = event.data.event.data as { jobId: string };
      const failure = (event.data.error as { message?: string } | undefined)?.message;
      const error = failure?.startsWith("Speech transcription")
        ? failure
        : "Processing could not finish. Please try again.";
      await clipDatabase()
        .from("clip_jobs")
        .update({ status: "failed", stage: "Could not complete", error })
        .eq("id", jobId)
        .in("status", ["queued", "processing"]);
    },
  },
  { event: "video/clipping.requested" },
  async ({ event, step }) => {
    const jobId = String(event.data.jobId);
    const job = await step.run("load-clipping-job", async () => {
      const { data, error } = await clipDatabase()
        .from("clip_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("owner_id", String(event.data.ownerId))
        .single();
      if (error || !data) throw new NonRetriableError("Clipping request was not found.");
      if (data.status === "completed") return { done: true as const };
      if (!(["queued", "processing"] as string[]).includes(data.status)) {
        throw new NonRetriableError("Clipping request is no longer active.");
      }
      const updated = await clipDatabase()
        .from("clip_jobs")
        .update({ status: "processing", stage: "Preparing video", progress: 2 })
        .eq("id", jobId);
      if (updated.error) throw updated.error;
      return { done: false as const, job: data };
    });
    if (job.done) return { jobId, status: "completed", reused: true };
    if (job.job.ratio !== "9:16") {
      throw new NonRetriableError("This clipping worker supports vertical 9:16 only. Please create a new 9:16 job.");
    }

    const call = await step.run("submit-podcast", () =>
      submitPodcast(job.job.source_key, job.job.requested_clips),
    );
    let outputs;
    for (let attempt = 0; attempt < 300; attempt++) {
      const result = await step.run(`poll-podcast-${attempt}`, () =>
        pollPodcast(call, job.job.source_key),
      );
      if (result) {
        outputs = result;
        break;
      }
      await step.sleep(`wait-podcast-${attempt}`, "30s");
    }
    if (!outputs) throw new NonRetriableError("Podcast worker timed out.");

    await step.run("save-completed-clips", async () => {
      const result = await clipDatabase()
        .from("clip_jobs")
        .update({ status: "completed", stage: "Ready", progress: 100, error: null, outputs })
        .eq("id", jobId);
      if (result.error) throw result.error;
    });
    return { jobId, status: "completed", clips: outputs.length };
  },
);
