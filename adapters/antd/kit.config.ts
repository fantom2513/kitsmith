import type { AdapterConfig } from "../../src/adapter/types.js";

const config: AdapterConfig = {
  name: "antd",
  package: "antd",
  typesEntry: "es/index.d.ts",
  deprecated: { source: "jsdoc" },
  descriptions: "descriptions.yaml",
  synonyms: "synonyms.yaml",
  detectorRules: "detector-rules.ts",
  tokens: "tokens.ts",
  recipes: "recipes",
  guidelines: "guidelines",
  allowedExternal: ["@ant-design/charts", "@ant-design/icons"],
  sandbox: {
    overlay: "sandbox",
    dependencies: { antd: "^6.6.8", "@ant-design/icons": "^6" },
  },
};

export default config;
