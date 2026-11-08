/**
 * Machine-proof check (FR-10, SC-4 in PRD.md; docs/ARCHITECTURE.md §Runner contract):
 * parses README.md and fails on any claim without a link to a receipt under receipts/
 * or a document under docs/.
 *
 * Contract enforced here:
 *   1. Claim surface  — every README line that is not a heading, a fenced code block,
 *      an image, a blank line, a table header/separator row, or the Novelty-claim
 *      blockquote is a claim and MUST carry at least one artifact link.
 *   2. Artifact link  — a markdown link whose target (anchor stripped) is an existing
 *      in-repo FILE under receipts/ or docs/, or one of the root doc artifacts
 *      PRD.md / AGENTS.md / LICENSE. External URLs never satisfy FR-10.
 *   3. Receipt coverage — every receipt JSON under receipts/ is linked by at least
 *      one claim line, so the README's results table cannot drift from the evidence.
 *   4. Novelty verbatim — the blockquote under README "## Novelty claim" must equal
 *      the blockquote under docs/NOVELTY-POSITIONING.md "## Claim" byte-for-byte
 *      (trailing whitespace excepted), per PRD.md §9: every claim surface reproduces
 *      it verbatim.
 *
 * `--readme <path>` checks a README variant against the same repo artifacts.
 * Exit 0 only when all checks pass.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const RECEIPTS_DIR = join(ROOT, 'receipts');
const NOVELTY_DOC = join(ROOT, 'docs', 'NOVELTY-POSITIONING.md');
/** Root-level doc artifacts FR-10 accepts beside the docs/ tree (PRD.md §5). */
const ROOT_DOCS = ['PRD.md', 'AGENTS.md', 'LICENSE'];

interface ClaimLine {
  line: number;
  text: string;
}

function readmePath(): string {
  const argv = process.argv.slice(2);
  const flag = argv.indexOf('--readme');
  if (flag >= 0) {
    const value = argv[flag + 1];
    if (!value) throw new Error('--readme requires a path argument');
    return resolve(process.cwd(), value);
  }
  return join(ROOT, 'README.md');
}

function stripInlineNoise(text: string): string {
  return text
    .replace(/<!--.*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '');
}

