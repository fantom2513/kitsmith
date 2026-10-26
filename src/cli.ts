#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AdapterLoadError, loadAdapter } from "./adapter/load.js";
import { KitNotInstalledError, loadOrBuildIndex } from "./index/build.js";
import { initProject } from "./project/init.js";
import { buildContext } from "./server/context.js";
import { createServer } from "./server/server.js";
import { TypecheckConfigError } from "./validate/typecheck.js";
import { formatReport, validateProject } from "./validate/validate.js";

class UsageError extends Error {}

function resolveAdapterDir(adapter: string | undefined, projectDir: string): string {
  if (adapter) return path.resolve(adapter);
  const cfg = path.join(projectDir, ".kitsmith", "config.json");
  if (fs.existsSync(cfg)) {
    try {
      const a = (JSON.parse(fs.readFileSync(cfg, "utf8")) as { adapter?: string }).adapter;
      if (a) return path.resolve(projectDir, a);
    } catch {
      throw new UsageError(`Cannot parse ${cfg}.`);
    }
  }
  throw new UsageError("No adapter: pass --adapter <dir> or run `kitsmith init --adapter <dir>` in the project first.");
}

const program = new Command().name("kitsmith").description("MCP server and CLI that helps coding agents build UI from a React kit");

program
  .command("index")
  .description("Build (or load) the component index of the kit")
  .requiredOption("--adapter <dir>", "adapter directory")
  .option("--project <dir>", "project directory", ".")
  .option("--rebuild", "ignore the cache")
  .action(async (o: { adapter: string; project: string; rebuild?: boolean }) => {
    const projectDir = path.resolve(o.project);
    const adapter = await loadAdapter(path.resolve(o.adapter));
    const index = loadOrBuildIndex(adapter, projectDir, { rebuild: o.rebuild });
    console.log(`Indexed ${index.components.length} components of ${index.package}@${index.version}`);
  });

program
  .command("serve")
  .description("Run the MCP server over stdio")
  .option("--adapter <dir>", "adapter directory (default: from .kitsmith/config.json)")
  .option("--project <dir>", "project directory", ".")
  .action(async (o: { adapter?: string; project: string }) => {
    const projectDir = path.resolve(o.project);
    const ctx = await buildContext(resolveAdapterDir(o.adapter, projectDir), projectDir);
    await createServer(ctx).connect(new StdioServerTransport());
    console.error(`kitsmith: serving ${ctx.adapter.config.name} for ${projectDir}`);
  });

program
  .command("init")
  .description("Set up AGENTS.md, CLAUDE.md and .mcp.json in a project")
  .requiredOption("--adapter <dir>", "adapter directory")
  .option("--project <dir>", "project directory", ".")
  .action(async (o: { adapter: string; project: string }) => {
    const { written, snippets } = await initProject({ projectDir: o.project, adapterDir: o.adapter });
    console.log(`Wrote: ${written.join(", ")}\n\n${snippets}`);
  });

program
  .command("validate")
  .description("Type-check files and detect hand-rolled duplicates of kit components")
  .argument("[files...]", "files to check (default: all .tsx under src/)")
  .option("--adapter <dir>", "adapter directory (default: from .kitsmith/config.json)")
  .option("--project <dir>", "project directory", ".")
  .action(async (files: string[], o: { adapter?: string; project: string }) => {
    const projectDir = path.resolve(o.project);
    const adapter = await loadAdapter(resolveAdapterDir(o.adapter, projectDir));
    const report = validateProject(adapter, projectDir, files.length > 0 ? files : undefined);
    console.log(formatReport(report));
    // 1 = findings, 2 = nothing found but the check was incomplete, 0 = clean and complete
    if (report.typeFindings.length > 0 || report.detectorFindings.length > 0) process.exitCode = 1;
    else if (!report.complete) process.exitCode = 2;
  });

// `kitsmith new` is wired in Task 11.

const KNOWN_ERRORS = [UsageError, AdapterLoadError, KitNotInstalledError, TypecheckConfigError];

program.parseAsync(process.argv).catch((e: unknown) => {
  const known = KNOWN_ERRORS.some((C) => e instanceof C) || (e instanceof Error && /^Cannot parse /.test(e.message));
  if (known) console.error(`kitsmith: ${(e as Error).message}`);
  else console.error(`kitsmith: unexpected error: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  process.exit(1);
});
