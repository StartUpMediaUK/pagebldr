import type { InferSchemaOutput, StandardSchemaV1 } from "./schema.js";
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
  readonly children?: readonly RenderNode[];
}

export interface ElementRenderContext {
  readonly children: readonly RenderNode[];
  readonly resource: (reference: ResourceReference) => string | null;
}

export interface ElementControl<Props> {
  readonly key: keyof Props & string;
  readonly label: string;
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
  readonly render?: (
    props: InferSchemaOutput<Schema>,
    context: ElementRenderContext,
  ) => RenderNode;
  readonly references?: (
    props: InferSchemaOutput<Schema>,
  ) => readonly ResourceReference[];
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
