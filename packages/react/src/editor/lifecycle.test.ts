import {
  createPagebldr,
  PagebldrError,
  standardElements,
  standardStyleCapabilities,
} from "@pagebldr/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEditorLifecycle as createLifecycle,
  type EditorLifecycleSaveRequest,
  type EditorLifecycleMutationRequest,
} from "./lifecycle.js";
import { encodeRecovery, type EditorRecoveryStorage } from "./recovery.js";

const builder = createPagebldr({
  namespace: "lifecycle-tests",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});
const loaded = {
  document: builder.documents.create({
    id: "draft",
    title: "Initial",
    slug: "draft",
  }),
  version: 1,
};
const edit = (title: string) => ({ ...loaded.document, title });
const createEditorLifecycle = (
  options: Parameters<typeof createLifecycle>[0],
) => createLifecycle({ onLoadDocument: vi.fn(), ...options });

afterEach(() => vi.useRealTimers());

function recoveryStorage(initial: string | null = null) {
  let payload = initial;
  return {
    read: () => payload,
    write: (next: string) => {
      payload = next;
    },
    remove: () => {
      payload = null;
    },
  } satisfies EditorRecoveryStorage;
}

describe("editor local recovery", () => {
  it("validates recovery before offering it and pauses writes until a choice", async () => {
    vi.useFakeTimers();
    const storage = recoveryStorage(encodeRecovery(edit("Recovered"), 1));
    const save = vi.fn(() => Promise.resolve({ version: 2 }));
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save,
      recovery: storage,
    });
    expect(lifecycle.getSnapshot().recovery?.document.title).toBe("Recovered");
    lifecycle.observe(edit("New local"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    await expect(lifecycle.save()).rejects.toThrow("Recover or discard");
    expect(lifecycle.recover().title).toBe("Recovered");
    expect(lifecycle.getSnapshot().status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(900);
    expect(save.mock.calls).toHaveLength(1);
    expect(storage.read()).toBeNull();
    lifecycle.dispose();
  });

  it("resumes mismatched recovery in Conflict without an automatic overwrite", async () => {
    vi.useFakeTimers();
    const storage = recoveryStorage(encodeRecovery(edit("Local draft"), 1));
    const save = vi.fn(() => Promise.resolve({ version: 4 }));
    const lifecycle = createEditorLifecycle({
      builder,
      loaded: { ...loaded, version: 3 },
      save,
      recovery: storage,
    });
    expect(lifecycle.recover().title).toBe("Local draft");
    expect(lifecycle.getSnapshot().status).toBe("conflict");
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(storage.read()).not.toBeNull();
    expect(JSON.parse(storage.read()!)).toMatchObject({ version: 1 });
    const reopened = createEditorLifecycle({
      builder,
      loaded: { ...loaded, version: 3 },
      save,
      recovery: storage,
    });
    reopened.recover();
    expect(reopened.getSnapshot().status).toBe("conflict");
    reopened.dispose();
    lifecycle.resolveConflict(3);
    await lifecycle.retry();
    expect(storage.read()).toBeNull();
    lifecycle.dispose();
  });

  it.each([
    "not JSON",
    JSON.stringify({
      schemaVersion: 2,
      document: loaded.document,
      version: 1,
      savedAt: new Date().toISOString(),
    }),
    encodeRecovery({ ...loaded.document, id: "other" }, 1),
    JSON.stringify({
      schemaVersion: 1,
      document: {},
      version: 1,
      savedAt: new Date().toISOString(),
    }),
    JSON.stringify({
      schemaVersion: 1,
      document: loaded.document,
      version: 0,
      savedAt: "invalid",
    }),
  ])("removes invalid recovery without offering arbitrary JSON", (payload) => {
    const storage = recoveryStorage(payload);
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save: () => Promise.resolve({ version: 2 }),
      recovery: storage,
    });
    expect(lifecycle.getSnapshot().recovery).toBeNull();
    expect(storage.read()).toBeNull();
    lifecycle.dispose();
  });

  it("does not remove newer work from another session after its own save", async () => {
    const storage = recoveryStorage();
    let finish: ((result: { version: number }) => void) | undefined;
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      recovery: storage,
      save: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    lifecycle.observe(edit("Submitted"));
    const pending = lifecycle.save();
    await Promise.resolve();
    const other = encodeRecovery(edit("Another session"), 1);
    storage.write(other);
    finish!({ version: 2 });
    await pending;
    expect(storage.read()).toBe(other);
    lifecycle.dispose();
  });

  it("keeps changes typed during a save and rebases their recovery version", async () => {
    let finish: ((result: { version: number }) => void) | undefined;
    const storage = recoveryStorage();
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      recovery: storage,
      save: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    lifecycle.observe(edit("Submitted"));
    const pending = lifecycle.save();
    await Promise.resolve();
    lifecycle.observe(edit("Still typing"));
    finish!({ version: 2 });
    await pending;
    expect(JSON.parse(storage.read()!)).toMatchObject({
      version: 2,
      document: { title: "Still typing" },
    });
    lifecycle.dispose();
  });

  it("isolates storage failures from saving and exposes recovery diagnostics", async () => {
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save: () => Promise.resolve({ version: 2 }),
      recovery: {
        read: () => {
          throw new Error("Storage blocked");
        },
        write: () => {
          throw new Error("Quota exceeded");
        },
        remove: vi.fn(),
      },
    });
    expect(lifecycle.getSnapshot().recoveryError).toBeInstanceOf(Error);
    lifecycle.observe(edit("Local"));
    expect(lifecycle.getSnapshot().recoveryError).toHaveProperty(
      "message",
      "Quota exceeded",
    );
    await lifecycle.save();
    expect(lifecycle.getSnapshot().status).toBe("saved");
    lifecycle.dispose();
  });

  it("discards an offered recovery and preserves current controlled work", () => {
    const storage = recoveryStorage(encodeRecovery(edit("Recovered"), 1));
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      recovery: storage,
      save: () => Promise.resolve({ version: 2 }),
    });
    lifecycle.discardRecovery();
    expect(lifecycle.getSnapshot().recovery).toBeNull();
    expect(lifecycle.exportLocalDocument()).toEqual(loaded.document);
    expect(storage.read()).toBeNull();
    lifecycle.dispose();
  });
});

