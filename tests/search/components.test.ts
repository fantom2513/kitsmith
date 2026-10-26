import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter } from "../../src/adapter/load.js";
import { buildIndex } from "../../src/index/build.js";
import type { KitIndex, ComponentEntry } from "../../src/index/types.js";
import { createComponentSearch } from "../../src/search/components.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
let search: ReturnType<typeof createComponentSearch>;

beforeAll(async () => {
  const adapter = await loadAdapter(path.join(root, "mini-kit-adapter"));
  const index = buildIndex(adapter, path.join(root, "mini-kit-project"));
  search = createComponentSearch(index, adapter.synonyms);
});

describe("createComponentSearch", () => {
  it("finds by name", () => expect(search.find("segmented")[0].name).toBe("Segmented"));
  it("finds by English synonym", () => expect(search.find("toggle group")[0].name).toBe("Segmented"));
  it("finds by Russian synonym", () => expect(search.find("переключатель")[0].name).toBe("Segmented"));
  it("ranks deprecated down and flags it", () => {
    const hits = search.find("table");
    const names = hits.map((h) => h.name);
    expect(names.indexOf("Table")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("Table")).toBeLessThan(names.indexOf("OldTable"));
    expect(hits.find((h) => h.name === "OldTable")?.deprecated).toBe("Use Table");
  });
  it("fuzzy tolerates typos", () => expect(search.find("segmentd")[0].name).toBe("Segmented"));
  it("returns [] for empty query", () => {
    expect(search.find("")).toEqual([]);
    expect(search.find("   ")).toEqual([]);
  });
  it("explains the match and respects limit", () => {
    const hit = search.find("toggle group", 1);
    expect(hit).toHaveLength(1);
    expect(hit[0].why).toContain("toggle group");
    expect(hit[0].why.length).toBeLessThanOrEqual(120);
  });
});

const comp = (name: string, description: string, deprecated?: string): ComponentEntry => ({
  name, description, props: [], subcomponents: [], extendsHtmlAttributes: false,
  ...(deprecated !== undefined ? { deprecated } : {}),
});
const mk = (components: ComponentEntry[]): KitIndex => ({ kit: "k", package: "k", version: "1", builtAt: "", components });

describe("ranking details", () => {
  const fresh = comp("NewGrid", "rows data");
  const old = (dep?: string) => comp("OldGrid", "rows data rows data", dep);
  it("deprecated penalty flips an otherwise winning component", () => {
    const base = createComponentSearch(mk([fresh, old()]), {}).find("rows data");
    expect(base[0].name).toBe("OldGrid");
    const penalized = createComponentSearch(mk([fresh, old("Use NewGrid")]), {}).find("rows data");
    expect(penalized[0].name).toBe("NewGrid");
    expect(penalized[1].deprecated).toBe("Use NewGrid");
  });
  it("exact name ranks before its subcomponents", () => {
    const idx = mk([
      comp("Input.TextArea", "input textarea multi-line input"),
      comp("Input.Password", "password input"),
      comp("Input", "Single-line text input."),
    ]);
    expect(createComponentSearch(idx, {}).find("input")[0].name).toBe("Input");
  });
});
