import path from "node:path";
import ts from "typescript";

export interface TypeFinding {
  file: string; // relative to projectDir, "/" separators
  line: number;
  column: number;
  code: number;
  message: string;
  kind: "unknown-prop" | "deprecated" | "type-error";
}

const DEPRECATED_CODES = new Set([6385, 6387]);

interface Project {
  service: ts.LanguageService;
  program: ts.Program;
}

function createProject(projectDir: string): Project {
  const configPath = path.join(projectDir, "tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, " "));
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, projectDir);
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => parsed.options,
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: () => "0",
    getScriptSnapshot: (f) => {
      const text = ts.sys.readFile(f);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => projectDir,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  return { service, program: service.getProgram()! };
}

function isInImport(sf: ts.SourceFile, pos: number): boolean {
  const visit = (node: ts.Node): boolean =>
    ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
      ? pos >= node.getStart(sf) && pos < node.getEnd()
      : node.getStart(sf) <= pos && pos < node.getEnd() && !!ts.forEachChild(node, (c) => visit(c) || undefined);
  return !!ts.forEachChild(sf, (c) => visit(c) || undefined);
}

const toRel = (projectDir: string, file: string) =>
  path.relative(projectDir, file).split(path.sep).join("/");

export function runTypecheck(projectDir: string, files?: string[]): TypeFinding[] {
  const { service, program } = createProject(projectDir);
  const wanted = files
    ? new Set(files.map((f) => toRel(projectDir, path.resolve(projectDir, f))))
    : undefined;
  const findings: TypeFinding[] = [];

  for (const sf of program.getSourceFiles()) {
    if (program.isSourceFileFromExternalLibrary(sf) || program.isSourceFileDefaultLibrary(sf)) continue;
    const rel = toRel(projectDir, sf.fileName);
    if (rel.startsWith("..") || rel.split("/").includes("node_modules")) continue;
    if (wanted && !wanted.has(rel)) continue;

    const diagnostics: readonly ts.Diagnostic[] = [
      ...service.getSyntacticDiagnostics(sf.fileName),
      ...service.getSemanticDiagnostics(sf.fileName),
      ...service.getSuggestionDiagnostics(sf.fileName).filter((d) => DEPRECATED_CODES.has(d.code)),
    ];
    for (const d of diagnostics) {
      if (d.file === undefined || d.start === undefined) continue;
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      if (DEPRECATED_CODES.has(d.code) && isInImport(d.file, d.start)) continue; // report usages, not imports
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      const kind: TypeFinding["kind"] = DEPRECATED_CODES.has(d.code)
        ? "deprecated"
        : message.includes("does not exist on type")
          ? "unknown-prop"
          : "type-error";
      findings.push({ file: rel, line: line + 1, column: character + 1, code: d.code, message, kind });
    }
  }
  return findings;
}
