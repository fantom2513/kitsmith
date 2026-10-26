import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter } from "../adapter/load.js";
import { renderLadder } from "../server/ladder.js";

export class InitError extends Error {}

const START = "<!-- kitsmith:start -->";
const END = "<!-- kitsmith:end -->";

const templatePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/AGENTS.md.tpl");

function readIfExists(file: string): string | undefined {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined;
}

function upsertBlock(existing: string | undefined, block: string): string {
  const wrapped = `${START}\n${block.trim()}\n${END}`;
  if (existing === undefined || existing.trim() === "") return `${wrapped}\n`;
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s !== -1 && e > s) return existing.slice(0, s) + wrapped + existing.slice(e + END.length);
  return `${existing.replace(/\s*$/, "")}\n\n${wrapped}\n`;
}

export async function initProject(opts: { projectDir: string; adapterDir: string }): Promise<{ written: string[]; snippets: string }> {
  const projectDir = path.resolve(opts.projectDir);
  const adapterDir = path.resolve(opts.adapterDir);
  const adapter = await loadAdapter(adapterDir);
  const written: string[] = [];
  const write = (rel: string, content: string) => {
    const file = path.join(projectDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    written.push(rel);
  };

  write(path.join(".kitsmith", "config.json"), JSON.stringify({ adapter: adapterDir }, null, 2) + "\n");

  const block = fs
    .readFileSync(templatePath, "utf8")
    .replace("{{LADDER}}", renderLadder(adapter.config.name, adapter.config.allowedExternal ?? []));
  write("AGENTS.md", upsertBlock(readIfExists(path.join(projectDir, "AGENTS.md")), block));

  const claude = readIfExists(path.join(projectDir, "CLAUDE.md"));
  if (claude === undefined) write("CLAUDE.md", "@AGENTS.md\n");
  else if (!/^@AGENTS\.md\s*$/m.test(claude)) write("CLAUDE.md", `${claude.replace(/\s*$/, "")}\n\n@AGENTS.md\n`);

  const mcpFile = path.join(projectDir, ".mcp.json");
  const mcpText = readIfExists(mcpFile);
  let mcp: { mcpServers?: Record<string, unknown> } = {};
  if (mcpText !== undefined && mcpText.trim() !== "") {
    try {
      mcp = JSON.parse(mcpText);
    } catch {
      throw new InitError(`Cannot parse ${mcpFile}; fix or remove it and run init again.`);
    }
  }
  mcp.mcpServers = { ...mcp.mcpServers, kitsmith: { command: "npx", args: ["kitsmith", "serve", "--project", "."] } };
  write(".mcp.json", JSON.stringify(mcp, null, 2) + "\n");

  const snippets = [
    "Codex (add to ~/.codex/config.toml):",
    "[mcp_servers.kitsmith]",
    'command = "npx"',
    'args = ["kitsmith", "serve", "--project", "."]',
    "",
    "OpenCode (add to opencode.json):",
    JSON.stringify({ mcp: { kitsmith: { type: "local", command: ["npx", "kitsmith", "serve", "--project", "."] } } }, null, 2),
  ].join("\n");
  return { written, snippets };
}
