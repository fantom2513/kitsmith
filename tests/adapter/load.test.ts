import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAdapter, AdapterLoadError } from "../../src/adapter/load.js";

const fixture = path.resolve(import.meta.dirname, "../fixtures/mini-kit-adapter");

describe("loadAdapter", () => {
  it("loads mini-kit adapter", async () => {
    const a = await loadAdapter(fixture);
    expect(a.config.name).toBe("mini-kit");
    expect(a.synonyms.Segmented).toContain("переключатель");
    expect(a.rules.map((r) => r.id)).toEqual(["raw-button"]);
    expect(a.recipes[0].slug).toBe("metric-card");
    expect(a.guidelines[0].slug).toBe("states");
    expect(typeof a.extractTokens).toBe("function");
  });

  it("throws AdapterLoadError naming kit.config.ts when dir has no config", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-empty-"));
    const err = await loadAdapter(dir).catch((e) => e);
    expect(err).toBeInstanceOf(AdapterLoadError);
    expect(err.message).toContain("kit.config.ts");
  });

  it("throws AdapterLoadError naming the file when synonyms path is missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-nosyn-"));
    fs.writeFileSync(
      path.join(dir, "kit.config.ts"),
      `export default { name: "x", package: "x", typesEntry: "index.d.ts", synonyms: "nope.yaml" };`,
    );
    const err = await loadAdapter(dir).catch((e) => e);
    expect(err).toBeInstanceOf(AdapterLoadError);
    expect(err.message).toContain("nope.yaml");
  });

  it("loads adapter from a path containing spaces", async () => {
    const dir = path.join(os.tmpdir(), "kit smith test", `adapter-${Date.now()}`);
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.cpSync(fixture, dir, { recursive: true });
    const a = await loadAdapter(dir);
    expect(a.config.name).toBe("mini-kit");
    expect(a.rules).toHaveLength(1);
  });
});
