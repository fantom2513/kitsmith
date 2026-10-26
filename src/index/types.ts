export interface PropEntry {
  name: string; type: string; required: boolean;
  description?: string; default?: string; deprecated?: string; // message, may be ""
}
export interface ComponentEntry {
  name: string;                 // "Input" or "Input.TextArea"
  description?: string; category?: string; deprecated?: string;
  props: PropEntry[]; subcomponents: string[];  // full names, e.g. ["Input.TextArea"]
  extendsHtmlAttributes: boolean;               // true if props from @types/react were dropped
}
export interface KitIndex {
  kit: string; package: string; version: string; builtAt: string;
  components: ComponentEntry[];
}
