import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { contactInputSchema } from "@/lib/validation/contact";

export async function POST(request: Request) {
  try {
    const input = contactInputSchema.parse(await request.json());
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("contacts").insert({ organization_id: input.organizationId, company_id: input.companyId, full_name: input.fullName || null, department: input.department || null, email: input.email || null, phone: input.phone || null }).select("id,full_name,department,email,phone").single();
    if (error) throw error;
    return Response.json({ data }, { status: 201 });
  } catch (error) { return safeErrorResponse(error); }
}
