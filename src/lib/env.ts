import "server-only";
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function getPublicServerEnv() {
  return publicEnvSchema.parse(process.env);
}

const privilegedEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getPrivilegedServerEnv() {
  return privilegedEnvSchema.parse(process.env);
}
