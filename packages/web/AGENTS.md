<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Hosted deploy

Production deploys run from the repo root as a flat upload of this package — `vercel deploy packages/web --prod`. The project has no `rootDirectory` set on purpose: Vercel's rootDirectory-monorepo path builds fine but never attaches the app function for this Next version (statics serve, `/` 404s). Receipts ride in via the committed `packages/web/public/receipts` snapshot; when the monorepo source is absent at build time, `scripts/copy-receipts.mjs` keeps the snapshot instead of failing. Never run a bare `vercel deploy --prod` from the repo root — it uploads the monorepo root, which is not a Next app.
