import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter } from "../../src/adapter/load.js";
import { buildIndex, loadOrBuildIndex, KitNotInstalledError } from "../../src/index/build.js";
import { extractComponents } from "../../src/index/extract-types.js";
import type { LoadedAdapter } from "../../src/adapter/types.js";
import { copyFixtureProject, fixtureProjectDir } from "../helpers/temp-project.js";

const adapterDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/mini-kit-adapter");
const get = (idx: { components: { name: string }[] }, n: string) => idx.components.find((c) => c.name === n) as any;

describe("buildIndex", () => {
  it("merges adapter descriptions and categories", async () => {
    const adapter = await loadAdapter(adapterDir);
    const index = buildIndex(adapter, fixtureProjectDir);
    const seg = get(index, "Segmented");
    expect(seg.description).toBe("Segmented control to pick one option from a short list.");
    expect(seg.category).toBe("data-entry");
  });

  it("lets a JSDoc description win only when yaml has none", async () => {
    const adapter = await loadAdapter(adapterDir);
    const extract = () => [
      { name: "A", description: "from jsdoc", props: [], subcomponents: [], extendsHtmlAttributes: false },
      { name: "B", description: "from jsdoc", props: [], subcomponents: [], extendsHtmlAttributes: false },
    ];
    const custom: LoadedAdapter = { ...adapter, descriptions: { A: { description: "from yaml", category: "x" } } };
    const index = buildIndex(custom, fixtureProjectDir, { extract });
    expect(get(index, "A").description).toBe("from yaml");
    expect(get(index, "A").category).toBe("x");
    expect(get(index, "B").description).toBe("from jsdoc");
  });

  it("marks deprecated.extra components", async () => {
    const adapter = await loadAdapter(adapterDir);
    const custom: LoadedAdapter = {
      ...adapter,
      config: { ...adapter.config, deprecated: { source: "jsdoc", extra: ["Card"] } },
    };
    const index = buildIndex(custom, fixtureProjectDir);
    expect(get(index, "Card").deprecated).toBe("");
    expect(get(index, "OldTable").deprecated).toBe("Use Table");
    expect(get(index, "Button").deprecated).toBeUndefined();
  });

  it("takes version from the kit package.json", async () => {
    const adapter = await loadAdapter(adapterDir);
    const index = buildIndex(adapter, fixtureProjectDir);
    expect(index.version).toBe("1.0.0");
    expect(index.kit).toBe("mini-kit");
    expect(index.package).toBe("mini-kit");
  });

  it("throws KitNotInstalledError when package dir is missing", async () => {
    const adapter = await loadAdapter(adapterDir);
    const missing = path.join(fixtureProjectDir, "no-such-project");
    expect(() => buildIndex(adapter, missing)).toThrow(KitNotInstalledError);
    expect(() => loadOrBuildIndex(adapter, missing)).toThrow(
      `Kit package "mini-kit" is not installed in ${missing}. Run npm install there first.`,
    );
  });
});

describe("loadOrBuildIndex", () => {
  it("writes cache and reuses it", async () => {
    const adapter = await loadAdapter(adapterDir);
    const { dir, cleanup } = copyFixtureProject();
    try {
      const extract = vi.fn(extractComponents);
      const first = loadOrBuildIndex(adapter, dir, { extract });
      expect(extract).toHaveBeenCalledTimes(1);
      expect(fs.existsSync(path.join(dir, ".kitsmith", "index-mini-kit-1.0.0.json"))).toBe(true);
      const second = loadOrBuildIndex(adapter, dir, { extract });
      expect(extract).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
      loadOrBuildIndex(adapter, dir, { extract, rebuild: true });
      expect(extract).toHaveBeenCalledTimes(2);
    } finally {
      cleanup();
    }
  });

  it("rebuilds when kit version changes", async () => {
    const adapter = await loadAdapter(adapterDir);
    const { dir, cleanup } = copyFixtureProject();
    try {
      expect(loadOrBuildIndex(adapter, dir).version).toBe("1.0.0");
      const pkgFile = path.join(dir, "node_modules", "mini-kit", "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
      fs.writeFileSync(pkgFile, JSON.stringify({ ...pkg, version: "2.0.0" }));
      const next = loadOrBuildIndex(adapter, dir);
      expect(next.version).toBe("2.0.0");
      expect(fs.existsSync(path.join(dir, ".kitsmith", "index-mini-kit-2.0.0.json"))).toBe(true);
    } finally {
      cleanup();
    }
  });
});
