import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { recalculateCompanyRecommendations } from "@/lib/recommendations/service";
import { eventInputSchema } from "@/lib/validation/sales";

export async function POST(request: Request) {
  try {
    const input = eventInputSchema.parse(await request.json());
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("events").insert({ organization_id: input.organizationId, company_id: input.companyId, event_type: input.eventType, occurred_on: input.occurredOn, title: input.title, source_url: input.sourceUrl ?? null, summary: input.summary ?? null }).select("id,event_type,occurred_on,title,source_url,summary").single();
    if (error) throw error;
    const recommendations = await recalculateCompanyRecommendations(supabase, input.organizationId, input.companyId);
    return Response.json({ data, recommendations }, { status: 201 });
  } catch (error) { return safeErrorResponse(error); }
}
