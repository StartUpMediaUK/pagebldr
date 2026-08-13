export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => unknown;
    readonly types?:
      | {
          readonly input: Input;
          readonly output: Output;
        }
      | undefined;
  };
}

export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | {
      readonly issues: readonly {
        readonly message: string;
        readonly path?: readonly PropertyKey[];
      }[];
    };

export type InferSchemaOutput<Schema> =
  Schema extends StandardSchemaV1<infer Input, infer Output>
    ? [Input] extends [unknown]
      ? Output
      : never
    : never;
