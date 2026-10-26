import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadAdapter } from "../../src/adapter/load.js";
import { validateProject, formatReport } from "../../src/validate/validate.js";
import { copyFixtureProject, fixtureProjectDir } from "../helpers/temp-project.js";

const NL = String.fromCharCode(10);
const adapterDir =path.resolve(fixtureProjectDir, "../mini-kit-adapter");

async function withProject(fn: (dir: string, adapter: Awaited<ReturnType<typeof loadAdapter>>) => void) {
  const adapter = await loadAdapter(adapterDir);
  const { dir, cleanup } = copyFixtureProject();
  try {
    fn(dir, adapter);
  } finally {
    cleanup();
  }
}

describe("validateProject", () => {
  it("report groups findings by section", () =>
    withProject((dir, adapter) => {
      const text = formatReport(validateProject(adapter, dir, ["src/bad-prop.tsx", "src/raw-button.tsx"]));
      expect(text).toContain("## Type errors");
      expect(text).toContain("src/bad-prop.tsx:");
      expect(text).toContain("## Hand-rolled duplicates of kit components");
      expect(text).toMatch(/src\/raw-button\.tsx:\d+:\d+ {2}.*→ use Button/);
      expect(text).not.toContain("## Deprecated usage");
      expect(text.indexOf("## Type errors")).toBeLessThan(text.indexOf("## Hand-rolled"));
    }));

  it("lists deprecated usage in its own section", () =>
    withProject((dir, adapter) => {
      const text = formatReport(validateProject(adapter, dir, ["src/deprecated.tsx"]));
      expect(text).toContain("## Deprecated usage");
    }));

  it("clean file reports no problems", () =>
    withProject((dir, adapter) => {
      const r = validateProject(adapter, dir, ["src/good.tsx"]);
      expect(formatReport(r)).toBe("No problems found in 1 file(s).");
      expect(r.complete).toBe(true);
    }));

  it("missing file", () =>
    withProject((dir, adapter) => {
      const r = validateProject(adapter, dir, ["src/nope.tsx"]);
      expect(r.notes).toContain("File not found: src/nope.tsx");
      expect(r.filesChecked).toEqual([]);
      expect(r.complete).toBe(false);
      expect(formatReport(r)).toBe(["Nothing was validated.", "", "## Notes", "- File not found: src/nope.tsx"].join(NL));
    }));

  it("file outside tsconfig", () =>
    withProject((dir, adapter) => {
      fs.mkdirSync(path.join(dir, "scripts"));
      fs.copyFileSync(path.join(dir, "src/raw-button.tsx"), path.join(dir, "scripts/outside.tsx"));
      const r = validateProject(adapter, dir, ["scripts/outside.tsx"]);
      expect(r.notes).toContain("Not part of tsconfig, type check skipped: scripts/outside.tsx");
      expect(r.detectorFindings.some((f) => f.file === "scripts/outside.tsx")).toBe(true);
    }));

  it("no tsx files", () =>
    withProject((dir, adapter) => {
      fs.rmSync(path.join(dir, "src"), { recursive: true });
      fs.mkdirSync(path.join(dir, "src"));
      const r = validateProject(adapter, dir);
      expect(r.notes).toContain("No .tsx files found under src/.");
      expect(r.complete).toBe(false);
      expect(formatReport(r).startsWith("Nothing was validated.")).toBe(true);
    }));

  it("broken tsconfig becomes a note and the detector still runs", () =>
    withProject((dir, adapter) => {
      fs.rmSync(path.join(dir, "tsconfig.json"));
      const r = validateProject(adapter, dir, ["src/raw-button.tsx"]);
      expect(r.notes.some((n) => n.includes("tsconfig.json not found"))).toBe(true);
      expect(r.detectorFindings.length).toBeGreaterThan(0);
    }));

  it("defaults to all src tsx files", () =>
    withProject((dir, adapter) => {
      const r = validateProject(adapter, dir);
      expect(r.filesChecked).toContain("src/good.tsx");
      expect(r.filesChecked.length).toBeGreaterThanOrEqual(7);
    }));

  it("clean file with broken tsconfig is not reported as fully clean", () =>
    withProject((dir, adapter) => {
      fs.rmSync(path.join(dir, "tsconfig.json"));
      const r = validateProject(adapter, dir, ["src/good.tsx"]);
      expect(r.complete).toBe(false);
      const text = formatReport(r);
      expect(text.split(NL)[0]).toBe(
        "No problems found in 1 file(s), but the type check did not run for some files (see Notes).",
      );
      expect(text).toContain(["## Notes", "- Type check skipped: Cannot typecheck: tsconfig.json not found"].join(NL));
    }));

  it("parse errors go to Detector errors, not duplicates", () =>
    withProject((dir, adapter) => {
      fs.writeFileSync(path.join(dir, "src/broken.tsx"), "const x = <div>;");
      const text = formatReport(validateProject(adapter, dir, ["src/broken.tsx"]));
      expect(text).toContain("## Detector errors");
      expect(text).not.toContain("## Hand-rolled");
      expect(text).not.toContain("→ use");
    }));
});
