import { describe, expect, it } from "vitest";
import { addCalendarDays, calculateRecommendations, type TimingEvent, type TimingRule } from "@/lib/recommendations/engine";

const event: TimingEvent = { id: "event-1", eventType: "funding", occurredOn: "2026-01-31", title: "資金調達", sourceUrl: "https://example.com/news" };
const rule: TimingRule = { id: "rule-1", name: "資金調達後フォロー", enabled: true, configuration: { eventType: "funding", offsetDays: 30, cooldownDays: 14 } };

describe("sales timing recommendation engine", () => {
  it("calculates a recommendation with an explainable evidence trail", () => {
    const [result] = calculateRecommendations([event], [rule], []);
    expect(result.recommendedOn).toBe("2026-03-02");
    expect(result.reason).toContain("資金調達後フォロー");
    expect(result.evidence.sourceUrl).toBe("https://example.com/news");
  });
  it("handles month, year, and leap-day boundaries in UTC", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2024-12-31", 1)).toBe("2025-01-01");
  });
  it("does not recommend when the event date is unknown", () => {
    expect(calculateRecommendations([{ ...event, occurredOn: null }], [rule], [])).toEqual([]);
  });
  it("deduplicates the same event ID", () => {
    expect(calculateRecommendations([event, event], [rule], [])).toHaveLength(1);
  });
  it("reflects rule changes without code changes", () => {
    const [result] = calculateRecommendations([event], [{ ...rule, configuration: { eventType: "funding", offsetDays: 60, cooldownDays: 0 } }], []);
    expect(result.recommendedOn).toBe("2026-04-01");
  });
  it("respects the latest sales activity cooldown", () => {
    const [result] = calculateRecommendations([event], [rule], [{ id: "activity-1", occurredOn: "2026-03-10", activityType: "approach" }]);
    expect(result.recommendedOn).toBe("2026-03-24");
    expect(result.evidence.latestActivityId).toBe("activity-1");
  });
  it("ignores disabled and non-matching rules", () => {
    expect(calculateRecommendations([event], [{ ...rule, enabled: false }, { ...rule, id: "other", configuration: { eventType: "hiring", offsetDays: 1 } }], [])).toEqual([]);
  });
});
