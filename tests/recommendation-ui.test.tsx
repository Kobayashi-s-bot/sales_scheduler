import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthlyCalendar } from "@/components/monthly-calendar";
import { RecommendationCard } from "@/components/recommendation-card";

describe("recommendation UI", () => {
  it("shows the recommended date, reason, and evidence URL", () => {
    const html = renderToStaticMarkup(<RecommendationCard recommendation={{ recommended_on: "2026-09-15", reason: "イベントから30日後", status: "pending", evidence: { sourceUrl: "https://example.com/source" } }} />);
    expect(html).toContain("2026-09-15");
    expect(html).toContain("イベントから30日後");
    expect(html).toContain("https://example.com/source");
  });
  it("places a recommendation in the correct monthly calendar day", () => {
    const html = renderToStaticMarkup(<MonthlyCalendar month="2026-09" items={[{ id: "rec-1", recommended_on: "2026-09-15", reason: "フォロー", companies: { id: "company-1", name: "Example社" } }]} />);
    expect(html).toContain("15日");
    expect(html).toContain("Example社");
    expect(html).toContain("フォロー");
  });
});
