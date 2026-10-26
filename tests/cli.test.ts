import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copyFixtureProject } from "./helpers/temp-project.js";

// Spawns node with tsx's own cli.mjs instead of `npx tsx` (no shell, no npx.cmd quirks on Windows).
const root = path.resolve(".");
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const adapter = "tests/fixtures/mini-kit-adapter";
const project = "tests/fixtures/mini-kit-project";

function cli(args: string[]) {
  const r = spawnSync(process.execPath, [tsxCli, path.join(root, "src/cli.ts"), ...args], { cwd: root, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe("cli", () => {
  it("cli index prints component count", () => {
    // run against a copy so the index cache is not written into the shared fixture
    const { dir, cleanup } = copyFixtureProject();
    try {
      const r = cli(["index", "--adapter", adapter, "--project", dir]);
      expect(r.out).toMatch(/Indexed 7 components of mini-kit@/);
      expect(r.code).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("cli serve without adapter or config exits 1 with No adapter", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-cli-"));
    try {
      const r = cli(["serve", "--project", tmp]);
      expect(r.code).toBe(1);
      expect(r.err).toContain("No adapter");
      expect(r.out).toBe("");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("cli validate exits 1 on raw-button.tsx, 0 on good.tsx, 2 for a missing file", () => {
    const base = ["--adapter", adapter, "--project", project];
    expect(cli(["validate", "src/raw-button.tsx", ...base]).code).toBe(1);
    expect(cli(["validate", "src/good.tsx", ...base]).code).toBe(0);
    expect(cli(["validate", "src/nope.tsx", ...base]).code).toBe(2);
  });

  it("cli prints a one-line error for a bad adapter dir", () => {
    const r = cli(["index", "--adapter", "tests/does-not-exist", "--project", project]);
    expect(r.code).toBe(1);
    expect(r.err).not.toContain("    at ");
  });
});
