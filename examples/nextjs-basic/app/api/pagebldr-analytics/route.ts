import { NextResponse } from "next/server";

import { events } from "../../../lib/builder";

export async function POST(request: Request) {
  const input = (await request.json()) as {
    readonly action?: string;
    readonly documentId?: string;
    readonly elementId?: string;
    readonly path?: string;
  };
  if (!input.documentId || !input.elementId || !input.path)
    return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  await events.analytics({
    type: "element.interaction",
    context: { namespace: "nextjs-example" },
    subject: { documentId: input.documentId, elementId: input.elementId },
    data: { path: input.path, action: input.action ?? "activate" },
  });
  await events.flush();
  return new NextResponse(null, { status: 204 });
}
