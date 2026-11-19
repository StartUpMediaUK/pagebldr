/** Reveal a selected answer after controlled editor updates, preserving visitor state. */
export function attachAccordionInteractions(root: HTMLElement): () => void {
  const selector = '[data-pagebldr-widget="accordion"]';
  const reveal = () => {
    for (const widget of root.querySelectorAll<HTMLElement>(selector)) {
      const selected = widget.dataset.accordionSelected ?? "";
      const selection = widget.closest<HTMLElement>("[data-pagebldr-renderer]")
        ?.dataset.pagebldrSelection;
      const applied = JSON.stringify([selected, selection ?? ""]);
      if (widget.dataset.accordionApplied === applied) continue;
      widget.dataset.accordionApplied = applied;
      if (!selected) continue;
      const panel = [
        ...widget.querySelectorAll<HTMLDetailsElement>("details"),
      ].find(
        (node) =>
          node.closest(selector) === widget &&
          node.dataset.accordionPanel === selected,
      );
      if (panel) panel.open = true;
    }
  };
  reveal();
  const Observer = root.ownerDocument.defaultView!.MutationObserver;
  const observer = new Observer(reveal);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-accordion-selected", "data-pagebldr-selection"],
  });
  return () => observer.disconnect();
}
