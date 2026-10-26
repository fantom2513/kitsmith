import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LoadedAdapter } from "../adapter/types.js";
import { loadAdapter } from "../adapter/load.js";
import { KitNotInstalledError, loadOrBuildIndex } from "../index/build.js";
import { initProject } from "./init.js";

const templateDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/sandbox");

const LAYOUT_SECTION = `## Prototype layout

- Pages live in \`src/pages\`, one file per screen.
- Register every page in \`src/routes.tsx\` (give it \`handle: { title }\` to list it on Home).
- Fake data comes from \`src/mocks\` (seeded, so screens are stable); add factories there.
- \`src/kit/Provider.tsx\` wraps the app with the kit's theme and global config.
- Run \`npm run dev\` to look at it; \`npm run build\` type-checks and builds.
`;

export class PrototypeNameError extends Error {}
export class TargetDirError extends Error {}
export class PrototypeConfigError extends Error {}
export class InstallError extends Error {}

const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

function validateName(name: string): void {
  if (name.length > 214 || !NAME_RE.test(name) || name.includes("..")) {
    throw new PrototypeNameError(
      `Invalid prototype name "${name}": use lowercase letters, digits, "-", "_" or "." (no path separators, no "..").`,
    );
  }
}

function runInstall(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install"], { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`npm install failed with exit code ${code}`))));
  });
}

export async function createPrototype(opts: {
  name: string;
  adapterDir: string;
  parentDir: string;
  install: boolean;
  /** Test seam: replaces `npm install`. */
  installer?: (dir: string) => Promise<void>;
}): Promise<{ dir: string }> {
  validateName(opts.name);
  const dir = path.resolve(opts.parentDir, opts.name);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    throw new TargetDirError(`Target directory ${dir} already exists and is not empty.`);
  }
  const adapterDir = path.resolve(opts.adapterDir);
  const adapter = await loadAdapter(adapterDir);

  const dirExisted = fs.existsSync(dir);
  try {
    await generate(dir, adapterDir, adapter, opts.name);
  } catch (e) {
    // Remove only what this call created; the pre-existing empty dir stays.
    if (dirExisted) for (const entry of fs.readdirSync(dir)) fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    else fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }

  if (opts.install) {
    try {
      await (opts.installer ?? runInstall)(dir);
    } catch (e) {
      throw new InstallError(
        `Prototype created at ${dir}, but dependency install failed (${e instanceof Error ? e.message : String(e)}). Run \`npm install\` there manually.`,
      );
    }
    // Warm the index cache so the first `serve` does not pay the cold extraction cost.
    try {
      loadOrBuildIndex(adapter, dir);
    } catch (e) {
      if (!(e instanceof KitNotInstalledError)) throw e;
    }
  }
  return { dir };
}

async function generate(dir: string, adapterDir: string, adapter: LoadedAdapter, name: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(templateDir, dir, { recursive: true });
  // npm strips files named .gitignore from published packages, so the template ships it undotted.
  const shippedIgnore = path.join(dir, "gitignore");
  if (fs.existsSync(shippedIgnore)) fs.renameSync(shippedIgnore, path.join(dir, ".gitignore"));

  const sandbox = adapter.config.sandbox;
  if (sandbox) fs.cpSync(path.resolve(adapterDir, sandbox.overlay), dir, { recursive: true });

  const pkgFile = path.join(dir, "package.json");
  let pkg: { name: string; dependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  } catch {
    throw new PrototypeConfigError(`Cannot parse ${pkgFile} in the sandbox template.`);
  }
  pkg.name = name;
  pkg.dependencies = { ...pkg.dependencies, ...sandbox?.dependencies };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");

  await initProject({ projectDir: dir, adapterDir });
  const agents = path.join(dir, "AGENTS.md");
  fs.writeFileSync(agents, `${fs.readFileSync(agents, "utf8").replace(/\s*$/, "")}\n\n${LAYOUT_SECTION}`);
}
