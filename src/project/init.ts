import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter } from "../adapter/load.js";
import { KitNotInstalledError, loadOrBuildIndex } from "../index/build.js";
import { renderLadder } from "../server/ladder.js";

export class InitError extends Error {}

const START = "<!-- kitsmith:start -->";
const END = "<!-- kitsmith:end -->";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const templatePath = path.join(packageRoot, "templates", "AGENTS.md.tpl");

/** How an agent host should start the server: via npx when installed from npm, else straight from this checkout. */
export function serverCommand(root: string): { command: string; args: string[] } {
  const installed = path.resolve(root).split(path.sep).includes("node_modules");
  const serve = ["serve", "--project", "."];
  return installed
    ? { command: "npx", args: ["kitsmith", ...serve] }
    : { command: "node", args: [path.join(path.resolve(root), "dist", "cli.js"), ...serve] };
}

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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readMcpConfig(mcpFile: string): { mcpServers?: Record<string, unknown> } {
  const text = readIfExists(mcpFile);
  if (text === undefined || text.trim() === "") return {};
  const fail = () => new InitError(`Cannot parse ${mcpFile}; fix or remove it and run init again.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw fail();
  }
  if (!isPlainObject(parsed)) throw fail();
  if (parsed.mcpServers !== undefined && !isPlainObject(parsed.mcpServers)) throw fail();
  return parsed as { mcpServers?: Record<string, unknown> };
}

/** Keeps the machine-local `.kitsmith/` cache out of version control. */
function ensureGitignored(projectDir: string, write: (rel: string, content: string) => void): void {
  const file = path.join(projectDir, ".gitignore");
  const existing = readIfExists(file);
  if (existing === undefined) return write(".gitignore", ".kitsmith/\n");
  const ignored = existing.split(/\r?\n/).some((l) => /^\/?\.kitsmith\/?\*?$/.test(l.trim()));
  if (!ignored) write(".gitignore", `${existing.replace(/\s*$/, "")}\n.kitsmith/\n`);
}

export async function initProject(opts: { projectDir: string; adapterDir: string }): Promise<{ written: string[]; snippets: string }> {
  const projectDir = path.resolve(opts.projectDir);
  const adapterDir = path.resolve(opts.adapterDir);
  const adapter = await loadAdapter(adapterDir);
  const mcp = readMcpConfig(path.join(projectDir, ".mcp.json"));
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

  const server = serverCommand(packageRoot);
  mcp.mcpServers = { ...mcp.mcpServers, kitsmith: server };
  write(".mcp.json", JSON.stringify(mcp, null, 2) + "\n");

  ensureGitignored(projectDir, write);

  // Warm the index cache so the first `serve` does not pay the cold extraction cost.
  try {
    loadOrBuildIndex(adapter, projectDir);
  } catch (e) {
    if (!(e instanceof KitNotInstalledError)) throw e;
  }

  const snippets = [
    "Codex (add to ~/.codex/config.toml):",
    "[mcp_servers.kitsmith]",
    `command = ${JSON.stringify(server.command)}`,
    `args = ${JSON.stringify(server.args)}`,
    "",
    "OpenCode (add to opencode.json):",
    JSON.stringify({ mcp: { kitsmith: { type: "local", command: [server.command, ...server.args] } } }, null, 2),
  ].join("\n");
  return { written, snippets };
}
