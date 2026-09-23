"use client";

import { useEffect, useRef } from "react";

export function PagebldrRuntimeInteractions() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = marker.current?.parentElement;
    if (!root) return;

    const activateTab = (tab: HTMLElement) => {
      const widget = tab.closest<HTMLElement>('[data-pagebldr-widget="tabs"]');
      const id = tab.dataset.tabId;
      if (!widget || !id) return;
      for (const candidate of widget.querySelectorAll<HTMLElement>(
        '[role="tab"]',
      )) {
        const active = candidate === tab;
        candidate.setAttribute("aria-selected", String(active));
        candidate.tabIndex = active ? 0 : -1;
      }
      for (const panel of widget.querySelectorAll<HTMLElement>(
        '[role="tabpanel"]',
      ))
        panel.hidden = panel.dataset.tabPanel !== id;
    };

    const showSlide = (gallery: HTMLElement, offset: number) => {
      const slides = [
        ...gallery.querySelectorAll<HTMLElement>("[data-gallery-slide]"),
      ];
      if (slides.length === 0) return;
      const current = Math.max(
        0,
        slides.findIndex((slide) => !slide.hidden),
      );
      const next = (current + offset + slides.length) % slides.length;
      slides.forEach((slide, index) => {
        slide.hidden = index !== next;
      });
      gallery.dataset.galleryIndex = String(next);
    };

    const onClick = (event: Event) => {
      const target = isDomElement(event.target) ? event.target : null;
      const menuToggle = target?.closest<HTMLElement>(".pagebldr-menu-toggle");
      if (menuToggle) {
        const menu = menuToggle.closest<HTMLElement>(
          '[data-pagebldr-widget="menu"]',
        );
        const open = menu?.dataset.open !== "true";
        if (menu) menu.dataset.open = String(open);
        menuToggle.setAttribute("aria-expanded", String(open));
        return;
      }
      const tab = target?.closest<HTMLElement>('[role="tab"]');
      if (tab) {
        activateTab(tab);
        return;
      }
      const galleryAction = target?.closest<HTMLElement>(
        "[data-gallery-action]",
      );
      const gallery = galleryAction?.closest<HTMLElement>(
        '[data-pagebldr-widget="gallery"]',
      );
      if (galleryAction && gallery)
        showSlide(
          gallery,
          galleryAction.dataset.galleryAction === "next" ? 1 : -1,
        );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const tab = isDomElement(event.target)
        ? event.target.closest<HTMLElement>('[role="tab"]')
        : null;
      if (
        !tab ||
        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        return;
      const tabs = [
        ...(tab.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]') ??
          []),
      ];
      const current = tabs.indexOf(tab);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
      event.preventDefault();
      const nextTab = tabs[next];
      if (nextTab) {
        activateTab(nextTab);
        nextTab.focus();
      }
    };

    const updateCountdowns = () => {
      for (const countdown of root.querySelectorAll<HTMLTimeElement>(
        '[data-pagebldr-widget="countdown"]',
      )) {
        const remaining = new Date(countdown.dateTime).getTime() - Date.now();
        if (!Number.isFinite(remaining) || remaining <= 0) {
          countdown.textContent = countdown.dataset.expiredText ?? "Expired";
          continue;
        }
        const seconds = Math.floor(remaining / 1_000);
        const days = Math.floor(seconds / 86_400);
        const hours = Math.floor((seconds % 86_400) / 3_600);
        const minutes = Math.floor((seconds % 3_600) / 60);
        countdown.textContent = `${days}d ${hours}h ${minutes}m ${seconds % 60}s`;
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);
    updateCountdowns();
    const timer = window.setInterval(updateCountdowns, 1_000);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
      window.clearInterval(timer);
    };
  }, []);

  return <span ref={marker} hidden data-pagebldr-interactions />;
}

function isDomElement(value: EventTarget | null): value is Element {
  return !!value && "nodeType" in value && value.nodeType === 1;
}
