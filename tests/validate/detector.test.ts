import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
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

describe("runDetector robustness", () => {
  const withSource = (src: string, rules: DetectorRule[] | "adapter") => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-det-"));
    fs.writeFileSync(path.join(dir, "a.tsx"), src);
    return loadAdapter(adapterDir).then((a) => {
      try {
        return runDetector(dir, ["a.tsx"], { ...a, rules: rules === "adapter" ? a.rules : rules });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  };

  it("ignores foreign eslint directives", async () => {
    const src = [
      "// eslint-disable-next-line react-hooks/exhaustive-deps",
      "/* eslint-disable no-unused-vars */",
      "export const A = () => <div />;",
    ].join("\n");
    expect(await withSource(src, "adapter")).toEqual([]);
  });

  it("reports parse errors with and without rules", async () => {
    const with_ = await withSource("export const A = () => <div>;", "adapter");
    expect(with_.map((f) => f.ruleId)).toEqual(["kitsmith/parse-error"]);
    const without = await withSource("export const A = () => <div>;", []);
    expect(without.map((f) => f.ruleId)).toEqual(["kitsmith/parse-error"]);
  });
});

describe("ruleHelpers childElements / attrExpressionType", () => {
  it("lists element children and the attr expression type", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitsmith-det-"));
    fs.writeFileSync(
      path.join(dir, "a.tsx"),
      `export const A = (p: {x: boolean}) => (
  <Card title="t" extra={p.x ? 1 : 2}>
    text
    {p.x}
    <Button />
    <Input.TextArea />
  </Card>
);`,
    );
    const out: { kids: (string | undefined)[]; title?: string; extra?: string; none?: string } = { kids: [] };
    const probe: DetectorRule = {
      id: "probe",
      suggest: "",
      description: "",
      rule: {
        meta: { schema: [] },
        create() {
          return {
            JSXOpeningElement(node: any) {
              if (ruleHelpers.jsxName(node) !== "Card") return;
              out.kids = ruleHelpers.childElements(node).map((c) => ruleHelpers.jsxName(c));
              out.title = ruleHelpers.attrExpressionType(node, "title");
              out.extra = ruleHelpers.attrExpressionType(node, "extra");
              out.none = ruleHelpers.attrExpressionType(node, "nope");
            },
          } as Rule.RuleListener;
        },
      },
    };
    try {
      runDetector(dir, ["a.tsx"], { ...(await loadAdapter(adapterDir)), rules: [probe] });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    expect(out).toEqual({ kids: ["Button", "Input.TextArea"], title: "Literal", extra: "ConditionalExpression", none: undefined });
  });
});
