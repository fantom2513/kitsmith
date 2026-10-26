import path from "node:path";
import { Project, ts } from "ts-morph";
import type { Node, Symbol as MorphSymbol, Type } from "ts-morph";
import type { ComponentEntry, PropEntry } from "./types.js";

export interface ExtractOptions {
  projectDir: string;
  packageName: string;
  typesEntry: string; // relative to the package dir
}

const MAX_TYPE_LENGTH = 200;
/** ALL_CAPS names (e.g. PRESENTED_IMAGE_404) are constants, not components. */
const isConstantName = (name: string) => /^[A-Z][A-Z0-9_]*$/.test(name) && (name.includes("_") || name.length > 1);
const REACT_TYPES_RE = /[\/]@types[\/]react[\/]/;

export function extractComponents(opts: ExtractOptions): ComponentEntry[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: false,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      types: [], // do not auto-include every @types/* package
    },
  });
  const entry = path.join(opts.projectDir, "node_modules", opts.packageName, opts.typesEntry);
  const sourceFile = project.addSourceFileAtPath(entry);
  const checker = project.getTypeChecker();
  const tsChecker = checker.compilerObject;

  const docOf = (symbol: MorphSymbol): string | undefined => {
    const text = ts.displayPartsToString(symbol.compilerSymbol.getDocumentationComment(tsChecker)).trim();
    return text === "" ? undefined : text;
  };
  const tagOf = (symbol: MorphSymbol, tag: string): string | undefined => {
    const found = symbol.compilerSymbol.getJsDocTags(tsChecker).find((t) => t.name === tag);
    return found ? ts.displayPartsToString(found.text).trim() : undefined;
  };
  const renderType = (type: Type, at: Node, optional: boolean): string => {
    let text = type.getText(at, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    if (optional) text = text.replace(/^undefined \| /, "").replace(/ \| undefined$/, "");
    return text.length > MAX_TYPE_LENGTH ? text.slice(0, MAX_TYPE_LENGTH - 1) + "…" : text;
  };

  /** The props type of a component-like type, or undefined if it is not a component. */
  const propsTypeOf = (type: Type, at: Node): Type | undefined => {
    // React Context objects expose callable Provider/Consumer but are not components.
    if (type.getProperty("Provider") && type.getProperty("Consumer")) return undefined;
    const signatures = [...type.getCallSignatures(), ...type.getConstructSignatures()];
    for (const sig of signatures) {
      const param = sig.getParameters()[0];
      if (param) return param.getTypeAtLocation(at);
    }
    return undefined;
  };

  const buildEntry = (name: string, symbol: MorphSymbol, at: Node, propsType: Type): ComponentEntry => {
    const props: PropEntry[] = [];
    let extendsHtmlAttributes = false;
    for (const p of propsType.getProperties()) {
      const decls = p.getDeclarations();
      if (decls.length > 0 && decls.every((d) => REACT_TYPES_RE.test(d.getSourceFile().getFilePath()))) {
        extendsHtmlAttributes = true;
        continue;
      }
      const optional = p.isOptional();
      const entry: PropEntry = {
        name: p.getName(),
        type: renderType(p.getTypeAtLocation(at), at, optional),
        required: !optional,
      };
      const description = docOf(p);
      if (description !== undefined) entry.description = description;
      const def = tagOf(p, "default");
      if (def !== undefined && def !== "") entry.default = def;
      const deprecated = tagOf(p, "deprecated");
      if (deprecated !== undefined) entry.deprecated = deprecated;
      props.push(entry);
    }
    props.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const component: ComponentEntry = { name, props, subcomponents: [], extendsHtmlAttributes };
    const description = docOf(symbol);
    if (description !== undefined) component.description = description;
    const deprecated = tagOf(symbol, "deprecated");
    if (deprecated !== undefined) component.deprecated = deprecated;
    return component;
  };

  const results: ComponentEntry[] = [];
  for (const [exportName, declarations] of sourceFile.getExportedDeclarations()) {
    if (!/^[A-Z]/.test(exportName) || isConstantName(exportName)) continue;
    for (const decl of declarations) {
      // Only value declarations can be components (skips interfaces / type aliases).
      if (!(decl.getKindName() === "VariableDeclaration" || decl.getKindName() === "FunctionDeclaration" || decl.getKindName() === "ClassDeclaration")) continue;
      const symbol = decl.getSymbol();
      if (!symbol) continue;
      const type = symbol.getTypeAtLocation(decl);
      const propsType = propsTypeOf(type, decl);
      if (!propsType) continue;

      const entry = buildEntry(exportName, symbol, decl, propsType);
      results.push(entry);

      // Subcomponents: one level deep, uppercase static properties that are components themselves.
      for (const member of type.getProperties()) {
        const memberName = member.getName();
        if (!/^[A-Z]/.test(memberName) || isConstantName(memberName)) continue;
        const memberType = member.getTypeAtLocation(decl);
        const memberProps = propsTypeOf(memberType, decl);
        if (!memberProps) continue;
        const fullName = `${exportName}.${memberName}`;
        entry.subcomponents.push(fullName);
        results.push(buildEntry(fullName, member, decl, memberProps));
      }
      entry.subcomponents.sort();
      break;
    }
  }
  return results.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
