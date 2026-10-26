import { describe, it, expect } from "vitest";
import path from "node:path";
import type { Rule } from "eslint";
import { loadAdapter } from "../../src/adapter/load.js";
import type { DetectorRule, LoadedAdapter } from "../../src/adapter/types.js";
import { runDetector } from "../../src/validate/detector.js";
import { ruleHelpers } from "../../src/validate/rule-helpers.js";
import { fixtureProjectDir } from "../helpers/temp-project.js";

const adapterDir = path.resolve(fixtureProjectDir, "../mini-kit-adapter");
const run = async (file: string, adapter?: LoadedAdapter) =>
  runDetector(fixtureProjectDir, [file], adapter ?? (await loadAdapter(adapterDir)));

describe("runDetector", () => {
  it("flags a raw <button> with the suggested component", async () => {
    const f = await run("src/raw-button.tsx");
    expect(f).toHaveLength(1);
    expect(f[0].ruleId).toBe("raw-button");
    expect(f[0].suggest).toBe("Button");
    expect(f[0].file).toBe("src/raw-button.tsx");
    expect(f[0].line).toBe(1);
    expect(f[0].column).toBeGreaterThan(0);
  });

  it("reports nothing for composed kit components", async () => {
    expect(await run("src/composed.tsx")).toEqual([]);
  });

  it("reports nothing for an allowed external component", async () => {
    expect(await run("src/external.tsx")).toEqual([]);
  });

  it("isolates a crashing rule and still runs the others", async () => {
    const adapter = await loadAdapter(adapterDir);
    const crash: DetectorRule = {
      id: "boom",
      suggest: "",
      description: "throws",
      rule: {
        meta: { schema: [] },
        create(): Rule.RuleListener {
          throw new Error("kaput");
        },
      },
    };
    const f = await run("src/raw-button.tsx", { ...adapter, rules: [crash, ...adapter.rules] });
    expect(f.map((x) => x.ruleId).sort()).toEqual(["kitsmith/rule-error", "raw-button"]);
    expect(f.find((x) => x.ruleId === "kitsmith/rule-error")!.message).toContain("boom");
  });

  it("returns a finding for a missing file rather than crashing", async () => {
    const f = await run("src/nope.tsx");
    expect(f).toHaveLength(1);
    expect(f[0].ruleId).toBe("kitsmith/read-error");
  });
});

describe("ruleHelpers.isAllowedExternal / isKitElement", () => {
  it("classifies elements by import source", async () => {
    const seen: Record<string, { external: boolean; kit: boolean }> = {};
    const probe: DetectorRule = {
      id: "probe",
      suggest: "",
      description: "",
      rule: {
        meta: { schema: [] },
        create(context) {
          return {
            JSXOpeningElement(node) {
              const name = ruleHelpers.jsxName(node)!;
              seen[name] = {
                external: ruleHelpers.isAllowedExternal(context, node),
                kit: ruleHelpers.isKitElement(context, node),
              };
            },
          };
        },
      },
    };
    const adapter = await loadAdapter(adapterDir);
    await runDetector(fixtureProjectDir, ["src/external.tsx", "src/good.tsx"], { ...adapter, rules: [probe] });
    expect(seen.Chart).toEqual({ external: true, kit: false });
    expect(seen.Button).toEqual({ external: false, kit: true });
    expect(seen.div).toEqual({ external: false, kit: false });
  });
});
