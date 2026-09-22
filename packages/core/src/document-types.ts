export type Breakpoint = "desktop" | "tablet" | "mobile";
export type StyleState = "normal" | "hover" | "focusVisible";
export type VariableKind =
  "color" | "typography" | "spacing" | "radius" | "shadow" | "contentWidth";

export interface VariableReference {
  readonly type: "variable";
  readonly variableId: string;
}

export type StyleValue = string | number | VariableReference;
export type StyleDeclarations = Readonly<Record<string, StyleValue>>;
export type StateStyles = Readonly<
  Partial<Record<StyleState, StyleDeclarations>>
>;
export type ResponsiveStyles = Readonly<
  Partial<Record<Breakpoint, StateStyles>>
>;

export interface PageElement {
  readonly id: string;
  readonly type: string;
  readonly elementVersion: number;
  readonly name: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly string[];
  readonly classIds: readonly string[];
  readonly styles: ResponsiveStyles;
  readonly locked: boolean;
  readonly hidden: boolean;
}

export interface StyleClass {
  readonly id: string;
  readonly name: string;
  readonly styles: ResponsiveStyles;
}

export interface StyleVariable {
  readonly id: string;
  readonly name: string;
  readonly kind: VariableKind;
  readonly value: string | number;
}

export interface PageSettings {
  readonly contentWidth: number;
  readonly showDefaultHeader: boolean;
  readonly breakpoints: {
    readonly tabletMax: number;
    readonly mobileMax: number;
  };
  readonly seo: {
    readonly title: string;
    readonly description: string;
    readonly socialTitle: string;
    readonly socialDescription: string;
    readonly socialImage: ResourceReference | null;
    readonly noIndex: boolean;
  };
}

export interface PageDocument {
  readonly format: "pagebldr";
  readonly schemaVersion: number;
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly rootId: string;
  readonly elements: Readonly<Record<string, PageElement>>;
  readonly classes: Readonly<Record<string, StyleClass>>;
  readonly classOrder: readonly string[];
  readonly variables: Readonly<Record<string, StyleVariable>>;
  readonly variableOrder: readonly string[];
  readonly settings: PageSettings;
}

export interface DocumentIndex {
  readonly parentById: ReadonlyMap<string, string | null>;
  readonly indexById: ReadonlyMap<string, number>;
  readonly depthById: ReadonlyMap<string, number>;
  readonly descendantsById: ReadonlyMap<string, ReadonlySet<string>>;
  readonly preorder: readonly string[];
}
import type { ResourceReference } from "./types.js";
