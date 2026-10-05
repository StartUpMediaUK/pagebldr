// Client behavior over definition-owned markup. No editor store or Host policy.
const scrollLocks = new WeakMap<
  HTMLElement,
  { count: number; overflow: string }
>();

function lockScroll(body: HTMLElement) {
  const lock = scrollLocks.get(body) ?? {
    count: 0,
    overflow: body.style.overflow,
  };
  lock.count++;
  scrollLocks.set(body, lock);
  body.style.overflow = "hidden";
  return () => {
    if (--lock.count === 0) {
      body.style.overflow = lock.overflow;
      scrollLocks.delete(body);
    }
  };
}

function menuBoundary(menu: HTMLElement) {
  return (
    menu.parentElement?.closest<HTMLElement>(
      "header, section, footer, article",
    ) ??
    menu.parentElement?.closest<HTMLElement>("[data-pagebldr-element]") ??
    menu
  );
}

function nearestLogo(menu: HTMLElement, root: HTMLElement) {
  let ancestor = menu.parentElement;
  while (ancestor && ancestor !== root) {
    const logo = ancestor.querySelector<HTMLElement>(".pagebldr-logo");
    if (logo && !menu.contains(logo)) return logo;
    ancestor = ancestor.parentElement;
  }
  const candidates = [
    ...root.querySelectorAll<HTMLElement>(
      '.pagebldr-logo, [data-pagebldr-widget="menu"]',
    ),
  ];
  const index = candidates.indexOf(menu);
  return candidates
    .map((element, position) => ({
      element,
      distance: Math.abs(position - index),
    }))
    .filter(
      ({ element }) =>
        element.matches(".pagebldr-logo") && !menu.contains(element),
    )
    .sort((left, right) => left.distance - right.distance)[0]?.element;
}

