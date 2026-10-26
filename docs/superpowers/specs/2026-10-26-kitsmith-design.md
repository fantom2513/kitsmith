# kitsmith — design

Date: 2026-10-26
Status: draft, awaiting approval

`kitsmith` is a working name (builder's call, easy to change).

## 1. Intent

Coding agents (Claude Code, Codex, OpenCode, Hermes, Cursor, …) are bad at
building UI on a specific React component kit:

1. **They don't reach for the kit.** Without explicit mentions or design
   fragments, the agent hand-rolls something "in the style of" the kit instead
   of using it. Real example: a `Segmented` control rebuilt from a row of
   `Button`s while the kit ships `Segmented`.
2. **When they do use it, they get props wrong** — invented props, wrong
   value types, deprecated API.
3. **They don't compose.** When the kit has no ready-made component (a payout
   amount slider, a 24px checkbox), developers legitimately compose one from kit
   primitives; agents instead write from scratch.

kitsmith is a **kit-agnostic core** that makes any agent build UI from a
given kit first: find the right component by intent, compose from kit
primitives when nothing fits, verify the output, and flag hand-rolled
duplicates. Kit-specific knowledge lives in a per-kit **adapter**.

### Why this shape

- It is a personal open-source project. The first and reference kit is
  **antd** (widely used and close in structure to many in-house kits). A second open
  kit (MUI or Mantine) proves the core is genuinely kit-agnostic.
- The core must be droppable into other environments (including private,
  in-house kits) by writing a new adapter with minimal or no core changes.
  Private adapters, mappings and design standards live outside this repository.
- The deliverable doubles as a portfolio piece, so a measurable benchmark
  ("without kitsmith vs with kitsmith", across agents/models) is a first-class
  part of the project, not an afterthought.

## 2. Users and entry points

| User | Input | Output | Priority |
|---|---|---|---|
| Product manager / designer | Free-text description + reference screenshots | Clickable prototype on the kit | **v1** |
| Designer exploring a hypothesis | Idea + references (references are a skeleton, not a blueprint) | Several reasoned variants | v2 (stage 2) |
| Developer | Figma layout on the design system | Production-grade code on the kit, with gaps reported | v3 (Figma layer) |

