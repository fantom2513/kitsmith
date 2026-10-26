import type { AdapterConfig } from "../../../src/adapter/types.js";

const config: AdapterConfig = {
  name: "mini-kit",
  package: "mini-kit",
  typesEntry: "index.d.ts",
  descriptions: "descriptions.yaml",
  synonyms: "synonyms.yaml",
  detectorRules: "detector-rules.ts",
  tokens: "tokens.ts",
  recipes: "recipes",
  guidelines: "guidelines",
  allowedExternal: ["mini-charts"],
};

export default config;
