import path from "node:path";
import { loadAdapter } from "../adapter/load.js";
import type { LoadedAdapter } from "../adapter/types.js";
import { loadOrBuildIndex } from "../index/build.js";
import type { KitIndex } from "../index/types.js";
import { createComponentSearch } from "../search/components.js";

export interface ServerContext {
  adapter: LoadedAdapter;
  projectDir: string;
  index: KitIndex;
  search: ReturnType<typeof createComponentSearch>;
}

export async function buildContext(adapterDir: string, projectDir: string): Promise<ServerContext> {
  const resolvedProject = path.resolve(projectDir);
  const adapter = await loadAdapter(path.resolve(adapterDir));
  const index = loadOrBuildIndex(adapter, resolvedProject);
  const search = createComponentSearch(index, adapter.synonyms);
  return { adapter, projectDir: resolvedProject, index, search };
}
