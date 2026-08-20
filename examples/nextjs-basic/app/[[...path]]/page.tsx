import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { PagebldrRenderer } from "pagebldr/react/server";
import { pagebldrMetadata, pagebldrRouteResult } from "pagebldr/runtime/next";

import { builder } from "../../lib/builder";
import { runtime } from "../../lib/runtime";
import { AnalyticsBoundary } from "./analytics";

interface RouteProps {
  readonly params: Promise<{ readonly path?: readonly string[] }>;
}

async function resolveRoute(params: RouteProps["params"]) {
  const { path = [] } = await params;
  return runtime.resolve({ path: `/${path.join("/")}` });
}

export async function generateMetadata({
  params,
}: RouteProps): Promise<Metadata> {
  const resolution = await resolveRoute(params);
  return resolution.status === "found"
    ? pagebldrMetadata(resolution.page)
    : { title: "Page not found" };
}

export default async function PublishedRoute({ params }: RouteProps) {
  const result = pagebldrRouteResult(await resolveRoute(params));
  if (result.kind === "notFound") notFound();
  if (result.kind === "redirect") {
    if (result.permanent) permanentRedirect(result.location);
    redirect(result.location);
  }
  if (result.kind === "error") throw result.error;
  await runtime.recordVisit(result.page);
  return (
    <AnalyticsBoundary>
      <PagebldrRenderer
        builder={builder}
        document={result.page.document}
        resources={result.page.resources}
      />
    </AnalyticsBoundary>
  );
}
