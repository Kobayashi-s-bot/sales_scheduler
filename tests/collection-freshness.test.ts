import { describe, expect, it } from "vitest";
import { contentHash, hasContentChanged, isDue, nextCheckAt } from "@/lib/collection/freshness";

describe("collection freshness", () => {
  it("detects an update at the same URL by content hash", async () => {
    const before = await contentHash("original");
    const unchanged = await contentHash("original");
    const after = await contentHash("updated");
    expect(hasContentChanged(before, unchanged)).toBe(false);
    expect(hasContentChanged(before, after)).toBe(true);
  });

  it("calculates and evaluates next_check_at", () => {
    expect(nextCheckAt(new Date("2027-01-01T00:00:00Z"), 60)).toBe("2027-01-01T01:00:00.000Z");
    expect(isDue("2027-01-01T01:00:00Z", new Date("2027-01-01T01:00:00Z"))).toBe(true);
    expect(isDue("2027-01-01T01:00:01Z", new Date("2027-01-01T01:00:00Z"))).toBe(false);
  });
});
