import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initProject } from "../../src/project/init.js";

const adapterDir = path.resolve("tests/fixtures/mini-kit-adapter");
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-init-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
const blocks = (s: string) => s.split("<!-- kitsmith:start -->").length - 1;

describe("initProject", () => {
  it("init on empty dir writes four files", async () => {
    const { written, snippets } = await initProject({ projectDir: dir, adapterDir });
    expect(written.map((w) => w.replace(/\\/g, "/")).sort()).toEqual([".kitsmith/config.json", ".mcp.json", "AGENTS.md", "CLAUDE.md"]);
    expect(JSON.parse(read(".kitsmith/config.json")).adapter).toBe(adapterDir);
    expect(read("AGENTS.md")).toContain("find_component");
    expect(JSON.parse(read(".mcp.json")).mcpServers.kitsmith.command).toBe("npx");
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
