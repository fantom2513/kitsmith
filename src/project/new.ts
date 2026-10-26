import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdapter } from "../adapter/load.js";
import { initProject } from "./init.js";

const templateDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/sandbox");

const LAYOUT_SECTION = `## Prototype layout

- Pages live in \`src/pages\`, one file per screen.
- Register every page in \`src/routes.tsx\` (give it \`handle: { title }\` to list it on Home).
- Fake data comes from \`src/mocks\` (seeded, so screens are stable); add factories there.
- \`src/kit/Provider.tsx\` wraps the app with the kit's theme and global config.
- Run \`npm run dev\` to look at it; \`npm run build\` type-checks and builds.
`;

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
}): Promise<{ dir: string }> {
  const dir = path.resolve(opts.parentDir, opts.name);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    throw new Error(`Target directory ${dir} already exists and is not empty.`);
  }
  const adapterDir = path.resolve(opts.adapterDir);
  const adapter = await loadAdapter(adapterDir);

  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(templateDir, dir, { recursive: true });

  const sandbox = adapter.config.sandbox;
  if (sandbox) fs.cpSync(path.resolve(adapterDir, sandbox.overlay), dir, { recursive: true });

  const pkgFile = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8")) as { name: string; dependencies?: Record<string, string> };
  pkg.name = opts.name;
  pkg.dependencies = { ...pkg.dependencies, ...sandbox?.dependencies };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");

  await initProject({ projectDir: dir, adapterDir });
  const agents = path.join(dir, "AGENTS.md");
  fs.writeFileSync(agents, `${fs.readFileSync(agents, "utf8").replace(/\s*$/, "")}\n\n${LAYOUT_SECTION}`);

  if (opts.install) await runInstall(dir);
  return { dir };
}