function bindMenu(menu: HTMLElement, root: HTMLElement) {
  const document = menu.ownerDocument;
  const view = document.defaultView!;
  const toggle = menu.querySelector<HTMLButtonElement>(".pagebldr-menu-toggle");
  const panel = menu.querySelector<HTMLElement>(".pagebldr-menu-panel");
  if (!toggle || !panel) return () => {};
  const label = toggle.getAttribute("aria-label") ?? "Open navigation";
  let openCleanup: (() => void) | undefined;
  const close = (restoreFocus = true) => {
    const wasOpen = menu.dataset.open === "true";
    menu.dataset.open = "false";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", label);
    panel.removeAttribute("role");
    panel.removeAttribute("aria-modal");
    panel.removeAttribute("aria-label");
    openCleanup?.();
    openCleanup = undefined;
    if (wasOpen && restoreFocus) toggle.focus();
  };
  const open = () => {
    if (view.getComputedStyle(toggle).display === "none") return;
    menu.dataset.open = "true";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation");
    const fullscreen = menu.dataset.presentation === "fullscreen";
    if (fullscreen) {
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute(
        "aria-label",
        menu.getAttribute("aria-label") ?? "Navigation",
      );
    }
    const updateBoundary = () => {
      if (view.getComputedStyle(toggle).display === "none") {
        close(false);
        return;
      }
      menu.style.setProperty(
        "--pagebldr-menu-boundary",
        `${Math.max(0, menuBoundary(menu).getBoundingClientRect().bottom)}px`,
      );
    };
    updateBoundary();
    const boundaryObserver = new view.ResizeObserver(updateBoundary);
    boundaryObserver.observe(menuBoundary(menu));
    const outside = (event: PointerEvent) => {
      if (event.target && !menu.contains(event.target as Node)) close();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab" && fullscreen) {
        const focusable = [
          toggle,
          ...panel.querySelectorAll<HTMLElement>(
            'a[href], button, [tabindex="0"]',
          ),
        ];
        const last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === toggle) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          toggle.focus();
        } else if (!focusable.includes(document.activeElement as HTMLElement)) {
          event.preventDefault();
          (event.shiftKey ? last : toggle).focus();
        }
      }
    };
    const slot = menu.querySelector<HTMLElement>(
      ".pagebldr-menu-fullscreen-logo",
    );
    const logo = fullscreen ? nearestLogo(menu, root) : undefined;
    let logoObserver: MutationObserver | undefined;
    let refreshLogo: (() => void) | undefined;
    if (slot && logo) {
      const sync = () => {
        const clone = logo.cloneNode(true) as HTMLElement;
        const originals = [logo, ...logo.querySelectorAll<HTMLElement>("*")];
        const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
        for (const [index, element] of copies.entries()) {
          // Local styles target Element identity, which the copy deliberately
          // cannot retain. Preserve its painted text without freezing its layout
          // to the original header's computed dimensions.
          const computed = view.getComputedStyle(originals[index]!);
          for (const property of [
            "color",
            "font-family",
            "font-size",
            "font-weight",
            "font-style",
            "line-height",
            "letter-spacing",
            "text-transform",
            "text-decoration",
          ]) {
            element.style.setProperty(
              property,
              computed.getPropertyValue(property),
            );
          }
          element.removeAttribute("id");
          element.removeAttribute("data-pagebldr-element");
          element.removeAttribute("data-pagebldr-force-state");
        }
        slot.replaceChildren(clone);
      };
      sync();
      refreshLogo = sync;
      view.addEventListener("resize", sync);
      logoObserver = new view.MutationObserver(sync);
      logoObserver.observe(logo, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      for (const styles of root.querySelectorAll(
        "style[data-pagebldr-authored-styles]",
      )) {
        logoObserver.observe(styles, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    }
    const unlock = fullscreen ? lockScroll(document.body) : () => {};
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    view.addEventListener("resize", updateBoundary);
    view.addEventListener("scroll", updateBoundary, true);
    const frame = view.requestAnimationFrame(() =>
      panel.querySelector<HTMLElement>("a[href]")?.focus(),
    );
    openCleanup = () => {
      view.cancelAnimationFrame(frame);
      boundaryObserver.disconnect();
      logoObserver?.disconnect();
      if (refreshLogo) view.removeEventListener("resize", refreshLogo);
      slot?.replaceChildren();
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keydown);
      view.removeEventListener("resize", updateBoundary);
      view.removeEventListener("scroll", updateBoundary, true);
      unlock();
    };
  };
  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (target?.closest(".pagebldr-menu-toggle") === toggle) {
      if (menu.dataset.open === "true") close();
      else open();
      return;
    }
    const link = target?.closest<HTMLAnchorElement>("a");
    if (!link || !panel.contains(link)) return;
    close(false);
    if (menu.dataset.renderMode === "edit") {
      event.preventDefault();
      return;
    }
    const href = link.getAttribute("href");
    if (
      !href?.startsWith("#") ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      link.target === "_blank"
    )
      return;
    let id: string;
    try {
      id = decodeURIComponent(href.slice(1));
    } catch {
      return;
    }
    const destination = document.getElementById(id);
    if (!destination) return;
    event.preventDefault();
    // Most authored anchor targets aren't normally focusable.
    const tabindex = destination.getAttribute("tabindex");
    if (tabindex === null) destination.setAttribute("tabindex", "-1");
    destination.focus({ preventScroll: true });
    if (tabindex === null)
      destination.addEventListener(
        "blur",
        () => destination.removeAttribute("tabindex"),
        { once: true },
      );
    destination.scrollIntoView({
      behavior: view.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    view.history.pushState(null, "", href);
  };
  menu.addEventListener("click", click);
  const configurationObserver = new view.MutationObserver(() => close(false));
  configurationObserver.observe(menu, {
    attributes: true,
    attributeFilter: ["data-collapse-at", "data-presentation"],
  });
  return () => {
    close(false);
    configurationObserver.disconnect();
    menu.removeEventListener("click", click);
  };
}

export function attachMenuInteractions(root: HTMLElement) {
  const controllers = new Map<HTMLElement, () => void>();
  const sync = () => {
    const menus = new Set(
      root.querySelectorAll<HTMLElement>('[data-pagebldr-widget="menu"]'),
    );
    for (const [menu, cleanup] of controllers) {
      if (!menus.has(menu)) {
        cleanup();
        controllers.delete(menu);
      }
    }
    for (const menu of menus) {
      if (!controllers.has(menu)) controllers.set(menu, bindMenu(menu, root));
    }
  };
  sync();
  const observer = new root.ownerDocument.defaultView!.MutationObserver(sync);
  observer.observe(root, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    for (const cleanup of controllers.values()) cleanup();
    controllers.clear();
  };
}
