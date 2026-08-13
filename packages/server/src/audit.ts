import type { AuditEventStore } from "@pagebldr/runtime";

export function createAuditQuery(options: {
  readonly store: AuditEventStore;
  readonly authorize: (request: Request) => boolean | Promise<boolean>;
  readonly resolveScope: (
    request: Request,
  ) =>
    | Readonly<Record<string, string>>
    | Promise<Readonly<Record<string, string>>>;
}) {
  return async (request: Request): Promise<Response> => {
    if (!(await options.authorize(request)))
      return Response.json({ error: "Forbidden" }, { status: 403 });
    const url = new URL(request.url);
    const result = await options.store.list({
      scope: await options.resolveScope(request),
      limit: Math.min(
        Math.max(Number(url.searchParams.get("limit") ?? 20), 1),
        100,
      ),
      ...(url.searchParams.get("cursor")
        ? { cursor: url.searchParams.get("cursor")! }
        : {}),
    });
    return Response.json(result);
  };
}
