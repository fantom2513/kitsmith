import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildContext } from "../../src/server/context.js";
import { createServer } from "../../src/server/server.js";
import { renderLadder } from "../../src/server/ladder.js";
import { copyFixtureProject, fixtureProjectDir } from "../helpers/temp-project.js";

const adapterDir = path.resolve(fixtureProjectDir, "../mini-kit-adapter");

let client: Client;
let projectDir: string;
let cleanup: () => void;

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args });
  const content = res.content as { type: string; text: string }[];
  return { text: content[0].text, isError: res.isError };
}

beforeAll(async () => {
  const proj = copyFixtureProject();
  cleanup = proj.cleanup;
  projectDir = proj.dir;
  const ctx = await buildContext(adapterDir, proj.dir);
  const server = createServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
});

afterAll(async () => {
  await client?.close();
  cleanup?.();
});

describe("mcp server", () => {
  it("lists seven tools with descriptions", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "find_component",
      "get_component",
      "get_guidelines",
      "get_recipe",
      "get_tokens",
      "list_components",
      "validate",
    ]);
    for (const t of tools) expect(t.description?.length).toBeGreaterThan(10);
  });

  it("server instructions equal the ladder", () => {
    expect(client.getInstructions()).toBe(renderLadder("mini-kit", ["mini-charts"]));
  });

  it("ladder says none without allowed externals", () => {
    expect(renderLadder("x", [])).toContain("allowed external library: none.");
  });

  it("find_component resolves a Russian intent", async () => {
    expect((await call("find_component", { intent: "переключатель" })).text.startsWith("- Segmented")).toBe(true);
  });

  it("get_component shows props table and HTML attributes note", async () => {
    const { text } = await call("get_component", { name: "Button" });
    expect(text).toContain("| size |");
    expect(text).toContain("standard HTML attributes");
  });

  it("get_component suggests the closest name", async () => {
    expect((await call("get_component", { name: "Buton" })).text).toContain("Button");
  });

  it("validate reports duplicates", async () => {
    expect((await call("validate", { files: ["src/raw-button.tsx"] })).text).toContain("→ use Button");
  });

  it("get_tokens filters by prefix", async () => {
    expect((await call("get_tokens", { prefix: "color" })).text).toBe("colorPrimary: #1677ff");
  });

  it("a thrown error becomes an isError tool result", async () => {
    fs.writeFileSync(path.join(projectDir, "tsconfig.json"), "{ not json");
    try {
      const res = await call("validate", {});
      expect(res.isError).toBe(true);
      expect(res.text.length).toBeGreaterThan(5);
    } finally {
      fs.writeFileSync(
        path.join(projectDir, "tsconfig.json"),
        fs.readFileSync(path.join(fixtureProjectDir, "tsconfig.json"), "utf8"),
      );
    }
  });
});
