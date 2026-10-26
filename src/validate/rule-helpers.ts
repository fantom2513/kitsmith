import type { Rule } from "eslint";

/** Minimal structural views of the JSX AST nodes the helpers touch (ESLint's types are ESTree-only). */
interface JsxNameNode {
  type: string;
  name?: string;
  object?: JsxNameNode;
  property?: JsxNameNode;
}
export interface JsxElementNode {
  name: JsxNameNode;
  attributes: Array<{ type: string; name?: { name?: string }; value?: any }>;
}

type Context = Rule.RuleContext;

function kitsmithSettings(context: Context): { kitPackage?: string; allowedExternal: string[] } {
  const s = (context.settings?.kitsmith ?? {}) as { kitPackage?: string; allowedExternal?: string[] };
  return { kitPackage: s.kitPackage, allowedExternal: s.allowedExternal ?? [] };
}

function nameOf(n: JsxNameNode): string | undefined {
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXMemberExpression" && n.object && n.property) {
    const o = nameOf(n.object);
    const p = nameOf(n.property);
    return o && p ? `${o}.${p}` : undefined;
  }
  return undefined; // JSXNamespacedName etc.
}

const matchesPackage = (source: string, pkg: string) => source === pkg || source.startsWith(`${pkg}/`);

export interface RuleHelpers {
  /** "button", "Button" or "Input.TextArea"; undefined for namespaced names. */
  jsxName(node: JsxElementNode): string | undefined;
  /** True for lowercase host elements such as <button>. */
  isIntrinsic(node: JsxElementNode): boolean;
  /** Module specifier a local identifier was imported from, if any. */
  importSource(context: Context, localName: string): string | undefined;
  /** True if the element's root identifier is imported from settings.kitsmith.kitPackage. */
  isKitElement(context: Context, node: JsxElementNode): boolean;
  /** True if the element's root identifier is imported from a settings.kitsmith.allowedExternal package. */
  isAllowedExternal(context: Context, node: JsxElementNode): boolean;
  getAttr(node: JsxElementNode, name: string): JsxElementNode["attributes"][number] | undefined;
  /** Keys of an inline object literal passed as style={{ ... }}. */
  styleKeys(node: JsxElementNode): string[];
}

export const ruleHelpers: RuleHelpers = {
  jsxName: (node) => nameOf(node.name),

  isIntrinsic(node) {
    const n = nameOf(node.name);
    return node.name.type === "JSXIdentifier" && n !== undefined && /^[a-z]/.test(n);
  },

  importSource(context, localName) {
    for (const stmt of context.sourceCode.ast.body) {
      if (stmt.type !== "ImportDeclaration") continue;
      if (stmt.specifiers.some((s) => s.local.name === localName)) return String(stmt.source.value);
    }
    return undefined;
  },

  isKitElement(context, node) {
    const { kitPackage } = kitsmithSettings(context);
    const root = nameOf(node.name)?.split(".")[0];
    if (!kitPackage || !root || ruleHelpers.isIntrinsic(node)) return false;
    const src = ruleHelpers.importSource(context, root);
    return src !== undefined && matchesPackage(src, kitPackage);
  },

  isAllowedExternal(context, node) {
    const { allowedExternal } = kitsmithSettings(context);
    const root = nameOf(node.name)?.split(".")[0];
    if (!root || ruleHelpers.isIntrinsic(node)) return false;
    const src = ruleHelpers.importSource(context, root);
    return src !== undefined && allowedExternal.some((p) => matchesPackage(src, p));
  },

  getAttr: (node, name) => node.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === name),

  styleKeys(node) {
    const attr = ruleHelpers.getAttr(node, "style");
    const expr = attr?.value?.type === "JSXExpressionContainer" ? attr.value.expression : undefined;
    if (expr?.type !== "ObjectExpression") return [];
    const keys: string[] = [];
    for (const p of expr.properties) {
      if (p.type !== "Property") continue;
      if (p.key.type === "Identifier" && !p.computed) keys.push(p.key.name);
      else if (p.key.type === "Literal") keys.push(String(p.key.value));
    }
    return keys;
  },
};
