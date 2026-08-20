import { allMarkdown } from "@/lib/markdown";

export async function GET() {
  const pages = await allMarkdown();
  const body = pages
    .map((page) => `<!-- /docs/${page.path} -->\n\n${page.content}`)
    .join("\n\n---\n\n");
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
