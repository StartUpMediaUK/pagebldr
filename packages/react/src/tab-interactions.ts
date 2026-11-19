/** Enhance definition-owned markup without unmounting nested form controls. */
export function attachTabInteractions(
  root: HTMLElement,
  onPanelActivate?: (id: string) => void,
): () => void {
  const selector = '[data-pagebldr-widget="tabs"]';
  const owned = (widget: HTMLElement, query: string) =>
    [...widget.querySelectorAll<HTMLElement>(query)].filter(
      (node) => node.closest(selector) === widget,
    );
  const activate = (widget: HTMLElement, tab: HTMLElement) => {
    for (const candidate of owned(widget, '[role="tab"]')) {
      const active = candidate === tab;
      candidate.setAttribute("aria-selected", String(active));
      candidate.tabIndex = active ? 0 : -1;
    }
    for (const panel of owned(widget, '[role="tabpanel"]'))
      panel.hidden = panel.dataset.tabPanel !== tab.dataset.tabId;
  };
  const activateFromInput = (widget: HTMLElement, tab: HTMLElement) => {
    activate(widget, tab);
    const panelId = tab.dataset.tabElementId;
    if (panelId && widget.dataset.renderMode === "edit")
      onPanelActivate?.(panelId);
  };
  const enhance = () => {
    for (const widget of root.querySelectorAll<HTMLElement>(selector)) {
      const tabs = owned(widget, '[role="tab"]');
      const active = widget.dataset.tabsActive ?? "";
      const selectionChanged = widget.dataset.tabsApplied !== active;
      if (widget.dataset.tabsEnhanced && !selectionChanged) {
        const current =
          tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ??
          tabs[0];
        if (current) activate(widget, current);
        continue;
      }
      const tab = tabs.find((tab) => tab.dataset.tabId === active) ?? tabs[0];
      if (tab) activate(widget, tab);
      widget.dataset.tabsEnhanced = "true";
      widget.dataset.tabsApplied = active;
      for (const label of owned(widget, "[data-tab-fallback-label]"))
        label.hidden = true;
    }
  };
  const click = (event: Event) => {
    const tab = (event.target as Element | null)?.closest?.<HTMLElement>(
      '[role="tab"]',
    );
    const widget = tab?.closest<HTMLElement>(selector);
    if (tab && widget) {
      event.preventDefault();
      activateFromInput(widget, tab);
    }
  };
  const keydown = (event: KeyboardEvent) => {
    const tab = (event.target as Element | null)?.closest?.<HTMLElement>(
      '[role="tab"]',
    );
    const widget = tab?.closest<HTMLElement>(selector);
    if (!tab || !widget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateFromInput(widget, tab);
      return;
    }
    const vertical = widget.dataset.orientation === "vertical";
    const previous = vertical ? "ArrowUp" : "ArrowLeft";
    const next = vertical ? "ArrowDown" : "ArrowRight";
    if (![previous, next, "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = owned(widget, '[role="tab"]');
    const index = tabs.indexOf(tab);
    const target =
      tabs[
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === next ? 1 : -1) + tabs.length) %
              tabs.length
      ];
    if (!target) return;
    tabs.forEach((candidate) => {
      candidate.tabIndex = candidate === target ? 0 : -1;
    });
    target.focus();
    target.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (widget.dataset.activation !== "manual")
      activateFromInput(widget, target);
  };
  enhance();
  // The canvas receives controlled Documents and selection asynchronously.
  const Observer = root.ownerDocument.defaultView!.MutationObserver;
  const observer = new Observer(enhance);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-tabs-active"],
  });
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  return () => {
    observer.disconnect();
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
  };
}
