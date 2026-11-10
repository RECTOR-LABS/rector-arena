<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Hosted deploy

Production deploys are automatic: the Vercel project `web` has `rootDirectory` set to `packages/web` (set 2026-11-10), so every push to `main` builds, goes READY, and takes the `arena.rectorspace.com` alias. A 2026-11-05 rootDirectory build built fine but never attached the app function (statics served, `/` 404'd); on Next 16.4.3 + current Vercel the attach works — verified 2026-11-10 with a git deploy serving `/`, `/demo`, `/leaderboard` at 200. The flat upload `vercel deploy packages/web --prod` from the repo root remains the manual fallback. Deployment URLs (`web-<hash>-<team>.vercel.app`) sit behind Vercel SSO protection — always verify via the custom domain, never the deployment URL. Receipts ride in via the committed `packages/web/public/receipts` snapshot; when the monorepo source is absent at build time, `scripts/copy-receipts.mjs` keeps the snapshot instead of failing. Never run a bare `vercel deploy --prod` from the repo root — it uploads the monorepo root, which is not a Next app.
