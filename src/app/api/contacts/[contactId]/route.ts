import { requireOrganizationMembership } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { contactUpdateSchema } from "@/lib/validation/contact";

export async function PATCH(request: Request, { params }: { params: Promise<{ contactId: string }> }) {
  try {
    const route = await params;
    const input = contactUpdateSchema.parse({ ...(await request.json()), contactId: route.contactId });
    const { supabase } = await requireOrganizationMembership(input.organizationId);
    const { data, error } = await supabase.from("contacts").update({ full_name: input.fullName || null, department: input.department || null, email: input.email || null, phone: input.phone || null }).eq("organization_id", input.organizationId).eq("company_id", input.companyId).eq("id", input.contactId).select("id,full_name,department,email,phone").single();
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return safeErrorResponse(error); }
}
