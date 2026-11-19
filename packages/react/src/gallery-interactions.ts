export function attachGalleryInteractions(root: HTMLElement): () => void {
  const openers = new Map<HTMLDialogElement, HTMLElement>();
  const close = (event: Event) => {
    const dialog = event.target as HTMLDialogElement;
    openers.get(dialog)?.focus();
    openers.delete(dialog);
  };
  const show = (gallery: HTMLElement, index: number, opener?: HTMLElement) => {
    const dialog = gallery.querySelector<HTMLDialogElement>(
      "[data-gallery-dialog]",
    );
    const buttons = [
      ...gallery.querySelectorAll<HTMLElement>("[data-gallery-open]"),
    ];
    const button = buttons[(index + buttons.length) % buttons.length];
    const source = button?.querySelector<HTMLImageElement>("img");
    const image = dialog?.querySelector<HTMLImageElement>(
      "[data-gallery-image]",
    );
    if (!dialog || !button || !source || !image) return;
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    const caption = dialog.querySelector<HTMLElement>("[data-gallery-caption]");
    if (caption)
      caption.textContent =
        button.closest<HTMLElement>("figure")?.dataset.galleryItemCaption ?? "";
    dialog.dataset.index = String(buttons.indexOf(button));
    if (!dialog.open) {
      if (opener) openers.set(dialog, opener);
      dialog.addEventListener("close", close, { once: true });
      dialog.showModal();
    }
  };
  const click = (event: Event) => {
    const target = event.target as Element | null;
    const gallery = target?.closest<HTMLElement>(
      '[data-pagebldr-widget="gallery"]',
    );
    if (!gallery || gallery.dataset.renderMode === "edit") return;
    const opener = target?.closest<HTMLElement>("[data-gallery-open]");
    if (opener) {
      const buttons = [
        ...gallery.querySelectorAll<HTMLElement>("[data-gallery-open]"),
      ];
      show(gallery, buttons.indexOf(opener), opener);
    }
    const dialog = target?.closest<HTMLDialogElement>("[data-gallery-dialog]");
    if (target?.closest("[data-gallery-close]")) dialog?.close();
    const step = target?.closest<HTMLElement>("[data-lightbox-step]");
    if (dialog && step)
      show(
        gallery,
        Number(dialog.dataset.index) + Number(step.dataset.lightboxStep),
      );
  };
  const keydown = (event: KeyboardEvent) => {
    const dialog = (event.target as Element | null)?.closest<HTMLDialogElement>(
      "[data-gallery-dialog]",
    );
    const gallery = dialog?.closest<HTMLElement>(
      '[data-pagebldr-widget="gallery"]',
    );
    if (!dialog || !gallery || !["ArrowLeft", "ArrowRight"].includes(event.key))
      return;
    event.preventDefault();
    show(
      gallery,
      Number(dialog.dataset.index) + (event.key === "ArrowRight" ? 1 : -1),
    );
  };
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  return () => {
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
    for (const dialog of openers.keys()) {
      dialog.removeEventListener("close", close);
      dialog.close();
    }
  };
}
