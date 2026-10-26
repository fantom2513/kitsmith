import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runTypecheck, TypecheckConfigError } from "../../src/validate/typecheck.js";
import { copyFixtureProject, fixtureProjectDir } from "../helpers/temp-project.js";

const check = (file: string) => runTypecheck(fixtureProjectDir, [file]);

describe("runTypecheck", () => {
  it("reports no findings for good.tsx", () => {
    expect(check("src/good.tsx")).toEqual([]);
  });

  it("reports an unknown prop", () => {
    const f = check("src/bad-prop.tsx");
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe("unknown-prop");
    expect(f[0].message).toContain("colour");
    expect(f[0].file).toBe("src/bad-prop.tsx");
    expect(f[0].line).toBeGreaterThan(0);
  });

  it("reports deprecated usages", () => {
    const f = check("src/deprecated.tsx");
    expect(f).toHaveLength(2);
    expect(f.every((x) => x.kind === "deprecated")).toBe(true);
  });

  it("reports a wrong prop type as type-error", () => {
    const f = check("src/wrong-type.tsx");
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => x.kind === "type-error")).toBe(true);
  });

  it("sees a new diagnostic after a file is edited (cache invalidation)", () => {
    const { dir, cleanup } = copyFixtureProject();
    try {
      const file = path.join(dir, "src", "good.tsx");
      expect(runTypecheck(dir, ["src/good.tsx"])).toEqual([]);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("<Button ", "<Button colour=\"red\" "));
      fs.utimesSync(file, new Date(), new Date(Date.now() + 5000));
      const f = runTypecheck(dir, ["src/good.tsx"]);
      expect(f.some((x) => x.kind === "unknown-prop" && x.message.includes("colour"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("resolves files through a solution-style tsconfig with references", () => {
    const { dir, cleanup } = copyFixtureProject();
    try {
      fs.renameSync(path.join(dir, "tsconfig.json"), path.join(dir, "tsconfig.app.json"));
      fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ files: [], references: [{ path: "./tsconfig.app.json" }] }));
      const f = runTypecheck(dir, ["src/bad-prop.tsx"]);
      expect(f).toHaveLength(1);
      expect(f[0].kind).toBe("unknown-prop");
    } finally {
      cleanup();
    }
  });

  it("throws TypecheckConfigError for an empty include and a missing tsconfig", () => {
    const { dir, cleanup } = copyFixtureProject();
    try {
      fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ include: ["nothing"] }));
      expect(() => runTypecheck(dir)).toThrow(TypecheckConfigError);
      fs.rmSync(path.join(dir, "tsconfig.json"));
      expect(() => runTypecheck(dir)).toThrow(/tsconfig.json/);
    } finally {
      cleanup();
    }
  });
});
