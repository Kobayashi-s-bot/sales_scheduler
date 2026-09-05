import { describe, expect, it } from "vitest";
import { addCalendarDays, calculateRecommendations, type TimingEvent, type TimingRule } from "@/lib/recommendations/engine";

const event: TimingEvent = { id: "event-1", eventType: "exhibition", occurredOn: "2026-01-31", title: "展示会", sourceUrl: "https://example.com/news" };
const rule: TimingRule = { id: "rule-1", name: "展示会事前営業", enabled: true, configuration: { eventType: "exhibition", leadDays: 30, cooldownDays: 14 } };

describe("sales timing recommendation engine", () => {
  it("recommends Christmas preparation 120 days before the event", () => {
    const [result] = calculateRecommendations([{ ...event, occurredOn: "2027-12-25" }], [{ ...rule, configuration: { eventType: event.eventType, leadDays: 120 } }], []);
    expect(result.recommendedOn).toBe("2027-08-27");
    expect(result.reason).toContain("120日前");
    expect(result.evidence.leadDays).toBe(120);
    expect(result.evidence).not.toHaveProperty("offsetDays");
  });
  it.each([
    ["2024-03-01", 1, "2024-02-29"],
    ["2025-03-01", 1, "2025-02-28"],
    ["2027-01-01", 1, "2026-12-31"],
    ["2027-12-25", 0, "2027-12-25"],
  ])("subtracts lead time across boundaries: %s", (date, leadDays, expected) => {
    expect(calculateRecommendations([{ ...event, occurredOn: date }], [{ ...rule, configuration: { eventType: event.eventType, leadDays } }], [])[0].recommendedOn).toBe(expected);
  });
  it("keeps the event-based date when cooldown expires earlier", () => {
    expect(calculateRecommendations([event], [rule], [{ id: "old", occurredOn: "2025-12-01", activityType: "approach" }])[0].recommendedOn).toBe("2026-01-01");
  });
  it("calculates a recommendation with an explainable evidence trail", () => {
    const [result] = calculateRecommendations([event], [rule], []);
    expect(result.recommendedOn).toBe("2026-01-01");
    expect(result.reason).toContain("展示会事前営業");
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
    const [result] = calculateRecommendations([event], [{ ...rule, configuration: { eventType: "exhibition", leadDays: 60, cooldownDays: 0 } }], []);
    expect(result.recommendedOn).toBe("2025-12-02");
  });
  it("respects the latest sales activity cooldown", () => {
    const [result] = calculateRecommendations([event], [rule], [{ id: "activity-1", occurredOn: "2026-03-10", activityType: "approach" }]);
    expect(result.recommendedOn).toBe("2026-03-24");
    expect(result.evidence.latestActivityId).toBe("activity-1");
  });
  it("ignores disabled and non-matching rules", () => {
    expect(calculateRecommendations([event], [{ ...rule, enabled: false }, { ...rule, id: "other", configuration: { eventType: "hiring", leadDays: 1 } }], [])).toEqual([]);
  });
});
