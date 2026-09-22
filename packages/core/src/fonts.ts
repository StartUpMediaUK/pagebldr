export interface FontFamilyOption {
  readonly label: string;
  readonly value: string;
  readonly aliases?: readonly string[];
}

export const standardFontFamilies: readonly FontFamilyOption[] = Object.freeze([
  { label: "System sans", value: "ui-sans-serif, system-ui, sans-serif" },
  { label: "System serif", value: 'Georgia, "Times New Roman", serif' },
  {
    label: "Geist",
    value: "var(--font-geist-sans), Arial, sans-serif",
    aliases: ["Geist, Arial, sans-serif"],
  },
  {
    label: "Inter",
    value: "var(--font-page-inter), Arial, sans-serif",
    aliases: ["Inter, ui-sans-serif, system-ui, sans-serif"],
  },
  { label: "Roboto", value: "var(--font-page-roboto), Arial, sans-serif" },
  {
    label: "Open Sans",
    value: "var(--font-page-open-sans), Arial, sans-serif",
  },
  {
    label: "Montserrat",
    value: "var(--font-page-montserrat), Arial, sans-serif",
  },
  { label: "Poppins", value: "var(--font-page-poppins), Arial, sans-serif" },
  {
    label: "Merriweather",
    value: 'var(--font-page-merriweather), Georgia, "Times New Roman", serif',
  },
  {
    label: "Playfair Display",
    value: 'var(--font-page-playfair), Georgia, "Times New Roman", serif',
  },
]);

export function findStandardFontFamily(
  value: unknown,
): FontFamilyOption | null {
  if (typeof value !== "string") return null;
  return (
    standardFontFamilies.find(
      (option) =>
        option.value === value || option.aliases?.includes(value) === true,
    ) ?? null
  );
}
