"use client";

import type { MouseEvent, ReactNode } from "react";

export function AnalyticsBoundary({
  children,
}: {
  readonly children: ReactNode;
}) {
  const track = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const action = event.target.closest<HTMLElement>("[data-pagebldr-action]");
    const element = action?.closest<HTMLElement>("[data-pagebldr-element]");
    if (!action || !element) return;
    void fetch("/api/pagebldr-analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: action.dataset.pagebldrAction ?? "activate",
        documentId: "welcome",
        elementId: element.dataset.pagebldrElement,
        path: window.location.pathname,
      }),
    });
  };
  return <div onClick={track}>{children}</div>;
}
