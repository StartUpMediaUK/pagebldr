import type { Pagebldr, PageDocument } from "@pagebldr/core";

export interface StorageCapabilities {
  readonly atomicSave: boolean;
  readonly optimisticConcurrency: boolean;
  readonly transactionalAudit: boolean;
}

export interface StorageAdapter<
  Integration extends string = string,
  Provider extends string = string,
> {
  readonly integration: Integration;
  readonly provider: Provider;
  readonly capabilities: StorageCapabilities;
}

export type CollectionPolicy =
  | { readonly mode: "single"; readonly key: string }
  | { readonly mode: "multiple" };

export interface PagebldrServerOptions<
  Adapter extends StorageAdapter = StorageAdapter,
> {
  readonly builder: Pagebldr;
  readonly storage: Adapter;
  readonly collection: CollectionPolicy;
  readonly revisions?: {
    readonly enabled: boolean;
    readonly retention?: number;
  };
  readonly requireCapabilities?: Partial<StorageCapabilities>;
}

export interface PagebldrServer<Adapter extends StorageAdapter> {
  readonly builder: Pagebldr;
  readonly storage: Adapter;
  readonly collection: CollectionPolicy;
  readonly documents: {
    readonly save: (
      request: SaveDocumentRequest,
    ) => Promise<SaveDocumentResult>;
  };
}

export interface SaveDocumentRequest {
  readonly document: PageDocument;
  readonly expectedVersion?: number;
}

export interface SaveDocumentResult {
  readonly document: PageDocument;
  readonly version: number;
}

export function createPagebldrServer<Adapter extends StorageAdapter>(
  options: PagebldrServerOptions<Adapter>,
): PagebldrServer<Adapter> {
  for (const [capability, required] of Object.entries(
    options.requireCapabilities ?? {},
  )) {
    if (
      required === true &&
      !options.storage.capabilities[capability as keyof StorageCapabilities]
    ) {
      throw new Error(
        `${options.storage.integration}/${options.storage.provider} does not support ${capability}.`,
      );
    }
  }

  return Object.freeze({
    builder: options.builder,
    storage: options.storage,
    collection: options.collection,
    documents: {
      save: (request: SaveDocumentRequest) =>
        Promise.resolve({
          document: request.document,
          version: (request.expectedVersion ?? 0) + 1,
        }),
    },
  });
}
