import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { HtmlSourceAdapter, RssSourceAdapter } from "@/lib/collection/adapters";
import { HeuristicEventAnalyzer } from "@/lib/collection/analyzer";
import { collectPublicSource } from "@/lib/collection/service";
import { assertPublicHttpsUrl } from "@/lib/collection/policy";
import { collectSourceInputSchema } from "@/lib/validation/collection";
import { recalculateCompanyRecommendations } from "@/lib/recommendations/service";

export async function POST(request: Request) {
  try {
    const input = collectSourceInputSchema.parse(await request.json());
    assertPublicHttpsUrl(input.sourceUrl);
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const adapter = input.sourceType === "rss" ? new RssSourceAdapter() : new HtmlSourceAdapter();
    const result = await collectPublicSource({ supabase, organizationId: input.organizationId, companyId: input.companyId, config: { url: input.sourceUrl, type: input.sourceType, refreshIntervalMinutes: input.refreshIntervalMinutes }, adapter, analyzer: new HeuristicEventAnalyzer() });
    await recalculateCompanyRecommendations(supabase, input.organizationId, input.companyId);
    return Response.json({ data: result });
  } catch (error) { return safeErrorResponse(error); }
}
