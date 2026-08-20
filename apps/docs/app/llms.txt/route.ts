import { allMarkdown } from "@/lib/markdown";

export async function GET() {
  const pages = await allMarkdown();
  const body = [
    "# pagebldr documentation",
    "",
    "> Documentation for the embeddable visual page-building engine.",
    "",
    ...pages.map((page) => `- [${page.path}](/docs/${page.path}.md)`),
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
