import { describe, it, expect } from "vitest";
import { runTypecheck } from "../../src/validate/typecheck.js";
import { fixtureProjectDir } from "../helpers/temp-project.js";

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
});
