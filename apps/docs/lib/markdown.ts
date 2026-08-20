import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const contentRoot = path.join(process.cwd(), "content", "docs");

export async function markdownFiles(
  directory = contentRoot,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(absolute);
      return /\.mdx?$/u.test(entry.name) ? [absolute] : [];
    }),
  );
  return nested.flat().sort();
}

export async function readMarkdown(
  slug: readonly string[],
): Promise<string | null> {
  const relative = slug.join("/").replace(/\.md$/u, "") || "index";
  if (
    relative.split("/").some((segment) => segment === "." || segment === "..")
  )
    return null;
  for (const extension of [".mdx", ".md"]) {
    try {
      return await readFile(
        path.join(contentRoot, `${relative}${extension}`),
        "utf8",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

export async function allMarkdown(): Promise<
  readonly { path: string; content: string }[]
> {
  return Promise.all(
    (await markdownFiles()).map(async (file) => ({
      path: path
        .relative(contentRoot, file)
        .replaceAll("\\", "/")
        .replace(/\.mdx?$/u, ""),
      content: await readFile(file, "utf8"),
    })),
  );
}
