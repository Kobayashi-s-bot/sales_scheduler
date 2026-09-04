import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccessDeniedError, requireAuthenticatedUser } from "@/lib/auth/access";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AccessDeniedError("Authentication required");
  return { supabase, user: requireAuthenticatedUser({ id: user.id }) };
}

export async function requireOrganizationMembership(organizationId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("organization_members").select("organization_id,user_id,role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (error || !data) throw new AccessDeniedError();
  return { supabase, user, membership: data };
}
