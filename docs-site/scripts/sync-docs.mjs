// Copy the repo's Markdown notes (../docs) into the Starlight content folder.
// docs/ stays the source of truth: it reads well on github.com, and this
// script only adds the frontmatter Starlight needs and rewrites relative links.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(site, "..");
const base = (process.env.SITE_BASE ?? "/tabush").replace(/\/$/, "");
const GITHUB = "https://github.com/SebasEliens/tabush/blob/main";

// Repo path of a Markdown note -> path of its page on the site.
const SECTIONS = [
  { from: "docs/research", to: "research", files: null },
  { from: "docs", to: "design", files: ["design-system.md", "design-feedback.md"] },
];

const pages = new Map(); // repo path -> site URL
for (const { from, to, files } of SECTIONS) {
  const dir = join(repo, from);
  if (!existsSync(dir)) continue;
  const names = files ?? readdirSync(dir).filter((n) => n.endsWith(".md"));
  for (const name of names) {
    pages.set(posix.join(from, name), `${base}/${to}/${name.replace(/\.md$/, "")}/`);
  }
}

function rewriteLink(target, fromRepoPath) {
  if (/^([a-z]+:|#|\/)/i.test(target)) return target;
  const [path, hash = ""] = target.split("#");
  const repoPath = posix.normalize(posix.join(posix.dirname(fromRepoPath), path));
  const anchor = hash ? `#${hash}` : "";
  if (pages.has(repoPath)) return pages.get(repoPath) + anchor;
  if (repoPath.startsWith("docs/screenshots/")) return `${base}/${repoPath.slice(5)}`;
  return `${GITHUB}/${repoPath}${anchor}`;
}

function toPage(markdown, repoPath, order) {
  const lines = markdown.split("\n");
  const h1 = lines.findIndex((l) => l.startsWith("# "));
  const title = h1 >= 0 ? lines[h1].slice(2).trim() : repoPath;
  if (h1 >= 0) lines.splice(h1, 1);
  const body = lines
    .join("\n")
    .replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (_, a, t, b) => a + rewriteLink(t, repoPath) + b);
  const front = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `editUrl: ${JSON.stringify(`${GITHUB.replace("/blob/", "/edit/")}/${repoPath}`)}`,
    `sidebar: { order: ${order} }`,
    "---",
    "",
    `:::note[Synced from the repo]`,
    `This page is generated from [\`${repoPath}\`](${GITHUB}/${repoPath}). Edit it there.`,
    ":::",
    "",
  ];
  return front.join("\n") + body;
}

for (const { to } of SECTIONS) rmSync(join(site, "src/content/docs", to), { recursive: true, force: true });
let order = 0;
for (const [repoPath, url] of pages) {
  const out = join(site, "src/content/docs", url.slice(base.length + 1, -1) + ".md");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toPage(readFileSync(join(repo, repoPath), "utf8"), repoPath, order++));
}

const shots = join(repo, "docs/screenshots");
rmSync(join(site, "public/screenshots"), { recursive: true, force: true });
if (existsSync(shots)) cpSync(shots, join(site, "public/screenshots"), { recursive: true });

console.log(`sync-docs: ${pages.size} pages from ${relative(site, join(repo, "docs"))}`);
