import type { StorageScope } from "./storage.js";
import type { createPagebldrServer } from "./server.js";

type PagebldrServer = ReturnType<typeof createPagebldrServer>;

export interface NextHandlerContext {
  readonly params:
    | { readonly all?: readonly string[] }
    | Promise<{ readonly all?: readonly string[] }>;
}

export interface NextHandlerOptions {
  readonly authorize: (request: Request) => boolean | Promise<boolean>;
  readonly resolveScope: (
    request: Request,
  ) => StorageScope | Promise<StorageScope>;
}

export function createPagebldrHandler(
  server: PagebldrServer,
  options: NextHandlerOptions,
) {
  return async (
    request: Request,
    context: NextHandlerContext,
  ): Promise<Response> => {
    if (!(await options.authorize(request)))
      return json({ error: "Forbidden" }, 403);
    const scope = await options.resolveScope(request);
    const { all = [] } = await context.params;
    try {
      if (
        request.method === "GET" &&
        all.length === 1 &&
        all[0] === "documents"
      ) {
        const url = new URL(request.url);
        return json(
          await server.documents.list({
            scope,
            ...(url.searchParams.get("cursor")
              ? { cursor: url.searchParams.get("cursor")! }
              : {}),
            ...(url.searchParams.get("limit")
              ? { limit: Number(url.searchParams.get("limit")) }
              : {}),
          }),
        );
      }
      const key = all[0] === "documents" ? all[1] : undefined;
      if (!key) return json({ error: "Not found" }, 404);
      if (request.method === "GET") {
        if (all.length === 2)
          return json(await server.documents.load({ scope, key }));
        if (all[2] === "revisions" && all.length === 3)
          return json(await server.revisions.list({ scope, key }));
        if (all[2] === "revisions" && all.length === 4)
          return json(
            await server.revisions.load({ scope, key, revisionId: all[3]! }),
          );
        if (all[2] === "publication" && all.length === 3)
          return json(await server.publications.get({ scope, key }));
        return json({ error: "Not found" }, 404);
      }
      if (request.method === "DELETE") {
        await server.documents.delete({ scope, key });
        return new Response(null, { status: 204 });
      }
      if (request.method !== "POST")
        return json({ error: "Method not allowed" }, 405);
      const body = (await request.json()) as Record<string, unknown>;
      if (
        body.confirmedWarnings !== undefined &&
        (!Array.isArray(body.confirmedWarnings) ||
          !body.confirmedWarnings.every((item) => typeof item === "string"))
      )
        return json(
          { error: "Confirmed warnings must be a string array." },
          400,
        );
      if (body.operation === "validate-publication")
        return json(
          await server.publications.validate({
            scope,
            key,
            document: body.document as never,
          }),
        );
      if (
        body.operationId !== undefined &&
        typeof body.operationId !== "string"
      )
        return json({ error: "Operation ID must be a string." }, 400);
      if (
        body.operation === "save" &&
        body.reason !== undefined &&
        body.reason !== "manual" &&
        body.reason !== "autosave"
      )
        return json({ error: "Unknown save reason." }, 400);
      if (body.operation === "create")
        return json(
          await server.documents.create({
            scope,
            key,
            document: body.document as never,
          }),
          201,
        );
      if (body.operation === "save")
        return json(
          await server.documents.save({
            scope,
            key,
            document: body.document as never,
            expectedVersion: body.expectedVersion as number,
            ...(typeof body.operationId === "string"
              ? { operationId: body.operationId }
              : {}),
            ...(body.reason === "autosave"
              ? { reason: "autosave" as const }
              : {}),
          }),
        );
      if (body.operation === "restore")
        return json(
          await server.revisions.restore({
            scope,
            key,
            revisionId: body.revisionId as string,
            expectedVersion: body.expectedVersion as number,
            ...(typeof body.operationId === "string"
              ? { operationId: body.operationId }
              : {}),
          }),
        );
      if (body.operation === "publish")
        return json(
          await server.publications.publish({
            scope,
            key,
            document: body.document as never,
            expectedVersion: body.expectedVersion as number,
            ...(Array.isArray(body.confirmedWarnings)
              ? { confirmedWarnings: body.confirmedWarnings }
              : {}),
            ...(typeof body.operationId === "string"
              ? { operationId: body.operationId }
              : {}),
          }),
        );
      if (body.operation === "unpublish") {
        await server.publications.unpublish({
          scope,
          key,
          ...(typeof body.operationId === "string"
            ? { operationId: body.operationId }
            : {}),
        });
        return new Response(null, { status: 204 });
      }
      return json({ error: "Unknown operation" }, 400);
    } catch (error) {
      const candidate = error as { code?: string; message?: string };
      const status =
        candidate.code === "NOT_FOUND"
          ? 404
          : candidate.code === "CONFLICT"
            ? 409
            : 400;
      return json(
        { error: candidate.message ?? "Request failed", code: candidate.code },
        status,
      );
    }
  };
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}
