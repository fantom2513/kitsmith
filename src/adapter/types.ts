export type { RuleHelpers } from "../validate/rule-helpers.js"; // type lives next to its implementation

export interface AdapterConfig {
  name: string;
  package: string;
  typesEntry: string; // relative to the package dir
  deprecated?: { source: "jsdoc"; extra?: string[] }; // extra = component names to mark deprecated
  descriptions?: string; // yaml: { [Component]: { description, category } }
  synonyms?: string; // yaml: { [Component]: string[] }
  detectorRules?: string; // module: default (h: RuleHelpers) => DetectorRule[]
  tokens?: string; // module: default TokenExtractor
  recipes?: string; // dir of .md with frontmatter
  guidelines?: string; // dir of .md with frontmatter
  examples?: string; // dir of <Component>.tsx usage examples
  allowedExternal?: string[];
  sandbox?: { overlay: string; dependencies: Record<string, string> };
}

export interface DocEntry {
  slug: string;
  title: string;
  intents: string[];
  components: string[];
  body: string;
}

export interface DetectorRule {
  id: string;
  suggest: string;
  description: string;
  rule: import("eslint").Rule.RuleModule;
}

export type TokenExtractor = (ctx: {
  projectDir: string;
  requireFromProject: NodeJS.Require;
}) => Promise<Record<string, unknown>>;

export interface LoadedAdapter {
  dir: string;
  config: AdapterConfig;
  descriptions: Record<string, { description?: string; category?: string }>;
  synonyms: Record<string, string[]>;
  rules: DetectorRule[];
  recipes: DocEntry[];
  guidelines: DocEntry[];
  examples: Record<string, string>;
  extractTokens?: TokenExtractor;
}
