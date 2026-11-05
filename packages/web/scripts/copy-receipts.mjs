// Copy the committed receipts into public/ so the leaderboard reads them from
// the same relative path locally and on a hosted deploy (Vercel ships public/).
// Chained explicitly in the dev/build scripts — pnpm does not run pre* hooks
// by default (enable-pre-post-scripts=false).
//
// Monorepo runs resolve receipts/ two levels up. Flat hosted deploys upload
// only packages/web, so the monorepo source is absent there; public/receipts
// is committed in the repo and ships with the upload — keep it and build on.
import { cpSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(webDir, "..", "..", "receipts");
const dest = resolve(webDir, "public", "receipts");

if (!existsSync(src)) {
  if (!existsSync(dest)) {
    console.error(`copy-receipts: source missing and no committed fallback at ${dest}`);
    process.exit(1);
  }
  console.log(`copy-receipts: monorepo source absent — using committed ${countFiles(dest)} receipt files in public/receipts`);
  process.exit(0);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`copy-receipts: ${countFiles(dest)} receipt files -> public/receipts`);

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = resolve(dir, entry);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}
