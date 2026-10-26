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

const MIN_DOC_SCORE = 1;

function searchDocs(docs: DocEntry[], query: string, fields: string[], boost: Record<string, number>) {
  if (!query.trim() || docs.length === 0) return undefined;
  const mini = new MiniSearch({ fields });
  mini.addAll(
    docs.map((d) => ({
      id: d.slug,
      title: d.title,
      intents: d.intents.join(" "),
      body: d.body,
    })),
  );
  const best = mini.search(query, { boost, fuzzy: 0.2, prefix: true })[0];
  if (!best || best.score < MIN_DOC_SCORE) return undefined;
  return docs.find((d) => d.slug === best.id);
}

export function findRecipe(recipes: DocEntry[], intent: string): DocEntry | undefined {
  return searchDocs(recipes, intent, ["title", "intents"], { title: 2, intents: 3 });
}

export function getGuideline(guidelines: DocEntry[], topic: string): DocEntry | undefined {
  const exact = guidelines.find((g) => g.slug === topic.trim());
  if (exact) return exact;
  return searchDocs(guidelines, topic, ["title", "intents", "body"], { title: 3, intents: 3, body: 1 });
}
