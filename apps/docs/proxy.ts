import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (
    !request.nextUrl.pathname.startsWith("/docs/") ||
    !request.nextUrl.pathname.endsWith(".md")
  )
    return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/api/markdown/${request.nextUrl.pathname.slice("/docs/".length)}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: "/docs/:path*.md" };
