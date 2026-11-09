import { describe, expect, it } from "vitest";
import { HeuristicEventAnalyzer, MockEventAnalyzer, toAnalyzerInput } from "@/lib/collection/analyzer";

const document = { url: "https://example.com/news", title: "展示会のお知らせ", content: "2027年5月1日に開催します", publishedAt: "2020-01-01T00:00:00Z" };

describe("EventAnalyzer boundary", () => {
  it("distinguishes publication date from the event date", async () => {
    const [event] = await new HeuristicEventAnalyzer().analyze(document);
    expect(event.eventDate).toBe("2027-05-01");
    expect(document.publishedAt).toBe("2020-01-01T00:00:00Z");
  });

  it("rejects an invalid AI response", async () => {
    await expect(new MockEventAnalyzer([{ eventType: "x", title: "x", summary: "", eventDate: "not-a-date", confidence: 2 }]).analyze(document)).rejects.toThrow();
  });

  it("only sends public document fields and never contact PII", () => {
    const input = toAnalyzerInput({ ...document, full_name: "Private", email: "private@example.com", phone: "000" } as typeof document);
    expect(Object.keys(input)).toEqual(["url", "title", "content", "publishedAt"]);
    expect(JSON.stringify(input)).not.toContain("private@example.com");
  });
});
