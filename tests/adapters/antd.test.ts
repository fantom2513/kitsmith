import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter } from "../../src/adapter/load.js";
import type { LoadedAdapter } from "../../src/adapter/types.js";
import { buildIndex } from "../../src/index/build.js";
import type { KitIndex } from "../../src/index/types.js";
import { createComponentSearch } from "../../src/search/components.js";
import { runDetector } from "../../src/validate/detector.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adapterDir = path.join(repoRoot, "adapters/antd");
const fixturesDir = path.join(adapterDir, "rules-fixtures");

let adapter: LoadedAdapter;
let index: KitIndex;

beforeAll(async () => {
  adapter = await loadAdapter(adapterDir);
  index = buildIndex(adapter, repoRoot);
}, 120_000);

const fixtures = (sub: string) =>
  fs.readdirSync(path.join(fixturesDir, sub)).filter((f) => f.endsWith(".tsx")).map((f) => `${sub}/${f}`);

describe("antd adapter", () => {
  it("antd index has core components", () => {
    const names = index.components.map((c) => c.name);
    for (const n of ["Button", "Segmented", "Table", "Input.TextArea", "Form.Item"]) expect(names).toContain(n);
    expect(names.length).toBeGreaterThanOrEqual(50);
    expect(names.filter((n) => /Context$/.test(n.split(".").pop()!))).toEqual([]);
    for (const c of index.components) expect(c.category, c.name).toBeTruthy();
  });

  it("antd search", () => {
    const search = createComponentSearch(index, adapter.synonyms);
    expect(search.find("toggle group")[0].name).toBe("Segmented");
    expect(search.find("переключатель")[0].name).toBe("Segmented");
    expect(search.find("kpi").map((h) => h.name)).toContain("Statistic");
  });

  it("antd docs load", () => {
    expect(adapter.recipes.map((r) => r.slug).sort()).toEqual(["filter-bar", "metric-card", "settings-form"]);
    expect(adapter.guidelines.map((r) => r.slug).sort()).toEqual(["decision-ladder", "states"]);
  });

  it("each antd rule fires on its positive fixtures and never on negative ones", () => {
    expect(adapter.rules).toHaveLength(6);
    const ruleIds = adapter.rules.map((r) => r.id);
    for (const id of ruleIds) {
      expect(fixtures("pos").some((f) => path.basename(f).startsWith(id)), `positive fixture for ${id}`).toBe(true);
    }
    for (const file of fixtures("pos")) {
      const id = ruleIds.find((r) => path.basename(file).startsWith(r))!;
      expect(id, file).toBeDefined();
      const found = runDetector(fixturesDir, [file], adapter).map((f) => f.ruleId);
      expect(found, file).toContain(id);
    }
    for (const file of fixtures("neg")) {
      expect(runDetector(fixturesDir, [file], adapter), file).toEqual([]);
    }
  });

  it("antd tokens contain colorPrimary", async () => {
    const tokens = await adapter.extractTokens!({
      projectDir: repoRoot,
      requireFromProject: (await import("node:module")).createRequire(path.join(repoRoot, "package.json")),
    });
    expect(tokens).toHaveProperty("colorPrimary");
    expect(tokens).not.toHaveProperty("motionDurationFast");
  });
});
