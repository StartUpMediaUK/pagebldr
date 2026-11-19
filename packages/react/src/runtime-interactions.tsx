"use client";

import { useEffect, useRef } from "react";
import { attachTabInteractions } from "./tab-interactions.js";
import { attachAccordionInteractions } from "./accordion-interactions.js";
import { attachGalleryInteractions } from "./gallery-interactions.js";
import { attachMenuInteractions } from "./menu-interactions.js";

export function PagebldrRuntimeInteractions() {
  return <RuntimeInteractions />;
}

export function RuntimeInteractions({
  onTabPanelActivate,
}: {
  readonly onTabPanelActivate?: (id: string) => void;
}) {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = marker.current?.parentElement;
    if (!root) return;
    const cleanupMenus = attachMenuInteractions(root);

    const cleanupTabs = attachTabInteractions(root, onTabPanelActivate);
    const cleanupAccordions = attachAccordionInteractions(root);
    const cleanupGallery = attachGalleryInteractions(root);

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
    updateCountdowns();
    const timer = window.setInterval(updateCountdowns, 1_000);
    return () => {
      cleanupMenus();
      cleanupTabs();
      cleanupAccordions();
      cleanupGallery();
      root.removeEventListener("click", onClick);
      window.clearInterval(timer);
    };
  }, [onTabPanelActivate]);

  return <span ref={marker} hidden data-pagebldr-interactions />;
}

function isDomElement(value: EventTarget | null): value is Element {
  return !!value && "nodeType" in value && value.nodeType === 1;
}
