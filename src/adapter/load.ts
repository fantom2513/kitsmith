import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { parse as parseYaml } from "yaml";
import { loadDocs } from "../docs/docs.js";
import { ruleHelpers } from "../validate/rule-helpers.js";
import type { AdapterConfig, DetectorRule, LoadedAdapter, TokenExtractor } from "./types.js";

export class AdapterLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterLoadError";
  }
}

const CONFIG_NAMES = ["kit.config.ts", "kit.config.js", "kit.config.mjs"];

const jiti = createJiti(import.meta.url, { moduleCache: false });

async function importModule<T>(file: string): Promise<T> {
  try {
    return await jiti.import<T>(pathToFileURL(file).href, { default: true });
  } catch (e) {
    throw new AdapterLoadError(`Failed to load ${file}: ${(e as Error).message}`);
  }
}

function resolveExisting(dir: string, rel: string, what: string): string {
  const p = path.resolve(dir, rel);
  if (!fs.existsSync(p)) {
    throw new AdapterLoadError(`Adapter ${what} not found: ${p}`);
  }
  return p;
}

function readYaml<T>(file: string): T {
  try {
    return (parseYaml(fs.readFileSync(file, "utf8")) ?? {}) as T;
  } catch (e) {
    throw new AdapterLoadError(`Invalid YAML in ${file}: ${(e as Error).message}`);
  }
}

export async function loadAdapter(dir: string): Promise<LoadedAdapter> {
  const adapterDir = path.resolve(dir);
  const configFile = CONFIG_NAMES.map((n) => path.join(adapterDir, n)).find((p) => fs.existsSync(p));
  if (!configFile) {
    throw new AdapterLoadError(`kit.config.ts not found in ${adapterDir}`);
  }
  const config = await importModule<AdapterConfig>(configFile);
  if (!config || !config.name || !config.package || !config.typesEntry) {
    throw new AdapterLoadError(`${configFile} must export name, package and typesEntry`);
  }

  const descriptions = config.descriptions
    ? readYaml<LoadedAdapter["descriptions"]>(resolveExisting(adapterDir, config.descriptions, "descriptions file"))
    : {};
  const synonyms = config.synonyms
    ? readYaml<LoadedAdapter["synonyms"]>(resolveExisting(adapterDir, config.synonyms, "synonyms file"))
    : {};

  let rules: DetectorRule[] = [];
  if (config.detectorRules) {
    const mod = await importModule<(h: typeof ruleHelpers) => DetectorRule[]>(
      resolveExisting(adapterDir, config.detectorRules, "detector rules module"),
    );
    rules = mod(ruleHelpers);
  }

  let extractTokens: TokenExtractor | undefined;
  if (config.tokens) {
    extractTokens = await importModule<TokenExtractor>(resolveExisting(adapterDir, config.tokens, "tokens module"));
  }

  const recipes = config.recipes ? loadDocs(resolveExisting(adapterDir, config.recipes, "recipes dir")) : [];
  const guidelines = config.guidelines
    ? loadDocs(resolveExisting(adapterDir, config.guidelines, "guidelines dir"))
    : [];

  const examples: Record<string, string> = {};
  if (config.examples) {
    const exDir = resolveExisting(adapterDir, config.examples, "examples dir");
    for (const f of fs.readdirSync(exDir).filter((n) => n.endsWith(".tsx"))) {
      examples[path.basename(f, ".tsx")] = fs.readFileSync(path.join(exDir, f), "utf8");
    }
  }

  return { dir: adapterDir, config, descriptions, synonyms, rules, recipes, guidelines, examples, extractTokens };
}
