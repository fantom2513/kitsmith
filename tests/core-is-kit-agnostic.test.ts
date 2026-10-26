import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe("core is kit-agnostic", () => {
  it("src/ mentions no concrete kit", () => {
    const src = path.resolve(import.meta.dirname, "../src");
    const offenders = walk(src).filter((f) =>
      /\bantd\b|ant-design|mini-kit/i.test(fs.readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