describe("editor lifecycle draft saves", () => {
  it("retries an explicit operation with its original ID and snapshot while preserving newer edits", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn<
        (request: EditorLifecycleSaveRequest) => Promise<{ version: number }>
      >()
      .mockRejectedValueOnce(new Error("Response lost"))
      .mockResolvedValueOnce({ version: 2 })
      .mockResolvedValueOnce({ version: 3 });
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    lifecycle.observe(edit("Submitted"));
    await expect(lifecycle.save()).rejects.toThrow("Response lost");
    lifecycle.observe(edit("Newer local work"));
    await lifecycle.retry();
    const first = save.mock.calls[0]![0];
    const retry = save.mock.calls[1]![0];
    expect(first.operationId).toBeTruthy();
    expect(retry.operationId).toBe(first.operationId);
    expect(retry.expectedVersion).toBe(first.expectedVersion);
    expect(retry.document).toEqual(first.document);
    expect(lifecycle.getSnapshot().status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(900);
    expect(save.mock.calls[2]?.[0]).toMatchObject({
      reason: "autosave",
      expectedVersion: 2,
      document: { title: "Newer local work" },
    });
    expect(lifecycle.getSnapshot().status).toBe("saved");
    lifecycle.dispose();
  });

  it("does not launch a queued request after immediate disposal", async () => {
    const save = vi.fn(() => Promise.resolve({ version: 2 }));
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    const pending = lifecycle.save();
    lifecycle.dispose();
    await pending;
    expect(save).not.toHaveBeenCalled();
  });

  it("waits for a 900ms quiet period and ignores identical controlled updates", async () => {
    vi.useFakeTimers();
    const save = vi.fn<
      (request: EditorLifecycleSaveRequest) => Promise<{ version: number }>
    >(() => Promise.resolve({ version: 2 }));
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    lifecycle.observe(edit("One"));
    await vi.advanceTimersByTimeAsync(899);
    expect(save).not.toHaveBeenCalled();
    lifecycle.observe(edit("Two"));
    await vi.advanceTimersByTimeAsync(800);
    lifecycle.observe(edit("Two"));
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].reason).toBe("autosave");
    expect(save.mock.calls[0]?.[0].expectedVersion).toBe(1);
    expect(save.mock.calls[0]?.[0].document.title).toBe("Two");
    expect(lifecycle.getSnapshot()).toMatchObject({
      status: "saved",
      version: 2,
    });
    lifecycle.dispose();
  });

  it("serializes requests and keeps edits made during a save dirty", async () => {
    vi.useFakeTimers();
    let finish: ((result: { version: number }) => void) | undefined;
    const requests: EditorLifecycleSaveRequest[] = [];
    const save = vi.fn((request: EditorLifecycleSaveRequest) => {
      requests.push(request);
      return new Promise<{ version: number }>((resolve) => {
        finish = resolve;
      });
    });
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    lifecycle.observe(edit("Submitted"));
    await vi.advanceTimersByTimeAsync(900);
    lifecycle.observe(edit("Still typing"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(requests[0]?.document.title).toBe("Submitted");
    finish!({ version: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(lifecycle.getSnapshot().status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(900);
    expect(requests[1]).toMatchObject({
      expectedVersion: 2,
      document: { title: "Still typing" },
    });
    finish!({ version: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(lifecycle.getSnapshot()).toMatchObject({
      status: "saved",
      version: 3,
    });
    lifecycle.dispose();
  });

  it("queues an explicit save behind autosave rather than silently omitting the Revision", async () => {
    vi.useFakeTimers();
    let finish: ((result: { version: number }) => void) | undefined;
    const save = vi.fn((request: EditorLifecycleSaveRequest) =>
      request.reason === "autosave"
        ? new Promise<{ version: number }>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ version: 3 }),
    );
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    lifecycle.observe(edit("Changed"));
    await vi.advanceTimersByTimeAsync(900);
    const manual = lifecycle.save();
    expect(save).toHaveBeenCalledTimes(1);
    finish!({ version: 2 });
    await manual;
    expect(save.mock.calls[1]?.[0]).toMatchObject({
      reason: "manual",
      expectedVersion: 2,
    });
    lifecycle.dispose();
  });

  it("stops on conflicts and preserves the latest local work until deliberate retry", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new PagebldrError("CONFLICT", "Newer head"))
      .mockResolvedValueOnce({ version: 5 });
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    lifecycle.observe(edit("Local"));
    await vi.advanceTimersByTimeAsync(900);
    expect(lifecycle.getSnapshot().status).toBe("conflict");
    lifecycle.observe(edit("More local"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(lifecycle.exportLocalDocument().title).toBe("More local");
    await expect(lifecycle.save()).rejects.toMatchObject({ code: "CONFLICT" });
    lifecycle.resolveConflict(4);
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
    await lifecycle.retry();
    expect(save.mock.calls[1]?.[0]).toMatchObject({
      expectedVersion: 4,
      document: { title: "More local" },
    });
    lifecycle.dispose();
  });

  it("does not loop on ordinary failures and retries on demand", async () => {
    vi.useFakeTimers();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ version: 2 });
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    lifecycle.observe(edit("Local"));
    await vi.advanceTimersByTimeAsync(5900);
    expect(lifecycle.getSnapshot().status).toBe("failed");
    expect(save).toHaveBeenCalledTimes(1);
    await lifecycle.retry();
    expect(lifecycle.getSnapshot().status).toBe("saved");
    lifecycle.dispose();
  });

  it("retries an explicit save even when the draft was already clean", async () => {
    const save = vi
      .fn<
        (request: EditorLifecycleSaveRequest) => Promise<{ version: number }>
      >()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ version: 2 });
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    await expect(lifecycle.save()).rejects.toThrow("Offline");
    await lifecycle.retry();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0].reason).toBe("manual");
    expect(lifecycle.getSnapshot().status).toBe("saved");
    lifecycle.dispose();
  });

  it("cancels scheduled writes and aborts in-flight work on disposal", async () => {
    vi.useFakeTimers();
    const save = vi.fn(() => Promise.resolve({ version: 2 }));
    const lifecycle = createEditorLifecycle({ builder, loaded, save });
    lifecycle.observe(edit("Local"));
    lifecycle.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    expect(() => lifecycle.observe(edit("Late"))).toThrow("disposed");
    let signal: AbortSignal | undefined;
    let finish: ((result: { version: number }) => void) | undefined;
    const active = createEditorLifecycle({
      builder,
      loaded,
      save: (request) => {
        signal = request.signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    const pending = active.save();
    await Promise.resolve();
    active.dispose();
    expect(signal?.aborted).toBe(true);
    finish!({ version: 2 });
    await pending;
    expect(active.getSnapshot().version).toBe(1);
  });

  it("rejects another Document and invalid or non-advancing server versions", async () => {
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save: () => Promise.resolve({ version: 1 }),
    });
    expect(() =>
      lifecycle.observe({ ...loaded.document, id: "other" }),
    ).toThrow("changing Documents");
    await expect(lifecycle.save()).rejects.toThrow(
      "advance the server version",
    );
    expect(lifecycle.getSnapshot().status).toBe("failed");
    lifecycle.dispose();
    expect(() =>
      createEditorLifecycle({
        builder,
        loaded: { ...loaded, version: NaN },
        save: () => Promise.resolve({ version: 2 }),
      }),
    ).toThrow("positive safe integer");
  });
});

