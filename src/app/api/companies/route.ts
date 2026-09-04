import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { companyInputSchema } from "@/lib/validation/company";

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    const parsedOrganizationId = companyInputSchema.shape.organizationId.parse(organizationId);
    const { supabase } = await requireOrganizationMembership(parsedOrganizationId);
    const { data, error } = await supabase.from("companies").select("id,name,website_url,industry,created_at").eq("organization_id", parsedOrganizationId).order("name");
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return safeErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const input = companyInputSchema.parse(await request.json());
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("companies").insert({ organization_id: input.organizationId, name: input.name, website_url: input.websiteUrl ?? null, industry: input.industry ?? null }).select("id,name,website_url,industry,created_at").single();
    if (error) throw error;
    return Response.json({ data }, { status: 201 });
  } catch (error) { return safeErrorResponse(error); }
}
