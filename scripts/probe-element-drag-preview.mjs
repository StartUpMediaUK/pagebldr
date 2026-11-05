// Evaluate this expression with T3 preview_evaluate on the Reference Host's
// #/editor/elements route. It dispatches native DOM DragEvents and reproduces
// protected-mode payload access; it does not simulate a physical mouse gesture.
/* global document, DataTransfer, DragEvent, setTimeout */
(async () => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, 80));
  const results = [];
  const record = (name, pass, detail) => results.push({ name, pass, detail });
  const frame = document.querySelector("iframe");
  const canvas = frame.contentDocument;
  const ids = () =>
    [...canvas.querySelectorAll("[data-pagebldr-element]")].map((node) =>
      node.getAttribute("data-pagebldr-element"),
    );
  const showLibrary = async () => {
    document.querySelector('[aria-label="Back to Add to page"]')?.click();
    await pause();
  };
  const root = () => canvas.querySelector("[data-pagebldr-element]");
  const drag = (source) => {
    const transfer = new DataTransfer();
    let protectedMode = false;
    const read = transfer.getData.bind(transfer);
    Object.defineProperty(transfer, "getData", {
      value: (format) => (protectedMode ? "" : read(format)),
    });
    source.dispatchEvent(
      new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
    return {
      over(target = root(), dataTransfer = transfer) {
        protectedMode = true;
        const event = new frame.contentWindow.DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: 80,
          clientY: 80,
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      },
      drop() {
        protectedMode = false;
        root().dispatchEvent(
          new frame.contentWindow.DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            clientX: 80,
            clientY: 80,
          }),
        );
      },
      end() {
        source.dispatchEvent(
          new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }),
        );
      },
    };
  };
  await showLibrary();
  const heading = () =>
    [
      ...document.querySelectorAll("[data-pagebldr-library] button[draggable]"),
    ].find((node) => node.textContent.trim() === "Heading");
  const before = ids();
  const insertion = drag(heading());
  const accepted = insertion.over();
  await pause();
  record(
    "protected Element dragover enables a placement indicator",
    accepted && !!canvas.querySelector("[data-pagebldr-drop-target]"),
    { accepted },
  );
  if (accepted) {
    insertion.drop();
    await pause();
    record(
      "drop clears the active drag before its library card unmounts",
      !insertion.over(),
    );
  }
  insertion.end();
  await pause();
  record(
    "drop inserts exactly one Element",
    ids().length === before.length + 1,
    { before: before.length, after: ids().length },
  );
  if (accepted) {
    document.querySelector('[aria-label="Undo"]')?.click();
    await pause();
    record(
      "Undo restores the original canvas tree",
      JSON.stringify(ids()) === JSON.stringify(before),
    );
  }
  await showLibrary();
  const cancelled = drag(heading());
  cancelled.end();
  record("cancelled drag cannot enable another drop", !cancelled.over());
  const unrelated = drag(heading());
  const text = new DataTransfer();
  text.setData("text/plain", "unrelated text");
  record("unrelated drag is rejected", !unrelated.over(root(), text));
  unrelated.end();
  const moving = document.querySelector('[role="tree"] [draggable="true"]');
  if (moving) {
    const previous = ids();
    const movement = drag(moving);
    const moveAccepted = movement.over();
    if (moveAccepted) movement.drop();
    movement.end();
    await pause();
    record(
      "protected Structure drag moves an existing Element",
      moveAccepted &&
        ids().length === previous.length &&
        JSON.stringify(ids()) !== JSON.stringify(previous),
      { accepted: moveAccepted },
    );
    if (moveAccepted) {
      document.querySelector('[aria-label="Undo"]')?.click();
      await pause();
      record(
        "Undo restores Structure movement",
        JSON.stringify(ids()) === JSON.stringify(previous),
      );
    }
  } else record("Structure drag source exists", false);
  await showLibrary();
  return { pass: results.every((result) => result.pass), results };
})();
