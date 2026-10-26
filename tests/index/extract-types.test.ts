import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractComponents } from "../../src/index/extract-types.js";
import type { ComponentEntry } from "../../src/index/types.js";

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/mini-kit-project",
);

let components: ComponentEntry[];
const get = (name: string) => components.find((c) => c.name === name)!;
const prop = (c: string, p: string) => get(c).props.find((x) => x.name === p)!;

beforeAll(() => {
  components = extractComponents({ projectDir, packageName: "mini-kit", typesEntry: "index.d.ts" });
});

describe("extractComponents", () => {
  it("finds components and skips non-components", () => {
    expect(components.map((c) => c.name)).toEqual([
      "Button", "Card", "Input", "Input.TextArea", "OldTable", "Segmented", "Table",
    ]);
  });

  it("extracts own props without React HTML attributes", () => {
    expect(get("Button").props.map((p) => p.name)).toEqual(["ghostly", "onClick", "size", "type"]);
    expect(get("Button").extendsHtmlAttributes).toBe(true);
    expect(get("Segmented").extendsHtmlAttributes).toBe(false);
  });

  it("reads required, default, deprecated", () => {
    expect(prop("Segmented", "options").required).toBe(true);
    expect(prop("Button", "size").default).toBe('"middle"');
    expect(prop("Button", "ghostly").deprecated).toBe("use type");
    expect(get("OldTable").deprecated).toBe("Use Table");
  });

  it("links subcomponents", () => {
    expect(get("Input").subcomponents).toEqual(["Input.TextArea"]);
    expect(get("Input.TextArea").props.map((p) => p.name)).toContain("rows");
  });

  it("renders union types readably", () => {
    expect(prop("Button", "type").type).toBe('"primary" | "default"');
    for (const c of components) for (const p of c.props) expect(p.type.length).toBeLessThanOrEqual(200);
  });
});
