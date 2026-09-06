import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { recalculateCompanyRecommendations } from "@/lib/recommendations/service";
import { timingRuleInputSchema } from "@/lib/validation/sales";

export async function POST(request: Request) {
  try {
    const input = timingRuleInputSchema.parse(await request.json());
    const { supabase, membership } = await requireOrganizationMembership(input.organizationId);
    if (membership.role === "member") return Response.json({ error: "Access denied" }, { status: 403 });
    const { data, error } = await supabase.from("scoring_rules").upsert({ organization_id: input.organizationId, name: input.name, rule_type: "event_timing", configuration: input.configuration, enabled: input.enabled }, { onConflict: "organization_id,name" }).select("id,name,configuration,enabled").single();
    if (error) throw error;
    const { data: companies, error: companiesError } = await supabase.from("companies").select("id").eq("organization_id", input.organizationId);
    if (companiesError) throw companiesError;
    await Promise.all((companies ?? []).map((company) => recalculateCompanyRecommendations(supabase, input.organizationId, company.id)));
    return Response.json({ data }, { status: 201 });
  } catch (error) { return safeErrorResponse(error); }
}
