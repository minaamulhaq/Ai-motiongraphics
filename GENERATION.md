# AI motion composition workflow

## Remotion deployment

`npm run remotion:site:deploy` publishes the included, labeled deployment demo as `my-motion`. Both `remotion/index.ts` and `remotion/src/export-composition.tsx` are valid standalone entry points. The checked-in `generated-project.tsx` contains that demo only.

Actual project exports create isolated temporary source, settings, and theme files, then bundle and deploy a separate site for that video. They do not use the demo site. Keep Next.js and Inngest running and use Export MP4 after generation completes. The AWS region, Lambda function name, bucket, and credentials must be configured for actual rendering.

`npm run remotion:bundle:smoke` bundles a small generated composition using the same temporary entry and Remotion Webpack code as export, without AWS calls. After `npm run build`, `npm run remotion:trace:verify` checks that the Inngest serverless trace contains every installed package file in the Remotion runtime dependency closure, including ESM export targets.

For a production smoke check, set `REMOTION_BUNDLE_SMOKE_SECRET` in the Vercel Production environment and redeploy. Then POST to `/api/internal/remotion-bundle-smoke` with `Authorization: Bearer <the-same-secret>`. A response with `ok: true` and the deployed commit SHA confirms that Vercel completed the dynamic Remotion/Webpack bundle; this endpoint does not upload a site to S3 or invoke an AWS render. The route returns 404 when the secret is unset.

Start Next.js with `npm run dev` and the Inngest development server with `npm run inngest:dev`. The Inngest dashboard is http://localhost:8288 and the registered endpoint is /api/inngest. The development server must remain running to execute jobs.

## Application flow

Opening a project checks its generation record. No record means pending. Owners automatically call the generation endpoint, which uses a Postgres function to create one queued run atomically. Concurrent visits reuse its run ID and Inngest event ID. A failed run can be retried explicitly with a new attempt and run ID. Guests can view shared progress but cannot queue work.

Every new video reserves 20 credits and every prompt-based modification reserves 10 credits. Clerk users start with 100 credits. The database locks the user's balance and generation row, validates ownership, deducts the exact cost, writes a credit ledger entry, and creates the run in one transaction. Insufficient balance stops before an Inngest event or AI request is sent. Duplicate requests return the existing run without another deduction. Permanent workflow failures refund the reservation exactly once; successful validation settles it as charged. Retrying a refunded failure creates a new reservation, so the final successful generation is charged once.

Inngest executes separately checkpointed steps to load the project, expand the prompt into a timed scene plan, generate a validated theme JSON, generate Remotion TSX using the installed local Remotion Best Practices agent skill, and type-check the output. At run time the worker loads the skill router plus its create, markup, and SaaS references from `.agents/skills/remotion-best-practices`, so updates to those local instructions are used by subsequent jobs. AI scene timing is normalized to the exact requested frame count. If the provider's code draft is empty or fails validation, a deterministic skill-aligned Remotion composition is built from the AI scene plan and theme. The final source is saved only after validation. Stage status and progress are persisted in public.project_generations and polled by the page every 2.5 seconds.

Each step uses a snapshot of the initial project settings. Progress represents completed workflow milestones, not elapsed time. Inngest retries transient failures twice. Credit failures stop without additional provider attempts. Exhausted failures are saved with retry guidance. Updates are scoped to the run ID to prevent an older attempt from overwriting a newer one.

`POST /api/projects/[id]/generate` requires a Clerk session and a same-origin request. An empty body queues the original 20-credit generation, `{prompt}` queues a 10-credit modification after the original completes, and `{retry:true}` retries a failed reservation. The browser never chooses the cost. In production `/api/inngest` refuses to run unless both Inngest keys are configured, and the Inngest SDK verifies request signatures before executing a function. Local unsigned execution requires the explicit `INNGEST_DEV=1` setting.

## Configuration

Local .env.local uses OPENROUTER_API_KEY, OPENROUTER_MODEL=baidu/ernie-5.5-flash-preview:free, INNGEST_DEV=1, and a server-only SUPABASE_SERVICE_ROLE_KEY. The free ERNIE model was selected after paid Gemini and GPT-4.1 Mini reservations returned HTTP 402. The worker has no Clerk cookie, so it uses its server key after the authorized queue endpoint has established project ownership.

OpenRouter is the default when its key is present. To use OpenAI, remove OPENROUTER_API_KEY and supply OPENAI_API_KEY and OPENAI_MODEL. AI calls send the saved creative prompt and video settings to the selected provider. Keys remain in server configuration.

For deployment set INNGEST_DEV=0, INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY from the same Inngest environment. Sync /api/inngest with Inngest Cloud and allow a 300-second function duration. Next.js includes the Remotion guidance Markdown in the route's traced files. Keep the service role key server-only.

The generation schema is tracked in `supabase/migrations/20261119000100_generation.sql`; atomic billing and the private ledger are tracked in `supabase/migrations/20261119040214_generation_credits.sql`. Both were applied to the hosted project. Clerk ownership policies protect generation and ledger reads. Only the server worker can settle or refund a reservation.

## Artifacts and preview

The generated module exports default MotionVideo({theme}) and named videoConfig with dimensions, fps, durationInFrames and defaultProps. Theme JSON contains colors, typography, mood and motion settings. Both artifacts are downloadable from the project workspace.

Generated source is type-checked as data and is not evaluated inside the app or worker. The existing abstract browser preview remains a separate feature. Executing arbitrary generated compositions and exporting their MP4 requires a separate isolated Remotion rendering service.

## Verification

The local Inngest endpoint and development server were checked. A temporary Clerk user and project verified authenticated project creation, duplicate request deduplication, every persisted progress stage, AI brief and theme generation, Remotion source generation, TypeScript validation, completion at 100%, and artifact reads through the application API. A rollback-only hosted database test also verified the 20-credit initial reservation, duplicate protection, failure refund, retry reservation, successful settlement, 10-credit modification, and insufficient-credit rejection. No billing fixtures were retained.

