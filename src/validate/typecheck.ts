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

export class TypecheckConfigError extends Error {
  constructor(
    public readonly tsconfigPath: string,
    detail: string,
  ) {
    super(`Cannot typecheck: ${detail} (${tsconfigPath})`);
    this.name = "TypecheckConfigError";
  }
}

interface ResolvedConfig {
  options: ts.CompilerOptions;
  fileNames: string[];
}

const NO_INPUTS = 18003;

function parseConfigFile(configPath: string): { parsed: ts.ParsedCommandLine; raw: any } {
  if (!ts.sys.fileExists(configPath)) throw new TypecheckConfigError(configPath, "tsconfig.json not found");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new TypecheckConfigError(configPath, ts.flattenDiagnosticMessageText(read.error.messageText, " "));
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath), undefined, configPath);
  const blocking = parsed.errors.filter((e) => e.code !== NO_INPUTS);
  if (blocking.length > 0) {
    throw new TypecheckConfigError(
      configPath,
      blocking.map((e) => ts.flattenDiagnosticMessageText(e.messageText, " ")).join("; "),
    );
  }
  return { parsed, raw: read.config };
}

/** Reads tsconfig.json; for solution-style configs (references) uses the referenced configs. */
function resolveConfig(projectDir: string): ResolvedConfig {
  const configPath = path.join(projectDir, "tsconfig.json");
  const { parsed } = parseConfigFile(configPath);
  let options = parsed.options;
  const fileNames = new Set(parsed.fileNames);
  for (const ref of parsed.projectReferences ?? []) {
    const refPath = ts.sys.directoryExists(ref.path) ? path.join(ref.path, "tsconfig.json") : ref.path;
    const child = parseConfigFile(refPath).parsed;
    if (child.fileNames.length > 0 && fileNames.size === 0) options = child.options;
    child.fileNames.forEach((f) => fileNames.add(f));
  }
  if (fileNames.size === 0) {
    throw new TypecheckConfigError(configPath, "no source files matched by tsconfig include/files/references");
  }
  return { options, fileNames: [...fileNames] };
}

interface Project {
  service: ts.LanguageService;
  config: ResolvedConfig;
}

const registry = ts.createDocumentRegistry();
let cached: { dir: string; project: Project } | undefined;

const mtime = (f: string) => String(ts.sys.getModifiedTime?.(f)?.getTime() ?? 0);

function createProject(projectDir: string): Project {
  const config = resolveConfig(projectDir);
  const key = path.resolve(projectDir);
  if (cached?.dir === key) {
    cached.project.config = config; // new/removed files and option changes picked up
    return cached.project;
  }
  const project: Project = { config, service: undefined as unknown as ts.LanguageService };
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => project.config.options,
    getScriptFileNames: () => project.config.fileNames,
    getScriptVersion: mtime,
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
  project.service = ts.createLanguageService(host, registry);
  cached = { dir: key, project };
  return project;
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
  const { service, config } = createProject(projectDir);
  const known = new Set(config.fileNames.map((f) => toRel(projectDir, f)));
  const wantedEarly = files?.map((f) => toRel(projectDir, path.resolve(projectDir, f)));
  if (wantedEarly && !wantedEarly.some((f) => known.has(f))) return [];
  const program = service.getProgram()!;
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
