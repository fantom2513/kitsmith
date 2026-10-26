import type { SearchHit } from "../search/components.js";
import type { ComponentEntry, KitIndex } from "../index/types.js";
import type { DocEntry } from "../adapter/types.js";

export function formatHits(hits: SearchHit[]): string {
  if (hits.length === 0) return "No component matches. Try other words, or call get_recipe to compose one.";
  return hits
    .map((h) => `- ${h.name} — ${h.why}${h.deprecated !== undefined ? ` (deprecated: ${h.deprecated})` : ""}`)
    .join("\n");
}

const cell = (s: string | undefined) => (s ?? "").replace(/\|/g, "\\|").replace(/\s*\r?\n\s*/g, " ");

const deprecation = (d: string) => (d ? `Deprecated: ${d}` : "Deprecated.");

export function formatComponent(c: ComponentEntry, example?: string): string {
  const out: string[] = [`# ${c.name}`];
  if (c.description) out.push("", c.description);
  if (c.deprecated !== undefined) out.push("", deprecation(c.deprecated));
  out.push("", "## Props");
  if (c.props.length === 0) out.push("", "No props.");
  else {
    out.push("", "| name | type | required | default | description |", "|---|---|---|---|---|");
    for (const p of c.props) {
      const desc =
        p.deprecated !== undefined ? `${deprecation(p.deprecated)} ${p.description ?? ""}`.trim() : p.description;
      out.push(`| ${cell(p.name)} | ${cell(p.type)} | ${p.required ? "yes" : "no"} | ${cell(p.default)} | ${cell(desc)} |`);
    }
  }
  if (c.subcomponents.length > 0) out.push("", `Subcomponents: ${c.subcomponents.join(", ")}`);
  if (c.extendsHtmlAttributes) {
    out.push("", "Also accepts the standard HTML attributes of the underlying element (not listed above).");
  }
  out.push("", "## Example", "");
  if (example) out.push(example.trimEnd());
  else {
    const req = c.props.filter((p) => p.required).map((p) => ` ${p.name}={…}`).join("");
    out.push(`<${c.name}${req} />`);
  }
  return out.join("\n");
}

export function formatList(index: KitIndex, category?: string): string {
  const groups = new Map<string, ComponentEntry[]>();
  for (const c of index.components) {
    const cat = c.category ?? "Other";
    if (category && cat.toLowerCase() !== category.toLowerCase()) continue;
    groups.set(cat, [...(groups.get(cat) ?? []), c]);
  }
  if (groups.size === 0) {
    const cats = [...new Set(index.components.map((c) => c.category ?? "Other"))].sort();
    return `No components in category "${category}". Categories: ${cats.join(", ")}.`;
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, items]) => `## ${cat}\n${items.map((c) => `- ${c.name} — ${c.description ?? ""}`.trimEnd()).join("\n")}`)
    .join("\n\n");
}

export function formatDoc(d: DocEntry): string {
  return `# ${d.title}\n\n${d.body.trim()}`;
}

export function formatTokens(tokens: Record<string, unknown>, prefix?: string): string {
  const lines = Object.entries(tokens)
    .filter(([k]) => !prefix || k.startsWith(prefix))
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return lines.length > 0 ? lines.join("\n") : `No tokens match prefix "${prefix ?? ""}".`;
}
