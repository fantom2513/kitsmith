import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
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
