import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import type { LoadedAdapter } from "../adapter/types.js";

export interface DetectorFinding {
  file: string; // relative to projectDir, "/" separators
  line: number;
  column: number;
  ruleId: string;
  message: string;
  suggest: string;
}

/** `files` are relative to projectDir. Each rule runs in its own verify call so a crashing rule is isolated. */
export function runDetector(projectDir: string, files: string[], adapter: LoadedAdapter): DetectorFinding[] {
  const linter = new Linter({ configType: "flat" });
  const findings: DetectorFinding[] = [];

  for (const rel of files) {
    const file = rel.split(path.sep).join("/");
    let source: string;
    try {
      source = fs.readFileSync(path.resolve(projectDir, rel), "utf8");
    } catch (e) {
      findings.push({
        file,
        line: 1,
        column: 1,
        ruleId: "kitsmith/read-error",
        message: `Cannot read file: ${(e as Error).message}`,
        suggest: "",
      });
      continue;
    }

    let parseErrorReported = false;
    // With no rules we still run one parse-only pass so syntax errors are reported.
    for (const r of adapter.rules.length > 0 ? adapter.rules : [undefined]) {
      const config = [
        {
          files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
          plugins: { kitsmith: { rules: r ? { [r.id]: r.rule } : {} } },
          linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
          languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaFeatures: { jsx: true } },
          },
          settings: {
            kitsmith: { kitPackage: adapter.config.package, allowedExternal: adapter.config.allowedExternal ?? [] },
          },
          rules: r ? { [`kitsmith/${r.id}`]: "error" } : {},
        },
      ] as Linter.Config[];

      let messages: Linter.LintMessage[];
      try {
        messages = linter.verify(source, config, { filename: file });
      } catch (e) {
        findings.push({
          file,
          line: 1,
          column: 1,
          ruleId: "kitsmith/rule-error",
          message: `Rule "${r?.id}" crashed: ${(e as Error).message}`,
          suggest: "",
        });
        continue;
      }

      for (const m of messages) {
        if (m.fatal) {
          if (!parseErrorReported) {
            parseErrorReported = true;
            findings.push({
              file,
              line: m.line,
              column: m.column,
              ruleId: "kitsmith/parse-error",
              message: m.message,
              suggest: "",
            });
          }
          continue;
        }
        // Ignore anything not produced by this rule (foreign directives, config messages).
        if (!r || m.ruleId !== `kitsmith/${r.id}`) continue;
        findings.push({
          file,
          line: m.line,
          column: m.column,
          ruleId: r.id,
          message: m.message,
          suggest: r.suggest,
        });
      }
    }
  }
  return findings;
}
