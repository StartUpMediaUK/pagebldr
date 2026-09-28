import type { InferSchemaOutput, StandardSchemaV1 } from "./schema.js";
import type { ResolvedDestination } from "./destinations.js";
import type { ResourceReference } from "./types.js";
import type { StyleCapabilityDefinition } from "./styles.js";

export type ElementChildPolicy =
  | { readonly kind: "none" }
  | { readonly kind: "any"; readonly max?: number }
  | {
      readonly kind: "types";
      readonly types: readonly string[];
      readonly max?: number;
    };

export interface ElementAccessibility {
  readonly role?: string;
  readonly requiresLabel?: boolean;
  readonly keyboardInteractive?: boolean;
}

export type RenderNode = string | number | null | RenderElement;

export interface RenderElement {
  readonly tag: string;
  readonly attributes?: Readonly<
    Record<string, string | number | boolean | undefined>
  >;
  readonly style?: Readonly<Record<string, string | number>>;
  readonly children?: readonly RenderNode[];
}

export interface ElementRenderContext {
  readonly children: readonly RenderNode[];
  readonly mode: "edit" | "preview" | "published";
  readonly now: Date;
  readonly resource: (reference: ResourceReference) => string | null;
  readonly destination: (value: unknown) => ResolvedDestination;
}

interface ElementControlBase<Props> {
  readonly key: keyof Props & string;
  readonly label: string;
  readonly description?: string;
  readonly visibleWhen?: {
    readonly key: keyof Props & string;
    readonly equals?: string | number | boolean;
    readonly notEquals?: string | number | boolean;
  };
}

export type CollectionItemControl =
  | {
      readonly kind: "text";
      readonly key: string;
      readonly label: string;
      readonly placeholder?: string;
    }
  | {
      readonly kind: "destination";
      readonly key: string;
      readonly label: string;
      readonly nullable?: boolean;
      readonly preferFirstAnchor?: boolean;
    };

export type ElementControl<Props> =
  | (ElementControlBase<Props> & {
      readonly kind: "text";
      readonly placeholder?: string;
    })
  | (ElementControlBase<Props> & {
      readonly kind: "number";
      readonly min?: number;
      readonly max?: number;
      readonly step?: number;
    })
  | (ElementControlBase<Props> & {
      readonly kind: "boolean";
    })
  | (ElementControlBase<Props> & {
      readonly kind: "select";
      readonly options: readonly {
        readonly label: string;
        readonly value: string | number;
      }[];
    })
  | (ElementControlBase<Props> & {
      readonly kind: "destination";
      readonly nullable?: boolean;
    })
  | (ElementControlBase<Props> & {
      readonly kind: "collection";
      readonly itemLabel: string;
      readonly minItems?: number;
      readonly maxItems?: number;
      readonly idKey: string;
      readonly idPrefix: string;
      readonly defaultItem: Readonly<Record<string, unknown>>;
      readonly itemControls: readonly CollectionItemControl[];
    });

export interface ElementInlineEditing<Props> {
  readonly property: keyof Props & string;
  readonly read: (props: Props) => string;
  readonly update: (value: string, props: Props) => Partial<Props>;
}

export interface ElementDefinition<
  Type extends string = string,
  Schema extends StandardSchemaV1 = StandardSchemaV1,
> {
  readonly type: Type;
  readonly version: number;
  readonly label: string;
  readonly props: Schema;
  readonly defaults: () => InferSchemaOutput<Schema>;
  readonly migrate?: (
    props: unknown,
    fromVersion: number,
  ) => InferSchemaOutput<Schema>;
  readonly controls?: readonly ElementControl<InferSchemaOutput<Schema>>[];
  readonly childPolicy?: ElementChildPolicy;
  readonly styles?: readonly StyleCapabilityDefinition["key"][];
  readonly accessibility?: ElementAccessibility;
  readonly inlineEditing?: ElementInlineEditing<InferSchemaOutput<Schema>>;
  readonly render?: (
    props: InferSchemaOutput<Schema>,
    context: ElementRenderContext,
  ) => RenderNode;
  readonly references?: (
    props: InferSchemaOutput<Schema>,
  ) => readonly ResourceReference[];
  readonly destinations?: (
    props: InferSchemaOutput<Schema>,
  ) => readonly unknown[];
}

export function defineElement<
  const Type extends string,
  Schema extends StandardSchemaV1,
>(
  definition: ElementDefinition<Type, Schema>,
): ElementDefinition<Type, Schema> {
  return Object.freeze({
    ...definition,
    childPolicy: definition.childPolicy ?? ({ kind: "any" } as const),
  });
}
