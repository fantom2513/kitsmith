import MiniSearch from "minisearch";
import type { KitIndex } from "../index/types.js";

export interface SearchHit {
  name: string;
  score: number;
  why: string;
  deprecated?: string;
}

const DEPRECATED_FACTOR = 0.3;
const EXACT_NAME_BONUS = 2;
const MAX_WHY = 120;

const clip = (s: string) => (s.length > MAX_WHY ? `${s.slice(0, MAX_WHY - 1)}…` : s);

export function createComponentSearch(index: KitIndex, synonyms: Record<string, string[]>) {
  const docs = index.components.map((c) => ({
    id: c.name,
    name: c.name,
    synonyms: (synonyms[c.name] ?? []).join(" "),
    description: c.description ?? "",
  }));
  const byName = new Map(index.components.map((c) => [c.name, c]));
  const mini = new MiniSearch({
    fields: ["name", "synonyms", "description"],
    storeFields: [],
  });
  mini.addAll(docs);

  return {
    find(query: string, limit = 5): SearchHit[] {
      if (!query.trim()) return [];
      const results = mini.search(query, {
        boost: { name: 3, synonyms: 2, description: 1 },
        fuzzy: 0.2,
        prefix: true,
      });
      const hits = results.map((r): SearchHit => {
        const comp = byName.get(String(r.id))!;
        const syn = (synonyms[comp.name] ?? []).find((s) =>
          Object.entries(r.match).some(([t, fields]) => fields.includes("synonyms") && s.toLowerCase().includes(t)),
        );
        const why = syn ? `matches synonym "${syn}"` : comp.description ?? comp.name;
        const hit: SearchHit = {
          name: comp.name,
          score:
            r.score *
            (comp.deprecated !== undefined ? DEPRECATED_FACTOR : 1) *
            (comp.name.toLowerCase() === query.trim().toLowerCase() ? EXACT_NAME_BONUS : 1),
          why: clip(why),
        };
        if (comp.deprecated !== undefined) hit.deprecated = comp.deprecated;
        return hit;
      });
      return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  };
}
