import {
  createPagebldr,
  standardElements,
  standardStyleCapabilities,
  type PageDocument,
} from "pagebldr";
import { memoryAdapter } from "pagebldr/adapters/memory";
import { createPagebldrServer } from "pagebldr/server";

const builder = createPagebldr({
  namespace: "persistence-example",
  elements: standardElements,
  styleCapabilities: standardStyleCapabilities,
});

export function createCallbackPersistence(notify: (message: string) => void) {
  return {
    load: (): PageDocument | null => {
      const value = globalThis.localStorage?.getItem("pagebldr-document");
      return value ? builder.documents.deserialize(value) : null;
    },
    save: (document: PageDocument) => {
      globalThis.localStorage?.setItem(
        "pagebldr-document",
        builder.documents.serialize(document),
      );
      notify("Document saved locally.");
    },
  };
}

export function createServerPersistence(input: {
  readonly canEdit: boolean;
  readonly canPublish: boolean;
  readonly notify: (message: string) => void;
}) {
  const storage = memoryAdapter();
  const server = createPagebldrServer({
    builder,
    storage,
    collection: { mode: "multiple" },
    revisions: { enabled: true, retention: 20 },
  });
  return {
    integration: storage.integration,
    provider: storage.provider,
    create: async (key: string, document: PageDocument) => {
      if (!input.canEdit) throw new Error("Host permission denied.");
      const record = await server.documents.create({ key, document });
      input.notify(`Created version ${record.version}.`);
      return record;
    },
    save: async (
      key: string,
      document: PageDocument,
      expectedVersion: number,
    ) => {
      if (!input.canEdit) throw new Error("Host permission denied.");
      const record = await server.documents.save({
        key,
        document,
        expectedVersion,
      });
      input.notify(`Saved version ${record.version}.`);
      return record;
    },
    publish: async (key: string) => {
      if (!input.canPublish) throw new Error("Host permission denied.");
      const publication = await server.publications.publish({ key });
      input.notify(`Published Revision ${publication.revisionId}.`);
      return publication;
    },
  };
}

// Production Hosts select a concrete pair such as Prisma/PostgreSQL or
// Prisma/MongoDB and provide its generated client. The adapter's `integration`
// and `provider` fields remain observable instead of treating all Prisma
// Providers as equivalent.
