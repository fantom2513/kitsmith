# kitsmith

A kit-agnostic MCP server and CLI that makes coding agents build UI from a
specific React component kit instead of hand-rolling it.

Agents are bad at building on a given kit in three ways:

1. **They don't reach for the kit.** Left alone, an agent writes something "in
   the style of" the kit, for example a segmented control rebuilt from a row of
   `Button`s while the kit ships `Segmented`.
2. **When they do use it, they get props wrong:** invented props, wrong value
   types, deprecated API.
3. **They don't compose.** When no ready-made component exists, they write from
   scratch instead of composing kit primitives.

kitsmith gives any MCP-capable agent host (Claude Code, Codex, OpenCode, Cursor,
...) tools to find the right component by intent, read its exact props, follow
composition recipes, and validate the result. Kit-specific knowledge lives in a
per-kit **adapter**; the core knows nothing about any concrete kit. The first
adapter is for [Ant Design](https://ant.design) (antd 6).

Everything runs locally. No network calls at runtime, no telemetry.

## The decision ladder

Every UI need is resolved in this order. The rule is repeated in the server
instructions, in tool descriptions and in the generated `AGENTS.md`.

1. An existing kit component fits: use it.
2. Nothing fits: compose it from kit components (a recipe may exist).
3. Still not covered: use an allowed external library listed in the adapter
   (for example charts or icons).
4. Only then write your own code, and say so.

Hand-rolled code that duplicates case 1 is reported by `validate`. Cases 2-4
are legitimate and are not flagged.

## Quick start

Requires Node 22 or newer. Until the package is published, run it from a clone:

```sh
git clone <this repo> && cd kitsmith
npm install && npm run build
```

### New prototype

```sh
node dist/cli.js new demo --adapter adapters/antd --dir ..
cd ../demo && npm run dev
```

`new` copies a Vite + React + react-router sandbox with the kit installed,
mock-data helpers, `AGENTS.md`, `CLAUDE.md` and `.mcp.json` already wired to
kitsmith. Open the folder in your agent host and describe the screens you want.
The project name must be lowercase and npm-safe. If `npm install` fails, the
project is kept and you are told to run `npm install` yourself (`--no-install`
skips the install step).

### Existing project

```sh
node dist/cli.js init --adapter adapters/antd --project path/to/project
```

`init` adds `.mcp.json`, `AGENTS.md` and `CLAUDE.md`. Existing MCP servers and
your own text are preserved; the kitsmith section is added or replaced
idempotently. The kit must already be installed in the project
(`node_modules/<package>`), otherwise you get a clear "run npm install" error.

### Commands

| Command | What it does |
|---|---|
| `kitsmith new <name> --adapter <dir> [--dir <parent>] [--no-install]` | Create a prototype sandbox |
| `kitsmith init --adapter <dir> [--project <dir>]` | Wire an existing project to kitsmith |
| `kitsmith serve [--adapter <dir>] [--project <dir>]` | Run the MCP server over stdio |
| `kitsmith index --adapter <dir> [--project <dir>] [--rebuild]` | Build or load the component index |
| `kitsmith validate [files...] [--adapter <dir>] [--project <dir>]` | Type-check and detect duplicates |

`--adapter` can be omitted when the project has `.kitsmith/config.json` (written
by `new` and `init`).

`validate` exit codes: `1` when there are findings, `2` when nothing was found
but the check was incomplete (for example a file outside the tsconfig), `0` when
clean and complete.

## MCP tools

Everything is reachable through tools, so no feature depends on MCP resources,
prompts or host-specific skills.

| Tool | Input | Purpose |
|---|---|---|
| `find_component` | `intent: string`, `limit?: number` | Intent and synonym search, ranked, with deprecation flags |
| `get_component` | `name: string` | Exact props, subcomponents and a usage example |
| `list_components` | `category?: string` | Overview of the kit by category |
| `get_recipe` | `intent: string` | Composition of kit components for an intent |
| `get_guidelines` | `topic?: string` | Usage guidelines; lists topics when omitted |
| `get_tokens` | `prefix?: string` | Design tokens as `key: value` lines |
| `validate` | `files?: string[]` | `tsc` against the real kit types plus the duplicate detector |

Search understands adapter synonyms, including non-English ones
(for example "переключатель" finds `Segmented` in the antd adapter).

## Writing an adapter

An adapter is a directory with a `kit.config.ts` plus optional content. It is
loaded by filesystem path, so it can live anywhere; built-in ones are in
`adapters/`. All relative paths resolve against the adapter directory.

```ts
// adapters/antd/kit.config.ts imports the types from src/adapter/types
import type { AdapterConfig } from "../../src/adapter/types.js";

const config: AdapterConfig = {
  name: "antd",
  package: "antd",                 // npm package of the kit
  typesEntry: "es/index.d.ts",     // relative to the package dir
  deprecated: { source: "jsdoc" }, // extra?: string[] marks more components deprecated
  descriptions: "descriptions.yaml", // { [Component]: { description, category } }
  synonyms: "synonyms.yaml",         // { [Component]: string[] }
  detectorRules: "detector-rules.ts",
  tokens: "tokens.ts",
  recipes: "recipes",              // dir of .md files with frontmatter
  guidelines: "guidelines",        // dir of .md files with frontmatter
  examples: "examples",            // dir of <Component>.tsx usage examples
  allowedExternal: ["@ant-design/charts", "@ant-design/icons"],
  sandbox: {
    overlay: "sandbox",            // files laid over templates/sandbox
    dependencies: { antd: "^6.6.8", "@ant-design/icons": "^6" },
  },
};
export default config;
```

Only `name`, `package` and `typesEntry` are required.

### Recipes and guidelines

Markdown files with frontmatter; the body is served as-is.

```md
---
title: Filter bar
intents: ["filter bar", "search and filter"]
components: [Space, Input, Select, Segmented, Button]
---
Use above a list or table to narrow results...
```

### Detector rules

`detectorRules` is a module whose default export is a factory that receives the
rule helpers and returns rules:

```ts
export default function rules(h: RuleHelpers): DetectorRule[];

interface DetectorRule {
  id: string;
  suggest: string;      // the kit component to use instead
  description: string;
  rule: Rule.RuleModule; // a regular ESLint rule
}
```

Helpers (`RuleHelpers`, from `src/validate/rule-helpers.ts`):

| Helper | Returns |
|---|---|
| `jsxName(node)` | `"button"`, `"Button"` or `"Input.TextArea"` |
| `isIntrinsic(node)` | true for lowercase host elements |
| `importSource(context, localName)` | module a local identifier was imported from |
| `isKitElement(context, node)` | element comes from the kit package |
| `isAllowedExternal(context, node)` | element comes from an `allowedExternal` package |
| `getAttr(node, name)` | the JSX attribute, if present |
| `childElements(node)` | direct JSX element children as opening elements |
| `attrExpressionType(node, name)` | ESTree type of the attribute value |
| `styleKeys(node)` | keys of an inline `style={{ ... }}` object |

Rules should stay quiet on legitimate composition and on allowed external
libraries; ship negative fixtures for every rule.

### Tokens

`tokens` is a module whose default export receives `{ projectDir,
requireFromProject }` and resolves to a plain object of design tokens.

## Status

v1 core is implemented: index, intent search, the seven tools, `validate`,
duplicate detector, sandbox, `init` and `new`, with the antd adapter.

Verified automatically: unit and integration test suite; a fresh antd prototype
created with `new` installs, builds, and passes `validate` with no problems; an
MCP client lists all seven tools from `serve`, and `find_component` resolves a
Russian-language intent.

Pending: a manual check with real agent hosts (Claude Code, Codex, OpenCode)
on a prompt such as "an orders page with a status filter as a segmented
control, a table and a KPI row".

## Roadmap

- Second open kit (MUI or Mantine) as proof of kit-agnosticism, plus a
  published benchmark: agent without kitsmith vs with kitsmith across hosts and
  models (type-check pass rate, invented props, hand-rolled duplicates,
  kit-usage ratio).
- Stage 2, design reasoning: design standards, a self-critique pass, and
  several reasoned variants per request.
- Figma layer: map a design tree to kit components, report gaps instead of
  silently hand-rolling.

## License

MIT. Component descriptions in the antd adapter are adapted from the Ant Design
documentation (MIT).
