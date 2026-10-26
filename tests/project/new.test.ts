import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initProject } from "../../src/project/init.js";
import { createPrototype, InstallError, PrototypeNameError, TargetDirError } from "../../src/project/new.js";

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

  it("ships a .gitignore that excludes machine-local state", async () => {
    const { dir } = await createPrototype({ name: "demo-app", adapterDir, parentDir: parent, install: false });
    const ignore = fs.readFileSync(path.join(dir, ".gitignore"), "utf8").split(/\r?\n/);
    expect(ignore).toEqual(expect.arrayContaining(["node_modules/", "dist/", ".kitsmith/"]));
    expect(fs.existsSync(path.join(dir, "gitignore"))).toBe(false);
  });

  it("refuses non-empty target dir", async () => {
    const target = path.join(parent, "taken");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "x.txt"), "x");
    await expect(createPrototype({ name: "taken", adapterDir, parentDir: parent, install: false })).rejects.toThrow(/not empty/);
  });

  it("keeps the layout section after the kitsmith block across an init re-run", async () => {
    const { dir } = await createPrototype({ name: "demo-app", adapterDir, parentDir: parent, install: false });
    await initProject({ projectDir: dir, adapterDir });
    const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    expect(agents.indexOf("## Prototype layout")).toBeGreaterThan(agents.indexOf("<!-- kitsmith:end -->"));
    expect(agents.split("## Prototype layout").length - 1).toBe(1);
  });

  it("rejects invalid names before touching disk", async () => {
    for (const name of ["../evil", "a/b", "a\b", "Upper", "..", ""]) {
      await expect(createPrototype({ name, adapterDir, parentDir: parent, install: false })).rejects.toThrow(PrototypeNameError);
    }
    expect(fs.readdirSync(parent)).toEqual([]);
  });

  it("refuses non-empty target with a typed error", async () => {
    fs.mkdirSync(path.join(parent, "t"));
    fs.writeFileSync(path.join(parent, "t", "x"), "x");
    await expect(createPrototype({ name: "t", adapterDir, parentDir: parent, install: false })).rejects.toThrow(TargetDirError);
  });

  describe("failure handling", () => {
    let badAdapter: string;
    beforeEach(() => {
      badAdapter = path.join(parent, "bad-adapter");
      fs.cpSync(adapterDir, badAdapter, { recursive: true });
      fs.rmSync(path.join(badAdapter, "sandbox"), { recursive: true, force: true });
    });

    it("removes the created dir when a step before install fails", async () => {
      await expect(createPrototype({ name: "p", adapterDir: badAdapter, parentDir: parent, install: false })).rejects.toThrow();
      expect(fs.existsSync(path.join(parent, "p"))).toBe(false);
    });

    it("empties but keeps a pre-existing empty dir on failure", async () => {
      fs.mkdirSync(path.join(parent, "p"));
      await expect(createPrototype({ name: "p", adapterDir: badAdapter, parentDir: parent, install: false })).rejects.toThrow();
      expect(fs.readdirSync(path.join(parent, "p"))).toEqual([]);
    });

    it("keeps the project and throws InstallError when install fails", async () => {
      const installer = async () => {
        throw new Error("boom");
      };
      const p = createPrototype({ name: "p", adapterDir, parentDir: parent, install: true, installer });
      await expect(p).rejects.toThrow(InstallError);
      await expect(p).rejects.toThrow(/npm install/);
      expect(fs.existsSync(path.join(parent, "p", "package.json"))).toBe(true);
    });
  });
});