function isFence(text: string): boolean {
  return /^(```|~~~)/.test(text.trim());
}

function isHeading(text: string): boolean {
  return /^#{1,6}\s/.test(text.trim());
}

function isTableSeparator(text: string): boolean {
  return /^ *\|? *:?-{1,}:? *( *\| *:?-{1,}:? *)*\|? *$/.test(text.trim()) && text.includes('-');
}

function isBlockquote(text: string): boolean {
  return text.trim().startsWith('>');
}

/** Collect the blockquote following `heading` in `doc`, '>' stripped; null when absent. */
function blockquoteUnder(doc: string, heading: string): string[] | null {
  const lines = doc.split('\n');
  const at = lines.findIndex((l) => l.trim() === heading);
  if (at < 0) return null;
  const quote: string[] = [];
  for (let i = at + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') {
      if (quote.length > 0) break;
      continue;
    }
    if (!isBlockquote(t)) break;
    quote.push(t.replace(/^>\s?/, '').replace(/\s+$/, ''));
  }
  return quote;
}

/** The claim surface: non-fence, non-heading, non-separator lines with links required. */
function claimSurface(src: string): { claims: ClaimLine[]; novelty: string[] } {
  const raw = src.split('\n');
  const claims: ClaimLine[] = [];
  const novelty: string[] = [];
  let inFence = false;
  let heading = '';
  for (let i = 0; i < raw.length; i++) {
    const text = stripInlineNoise(raw[i]);
    if (isFence(text)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (text.trim() === '') continue;
    if (isHeading(text)) {
      heading = text.trim();
      continue;
    }
    if (isTableSeparator(text)) continue;
    if (isBlockquote(text) && heading.startsWith('## Novelty claim')) {
      novelty.push(text.trim().replace(/^>\s?/, '').replace(/\s+$/, ''));
      continue;
    }
    // A table row immediately followed by a separator row is that table's header.
    if (text.trim().startsWith('|')) {
      let next = -1;
      for (let j = i + 1; j < raw.length; j++) {
        if (stripInlineNoise(raw[j]).trim() === '') continue;
        next = j;
        break;
      }
      if (next >= 0 && isTableSeparator(stripInlineNoise(raw[next]))) continue;
    }
    claims.push({ line: i + 1, text: text.trim() });
  }
  return { claims, novelty };
}

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function linkTargets(text: string): string[] {
  return [...text.matchAll(LINK_RE)].map((m) => m[1].split('#')[0]);
}

function isArtifactLink(target: string): boolean {
  if (target === '' || /^(https?:|mailto:)/i.test(target)) return false;
  const abs = resolve(ROOT, target);
  if (!abs.startsWith(ROOT + sep)) return false;
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const rel = relative(ROOT, abs);
  if (rel.startsWith(`receipts${sep}`) || rel.startsWith(`docs${sep}`)) return true;
  return ROOT_DOCS.includes(rel);
}

/**
 * FR-10 receipt set: git-committed receipts by default. Fresh-run receipts are
 * uncommitted work-in-progress that no README claim links, so including them
 * fails every `pnpm arena:run` → `pnpm arena:prove` sequence inside one clone
 * (README steps 2→4). ARENA_PROVE_ALL=1 widens the scan to every *.json on disk.
 */
function receiptFiles(): string[] {
  if (process.env.ARENA_PROVE_ALL === '1') {
    const out: string[] = [];
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) visit(full);
        else if (entry.endsWith('.json')) out.push(relative(ROOT, full));
      }
    };
    visit(RECEIPTS_DIR);
    return out.sort();
  }
  return committedReceipts().filter((rel) => existsSync(join(ROOT, rel))).sort();
}

/** Receipt files tracked by git (relative to the repo root); fails loudly outside a checkout. */
function committedReceipts(): string[] {
  try {
    return execFileSync('git', ['ls-files', 'receipts'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.json'));
  } catch (err) {
    return fail([`git ls-files failed — arena:prove proves the committed receipt set; run inside the repo checkout: ${String(err)}`]);
  }
}

function fail(lines: string[]): never {
  console.log('arena:prove: FAIL');
  for (const line of lines) console.log(`  ${line}`);
  process.exit(1);
}

function main(): void {
  const path = readmePath();
  let src: string;
  try {
    src = readFileSync(path, 'utf8');
  } catch (err) {
    fail([`cannot read ${path}: ${String(err)}`]);
  }
  const relPath = relative(ROOT, path);
  const problems: string[] = [];

  const { claims, novelty } = claimSurface(src);
  if (claims.length === 0) problems.push(`${relPath}: no claim lines found — nothing to prove`);

  for (const claim of claims) {
    const targets = linkTargets(claim.text);
    for (const target of targets) {
      // A repo-relative link that resolves to nothing is a dangling reference — it is not
      // "a link to a receipt or document" for the reader, so it fails FR-10 outright.
      if (!/^(https?:|mailto:)/i.test(target) && !isArtifactLink(target)) {
        problems.push(`${relPath}:${claim.line}: link target does not resolve to a file in this repo: ${target}`);
      }
    }
    if (targets.length === 0 || !targets.some(isArtifactLink)) {
      problems.push(
        `${relPath}:${claim.line}: claim has no receipt/docs artifact link: "${claim.text.slice(0, 80)}${claim.text.length > 80 ? '…' : ''}"`,
      );
    }
  }

  const linked = new Set(claims.flatMap((c) => linkTargets(c.text)));
  const receipts = receiptFiles();
  for (const rel of receipts) {
    if (!linked.has(rel)) problems.push(`${relPath}: receipt not linked by any claim: ${rel}`);
  }

  const expected = blockquoteUnder(readFileSync(NOVELTY_DOC, 'utf8'), '## Claim');
  if (expected === null) fail([`docs/NOVELTY-POSITIONING.md: "## Claim" blockquote not found`]);
  if (novelty.length !== expected.length || novelty.some((l, i) => l !== expected[i])) {
    problems.push(
      `${relPath}: "## Novelty claim" blockquote differs from docs/NOVELTY-POSITIONING.md §Claim — every claim surface must reproduce it verbatim (PRD.md §9)`,
    );
  }

  if (problems.length > 0) fail(problems);
  console.log(
    `arena:prove: PASS — ${claims.length} claims, all artifact-linked; ${receipts.length}/${receipts.length} receipts covered; novelty claim verbatim`,
  );
}

main();
