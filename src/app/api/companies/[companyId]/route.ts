import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { companyUpdateSchema } from "@/lib/validation/company";

export async function PATCH(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const route = await params;
    const input = companyUpdateSchema.parse({ ...(await request.json()), companyId: route.companyId });
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("companies").update({ name: input.name, website_url: input.websiteUrl || null, industry: input.industry || null, description: input.description || null }).eq("organization_id", input.organizationId).eq("id", input.companyId).select("id,name,website_url,industry,description").single();
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return safeErrorResponse(error); }
}
