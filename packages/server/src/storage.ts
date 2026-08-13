import type { PageDocument } from "@pagebldr/core";

export type StorageScope = Readonly<Record<string, string>>;

export interface StorageCapabilities {
  readonly atomicLifecycle: boolean;
  readonly optimisticConcurrency: boolean;
  readonly revisions: boolean;
  readonly publicationPointers: boolean;
  readonly pagination: boolean;
  readonly scopeIsolation: boolean;
  readonly transactionalAudit: boolean;
}

export interface StorageSetupGuide {
  readonly strategy:
    "automatic" | "prisma-db-push" | "prisma-migrate" | "manual";
  readonly summary: string;
  readonly schemaPath?: string;
}

export interface StoredDocument {
  readonly scope: StorageScope;
  readonly key: string;
  readonly document: PageDocument;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface StoredRevision {
  readonly scope: StorageScope;
  readonly id: string;
  readonly documentKey: string;
  readonly document: PageDocument;
  readonly version: number;
  readonly createdAt: Date;
}

export interface StoredPublication {
  readonly scope: StorageScope;
  readonly documentKey: string;
  readonly revisionId: string;
  readonly publishedAt: Date;
}

export interface StorageListRequest {
  readonly scope: StorageScope;
  readonly cursor?: string;
  readonly limit: number;
}

export interface StorageListResult {
  readonly items: readonly StoredDocument[];
  readonly nextCursor?: string;
}

export interface StorageTransaction {
  readonly documents: {
    readonly get: (
      scope: StorageScope,
      key: string,
    ) => Promise<StoredDocument | null>;
    readonly list: (request: StorageListRequest) => Promise<StorageListResult>;
    readonly put: (record: StoredDocument) => Promise<void>;
    readonly delete: (scope: StorageScope, key: string) => Promise<void>;
  };
  readonly revisions: {
    readonly get: (
      scope: StorageScope,
      id: string,
    ) => Promise<StoredRevision | null>;
    readonly list: (
      scope: StorageScope,
      documentKey: string,
    ) => Promise<readonly StoredRevision[]>;
    readonly put: (record: StoredRevision) => Promise<void>;
    readonly delete: (scope: StorageScope, id: string) => Promise<void>;
  };
  readonly publications: {
    readonly get: (
      scope: StorageScope,
      documentKey: string,
    ) => Promise<StoredPublication | null>;
    readonly put: (record: StoredPublication) => Promise<void>;
    readonly delete: (
      scope: StorageScope,
      documentKey: string,
    ) => Promise<void>;
  };
}

export interface StorageAdapter<
  Integration extends string = string,
  Provider extends string = string,
> {
  readonly integration: Integration;
  readonly provider: Provider;
  readonly capabilities: StorageCapabilities;
  readonly setup: StorageSetupGuide;
  readonly read: <Result>(
    operation: (storage: StorageTransaction) => Promise<Result>,
  ) => Promise<Result>;
  readonly transaction: <Result>(
    operation: (storage: StorageTransaction) => Promise<Result>,
  ) => Promise<Result>;
}

export function canonicalScope(scope: StorageScope): string {
  return JSON.stringify(
    Object.entries(scope).sort(([left], [right]) => left.localeCompare(right)),
  );
}
