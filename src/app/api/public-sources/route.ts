import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { publicSourceInputSchema } from "@/lib/validation/public-source";
import { z } from "zod";

const routeSchema = z.object({ companyId: z.uuid() });

export async function POST(request: Request) {
  try {
    const { organizationId, ...fields } = (await request.json()) as Record<string, unknown>;
    const input = publicSourceInputSchema.parse(fields);
    const { supabase, membership } = await requireOrganizationMembership(z.uuid().parse(organizationId));
    const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", input.companyId).eq("organization_id", membership.organization_id).maybeSingle();
    if (companyError) throw companyError;
    if (!company) return Response.json({ error: "Not found" }, { status: 404 });
    const { data, error } = await supabase.from("public_sources").insert({ organization_id: membership.organization_id, company_id: input.companyId, source_url: input.sourceUrl, source_type: input.sourceType }).select("id,company_id,source_url,source_type,last_checked_at,last_error,created_at").single();
    if (error?.code === "23505") return Response.json({ error: "Conflict" }, { status: 409 });
    if (error) throw error;
    return Response.json({ data }, { status: 201 });
  } catch (error) { return safeErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const input = routeSchema.extend({ id: z.uuid(), organizationId: z.uuid() }).parse({ id: url.searchParams.get("id"), companyId: url.searchParams.get("companyId"), organizationId: url.searchParams.get("organizationId") });
    const { supabase, membership } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("public_sources").delete().eq("id", input.id).eq("organization_id", membership.organization_id).eq("company_id", input.companyId).select("id");
    if (error) throw error;
    if (!data?.length) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) { return safeErrorResponse(error); }
}