v1 assumes whoever runs the prototype path can operate an agent host. A
minimal `kitsmith init` writes the MCP config snippet and the `AGENTS.md` /
`CLAUDE.md` rules for a project; polished setup for non-developers is
deferred. *(assistant's call; author chose not to prioritise this)*

Order rationale: the text+screenshots path can be fully built and tested at
home on antd. Personal Figma plans have tight API limits; the Figma path is
designed now (as an interface) but exercised later, with team Figma plans.

## 3. Maturity stages

**Stage 1 — Translation.** Description + references → the same screen built
from kit components. Button→`Button`, table→`Table`, "toggle between
options"→`Segmented`. No hand-rolled duplicates, no invented props. This is
the v1 demo.

**Stage 2 — Design.** References are intent, not a blueprint ("a reference
rarely fits the product logic; it's a skeleton"). The agent reasons as an
interaction designer against written design standards (page types, action
hierarchy, loading/empty/error states, form behaviour), runs a self-critique
pass against a checklist, and returns **several variants with short
rationales**. Stage 2 is layered on top of stage 1 mechanisms; it does not
replace them.

## 4. Goals, non-goals, anti-goals

**Goals**
- Agent picks the existing kit component for an intent (search by purpose and
  synonyms, not just names).
- Agent composes missing blocks from kit primitives using recipes.
- Generated code type-checks against the real kit types.
- Hand-rolled duplicates of existing kit components are detected and reported
  with the suggested replacement.
- Works in any MCP-capable agent host.
- New kit = new adapter config (+ optional small extractor hooks), no core
  edits.
- Prototype path: a ready sandbox app the agent fills; non-developers don't
  configure anything.
- Benchmark with published numbers.

**Non-goals (for now)**
- Parsing Figma ourselves. The Figma layer consumes output of existing Figma
  tooling (official Figma Dev Mode MCP / REST) through an abstract
  "design tree" interface.
- Pairwise-comparison / heuristic-evaluation service. The author plans it
  separately; kitsmith only leaves an extension point (variants exported with
  metadata).
- Pixel-diff visual regression, screenshot-to-Figma, generating whole apps.
- Hosting/sharing prototypes as public links (open question, see §11).

**Anti-goals (failure even if it "works")**
- Core contains antd-specific logic that a second kit has to work around.
- Behaviour depends on Claude-only features (skills, plugins) to function.
- Any proprietary kit code, names, mappings or design standards in this repo or
  its history.
- The detector flags legitimate composition or allowed external libraries
  (charts, sandboxes) as violations — noisy rules get ignored.

## 5. Decision ladder (the core rule)

Every UI need is resolved in this order; the rule is stated in server
instructions, tool descriptions and the `AGENTS.md` template:

1. **Existing kit component** fits → use it.
2. **Compose from kit primitives** (recipe if available).
3. **Allowed external library** listed in the adapter (e.g. charts).
4. **Own code**, only as a last resort, and reported as such.

Hand-rolled code duplicating case 1 is a violation. Cases 2–4 are legitimate.

## 6. Architecture

```
agent host (Claude Code / Codex / OpenCode / Hermes / Cursor …)
   │  MCP (stdio), tools only as the common denominator
   ▼
kitsmith MCP server ── core ───────────────────────────────┐
   │   index (components, props, docs, deprecations)        │
   │   intent search                                        │
   │   recipes + guidelines (served via tools)              │
   │   validate (tsc + eslint + duplicate detector)         │
   │   design-tree resolver (Figma layer, v3)               │
   └────────────────────────────────────────────────────────┘
   ▲ loads
kit adapter (antd | mui | <private, outside this repo>)
   config, synonyms, detector rules, recipes, guidelines,
   allowed external libs, design-token mapping
```

### 6.1 Host-agnostic delivery

Only **tools** are reliably supported across MCP hosts; server instructions,
resources and prompts are uneven. Therefore:

- All functionality is reachable through tools. Guidelines and recipes are
  returned by tools, not exposed only as MCP resources.
- The decision ladder is repeated in: MCP server instructions, every relevant
  tool description, an `AGENTS.md` template (read by Codex, OpenCode and
  others) and a `CLAUDE.md` snippet.
- A Claude Code plugin (server + thin skills) is an optional convenience
  wrapper, never required.

### 6.2 Adapter

A per-kit directory with a config file plus optional hooks and content:

```ts
// adapters/antd/kit.config.ts  (illustrative)
export default {
  name: "antd",
  package: "antd",
  typesEntry: "es/index.d.ts",
  deprecated: { source: "jsdoc" },          // or explicit list
  docs: ["node_modules/antd/es/**/index.en-US.md"], // descriptions for search
  synonyms: "./synonyms.yaml",              // "toggle group" → Segmented
  detectorRules: "./detector-rules.ts",
  recipes: "./recipes/",
  guidelines: "./guidelines/",
  tokens: { extractor: "./tokens.ts" },
  allowedExternal: ["@ant-design/charts"],
  sandbox: { theme: "./theme.ts" },
}
```

Exact field names and file formats are the builder's call. Constraint: the
antd and second-kit adapters must not require core changes beyond optional
hooks.

*(assistant's calls)*
- The core defines generic extractor interfaces (docs, tokens, synonyms);
  kit-specific implementations live inside the adapter directory. "No core
  edits" means no kit names or kit-specific branches in core code.
- Adapters are loaded **by filesystem path**. Built-in adapters (antd,
  second kit) live in this repo under `adapters/`; a private adapter lives
  anywhere outside it and is passed by path. This is a requirement from
  step 1.
- Each adapter targets one kit major version (antd: the current major at
  build time); version-specific details (docs layout, deprecations) stay in
  the adapter.

### 6.3 Index

Built offline by a CLI (`kitsmith index`) into a JSON artifact:

- Components and sub-components from the package's exported types (ts-morph).
- Props: name, type (rendered readably), required, default, JSDoc, deprecated.
- Description text from JSDoc and kit docs, plus adapter synonyms — this is the
  search corpus.
- Kit version, so the index can be rebuilt when the kit updates.

Real kits accumulate history (legacy and duplicate components), so
deprecated/legacy marking is important: search must rank them
down and say so.

### 6.4 MCP tools (v1 set)

| Tool | Purpose |
|---|---|
| `find_component(intent)` | Intent/synonym search → ranked components with one-line "why" and deprecation flags |
| `get_component(name)` | Full props, sub-components, minimal usage example |
| `list_components(category?)` | Overview of the kit |
| `get_recipe(intent)` | Composition recipe from kit primitives, if one exists |
| `get_guidelines(topic)` | Design standards (page types, states, action hierarchy); minimal in v1, central in stage 2 |
| `get_tokens()` | Theme tokens (colors, spacing, typography) |
| `validate(files)` | tsc against real kit types + eslint + duplicate detector; returns actionable findings ("hand-rolled segmented control at X:Y → use `Segmented`") |

Exact names and signatures are the builder's call.

`validate` targets a project path (default: the current prototype) and uses
that project's `tsconfig` and installed kit, so it also works on a
developer's real project. The index is built from the kit installed in a
given project's `node_modules` and cached per kit version.
*(assistant's call)*

### 6.5 Duplicate detector

- Mechanism in core (eslint plugin + rule runner); patterns in the adapter.
- Starts with hand-written rules for common cases: button group with an
  "active" state → `Segmented`; styled `div` card → `Card`; custom
  `<input type="checkbox">` → `Checkbox`; etc.
- Respects `allowedExternal` and does not flag composition from kit
  primitives.
- Reports a suggestion, not a hard failure.
- Static analysis only (JSX/AST patterns), no runtime rendering.
  *(assistant's call)*
- First batch: 5–8 rules, each with positive and negative fixtures
  (including "legitimate composition must not fire"). False positives on the
  fixture set must be zero; new false positives found in practice become new
  negative fixtures. *(assistant's call)*

### 6.6 Prototype sandbox (v1)

- A template app: Vite + React + kit + theme + router.
- Agent adds screens and routes; navigation between screens makes it
  clickable.
- Mock data via simple factories so tables/lists/forms look alive.
- Started with one command. Sharing beyond localhost is out of v1 scope.
- Each prototype is its own copy of the template (created by
  `kitsmith new <name> --adapter <path>`), with the kit installed in its own
  `node_modules`. *(assistant's call)*
- Screenshots are read by the host agent's own vision; kitsmith ships no
  screenshot tooling in v1. A render-and-screenshot self-check loop is an
  optional later addition. *(from conversation; later loop is assistant's
  call)*

### 6.7 Figma layer (v3, interface designed now)

- Core accepts an abstract **design tree**: nodes with component name,
  variant properties, text, tokens.
- Sources: official Figma Dev Mode MCP output or Figma REST JSON, converted by
  a small adapter. For home testing: a few saved JSON fixtures from the public
  Ant Design Figma kit (no live API calls).
- Resolver classifies each node:
  1. **mapped** — DS component ↔ kit component (+ prop mapping);
  2. **gap** — DS ahead of kit (new/changed component, renamed token, e.g. font
     names differ): reported to the user with a proposed fallback, never
     silently hand-rolled;
  3. **custom** — designer-made, detached component (e.g. 24px checkbox,
     payout slider): composed via the decision ladder.
- DS↔kit↔token mapping table lives in the adapter. Figma Code Connect is prior
  art for the mapping but requires paid Figma plans and is not a dependency.

## 7. Tech stack (builder's/assistant's call, accepted by the author)

- TypeScript on Node (LTS).
- `@modelcontextprotocol/sdk`, local stdio server.
- ts-morph for type extraction.
- tsc + eslint (custom plugin) for validation.
- Vite + React + react-router for the sandbox.
- Search: simple local text/fuzzy ranking in v1; embeddings optional later and
  local-only (private kits must never send kit data to external services).
- Packaging: one npm package with a CLI (`kitsmith index | new | serve |
  init`) and built-in adapters in `adapters/`; publishing to npm comes later.
  A monorepo split is not needed unless the package grows. *(assistant's
  call)*
- Developed on Windows; must also work on macOS/Linux (path handling).

## 8. Benchmark

- 20–30 tasks of the prototype type ("orders page with filters", "settings
  form", …), each with a short rubric.
- Runs: agent without kitsmith vs with kitsmith; several hosts/models
  (Claude Code, Codex, OpenCode with an open model).
- Metrics: type-check pass rate, invented props count, hand-rolled duplicates
  count, kit-component usage ratio, build success; stage 2 adds rubric scoring.
- Results table goes into the README. Benchmark harness is generic (works with
  any adapter).

*(assistant's calls)*
- The benchmark is step 6, not a v1 gate. It has no pass thresholds; its
  purpose is the before/after comparison.
- To avoid grading kitsmith with its own detector, duplicates and kit-usage
  are counted by a separate, simpler counter (kit imports vs raw DOM elements
  carrying their own styling) plus a manual review of a sample.
- Hosts are driven through their non-interactive CLI modes where available;
  runs are small (each task × 1–3 runs per configuration) to keep API cost
  modest. Exact harness mechanics are the builder's call.

## 9. Delivery order

1. Repo skeleton, adapter config format, antd indexer.
2. MCP tools: find/get/list/tokens + `validate` (tsc).
3. Duplicate detector + first rules.
4. Prototype sandbox template.
5. Second open kit as the kit-agnostic proof.
6. Benchmark + README.
7. Stage 2: guidelines content, self-critique pass, variants.
8. Figma layer (design tree, resolver, fixtures).

Private adapters are built separately, outside this repo.

## 10. Constraints

- Open data only (antd, its public docs and
  Figma kit, general UX practice such as Ant Design guidelines and NN/g).
- License: MIT (assumed; author to confirm).
- Everything runs locally; no telemetry; no external calls with kit data.
- Clean history from scratch; no third-party proprietary code.

## 11. Open questions

- How prototypes are shared with non-developers beyond localhost.
- Whether stage-2 guidelines ship as part of the antd adapter or as a
  kit-independent generic set plus kit overrides.
- Second kit: MUI or Mantine.

## 12. Design quality track (separate, future)

How kitsmith learns a designer's view of "good" and measurably improves what
agents generate. This is a separate track kept for the future: it does not
change the stages in §3 or the delivery order in §9, and nothing here is
planned yet. The author is still deciding where exemplar material comes from.

### 12.1 Teaching material, in order of leverage

1. **Exemplar screens as code.** 5–10 well-built pages on the kit per page
   type (list with filters, form, entity details, dashboard, wizard, empty
   states). Agents copy composition, density, action hierarchy and spacing
   far more precisely from code than from images. Adapter content
   (`exemplars/`), served by a tool such as `get_exemplar(page_type)`.
2. **Bad → good pairs with a short annotation.** "All buttons primary" →
   fixed, and why; "form without loading/error states" → fixed. This is how
   taste transfers. Stored next to exemplars.
3. **Critique rubric.** 15–25 checkable items (one primary action per screen;
   loading/empty/error states present; grid alignment; no wall of identical
   cards; consistent label tone). Served by a tool; the agent reviews its own
   screen against it and fixes before finishing.
4. **Render → screenshot → compare loop.** The agent renders the prototype,
   takes a screenshot and checks it with its own vision against the rubric and
   the exemplar's screenshot. Catches what code does not show (overload,
   rhythm, hierarchy). Token-heavy: once or twice at the end, not per edit.
5. **Designer feedback through pairwise comparison.** The agent produces 2–3
   variants; a designer picks one and says why in a sentence. Reasons become
   rubric items and new bad → good pairs. A separate pairwise-comparison
   tool is the natural UI for this; integration stays out of scope here.

Anti-patterns: screenshots as primary teaching material (costly, imprecise);
long prose style guides (followed superficially); rules derived from single
anecdotes instead of benchmark data and designer choices.

Everything stays inside the existing paradigm: adapter content + tools, no
host-specific features. Open antd content lives in this repo; a private
kit's exemplars and rubric live in its adapter outside it.

### 12.2 Reconstruction harness (proposed answer to "where does the code come from")

Designers have screens in Figma; code exemplars are the scarce part. The
harness turns Figma screens into validated code exemplars and doubles as a
benchmark:

```
Figma frame ──export──▶ reference PNG (+ optional node JSON)
      │
      ▼
agent (headless: Claude Code / Codex / OpenCode) + kitsmith MCP
  in a fresh `kitsmith new` prototype, prompt: "reproduce this screen"
      │
      ▼
render (headless browser, same viewport) ──▶ result PNG
      │
      ▼
compare ──▶ score + diff notes ──(≤ N rounds)──▶ back to the agent
      │
      ▼
designer approves ──▶ code + PNG + annotation saved as an exemplar
```

Comparison signals, cheapest first:
- **kitsmith `validate`:** no type errors, no hand-rolled duplicates.
- **Component inventory:** when node JSON is available, Figma component
  instances mapped to kit components vs the kit components actually used
  (precision/recall). Reuses the Figma design-tree resolver from §6.7.
- **Layout similarity:** coarse geometry (regions, alignment, order) from the
  rendered DOM vs Figma frame bounds. Pixel diff is too brittle (fonts,
  antialiasing) to be a primary signal.
- **Vision judge with the rubric:** a model compares the two PNGs and lists
  concrete differences; differences feed the next round, the final verdict
  feeds the score.

The designer's approval is the gate: the harness proposes exemplars, it does
not create them unattended.

Constraints and inputs:
- Figma access: a handful of image exports per frame fits personal-plan API
  limits; manual PNG export works too. Node JSON is optional.
- Calibration on open material first: public antd page templates that exist
  both as rendered pages and as code give known-good pairs to tune the
  comparison before Figma screens are used.
- Private screens and the resulting exemplars never enter this repo.

Open questions for this track:
- Source of the first exemplars: hand-picked open antd pages, Figma
  reconstructions, or both.
- Score thresholds that mean "good enough to show a designer".
- Whether variants (12.1 item 5) are generated inside the harness or only in
  normal use.
