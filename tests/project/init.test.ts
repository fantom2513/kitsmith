import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InitError, initProject, serverCommand } from "../../src/project/init.js";
import { copyFixtureProject } from "../helpers/temp-project.js";

const adapterDir = path.resolve("tests/fixtures/mini-kit-adapter");
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-init-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
const blocks = (s: string) => s.split("<!-- kitsmith:start -->").length - 1;

describe("initProject", () => {
  it("init on empty dir writes five files", async () => {
    const { written, snippets } = await initProject({ projectDir: dir, adapterDir });
    expect(written.map((w) => w.replace(/\\/g, "/")).sort()).toEqual([".gitignore", ".kitsmith/config.json", ".mcp.json", "AGENTS.md", "CLAUDE.md"]);
    expect(JSON.parse(read(".kitsmith/config.json")).adapter).toBe(adapterDir);
    expect(read("AGENTS.md")).toContain("find_component");
    const server = JSON.parse(read(".mcp.json")).mcpServers.kitsmith;
    expect(server.command).toBe("node"); // the repo checkout is not inside node_modules
    expect(server.args).toEqual([path.resolve("dist", "cli.js"), "serve", "--project", "."]);
    expect(snippets).toContain(JSON.stringify(path.resolve("dist", "cli.js")));
    expect(snippets).toContain("[mcp_servers.kitsmith]");
    expect(snippets).toContain("opencode");
  });

  it("init preserves existing mcp servers", async () => {
    fs.writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));
    await initProject({ projectDir: dir, adapterDir });
    const servers = JSON.parse(read(".mcp.json")).mcpServers;
    expect(servers.other).toEqual({ command: "x" });
    expect(servers.kitsmith).toBeDefined();
  });

  it("init preserves user text in AGENTS.md and is idempotent", async () => {
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# My rules\n\nBe nice.\n");
    await initProject({ projectDir: dir, adapterDir });
    const once = read("AGENTS.md");
    await initProject({ projectDir: dir, adapterDir });
    const twice = read("AGENTS.md");
    expect(twice).toBe(once);
    expect(blocks(twice)).toBe(1);
    expect(twice).toContain("# My rules\n\nBe nice.");
  });

  it("CLAUDE.md gets @AGENTS.md once", async () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Notes\n");
    await initProject({ projectDir: dir, adapterDir });
    await initProject({ projectDir: dir, adapterDir });
    const c = read("CLAUDE.md");
    expect(c).toContain("# Notes");
    expect(c.split("@AGENTS.md").length - 1).toBe(1);
  });
});

describe("initProject .gitignore", () => {
  it("creates .gitignore with .kitsmith/ when none exists", async () => {
    await initProject({ projectDir: dir, adapterDir });
    expect(read(".gitignore")).toBe(".kitsmith/\n");
  });

  it("appends .kitsmith/ to an existing .gitignore once", async () => {
    fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules/");
    await initProject({ projectDir: dir, adapterDir });
    await initProject({ projectDir: dir, adapterDir });
    expect(read(".gitignore")).toBe("node_modules/\n.kitsmith/\n");
  });

  it("leaves a .gitignore that already ignores .kitsmith untouched", async () => {
    fs.writeFileSync(path.join(dir, ".gitignore"), ".kitsmith\ndist/\n");
    await initProject({ projectDir: dir, adapterDir });
    expect(read(".gitignore")).toBe(".kitsmith\ndist/\n");
  });
});

describe("initProject invalid .mcp.json", () => {
  for (const [label, content] of [["malformed", "{ nope"], ["array", "[]"], ["null", "null"], ["bad mcpServers", '{"mcpServers": []}']]) {
    it(`${label}: throws InitError and writes nothing`, async () => {
      fs.writeFileSync(path.join(dir, ".mcp.json"), content);
      await expect(initProject({ projectDir: dir, adapterDir })).rejects.toThrow(InitError);
      expect(fs.readdirSync(dir)).toEqual([".mcp.json"]);
      expect(read(".mcp.json")).toBe(content);
    });
  }
});

describe("initProject index pre-build", () => {
  it("warms the index cache when the kit is installed", async () => {
    const proj = copyFixtureProject();
    try {
      await initProject({ projectDir: proj.dir, adapterDir });
      const cached = fs.readdirSync(path.join(proj.dir, ".kitsmith")).filter((f) => f.startsWith("index-"));
      expect(cached).toHaveLength(1);
    } finally {
      proj.cleanup();
    }
  });

  it("skips silently when the kit is not installed", async () => {
    await initProject({ projectDir: dir, adapterDir });
    expect(fs.readdirSync(path.join(dir, ".kitsmith"))).toEqual(["config.json"]);
  });
});

describe("serverCommand", () => {
  it("uses npx when the package lives inside node_modules", () => {
    const root = path.join(path.sep, "proj", "node_modules", "kitsmith");
    expect(serverCommand(root)).toEqual({ command: "npx", args: ["kitsmith", "serve", "--project", "."] });
  });
  it("points node at dist/cli.js for a checkout", () => {
    const root = path.resolve(path.sep, "src", "kitsmith");
    expect(serverCommand(root)).toEqual({ command: "node", args: [path.join(root, "dist", "cli.js"), "serve", "--project", "."] });
  });
});
