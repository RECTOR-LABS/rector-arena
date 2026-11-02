// Copy the committed receipts into public/ so the leaderboard reads them from
// the same relative path locally and on a hosted deploy (Vercel ships public/).
// Chained explicitly in the dev/build scripts — pnpm does not run pre* hooks
// by default (enable-pre-post-scripts=false).
import { cpSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(webDir, "..", "..", "receipts");
const dest = resolve(webDir, "public", "receipts");

if (!existsSync(src)) {
  console.error(`copy-receipts: source missing: ${src}`);
  process.exit(1);
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
