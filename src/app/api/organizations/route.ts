import { requireUser } from "@/lib/auth/server";
import { safeErrorResponse } from "@/lib/http/errors";
import { organizationInputSchema } from "@/lib/validation/organization";

export async function POST(request: Request) {
  try {
    const input = organizationInputSchema.parse(await request.json());
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("create_organization", { organization_name: input.name });
    if (error) throw error;
    return Response.json({ data: { id: data } }, { status: 201 });
  } catch (error) { return safeErrorResponse(error); }
}
