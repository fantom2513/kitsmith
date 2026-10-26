import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import MiniSearch from "minisearch";
import type { DocEntry } from "../adapter/types.js";

export function loadDocs(dir: string): DocEntry[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      const slug = path.basename(file, ".md");
      return {
        slug,
        title: typeof data.title === "string" ? data.title : slug,
        intents: Array.isArray(data.intents) ? data.intents.map(String) : [],
        components: Array.isArray(data.components) ? data.components.map(String) : [],
        body: content.trim(),
      };
    });
}

const MIN_COVERAGE = 0.5;
const MIN_TERM_LENGTH = 3;
const STOPWORDS = new Set(["the", "and", "for", "with", "from", "into", "that", "this", "how", "make", "can", "use"]);

function meaningfulTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= MIN_TERM_LENGTH && !STOPWORDS.has(t));
}

function searchDocs(docs: DocEntry[], query: string, fields: string[], boost: Record<string, number>) {
  const terms = meaningfulTerms(query);
  if (terms.length === 0 || docs.length === 0) return undefined;
  const mini = new MiniSearch({ fields });
  mini.addAll(
    docs.map((d) => ({
      id: d.slug,
      title: d.title,
      intents: d.intents.join(" "),
      body: d.body,
    })),
  );
  // OR search, then require that enough of the meaningful query terms matched.
  const best = mini
    .search(terms.join(" "), { boost, fuzzy: 0.2, prefix: true, combineWith: "OR" })
    .find((r) => r.queryTerms.length / terms.length >= MIN_COVERAGE);
  return best ? docs.find((d) => d.slug === best.id) : undefined;
}

export function findRecipe(recipes: DocEntry[], intent: string): DocEntry | undefined {
  return searchDocs(recipes, intent, ["title", "intents"], { title: 2, intents: 3 });
}

export function getGuideline(guidelines: DocEntry[], topic: string): DocEntry | undefined {
  const exact = guidelines.find((g) => g.slug === topic.trim());
  if (exact) return exact;
  return searchDocs(guidelines, topic, ["title", "intents", "body"], { title: 3, intents: 3, body: 1 });
}
