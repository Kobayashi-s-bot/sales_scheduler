import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("recommendation PII boundary", () => {
  it("does not query contacts or use contact PII fields", () => {
    const sources = [
      "src/lib/recommendations/engine.ts",
      "src/lib/recommendations/service.ts",
    ].map((file) => readFileSync(resolve(file), "utf8").toLowerCase()).join("\n");
    expect(sources).not.toContain('from("contacts")');
    expect(sources).not.toMatch(/full_name|department|phone|email/);
  });
});
