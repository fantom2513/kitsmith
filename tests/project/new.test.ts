import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPrototype } from "../../src/project/new.js";

const adapterDir = path.resolve("adapters/antd");
let parent: string;
beforeEach(() => {
  parent = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-new-"));
});
afterEach(() => fs.rmSync(parent, { recursive: true, force: true }));

describe("createPrototype", () => {
  it("creates prototype with overlay and deps", async () => {
    const { dir } = await createPrototype({ name: "demo-app", adapterDir, parentDir: parent, install: false });
    const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("demo-app");
    expect(pkg.dependencies.antd).toBeDefined();
    expect(pkg.dependencies.react).toBeDefined();
    expect(read("src/kit/Provider.tsx")).toContain("ConfigProvider");
    expect(fs.existsSync(path.join(dir, ".mcp.json"))).toBe(true);
    expect(read("AGENTS.md")).toContain("src/routes.tsx");
    expect(read("AGENTS.md")).toContain("<!-- kitsmith:end -->");
  });

  it("refuses non-empty target dir", async () => {
    const target = path.join(parent, "taken");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "x.txt"), "x");
    await expect(createPrototype({ name: "taken", adapterDir, parentDir: parent, install: false })).rejects.toThrow(/not empty/);
  });
});
