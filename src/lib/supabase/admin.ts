import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPrivilegedServerEnv } from "@/lib/env";

/** Use only for narrowly reviewed administrative jobs. User-facing requests must use the RLS client. */
export function createSupabaseAdminClient() {
  const env = getPrivilegedServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
