"use client";

import { useEffect, useRef, useState } from "react";
import {
  EyeIcon,
  HistoryIcon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
} from "lucide-react";
import {
  resolveDocumentResources,
  type PageDocument,
  type PreparedResources,
} from "@pagebldr/core";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card.js";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "../components/ui/empty.js";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../components/ui/sheet.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../components/ui/alert-dialog.js";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs.js";
import { PagebldrRenderer } from "../renderer.js";
import { usePagebldrEditor } from "./context.js";
import type {
  createEditorLifecycle,
  EditorLifecycleSnapshot,
  EditorRevision,
} from "./lifecycle.js";

export function HistorySheet({
  restoreFocus,
  open,
  onOpenChange,
  lifecycle,
  snapshot,
}: {
  readonly restoreFocus: () => void;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly lifecycle: ReturnType<typeof createEditorLifecycle> | undefined;
  readonly snapshot: EditorLifecycleSnapshot | null;
}) {
  const editor = usePagebldrEditor();
  const [revisions, setRevisions] = useState<readonly EditorRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    document: PageDocument;
    resources: PreparedResources;
  } | null>(null);
  const [restore, setRestore] = useState<EditorRevision | null>(null);
  const [refresh, setRefresh] = useState(0);
  const previewRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) {
      previewRequest.current?.abort();
      setPreview(null);
      setRestore(null);
    }
    return () => previewRequest.current?.abort();
  }, [open, lifecycle]);
  useEffect(() => {
    if (!open || !lifecycle) return;
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    void lifecycle
      .listRevisions(abort.signal)
      .then((items) => {
        if (!abort.signal.aborted) setRevisions(items);
      })
      .catch((failure: unknown) => {
        if (!abort.signal.aborted) setError(message(failure));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [open, lifecycle, refresh, snapshot?.version]);
  const previewRevision = async (id: string) => {
    if (!lifecycle) return;
    previewRequest.current?.abort();
    const abort = new AbortController();
    previewRequest.current = abort;
    setError(null);
    try {
      const signal = abort.signal;
      const document = await lifecycle.previewRevision(id, signal);
      const resources = await resolveDocumentResources(
        editor.builder,
        document,
        { signal },
      );
      if (!signal.aborted) setPreview({ document, resources });
    } catch (failure) {
      if (!abort.signal.aborted) setError(message(failure));
    }
  };
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          className="w-full sm:max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
        >
          <SheetHeader>
            <SheetTitle>History</SheetTitle>
            <SheetDescription>
              Actions are local to this session. Revisions are saved snapshots.
            </SheetDescription>
          </SheetHeader>
          <Tabs
            defaultValue="actions"
            className="flex min-h-0 flex-1 flex-col px-4 pb-4"
          >
            <TabsList>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="revisions">Revisions</TabsTrigger>
            </TabsList>
            <TabsContent value="actions" className="overflow-auto">
              <ol className="flex flex-col gap-2">
                {editor.actions.map((action) => (
                  <li key={action.position}>
                    <Button
                      className="w-full justify-start"
                      variant={
                        action.position === editor.actionPosition
                          ? "secondary"
                          : "ghost"
                      }
                      disabled={editor.mode !== "edit"}
                      aria-current={
                        action.position === editor.actionPosition
                          ? "step"
                          : undefined
                      }
                      onClick={() => editor.jumpToAction(action.position)}
                    >
                      <HistoryIcon data-icon="inline-start" />
                      {action.label}
                    </Button>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent
              value="revisions"
              className="flex min-h-0 flex-col gap-3 overflow-auto"
            >
              {error ? <p role="alert">{error}</p> : null}
              {loading ? <p role="status">Loading Revisions…</p> : null}
              {!loading && revisions.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No Revisions yet</EmptyTitle>
                    <EmptyDescription>
                      Save draft or Publish to create a durable snapshot.
                      Autosave does not create Revisions.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {snapshot && snapshot.status !== "saved" ? (
                <p>Save local changes before restoring a Revision.</p>
              ) : null}
              {revisions.map((revision) => (
                <Card
                  key={revision.id}
                  role="group"
                  aria-label={`${revision.kind} Revision ${revision.version}`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {revision.kind === "save" ? (
                        <SaveIcon aria-hidden="true" className="size-4" />
                      ) : revision.kind === "publish" ? (
                        <SendIcon aria-hidden="true" className="size-4" />
                      ) : (
                        <RotateCcwIcon aria-hidden="true" className="size-4" />
                      )}
                      {revision.kind === "save"
                        ? "Saved"
                        : revision.kind === "publish"
                          ? "Published"
                          : "Restored"}{" "}
                      · Revision {revision.version}
                    </CardTitle>
                    <CardDescription>
                      <time dateTime={revision.createdAt}>
                        {new Date(revision.createdAt).toLocaleString()}
                      </time>{" "}
                      · {revision.actorId ?? "Unknown author"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    {revision.title}
                    {snapshot?.publishedRevisionId === revision.id ? (
                      <Badge>Live</Badge>
                    ) : null}
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void previewRevision(revision.id)}
                    >
                      <EyeIcon data-icon="inline-start" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        editor.mode !== "edit" ||
                        snapshot?.status !== "saved" ||
                        !!snapshot.pending
                      }
                      onClick={() => setRestore(revision)}
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      Restore
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
      <Dialog
        open={preview !== null}
        onOpenChange={(next) => {
          if (!next) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Revision preview</DialogTitle>
            <DialogDescription>
              Read-only snapshot: {preview?.document.title}. Your local draft is
              unchanged.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div
              onClickCapture={(event) => {
                if ((event.target as HTMLElement).closest("a"))
                  event.preventDefault();
              }}
              onSubmitCapture={(event) => event.preventDefault()}
            >
              <PagebldrRenderer
                builder={editor.builder}
                document={preview.document}
                resources={preview.resources}
                mode="preview"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={restore !== null}
        onOpenChange={(next) => {
          if (!next) setRestore(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this Revision?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a new draft and a Restore Revision. The live page
              will not change until you Publish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!lifecycle || !restore) return;
                void lifecycle
                  .restore(restore.id)
                  .then(() => setRefresh((value) => value + 1))
                  .catch((failure: unknown) => setError(message(failure)));
              }}
            >
              Restore draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not complete the History operation.";
}
