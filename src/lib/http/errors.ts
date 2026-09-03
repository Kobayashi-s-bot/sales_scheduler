import { ZodError } from "zod";
import { AccessDeniedError } from "@/lib/auth/access";

export function safeErrorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: "Invalid request", issues: error.issues.map(({ path, code }) => ({ path, code })) }, { status: 400 });
  if (error instanceof AccessDeniedError) return Response.json({ error: error.message }, { status: error.message === "Authentication required" ? 401 : 403 });
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
