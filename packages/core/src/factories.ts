export interface ElementTree {
  readonly type: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly children?: readonly ElementTree[];
}

export interface BlockDefinition {
  readonly key: string;
  readonly label: string;
  readonly create: () => ElementTree;
}

export interface TemplateDefinition {
  readonly key: string;
  readonly label: string;
  readonly create: () => ElementTree;
}

export function defineBlock(definition: BlockDefinition): BlockDefinition {
  return Object.freeze(definition);
}

export function defineTemplate(
  definition: TemplateDefinition,
): TemplateDefinition {
  return Object.freeze(definition);
}
