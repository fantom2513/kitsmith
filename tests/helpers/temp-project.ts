import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const fixtureProjectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/mini-kit-project",
);

/**
 * Copies the fixture project to a temp dir (with a space in its path) and links
 * react / @types/react from the repo's node_modules so type resolution still works.
 * Always call `cleanup` in a finally block.
 */
export function copyFixtureProject(): { dir: string; cleanup: () => void } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kit smith "));
  const dir = path.join(tmp, "my project");
  fs.cpSync(fixtureProjectDir, dir, { recursive: true });
  const repoModules = path.resolve(fixtureProjectDir, "../../../node_modules");
  fs.mkdirSync(path.join(dir, "node_modules", "@types"), { recursive: true });
  fs.symlinkSync(path.join(repoModules, "react"), path.join(dir, "node_modules", "react"), "junction");
  fs.symlinkSync(path.join(repoModules, "@types", "react"), path.join(dir, "node_modules", "@types", "react"), "junction");
  return { dir, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}