describe("editor lifecycle publication and restoration", () => {
  it("requires controlled snapshot acceptance for recovery and Revisions", () => {
    expect(() =>
      createLifecycle({
        builder,
        loaded,
        save: vi.fn(),
        recovery: recoveryStorage(),
      }),
    ).toThrow("require onLoadDocument");
  });

  it("preserves a Restore receipt when the Host rejects snapshot acceptance", async () => {
    const onLoadDocument = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Host rejected load");
      })
      .mockImplementation(() => undefined);
    const restore = vi
      .fn()
      .mockResolvedValue({ version: 2, document: edit("Restored") });
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save: vi.fn(),
      onLoadDocument,
      revisions: { restore, list: vi.fn(), preview: vi.fn() },
    });
    await expect(lifecycle.restore("old")).rejects.toThrow(
      "Host rejected load",
    );
    const first = restore.mock.calls[0]?.[0] as EditorLifecycleMutationRequest;
    expect(lifecycle.exportLocalDocument()).toEqual(loaded.document);
    await lifecycle.retry();
    expect(restore.mock.calls[1]?.[0]).toMatchObject({
      operationId: first.operationId,
      expectedVersion: 1,
    });
    expect(lifecycle.exportLocalDocument().title).toBe("Restored");
    lifecycle.dispose();
  });
  it("shows publication validation errors and requires explicit warning confirmation", async () => {
    const validate = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "alt", severity: "error", message: "Confirm alt" },
      ])
      .mockResolvedValue([
        { id: "target", severity: "warning", message: "Unpublished target" },
      ]);
    const publish = vi.fn(() =>
      Promise.resolve({ version: 2, revisionId: "live" }),
    );
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save: () => Promise.resolve({ version: 2 }),
      publication: { validate, publish, unpublish: vi.fn() },
    });
    await lifecycle.publish();
    expect(lifecycle.getSnapshot().publicationIssues).toMatchObject([
      { severity: "error" },
    ]);
    expect(publish).not.toHaveBeenCalled();
    await lifecycle.publish();
    expect(publish).not.toHaveBeenCalled();
    await lifecycle.publish(["target"]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(lifecycle.getSnapshot().publicationIssues).toEqual([]);
    lifecycle.dispose();
  });

  it("retries validation failures as publication rather than an unrelated save", async () => {
    const validate = vi
      .fn()
      .mockRejectedValueOnce(new Error("Validation offline"))
      .mockResolvedValue([]);
    const save = vi.fn();
    const publish = vi.fn(() =>
      Promise.resolve({ version: 2, revisionId: "live" }),
    );
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save,
      publication: { validate, publish, unpublish: vi.fn() },
    });
    await expect(lifecycle.publish()).rejects.toThrow("Validation offline");
    expect(lifecycle.getSnapshot()).toMatchObject({
      status: "failed",
      pending: null,
    });
    await lifecycle.retry();
    expect(publish).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
    lifecycle.dispose();
  });

  it("blocks all writes with a Host read-only reason", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const publish = vi.fn();
    const lifecycle = createEditorLifecycle({
      builder,
      loaded: { ...loaded, readOnlyReason: "Editing is unavailable" },
      save,
      publication: { publish, unpublish: vi.fn() },
    });
    lifecycle.observe(edit("External state"));
    await vi.advanceTimersByTimeAsync(5000);
    await expect(lifecycle.save()).rejects.toThrow("Editing is unavailable");
    await expect(lifecycle.publish()).rejects.toThrow("Editing is unavailable");
    expect(save).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    lifecycle.dispose();
  });
  it("publishes the exact submitted local snapshot and keeps later typing dirty", async () => {
    vi.useFakeTimers();
    let finish:
      ((result: { version: number; revisionId: string }) => void) | undefined;
    const publish = vi.fn(
      () =>
        new Promise<{ version: number; revisionId: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const save = vi.fn(() => Promise.resolve({ version: 3 }));
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save,
      publication: { publish, unpublish: vi.fn() },
    });
    lifecycle.observe(edit("Publish this"));
    const pending = lifecycle.publish();
    await Promise.resolve();
    lifecycle.observe(edit("Later typing"));
    finish!({ version: 2, revisionId: "live" });
    await pending;
    expect(lifecycle.getSnapshot()).toMatchObject({
      version: 2,
      publishedRevisionId: "live",
      status: "dirty",
      pending: null,
    });
    await vi.advanceTimersByTimeAsync(900);
    expect(save.mock.calls).toHaveLength(1);
    expect(lifecycle.exportLocalDocument().title).toBe("Later typing");
    lifecycle.dispose();
  });

  it("retries a lost publish response with its original operation and Document", async () => {
    vi.useFakeTimers();
    const publish = vi
      .fn<
        (
          request: EditorLifecycleMutationRequest & {
            document: typeof loaded.document;
          },
        ) => Promise<{ version: number; revisionId: string }>
      >()
      .mockRejectedValueOnce(new Error("Lost response"))
      .mockResolvedValueOnce({ version: 2, revisionId: "live" });
    const save = vi.fn(() => Promise.resolve({ version: 3 }));
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save,
      publication: { publish, unpublish: vi.fn() },
    });
    lifecycle.observe(edit("Submitted"));
    await expect(lifecycle.publish()).rejects.toThrow("Lost response");
    lifecycle.observe(edit("New local"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    await expect(lifecycle.save()).rejects.toThrow("uncertain lifecycle");
    await lifecycle.retry();
    const first = publish.mock.calls[0]![0];
    expect(publish.mock.calls[1]![0]).toMatchObject({
      operationId: first.operationId,
      expectedVersion: 1,
      document: { title: "Submitted" },
    });
    expect(lifecycle.getSnapshot().status).toBe("dirty");
    lifecycle.dispose();
  });

  it("unpublishes without changing the draft version, content or dirty state", async () => {
    const unpublish = vi.fn(() => Promise.resolve());
    const lifecycle = createEditorLifecycle({
      builder,
      loaded: { ...loaded, publishedRevisionId: "live" },
      save: () => Promise.resolve({ version: 2 }),
      publication: { publish: vi.fn(), unpublish },
    });
    lifecycle.observe(edit("Unsaved"));
    await lifecycle.unpublish();
    expect(lifecycle.getSnapshot()).toMatchObject({
      status: "dirty",
      version: 1,
      publishedRevisionId: null,
    });
    expect(lifecycle.exportLocalDocument().title).toBe("Unsaved");
    lifecycle.dispose();
  });

  it("requires saved local work before Restore and keeps Live unchanged", async () => {
    const restore = vi.fn(() =>
      Promise.resolve({ version: 3, document: edit("Restored snapshot") }),
    );
    const lifecycle = createEditorLifecycle({
      builder,
      loaded: { ...loaded, publishedRevisionId: "live" },
      save: () => Promise.resolve({ version: 2 }),
      revisions: { restore, list: vi.fn(), preview: vi.fn() },
    });
    lifecycle.observe(edit("Unsaved"));
    await expect(lifecycle.restore("old")).rejects.toThrow(
      "Save local changes",
    );
    expect(restore).not.toHaveBeenCalled();
    await lifecycle.save();
    expect(await lifecycle.restore("old")).toMatchObject({
      title: "Restored snapshot",
    });
    expect(lifecycle.getSnapshot()).toMatchObject({
      status: "saved",
      version: 3,
      publishedRevisionId: "live",
    });
    lifecycle.dispose();
  });

  it("previews a validated Revision without changing the local draft", async () => {
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save: () => Promise.resolve({ version: 2 }),
      revisions: {
        list: () => Promise.resolve([]),
        restore: vi.fn(),
        preview: () => Promise.resolve(edit("Preview only")),
      },
    });
    expect(
      (await lifecycle.previewRevision("old", new AbortController().signal))
        .title,
    ).toBe("Preview only");
    expect(lifecycle.exportLocalDocument()).toEqual(loaded.document);
    lifecycle.dispose();
  });

  it("blocks publication and restoration during a conflict", async () => {
    const publish = vi.fn();
    const restore = vi.fn();
    const lifecycle = createEditorLifecycle({
      builder,
      loaded,
      save: () => Promise.reject(new PagebldrError("CONFLICT", "Newer head")),
      publication: { publish, unpublish: vi.fn() },
      revisions: { restore, list: vi.fn(), preview: vi.fn() },
    });
    await expect(lifecycle.save()).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(lifecycle.publish()).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(lifecycle.restore("old")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(publish).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
    lifecycle.dispose();
  });
});
