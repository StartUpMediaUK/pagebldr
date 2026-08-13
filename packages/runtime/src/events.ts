export type AuditEventType =
  | "document.created"
  | "document.saved"
  | "document.deleted"
  | "revision.restored"
  | "publication.published"
  | "publication.unpublished"
  | "editor.command";

export type AnalyticsEventType = "page.visit" | "element.interaction";

export interface EventContext {
  readonly namespace: string;
  readonly scope?: Readonly<Record<string, string>>;
  readonly actorId?: string;
  readonly correlationId?: string;
}

export interface AuditEvent {
  readonly family: "audit";
  readonly schemaVersion: 1;
  readonly id: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly type: AuditEventType;
  readonly context: EventContext;
  readonly subject: {
    readonly documentKey?: string;
    readonly revisionId?: string;
  };
  readonly data: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AnalyticsEvent {
  readonly family: "analytics";
  readonly schemaVersion: 1;
  readonly id: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly type: AnalyticsEventType;
  readonly context: Omit<EventContext, "actorId">;
  readonly subject: {
    readonly documentId: string;
    readonly elementId?: string;
  };
  readonly data: Readonly<Record<string, string | number | boolean | null>>;
}

export type PagebldrEvent = AuditEvent | AnalyticsEvent;

export interface EventSink {
  readonly write: (events: readonly PagebldrEvent[]) => void | Promise<void>;
}

export interface EventDeliveryOptions {
  readonly sink: EventSink;
  readonly consent?: (event: AnalyticsEvent) => boolean | Promise<boolean>;
  readonly batchSize?: number;
  readonly retries?: number;
  readonly failure?: "isolate" | "throw";
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export interface EventDelivery {
  readonly audit: (
    input: Omit<
      AuditEvent,
      "family" | "schemaVersion" | "id" | "sequence" | "occurredAt"
    >,
  ) => Promise<AuditEvent>;
  readonly analytics: (
    input: Omit<
      AnalyticsEvent,
      "family" | "schemaVersion" | "id" | "sequence" | "occurredAt"
    >,
  ) => Promise<AnalyticsEvent | null>;
  readonly flush: () => Promise<void>;
}

export function createEventDelivery(
  options: EventDeliveryOptions,
): EventDelivery {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const batchSize = Math.min(Math.max(options.batchSize ?? 20, 1), 100);
  let sequence = 0;
  const queue: PagebldrEvent[] = [];
  let pending = Promise.resolve();

  const flush = async () => {
    const events = queue.splice(0, batchSize);
    if (events.length === 0) return;
    let attempt = 0;
    while (true) {
      try {
        await options.sink.write(events);
        break;
      } catch (error) {
        if (attempt++ >= (options.retries ?? 2)) {
          if (options.failure === "throw") throw error;
          break;
        }
      }
    }
    if (queue.length > 0) await flush();
  };
  const schedule = (event: PagebldrEvent) => {
    queue.push(event);
    if (queue.length >= batchSize) pending = pending.then(flush, flush);
  };
  return Object.freeze({
    audit: (
      input: Omit<
        AuditEvent,
        "family" | "schemaVersion" | "id" | "sequence" | "occurredAt"
      >,
    ) => {
      const event: AuditEvent = Object.freeze({
        family: "audit",
        schemaVersion: 1,
        id: createId(),
        sequence: ++sequence,
        occurredAt: now().toISOString(),
        ...input,
        data: redact(input.data),
      });
      schedule(event);
      return Promise.resolve(event);
    },
    analytics: async (
      input: Omit<
        AnalyticsEvent,
        "family" | "schemaVersion" | "id" | "sequence" | "occurredAt"
      >,
    ) => {
      const event: AnalyticsEvent = Object.freeze({
        family: "analytics",
        schemaVersion: 1,
        id: createId(),
        sequence: ++sequence,
        occurredAt: now().toISOString(),
        ...input,
        data: redact(input.data),
      });
      if (options.consent && !(await options.consent(event))) return null;
      schedule(event);
      return event;
    },
    flush: async () => {
      await pending;
      await flush();
    },
  });
}

const sensitivePattern =
  /(?:content|document|email|name|token|secret|password|url)$/iu;

export function redact(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | number | boolean | null>> {
  const entries = Object.entries(input).filter(
    ([key, value]) =>
      !sensitivePattern.test(key) &&
      (value === null ||
        ["string", "number", "boolean"].includes(typeof value)),
  ) as [string, string | number | boolean | null][];
  return Object.freeze(Object.fromEntries(entries));
}

export function memoryEventSink(): EventSink & {
  readonly events: readonly PagebldrEvent[];
} {
  const events: PagebldrEvent[] = [];
  return Object.freeze({
    events,
    write: (batch: readonly PagebldrEvent[]) => {
      events.push(...structuredClone(batch));
    },
  });
}

export function callbackEventSink(callback: EventSink["write"]): EventSink {
  return Object.freeze({ write: callback });
}

export function consoleEventSink(
  logger: Pick<Console, "info"> = console,
): EventSink {
  return Object.freeze({
    write: (events: readonly PagebldrEvent[]) =>
      logger.info("pagebldr events", events),
  });
}

export interface OpenTelemetryEventTarget {
  readonly addEvent: (
    name: string,
    attributes: Readonly<Record<string, string | number | boolean>>,
  ) => void;
}

export interface AuditEventStore {
  readonly append: (events: readonly AuditEvent[]) => void | Promise<void>;
  readonly list: (request: {
    readonly cursor?: string;
    readonly limit: number;
    readonly scope?: Readonly<Record<string, string>>;
  }) => Promise<{
    readonly items: readonly AuditEvent[];
    readonly nextCursor?: string;
  }>;
}

export function auditStoreEventSink(
  store: AuditEventStore,
  analytics?: EventSink,
): EventSink {
  return Object.freeze({
    write: async (events: readonly PagebldrEvent[]) => {
      const audits = events.filter(
        (event): event is AuditEvent => event.family === "audit",
      );
      const analyticsEvents = events.filter(
        (event) => event.family === "analytics",
      );
      if (audits.length > 0) await store.append(audits);
      if (analytics && analyticsEvents.length > 0)
        await analytics.write(analyticsEvents);
    },
  });
}

export function memoryAuditEventStore(): AuditEventStore {
  const events: AuditEvent[] = [];
  return Object.freeze({
    append: (batch: readonly AuditEvent[]) => {
      events.push(...structuredClone(batch));
    },
    list: ({
      cursor,
      limit,
      scope,
    }: Parameters<AuditEventStore["list"]>[0]) => {
      const filtered = events.filter(
        (event) =>
          !scope ||
          Object.entries(scope).every(
            ([key, value]) => event.context.scope?.[key] === value,
          ),
      );
      const start = cursor
        ? Math.max(filtered.findIndex((event) => event.id === cursor) + 1, 0)
        : 0;
      const items = filtered.slice(start, start + limit);
      const last = items.at(-1);
      return Promise.resolve({
        items: structuredClone(items),
        ...(start + items.length < filtered.length && last
          ? { nextCursor: last.id }
          : {}),
      });
    },
  });
}

export function openTelemetryEventSink(
  target: OpenTelemetryEventTarget,
): EventSink {
  return Object.freeze({
    write: (events: readonly PagebldrEvent[]) => {
      for (const event of events)
        target.addEvent(`pagebldr.${event.type}`, {
          "pagebldr.event.id": event.id,
          "pagebldr.event.family": event.family,
          "pagebldr.event.sequence": event.sequence,
        });
    },
  });
}

export async function recordEditorAudit(
  delivery: EventDelivery,
  input: {
    readonly context: EventContext;
    readonly documentKey: string;
    readonly commandType: string;
    readonly changedElementCount: number;
  },
): Promise<AuditEvent> {
  return delivery.audit({
    type: "editor.command",
    context: input.context,
    subject: { documentKey: input.documentKey },
    data: {
      commandType: input.commandType,
      changedElementCount: input.changedElementCount,
    },
  });
}
