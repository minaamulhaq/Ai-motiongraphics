# Clipping deployment

The web app uploads sources directly to a private S3 bucket. PostgreSQL is the durable queue. Dedicated Python workers claim jobs using SKIP LOCKED and renewable leases. Each worker processes one job at a time; scale by running additional containers. Completed outputs are private MP4s with styled captions burned into their pixels. No subtitle download is exposed.

## Setup

1. Apply `supabase/migrations/20261125090000_clipping.sql` to the application's Supabase database.
2. Configure the web app and workers with `CLIP_S3_BUCKET`, `AWS_REGION`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Workers also need `OPENAI_API_KEY`. Use AWS workload IAM roles in production; local development can use standard AWS credentials.
3. Allow bucket CORS PUT requests from the exact application origin with Content-Type and x-amz-* headers. Keep public access blocked. Grant web identity PutObject/GetObject, and worker identity GetObject/PutObject, only within the `clipping/` prefix.
4. Build: `docker build -t clipping-worker workers/clipping`.
5. Run with a private environment file: `docker run --env-file .env.worker --memory=4g --cpus=2 clipping-worker`. Never commit this file. Configure platform restart policy and monitoring.
6. Open `/dashboard/auto-clipping`, upload a spoken video, select count and aspect ratio, and wait for captioned MP4s.

## Behavior and limits

- Maximum upload: 500 MB; duration: two hours; 1–10 clips. Clips target 15–90 seconds. Insufficient distinct speech produces a helpful failure rather than duplicate clips.
- Whisper supplies word timestamps. gpt-4o-mini chooses coherent segments from the transcript. This version selects based on speech, not visual scene recognition.
- FFmpeg/libass renders white outlined captions in groups of up to five words. The complete source frame is fitted with padding; automatic speaker tracking and face cropping are not implemented.
- Source audio is preserved. Captions use the original spoken language; fonts supplied cover Latin text. Add suitable fonts before supporting other scripts.
- Transcription chunks are persisted in private S3 to avoid paying again on a worker retry. Jobs retry at most three times. Uploading rows are not processed until S3 HEAD confirms their expected size.
- Signed preview URLs last one hour and refresh through polling. The database is service-role-only; web API ownership checks protect each user's jobs.
- Configure S3 retention/lifecycle for abandoned uploads and job artifacts, and database retention appropriate to your product. Monitor queued age, expired leases, failures, disk usage and OpenAI cost.

## Verification before launch

Run the migration in staging; configure real bucket CORS and worker credentials. Upload a sample, verify audible speech and caption alignment on every clip, refresh the browser, terminate a worker during processing and confirm lease recovery, and verify users cannot retrieve each other's jobs. Load test at the intended concurrency. Live cloud processing has not been executed by the code author.
