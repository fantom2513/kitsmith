import fs from "node:fs";
import path from "node:path";
import type { LoadedAdapter } from "../adapter/types.js";
import { extractComponents } from "./extract-types.js";
import type { ComponentEntry, KitIndex } from "./types.js";

export class KitNotInstalledError extends Error {
  constructor(pkg: string, projectDir: string) {
    super(`Kit package "${pkg}" is not installed in ${projectDir}. Run npm install there first.`);
    this.name = "KitNotInstalledError";
  }
}

export interface BuildOptions {
  /** Replaceable extractor (tests inject a spy). */
  extract?: typeof extractComponents;
}

function readKitVersion(adapter: LoadedAdapter, projectDir: string): string {
  const pkgDir = path.join(projectDir, "node_modules", adapter.config.package);
  const pkgFile = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgFile)) throw new KitNotInstalledError(adapter.config.package, projectDir);
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

export function buildIndex(adapter: LoadedAdapter, projectDir: string, opts: BuildOptions = {}): KitIndex {
  const version = readKitVersion(adapter, projectDir);
  const extract = opts.extract ?? extractComponents;
  const components: ComponentEntry[] = extract({
    projectDir,
    packageName: adapter.config.package,
    typesEntry: adapter.config.typesEntry,
  });
  const extra = new Set(adapter.config.deprecated?.extra ?? []);
  for (const c of components) {
    const meta = adapter.descriptions[c.name];
    const description = meta?.description ?? c.description;
    const category = meta?.category ?? c.category;
    if (description !== undefined) c.description = description;
    if (category !== undefined) c.category = category;
    if (extra.has(c.name) && c.deprecated === undefined) c.deprecated = "";
  }
  return {
    kit: adapter.config.name,
    package: adapter.config.package,
    version,
    builtAt: new Date().toISOString(),
    components,
  };
}

export function loadOrBuildIndex(
  adapter: LoadedAdapter,
  projectDir: string,
  opts: BuildOptions & { rebuild?: boolean } = {},
): KitIndex {
  const version = readKitVersion(adapter, projectDir);
  const cacheFile = path.join(projectDir, ".kitsmith", `index-${adapter.config.name}-${version}.json`);
  if (!opts.rebuild && fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, "utf8")) as KitIndex;
    } catch {
      // corrupt cache: fall through and rebuild
    }
  }
  const index = buildIndex(adapter, projectDir, opts);
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(index, null, 2));
  return index;
}
