# Supabase setup for AI Vid

## Implemented plan

Install the Supabase SDK, SSR adapter and CLI. Create versioned schema migrations, configure typed clients, migrate project data, generate client types and verify ownership and guest queries. The original SQLite tables were empty at cutover.

## Current application

Clerk handles accounts and sessions. Supabase Postgres stores users, project metadata, prompts, themes, sharing and chat messages. The server passes Clerk session tokens to Supabase through its accessToken callback. Row level policies use the JWT sub claim as a text Clerk user ID. Static artwork ships with the app. Rendered preview videos stay in browser memory until downloaded and are recreated on demand.

The hosted URL and publishable key belong in the ignored .env.local file alongside the Clerk credentials. .env.example contains placeholders. The hosted project trusts the issuer https://social-falcon-250.clerk.accounts.dev through Supabase Third Party Auth.

The server requests the Clerk JWT template `aivid-supabase`. This template uses Clerk's own signing key, a 60-second lifetime, and claims `{"role":"authenticated","aud":"authenticated"}`. Clerk includes the user ID as `sub`. The ordinary Clerk session cookie continues to authenticate app requests. The dedicated template supplies the token used only for database requests.

The hosted Clerk provider registration and workspace/access migrations were applied on November 19, 2026 (Asia/Karachi). Signed-in client queries were verified using a temporary Clerk account which was deleted after testing. Ownership and privacy policies are enforced in Postgres.

## Hosted migration

The public key supports application requests. Schema changes require a CLI login and database access. For the selected hosted project:

```sh
npx supabase login
npx supabase link --project-ref yiwgytmpfgucyfzipldq
npx supabase db push --dry-run
npx supabase db push
npm run db:types -- --linked
```

Review the dry run against the existing remote schema. Version 20261118000200 adds project chat and reconciles the Clerk users and projects columns. Version 20261118000300 grants authenticated users access to their own records and replaces broad access policies. Chat uses one insert for each request and its built-in assistant response.

## Local verification

```sh
npm run db:start
npm run db:migrate
npm run db:types
npm run db:verify
```

Docker Desktop must be running. The local API uses port 55431 and Postgres uses 55432. The SQL verification runs only on the local stack, simulates Clerk JWT claims, checks private and shared project access, ownership spoofing and chat privacy, then rolls fixtures back. Enable Clerk Third Party Auth locally if using actual signed-in local sessions. The app's hosted environment settings are independent of the local test stack.

## Project workspace

The project route reads records through an authorized API. Owners can save theme, duration and ratio changes and chat history. Guests can view shared projects. Chat currently uses built-in scene guidance. The browser renders a real abstract motion video through Canvas and MediaRecorder with progress from actual frame capture, cancellation, playback and download. A video model and conversational AI provider are required for freeform AI generation.

## Development server

Run npm commands from D:/My_Youtube/motiongrapc-genrator. If Next reports an existing dev server for that directory, use its reported URL. Start only one dev server per checkout.
