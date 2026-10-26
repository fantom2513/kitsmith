import path from "node:path";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findRecipe, getGuideline } from "../docs/docs.js";
import { formatReport, validateProject } from "../validate/validate.js";
import type { ServerContext } from "./context.js";
import { formatComponent, formatDoc, formatHits, formatList, formatTokens } from "./format.js";
import { ladderFindSentence, ladderPropsSentence, ladderValidateSentence, renderLadder } from "./ladder.js";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function safe(fn: () => string | Promise<string>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: await fn() }] };
  } catch (e) {
    const err = e as Error;
    return { content: [{ type: "text", text: `${err.name ?? "Error"}: ${err.message ?? String(e)}` }], isError: true };
  }
}

export function createServer(ctx: ServerContext): McpServer {
  const { adapter, index, search, projectDir } = ctx;
  const kit = adapter.config.name;
  const server = new McpServer(
    { name: "kitsmith", version: "0.1.0" },
    { instructions: renderLadder(kit, adapter.config.allowedExternal ?? []) },
  );

  server.registerTool(
    "find_component",
    {
      description: `Find ${kit} components matching a UI intent, ranked by relevance. ${ladderFindSentence()}`,
      inputSchema: { intent: z.string(), limit: z.number().int().positive().optional() },
    },
    ({ intent, limit }) => safe(() => formatHits(search.find(intent, limit))),
  );

  server.registerTool(
    "get_component",
    {
      description: `Get the exact props, subcomponents and a usage example of a ${kit} component. ${ladderPropsSentence()}`,
      inputSchema: { name: z.string() },
    },
    ({ name }) =>
      safe(() => {
        const c = index.components.find((x) => x.name === name);
        if (!c) {
          const near = search.find(name, 3).map((h) => h.name);
          return near.length > 0
            ? `Unknown component "${name}". Closest: ${near.join(", ")}.`
            : `Unknown component "${name}". Use find_component or list_components.`;
        }
        return formatComponent(c, adapter.examples[c.name]);
      }),
  );

  server.registerTool(
    "list_components",
    {
      description: `List all ${kit} components grouped by category, optionally for one category.`,
      inputSchema: { category: z.string().optional() },
    },
    ({ category }) => safe(() => formatList(index, category)),
  );

  server.registerTool(
    "get_recipe",
    {
      description: `Get a known composition of ${kit} components for a UI intent.`,
      inputSchema: { intent: z.string() },
    },
    ({ intent }) =>
      safe(() => {
        const r = findRecipe(adapter.recipes, intent);
        return r ? formatDoc(r) : "No recipe. Compose from components found by find_component.";
      }),
  );

  server.registerTool(
    "get_guidelines",
    {
      description: `Get usage guidelines for ${kit} on a topic; without a topic, list the available topics.`,
      inputSchema: { topic: z.string().optional() },
    },
    ({ topic }) =>
      safe(() => {
        if (!topic) {
          if (adapter.guidelines.length === 0) return "No guidelines available.";
          return adapter.guidelines.map((g) => `- ${g.slug} — ${g.title}`).join("\n");
        }
        const g = getGuideline(adapter.guidelines, topic);
        return g ? formatDoc(g) : `No guideline for "${topic}". Call get_guidelines without a topic to list topics.`;
      }),
  );

  server.registerTool(
    "get_tokens",
    {
      description: `Get design tokens of ${kit} as key: value lines, optionally filtered by key prefix.`,
      inputSchema: { prefix: z.string().optional() },
    },
    ({ prefix }) =>
      safe(async () => {
        if (!adapter.extractTokens) return "Token extraction is not configured for this kit.";
        const requireFromProject = createRequire(path.join(projectDir, "package.json"));
        return formatTokens(await adapter.extractTokens({ projectDir, requireFromProject }), prefix);
      }),
  );

  server.registerTool(
    "validate",
    {
      description: `Typecheck the project and detect hand-rolled duplicates of ${kit} components. ${ladderValidateSentence()}`,
      inputSchema: { files: z.array(z.string()).optional() },
    },
    ({ files }) => safe(() => formatReport(validateProject(adapter, projectDir, files))),
  );

  return server;
}
