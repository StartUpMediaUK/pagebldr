import type { InferSchemaOutput, StandardSchemaV1 } from "./schema.js";
import type { ResourceReference } from "./types.js";

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
  return Object.freeze(definition);
}
