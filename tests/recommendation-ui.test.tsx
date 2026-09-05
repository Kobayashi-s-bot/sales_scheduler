import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthlyCalendar } from "@/components/monthly-calendar";
import { RecommendationCard } from "@/components/recommendation-card";

describe("recommendation UI", () => {
  it("shows the recommended date, reason, and evidence URL", () => {
    const html = renderToStaticMarkup(<RecommendationCard recommendation={{ recommended_on: "2027-08-27", reason: "イベントの120日前", status: "pending", evidence: { sourceUrl: "https://example.com/source" } }} />);
    expect(html).toContain("2027-08-27");
    expect(html).toContain("イベントの120日前");
    expect(html).toContain("https://example.com/source");
  });
  it("places a recommendation in the correct monthly calendar day", () => {
    const html = renderToStaticMarkup(<MonthlyCalendar month="2027-08" items={[{ id: "rec-1", recommended_on: "2027-08-27", reason: "クリスマス施策の120日前", companies: { id: "company-1", name: "Example社" } }]} />);
    expect(html).toMatch(/27日<\/h2>[\s\S]*?Example社[\s\S]*?クリスマス施策の120日前[\s\S]*?<\/article>/);
    expect(html).toContain("Example社");
    expect(html).toContain("クリスマス施策の120日前");
  });
});
