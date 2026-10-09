"use client";

import { useState } from "react";
import type { PageDocument } from "@pagebldr/core";
import { Button } from "../components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "../components/ui/alert-dialog.js";
import type {
  createEditorLifecycle,
  EditorLifecycleSnapshot,
} from "./lifecycle.js";

export function LifecycleDialogs({
  lifecycle,
  snapshot,
  unpublishOpen,
  onUnpublishOpenChange,
}: {
  readonly lifecycle: ReturnType<typeof createEditorLifecycle>;
  readonly snapshot: EditorLifecycleSnapshot;
  readonly unpublishOpen: boolean;
  readonly onUnpublishOpenChange: (open: boolean) => void;
}) {
  const [conflictOpen, setConflictOpen] = useState(false);
  const [head, setHead] = useState<{
    document: PageDocument;
    version: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inspect = async () => {
    setConflictOpen(true);
    setLoading(true);
    setHead(null);
    setError(null);
    try {
      setHead(await lifecycle.inspectConflict(new AbortController().signal));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not load the newer draft.",
      );
    } finally {
      setLoading(false);
    }
  };
  const download = () => {
    const blob = new Blob(
      [JSON.stringify(lifecycle.exportLocalDocument(), null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pagebldr-recovery.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <Dialog
        open={snapshot.publicationIssues.length > 0}
        onOpenChange={(open) => {
          if (!open) lifecycle.dismissPublicationIssues();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review publication</DialogTitle>
            <DialogDescription>
              Fix blocking issues before publishing. Unpublished destinations
              require explicit confirmation.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {snapshot.publicationIssues.map((issue) => (
              <li key={issue.id}>
                {issue.severity === "error" ? "Required: " : "Warning: "}
                {issue.message}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => lifecycle.dismissPublicationIssues()}
            >
              Return to editor
            </Button>
            {snapshot.publicationIssues.every(
              (issue) => issue.severity === "warning",
            ) ? (
              <Button
                onClick={() => {
                  const ids = snapshot.publicationIssues.map(
                    (issue) => issue.id,
                  );
                  lifecycle.dismissPublicationIssues();
                  void lifecycle.publish(ids).catch(() => undefined);
                }}
              >
                Publish anyway
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {snapshot.readOnlyReason ? (
        <p role="status" className="px-4">
          {snapshot.readOnlyReason}
        </p>
      ) : null}
      {snapshot.recoveryError ? (
        <p role="alert" className="px-4">
          Local recovery storage is unavailable. Download your draft before
          leaving.
        </p>
      ) : null}
      {snapshot.status === "failed" ||
      snapshot.status === "conflict" ||
      snapshot.recoveryError ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          <p role="alert">
            {snapshot.status === "conflict"
              ? "Another session changed the draft. Your local work is preserved."
              : snapshot.status === "failed"
                ? "The operation failed. Your local work is preserved."
                : "Keep a copy of your work."}
          </p>
          {snapshot.status === "conflict" ? (
            <Button variant="outline" size="sm" onClick={() => void inspect()}>
              Resolve conflict
            </Button>
          ) : snapshot.status === "failed" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!!snapshot.pending || !!snapshot.readOnlyReason}
              onClick={() => void lifecycle.retry().catch(() => undefined)}
            >
              Retry
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={download}>
            Download local JSON
          </Button>
        </div>
      ) : null}
      <AlertDialog open={!!snapshot.recovery}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recover unsaved work?</AlertDialogTitle>
            <AlertDialogDescription>
              A local draft from{" "}
              {snapshot.recovery
                ? new Date(snapshot.recovery.savedAt).toLocaleString()
                : "a previous session"}{" "}
              is available. Recover it or discard it before editing. A different
              server version will resume in Conflict.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => lifecycle.discardRecovery()}>
              Discard local recovery
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!snapshot.readOnlyReason}
              onClick={() => lifecycle.recover()}
            >
              Recover local draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={conflictOpen && snapshot.status === "conflict"}
        onOpenChange={setConflictOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve draft conflict</DialogTitle>
            <DialogDescription>
              No work has been overwritten. Review the newer head before
              deliberately keeping your local draft.
            </DialogDescription>
          </DialogHeader>
          {loading ? <p role="status">Loading the newer draft…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {head ? (
            <p>
              Server version {head.version}: {head.document.title}. Keeping
              local work will save your exact local Document over this newer
              draft.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={download}>
              Download local JSON
            </Button>
            <Button
              disabled={!head || loading || !!snapshot.readOnlyReason}
              onClick={() => {
                if (!head) return;
                lifecycle.resolveConflict(head.version);
                setConflictOpen(false);
                void lifecycle.retry().catch(() => undefined);
              }}
            >
              Keep local draft and retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={unpublishOpen} onOpenChange={onUnpublishOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish this page?</AlertDialogTitle>
            <AlertDialogDescription>
              The live page will be removed. Your editable draft and saved
              Revisions will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void lifecycle.unpublish().catch(() => undefined)}
            >
              Unpublish page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
