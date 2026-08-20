import { readMarkdown } from "@/lib/markdown";

export async function GET(
  _request: Request,
  {
    params,
  }: { readonly params: Promise<{ readonly slug: readonly string[] }> },
) {
  const content = await readMarkdown((await params).slug);
  return content
    ? new Response(content, {
        headers: { "content-type": "text/markdown; charset=utf-8" },
      })
    : new Response("Not found", { status: 404 });
}
