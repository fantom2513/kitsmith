import fs from "node:fs";
import path from "node:path";
import type { LoadedAdapter } from "../adapter/types.js";
import { runDetector, type DetectorFinding } from "./detector.js";
import { listTsconfigFiles, runTypecheck, TypecheckConfigError, type TypeFinding } from "./typecheck.js";

export interface ValidationReport {
  filesChecked: string[];
  typeFindings: TypeFinding[];
  detectorFindings: DetectorFinding[];
  notes: string[];
  /** false when nothing was checked or the type check was skipped for any checked file */
  complete: boolean;
}

const toRel = (projectDir: string, file: string) =>
  path.relative(projectDir, path.resolve(projectDir, file)).split(path.sep).join("/");

function findTsx(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findTsx(full, out);
    else if (e.isFile() && e.name.endsWith(".tsx")) out.push(full);
  }
}

export function validateProject(adapter: LoadedAdapter, projectDir: string, files?: string[]): ValidationReport {
  const report: ValidationReport = { filesChecked: [], typeFindings: [], detectorFindings: [], notes: [], complete: true };

  if (files === undefined) {
    const found: string[] = [];
    findTsx(path.join(projectDir, "src"), found);
    report.filesChecked = found.map((f) => toRel(projectDir, f)).sort();
    if (report.filesChecked.length === 0) {
      report.notes.push("No .tsx files found under src/.");
      report.complete = false;
      return report;
    }
  } else {
    for (const f of files) {
      const rel = toRel(projectDir, f);
      const abs = path.resolve(projectDir, f);
      const isFile = fs.existsSync(abs) && fs.statSync(abs).isFile();
      if (!isFile) report.notes.push(`File not found: ${rel}`);
      else if (!report.filesChecked.includes(rel)) report.filesChecked.push(rel);
    }
  }
  if (report.filesChecked.length === 0) {
    report.complete = false;
    return report;
  }

  try {
    const inProgram = listTsconfigFiles(projectDir);
    const checkable = report.filesChecked.filter((f) => {
      if (inProgram.has(f)) return true;
      report.notes.push(`Not part of tsconfig, type check skipped: ${f}`);
      report.complete = false;
      return false;
    });
    if (checkable.length > 0) report.typeFindings = runTypecheck(projectDir, checkable);
  } catch (e) {
    if (!(e instanceof TypecheckConfigError)) throw e;
    report.notes.push(`Type check skipped: ${e.message}`);
    report.complete = false;
  }

  report.detectorFindings = runDetector(projectDir, report.filesChecked, adapter);
  return report;
}

const NL = String.fromCharCode(10);
const loc =(f: { file: string; line: number; column: number }) => `${f.file}:${f.line}:${f.column}`;

export function formatReport(r: ValidationReport): string {
  const sections: string[] = [];
  const typeErrors = r.typeFindings.filter((f) => f.kind !== "deprecated");
  const deprecated = r.typeFindings.filter((f) => f.kind === "deprecated");

  if (typeErrors.length > 0) {
    sections.push(["## Type errors", ...typeErrors.map((f) => `${loc(f)}  ${f.message}`)].join("\n"));
  }
  if (deprecated.length > 0) {
    sections.push(["## Deprecated usage", ...deprecated.map((f) => `${loc(f)}  ${f.message}`)].join("\n"));
  }
  const detectorErrors = r.detectorFindings.filter((f) => f.ruleId.startsWith("kitsmith/"));
  const duplicates = r.detectorFindings.filter((f) => !f.ruleId.startsWith("kitsmith/"));
  if (duplicates.length > 0) {
    sections.push(
      [
        "## Hand-rolled duplicates of kit components",
        ...duplicates.map((f) => `${loc(f)}  ${f.message}${f.suggest ? `  → use ${f.suggest}` : ""}`),
      ].join(NL),
    );
  }
  if (detectorErrors.length > 0) {
    sections.push(["## Detector errors", ...detectorErrors.map((f) => `${loc(f)}  ${f.message}`)].join(NL));
  }
  if (sections.length === 0) {
    const n = r.filesChecked.length;
    if (n === 0) sections.push("Nothing was validated.");
    else if (r.complete) sections.push(`No problems found in ${n} file(s).`);
    else sections.push(`No problems found in ${n} file(s), but the type check did not run for some files (see Notes).`);
  }
  if (r.notes.length > 0) sections.push(["## Notes", ...r.notes.map((n) => `- ${n}`)].join(NL));
  return sections.join(NL + NL);
}
