import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const docsRoot = path.resolve("content/docs");
const packageManifest = JSON.parse(
  await readFile(path.resolve("../../packages/pagebldr/package.json"), "utf8"),
);
const publicExports = new Set(
  Object.keys(packageManifest.exports).map((key) =>
    key === "." ? "pagebldr" : `pagebldr${key.slice(1)}`,
  ),
);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory()
          ? filesIn(absolute)
          : /\.mdx$/u.test(entry.name)
            ? [absolute]
            : [];
      }),
    )
  ).flat();
}

const files = await filesIn(docsRoot);
const routes = new Set(
  files.map((file) => {
    const relative = path.relative(docsRoot, file).replaceAll("\\", "/");
    const slug = relative.replace(/(?:\/index)?\.mdx$/u, "");
    return `/docs${slug ? `/${slug}` : ""}`;
  }),
);
const failures = [];

for (const file of files) {
  const relative = path.relative(docsRoot, file).replaceAll("\\", "/");
  const content = await readFile(file, "utf8");
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? "";

  for (const field of ["title", "description"]) {
    if (!new RegExp(`^${field}:\\s+\\S`, "mu").test(frontmatter))
      failures.push(`${relative}: missing ${field} frontmatter`);
  }

  if (/\b(?:Quizr|Tener)\b/u.test(content))
    failures.push(`${relative}: product-specific vocabulary is not permitted`);

  for (const [, href] of content.matchAll(/\]\((\/docs[^)#?]*)(?:[)#?])/gu)) {
    const route = href.replace(/\/$/u, "");
    if (!routes.has(route)) failures.push(`${relative}: broken link ${href}`);
  }

  for (const [, moduleName] of content.matchAll(
    /(?:from\s+|import\s*)["'`](pagebldr(?:\/[a-z-]+)?)["'`]/gu,
  )) {
    if (!publicExports.has(moduleName))
      failures.push(`${relative}: unknown public export ${moduleName}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${files.length} documentation pages.\n`);
}
