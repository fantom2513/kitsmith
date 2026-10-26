import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDocs, findRecipe, getGuideline } from "../../src/docs/docs.js";

const adapterDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/mini-kit-adapter");
const recipes = loadDocs(path.join(adapterDir, "recipes"));
const guidelines = loadDocs(path.join(adapterDir, "guidelines"));

describe("doc lookups", () => {
  it("finds a recipe by intent", () => expect(findRecipe(recipes, "kpi tile")?.slug).toBe("metric-card"));
  it("returns undefined for unrelated intent", () => expect(findRecipe(recipes, "zzz")).toBeUndefined());
  it("rejects plausible but unrelated multi-word queries", () => {
    expect(findRecipe(recipes, "form for a table with filters")).toBeUndefined();
    expect(findRecipe(recipes, "how to make a login page")).toBeUndefined();
    expect(getGuideline(guidelines, "form for a table with filters")).toBeUndefined();
  });
  it("rejects generic or stopword-only queries", () => {
    expect(findRecipe(recipes, "page")).toBeUndefined();
    expect(findRecipe(recipes, "for a")).toBeUndefined();
  });
  it("gets a guideline by slug", () => expect(getGuideline(guidelines, "states")?.slug).toBe("states"));
  it("falls back to search for guidelines", () => expect(getGuideline(guidelines, "empty error")?.slug).toBe("states"));
  it("returns undefined for unknown guideline", () => expect(getGuideline(guidelines, "zzz")).toBeUndefined());
});
